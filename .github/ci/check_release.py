"""Release check for the Living Uganda website.

This is the gate that runs before anything is pushed to GitHub Pages. It checks
what a public visitor, a search engine and a future editor all depend on:

  structure      required files, doctype, language, charset, viewport
  metadata       one unique title and description per page, canonical, social card
  security       Content-Security-Policy present, no inline script, no third-party script
  links          every local href/src/url() resolves, every #anchor exists
  data           species.json is valid and the homepage numbers match it
  publishing     sitemap and robots agree with the pages, 404 page present
  hygiene        no preview banners, no local paths, no secrets, UTF-8, sane file sizes

Usage (from anywhere):
    python Living-Uganda-Website/inventory/check_release.py
    python Living-Uganda-Website/inventory/check_release.py --site path/to/site

Exit code 0 = ready to publish, 1 = errors found. Warnings do not block.
Only the standard library is used, so it runs unchanged in GitHub Actions.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

BASE = "https://arsenebaguma0-ux.github.io/living-uganda/"

# Pages published on purpose without an index instruction (drafts, redirects, error page).
EXPECTED_NOINDEX = {
    "404.html",
    "catalogue.html",
    "connections.html",
    "species-bird.html",
    "species-fungus.html",
    "species-insect.html",
    "species-mammal.html",
    "species-plant.html",
}

REQUIRED_FILES = [
    "index.html",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    ".nojekyll",
    "README.md",
    "LICENSE",
    "assets/favicon.svg",
    "assets/images/social-card.jpg",
    "data/species.json",
]

SECRET_PATTERNS = [
    (r"ghp_[A-Za-z0-9]{20,}", "GitHub personal access token"),
    (r"github_pat_[A-Za-z0-9_]{20,}", "GitHub fine-grained token"),
    (r"sk-[A-Za-z0-9]{20,}", "OpenAI-style secret key"),
    (r"AIza[0-9A-Za-z_\-]{30,}", "Google API key"),
    (r"AKIA[0-9A-Z]{16}", "AWS access key id"),
    (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "private key block"),
    (r"xox[baprs]-[A-Za-z0-9-]{10,}", "Slack token"),
]

TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".md", ".txt", ".xml", ".svg"}


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, where: str, msg: str) -> None:
        self.errors.append(f"{where}: {msg}" if where else msg)

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"{where}: {msg}" if where else msg)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def head_of(text: str) -> str:
    m = re.search(r"<head[^>]*>(.*?)</head>", text, re.S | re.I)
    return m.group(1) if m else ""


def attr(html: str, pattern: str) -> str | None:
    m = re.search(pattern, html, re.I | re.S)
    return m.group(1).strip() if m else None


def check_pages(site: Path, pages: list[Path], rep: Report) -> dict[str, str]:
    """Per-page structure, metadata, security and hygiene checks."""
    texts: dict[str, str] = {}
    titles: Counter[str] = Counter()
    descriptions: Counter[str] = Counter()

    for p in pages:
        name = p.name
        raw = p.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf"):
            rep.warn(name, "file starts with a UTF-8 BOM; save as UTF-8 without BOM")
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            rep.error(name, f"not valid UTF-8 ({exc})")
            continue
        texts[name] = text
        head = head_of(text)

        if not re.match(r"\s*<!doctype html>", text, re.I):
            rep.error(name, "missing <!doctype html>")
        if not re.search(r'<html[^>]*\blang="[a-z]{2}', text, re.I):
            rep.error(name, '<html> needs a lang attribute (e.g. lang="en")')
        if not re.search(r'<meta charset="utf-8">', head, re.I):
            rep.error(name, "missing <meta charset=\"utf-8\">")
        if not re.search(r'<meta name="viewport"', head, re.I):
            rep.error(name, "missing viewport meta tag")

        # ---- title / description
        title = attr(head, r"<title>(.*?)</title>")
        if not title:
            rep.error(name, "no <title>")
        else:
            title = re.sub(r"\s+", " ", title)
            titles[title] += 1
            if "preview" in title.lower():
                rep.error(name, f'title still says preview: "{title}"')
            if not (15 <= len(title) <= 75):
                rep.warn(name, f"title is {len(title)} characters (aim for 15-75): {title}")

        desc = attr(head, r'<meta name="description" content="([^"]*)"')
        if not desc:
            rep.error(name, "no meta description")
        else:
            descriptions[desc] += 1
            if name not in EXPECTED_NOINDEX and not (60 <= len(desc) <= 185):
                rep.warn(name, f"description is {len(desc)} characters (aim for 60-185)")
            if "layout preview" in desc.lower():
                rep.error(name, "description is still the design-preview text")

        # ---- robots / canonical
        robots = attr(head, r'<meta name="robots" content="([^"]*)"')
        if robots is None:
            rep.error(name, "no robots meta tag")
            robots = ""
        indexable = robots.lower().startswith("index")
        if name in EXPECTED_NOINDEX and indexable:
            rep.error(name, "draft/redirect page must stay noindex")
        if name not in EXPECTED_NOINDEX and not indexable:
            rep.error(name, "published page is set to noindex and cannot be found by search engines")

        canonical = attr(head, r'<link rel="canonical" href="([^"]+)"')
        if not canonical:
            rep.error(name, "no canonical link")
        elif not canonical.startswith(BASE):
            rep.error(name, f"canonical is not under {BASE}: {canonical}")

        for prop in ("og:title", "og:description", "og:image", "og:url", "og:type"):
            if not re.search(rf'<meta property="{prop}"', head):
                rep.error(name, f"missing {prop} (link previews will be blank)")
        if not re.search(r'<meta name="twitter:card"', head):
            rep.warn(name, "missing twitter:card (X/Twitter previews will be plain)")

        meta_names = [n.lower() for n in re.findall(r'<meta (?:name|property|http-equiv)="([^"]+)"', head)]
        meta_dupes = sorted(n for n, c in Counter(meta_names).items() if c > 1)
        if meta_dupes:
            rep.error(name, f"duplicate meta tags: {', '.join(meta_dupes)}")

        # ---- security
        csp = attr(head, r'<meta http-equiv="Content-Security-Policy" content="([^"]*)"')
        if not csp:
            rep.error(name, "no Content-Security-Policy meta tag")
        else:
            for needed in ("default-src 'self'", "script-src 'self'", "object-src 'none'"):
                if needed not in csp:
                    rep.error(name, f"CSP is missing {needed}")
        if not re.search(r'<meta name="referrer"', head):
            rep.warn(name, "no referrer policy meta tag")

        inline_scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", text, re.S | re.I)
        for s in inline_scripts:
            if s.strip():
                rep.error(name, "inline <script> found; move it to assets/ so script-src 'self' holds")

        remote = re.findall(r'<(?:script|link|iframe)[^>]+(?:src|href)="(https?://[^"]+)"', text, re.I)
        for url in remote:
            if "fonts.googleapis" in url or "cdn" in url or "google-analytics" in url:
                rep.error(name, f"third-party runtime dependency: {url}")

        # ---- structure / accessibility
        if not re.search(r"<h1\b", text, re.I):
            rep.error(name, "no <h1>")
        if len(re.findall(r"<h1\b", text, re.I)) > 1:
            rep.warn(name, "more than one <h1>")
        ids = re.findall(r'\sid="([^"]+)"', text)
        dupes = [i for i, n in Counter(ids).items() if n > 1]
        if dupes:
            rep.error(name, f"duplicate id attributes: {', '.join(sorted(dupes))}")
        for img in re.findall(r"<img\b[^>]*>", text, re.I):
            if "alt=" not in img.lower():
                rep.error(name, f"image without alt text: {img[:90]}")
        for a in re.findall(r"<a\b[^>]*target=\"_blank\"[^>]*>", text, re.I):
            if "noopener" not in a.lower():
                rep.warn(name, "target=_blank link without rel=noopener")

        # ---- hygiene strings
        for bad, why in [
            ("DESIGN PREVIEW", "design-preview ribbon still on the page"),
            ("Local preview", "local-preview wording still on the page"),
            ("Preliminary edition · October 2026", "footer edition date is out of date"),
            ("About this preview", "preview wording in a heading"),
            ("file:///", "local file path in published HTML"),
        ]:
            if bad in text:
                rep.error(name, why)
        for bad in ("localhost", "127.0.0.1"):
            if bad in text:
                rep.warn(name, f"development address in published HTML: {bad}")
        if re.search(r"[A-Za-z]:\\\\Users", text):
            rep.error(name, "absolute Windows path in published HTML")

    for title, n in titles.items():
        if n > 1:
            rep.error("titles", f"{n} pages share the title: {title}")
    for desc, n in descriptions.items():
        if n > 1:
            rep.error("descriptions", f"{n} pages share the same description")

    return texts


def check_links(site: Path, texts: dict[str, str], rep: Report) -> None:
    ids: dict[str, set[str]] = {
        name: set(re.findall(r'\sid="([^"]+)"', text)) for name, text in texts.items()
    }
    css_refs = [
        (css.relative_to(site).as_posix(), re.findall(r'url\(["\']?([^"\')]+)["\']?\)', read(css)))
        for css in site.rglob("*.css")
    ]
    for name, text in texts.items():
        refs = re.findall(r'(?:href|src)="([^"]*)"', text)
        for ref in refs:
            if not ref or ref.startswith(("#", "mailto:", "tel:", "data:")):
                continue
            if ref.startswith("//"):
                rep.error(name, f"protocol-relative URL: {ref}")
                continue
            if re.match(r"^[a-z]+:", ref, re.I):
                if ref.lower().startswith("http://") and "creativecommons.org" not in ref:
                    rep.warn(name, f"insecure http link: {ref}")
                if re.search(r"\s", ref):
                    rep.error(name, f"URL contains a space: {ref}")
                continue
            target, _, frag = ref.partition("#")
            cleaned = target.split("?")[0]
            if cleaned.startswith("/"):
                # root-absolute URLs (used by 404.html, which is served at any depth)
                if not cleaned.startswith("/living-uganda/"):
                    rep.error(name, f"root-absolute link outside the site base: {ref}")
                    continue
                path = site / cleaned[len("/living-uganda/"):]
            else:
                path = (site / name).parent / cleaned
            if not path.exists():
                rep.error(name, f"broken internal link: {ref}")
                continue
            if frag and target.endswith((".html", "")) and path.suffix == ".html":
                target_name = path.name
                if target_name in ids and frag not in ids[target_name]:
                    rep.warn(name, f"anchor not found: {ref}")
            elif frag and not target:
                if frag not in ids[name]:
                    rep.error(name, f"broken #anchor on this page: #{frag}")

        # image / font references inside stylesheets
        for css_name, urls in css_refs:
            for u in urls:
                if u.startswith(("data:", "http:", "https:", "#")):
                    continue
                if not (site / "assets" / u).exists() and not (site / css_name).parent.joinpath(u).exists():
                    rep.error(css_name, f"stylesheet references a missing file: {u}")

    # images present but never referenced (including og:image / twitter:image)
    used = set()
    for text in texts.values():
        for ref in re.findall(r'(?:src|href)="([^"]+)"', text):
            used.add(ref.split("?")[0].split("#")[0])
        for ref in re.findall(r'content="([^"]+\.(?:jpg|jpeg|png|svg|webp))"', text, re.I):
            used.add(ref.lstrip("/").replace("living-uganda/", "", 1) if ref.startswith("/living-uganda/") else ref)
    for css in site.rglob("*.css"):
        for u in re.findall(r'url\(["\']?([^"\')]+)["\']?\)', read(css)):
            used.add(u.split("?")[0])
    used_names = {Path(u).name for u in used}
    for img in (site / "assets" / "images").glob("*"):
        if img.suffix.lower() in {".jpg", ".jpeg", ".png", ".svg", ".webp"} and img.name not in used_names:
            rep.warn("images", f"not referenced by any page or stylesheet: {img.name}")


def check_data(site: Path, texts: dict[str, str], rep: Report) -> None:
    data_dir = site / "data"
    species_file = data_dir / "species.json"
    try:
        data = json.loads(species_file.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        rep.error("data/species.json", f"cannot be parsed: {exc}")
        return

    records = data.get("records")
    if data.get("schemaVersion") != 1:
        rep.error("data/species.json", "schemaVersion is not 1")
    if not isinstance(records, list) or not records:
        rep.error("data/species.json", "no records array")
        return

    ids = [r.get("id") for r in records]
    keys = [r.get("gbifKey") for r in records]
    if len(set(ids)) != len(ids):
        rep.error("data/species.json", "duplicate record ids")
    if len(set(keys)) != len(keys):
        rep.error("data/species.json", "duplicate gbifKey values")
    for r in records:
        if not r.get("scientificName") or not r.get("group") or not r.get("rank"):
            rep.error("data/species.json", f"record missing scientificName/group/rank: {r.get('id')}")
            break
    if not data.get("sources"):
        rep.error("data/species.json", "no dataset sources for the credits page")

    for f in sorted(data_dir.rglob("*.json")):
        if f == species_file:
            continue
        try:
            json.loads(f.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            rep.error(str(f.relative_to(site)), f"invalid JSON: {exc}")

    # the homepage states its numbers in prose; they must be the real ones
    families = {r.get("taxonomy", {}).get("family") for r in records if r.get("taxonomy", {}).get("family")}
    orders = {r.get("taxonomy", {}).get("order") for r in records if r.get("taxonomy", {}).get("order")}
    common = sum(1 for r in records if r.get("commonName"))
    expected = [len(records), len(families), len(orders), common]
    index = texts.get("index.html", "")
    shown = [int(x.replace(",", "")) for x in re.findall(r'data-to="([\d,]+)"', index)]
    if shown[:4] != expected:
        rep.error(
            "index.html",
            f"headline numbers {shown[:4]} do not match the catalogue {expected} (records, families, orders, common names)",
        )
    for n in re.findall(r"<dd>([\d,]+)</dd>", index):
        if int(n.replace(",", "")) not in (expected + [len({r.get('group') for r in records})]):
            rep.warn("index.html", f"hero/ledger number {n} is not derived from the catalogue")


def check_publishing(site: Path, texts: dict[str, str], rep: Report) -> None:
    sitemap = site / "sitemap.xml"
    try:
        root = ET.parse(sitemap).getroot()
        locs = [e.text.strip() for e in root.iter() if e.tag.endswith("loc") and e.text]
    except Exception as exc:  # noqa: BLE001
        rep.error("sitemap.xml", f"cannot be parsed: {exc}")
        return

    indexable = {n for n, t in texts.items() if re.search(r'<meta name="robots" content="index', t, re.I)}
    expected = {BASE if n == "index.html" else BASE + n for n in indexable}
    listed = set(locs)
    for url in sorted(expected - listed):
        rep.error("sitemap.xml", f"indexable page missing from the sitemap: {url}")
    for url in sorted(listed - expected):
        rep.error("sitemap.xml", f"sitemap lists a page that is not published/indexable: {url}")
    if len(locs) != len(listed):
        rep.error("sitemap.xml", "duplicate URLs")

    robots = site / "robots.txt"
    if not robots.exists():
        rep.error("robots.txt", "missing")
    else:
        text = robots.read_text(encoding="utf-8")
        if f"Sitemap: {BASE}sitemap.xml" not in text:
            rep.error("robots.txt", "does not point at sitemap.xml")
        if "Disallow: /" in text:
            rep.error("robots.txt", "blocks the whole site")

    if "404.html" not in texts:
        rep.error("404.html", "missing; unknown addresses will show GitHub's own error page")
    elif not re.search(r'<meta name="robots" content="noindex', texts["404.html"], re.I):
        rep.warn("404.html", "should be noindex")


def check_hygiene(site: Path, rep: Report) -> None:
    total = 0
    for f in site.rglob("*"):
        if not f.is_file() or ".git" in f.parts:
            continue
        total += 1
        size = f.stat().st_size
        rel = f.relative_to(site).as_posix()
        if size > 50 * 1024 * 1024:
            rep.error(rel, f"{size / 1e6:.1f} MB — too large for a web repository")
        elif size > 8 * 1024 * 1024:
            rep.warn(rel, f"{size / 1e6:.1f} MB — slow on mobile connections")
        if f.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            text = f.read_text(encoding="utf-8-sig", errors="replace")
        except OSError:
            continue
        for pattern, label in SECRET_PATTERNS:
            if re.search(pattern, text):
                rep.error(rel, f"looks like a committed {label}")
        if re.search(r"\bTODO\b|\bFIXME\b", text) and f.suffix.lower() == ".html":
            rep.warn(rel, "TODO/FIXME left in a published page")
    print(f"  files in the published tree: {total}")


def main() -> int:
    default_site = Path(__file__).resolve().parent.parent / "living-uganda-site"
    ap = argparse.ArgumentParser(description="Check the Living Uganda site before publishing.")
    ap.add_argument("--site", type=Path, default=default_site)
    args = ap.parse_args()
    site: Path = args.site.resolve()

    print("Living Uganda — release check")
    print(f"site: {site}")
    if not site.is_dir():
        print("ERROR: site directory not found")
        return 1

    rep = Report()

    for rel in REQUIRED_FILES:
        if not (site / rel).exists():
            rep.error(rel, "required file is missing")

    pages = sorted(site.glob("*.html"))
    print(f"  pages: {len(pages)}")
    texts = check_pages(site, pages, rep)
    print("\n  links and anchors:")
    check_links(site, texts, rep)
    print("  catalogue data:")
    check_data(site, texts, rep)
    print("  publishing files:")
    check_publishing(site, texts, rep)
    print("  hygiene:")
    check_hygiene(site, rep)

    print()
    if rep.errors:
        print(f"ERRORS ({len(rep.errors)}) — must be fixed before publishing")
        for e in rep.errors:
            print("  ✗", e)
    if rep.warnings:
        print(f"\nWARNINGS ({len(rep.warnings)}) — review, not blocking")
        for w in rep.warnings:
            print("  !", w)

    if rep.errors:
        print("\nRESULT: FAIL")
        return 1
    print("\nRESULT: PASS — ready to publish")
    return 0


if __name__ == "__main__":
    sys.exit(main())
