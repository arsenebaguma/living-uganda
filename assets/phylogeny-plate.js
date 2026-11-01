/* Living Uganda — the paper plate phylogeny renderer.
   Mounted into the group page (phylogeny.html) for any group with a plate:
   window.mountPhylogenyPlate(rootElement, data). */
(function () {
  function mount(root, DATA) {
    if (!root || !DATA || !DATA.tree) return;

    const NS = 'http://www.w3.org/2000/svg';
    const svg = root.querySelector('.plate-tree');
    if (!svg) return;
    const g = document.createElementNS(NS, 'g');
    svg.appendChild(g);
    const tip = root.querySelector('.plate-tip');
    const panel = root.querySelector('.plate-panel');
    const panelInner = panel.querySelector('.inner');
    const closeBtn = panel.querySelector('.plate-close');
    const listBox = root.querySelector('.plate-list');

    const L = DATA.layout;
    const nounOne = DATA.noun.one, nounMany = DATA.noun.many;
    const kicker = DATA.noun.one.charAt(0).toUpperCase() + DATA.noun.one.slice(1) + ' · recorded in Uganda';

    const legend = root.querySelector('.plate-legend');
    if (legend) legend.innerHTML = '<i></i>' + nounOne + ' recorded in Uganda &nbsp; ' +
      (DATA.summary && DATA.summary.note
        ? '<span style="color:#9a8a6e">' + DATA.summary.note + '</span>'
        : '<span style="color:#9a8a6e">numerals = ' + nounMany + ' not recorded</span>');

    function el(tag, attrs, text) {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (text != null) e.textContent = text;
      return e;
    }
    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* ---------- model ---------- */
    let uid = 0;
    function build(raw, parent, depth) {
      const n = {
        id: ++uid, name: raw.name || null, count: raw.count || 0,
        meta: raw.meta || '', sample: raw.sample || '', common: raw.common || '',
        items: raw.items || [], note: raw.note || '',
        gap: raw.gap || 0, dropped: raw.dropped || [],
        children: [], parent, depth
      };
      for (const c of (raw.children || [])) n.children.push(build(c, n, depth + 1));
      return n;
    }
    const rootNode = build(DATA.tree, null, 0);
    const leaves = [];
    (function collect(n) { if (n.name) leaves.push(n); else n.children.forEach(collect); })(rootNode);

    let leafIndex = 0;
    (function ywalk(n) {
      if (n.name) { n.y = 40 + leafIndex++ * L.sp; return; }
      n.children.forEach(ywalk);
      n.y = n.children.reduce((a, c) => a + c.y, 0) / n.children.length;
    })(rootNode);
    (function xwalk(n) { n.x = n.parent ? n.parent.x + L.xstep : 0; n.children.forEach(xwalk); })(rootNode);

    /* ---------- draw ---------- */
    const branches = new Map();
    let trigger = null;

    (function draw(n) {
      if (n.parent) {
        const mx = n.parent.x + (n.x - n.parent.x) * 0.5;
        const p = el('path', {
          d: 'M' + n.parent.x + ',' + n.parent.y + ' H' + mx + ' V' + n.y + ' H' + n.x,
          fill: 'none', stroke: '#5b4a33', 'stroke-width': 1.1, 'stroke-opacity': 0.85
        });
        g.appendChild(p);
        branches.set(n.id, p);
        if (n.gap > 0) g.appendChild(gapMark(n, mx));
      }
      n.children.forEach(draw);
    })(rootNode);

    function gapMark(n, mx) {
      const grp = el('g', { class: 'gapmark', tabindex: '0', role: 'button' });
      grp.setAttribute('aria-label', n.gap + ' ' + (n.gap === 1 ? nounOne : nounMany) +
        ' not recorded in Uganda on this branch');
      const tick = el('line', { x1: mx, y1: n.y, x2: mx, y2: n.y - 4, stroke: '#b3a281', 'stroke-width': 0.8 });
      const center = L.gapAlign === 'center';
      const num = el('text', {
        x: center ? mx : mx - 5, y: n.y - (center ? 9 : 5),
        'text-anchor': center ? 'middle' : 'end', 'font-size': L.gapFont,
        fill: '#8a7a5f', 'font-family': 'Georgia,serif'
      }, String(n.gap));
      num.setAttribute('paint-order', 'stroke');
      num.setAttribute('stroke', '#efe6d2');
      num.setAttribute('stroke-width', '2.4');
      const hit = el('rect', {
        x: center ? mx - 11 : mx - 26, y: n.y - 20,
        width: center ? 22 : 32, height: 24, fill: 'transparent'
      });
      const ring = el('rect', {
        class: 'plate-focus-ring', x: center ? mx - 13 : mx - 28, y: n.y - 22,
        width: center ? 26 : 36, height: 27
      });
      ring.setAttribute('visibility', 'hidden');
      grp.append(hit, tick, num, ring);
      grp.addEventListener('mouseenter', e => { gapTip(n, e); highlight(n); });
      grp.addEventListener('mousemove', moveTip);
      grp.addEventListener('mouseleave', () => { hideTip(); unhighlight(); });
      grp.addEventListener('click', () => openGap(n, grp));
      grp.addEventListener('focus', () => { gapTip(n, grp); highlight(n); ring.setAttribute('visibility', 'visible'); });
      grp.addEventListener('blur', () => { hideTip(); unhighlight(); ring.setAttribute('visibility', 'hidden'); });
      grp.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGap(n, grp); }
      });
      return grp;
    }

    if (rootNode.gap > 0) {
      const center = L.gapAlign === 'center';
      const rt = el('text', {
        x: center ? rootNode.x - 9 : rootNode.x - 14, y: rootNode.y - (center ? 5 : 3),
        'text-anchor': 'end', 'font-size': L.gapFont, fill: '#8a7a5f', 'font-family': 'Georgia,serif'
      }, String(rootNode.gap));
      rt.setAttribute('paint-order', 'stroke');
      rt.setAttribute('stroke', '#efe6d2');
      rt.setAttribute('stroke-width', '2.4');
      g.appendChild(rt);
    }

    for (const n of leaves) {
      const grp = el('g', { class: 'familymark', tabindex: '0', role: 'button' });
      grp.setAttribute('aria-label', nounOne.charAt(0).toUpperCase() + nounOne.slice(1) + ' ' + n.name +
        '. ' + n.count + ' recorded species' + (n.meta ? '. ' + n.meta : '') + '.');
      const hit = el('rect', { x: n.x - 7, y: n.y - 9.5, width: 20, height: 19, fill: 'transparent' });
      const dot = el('circle', { cx: n.x, cy: n.y, r: L.dot, fill: '#c9a227', stroke: '#8a6f2f', 'stroke-width': 0.6 });
      const label = el('text', {
        x: n.x + L.labelGap, y: n.y + L.font * 0.35, 'font-size': L.font,
        fill: '#4a3413', 'font-family': 'Georgia,serif'
      }, n.name);
      label.setAttribute('paint-order', 'stroke');
      label.setAttribute('stroke', '#efe6d2');
      label.setAttribute('stroke-width', '2.6');
      grp.append(hit, dot, label);
      g.appendChild(grp);

      const w = label.getComputedTextLength();
      const count = el('text', {
        x: n.x + L.labelGap + w + L.countGap, y: n.y + L.font * 0.35,
        'font-size': L.countFont, fill: '#a07d2a', 'font-family': 'Georgia,serif'
      }, String(n.count));
      count.setAttribute('paint-order', 'stroke');
      count.setAttribute('stroke', '#efe6d2');
      count.setAttribute('stroke-width', '2.2');
      g.appendChild(count);
      n.right = n.x + L.labelGap + w + L.countGap + count.getComputedTextLength();
      hit.setAttribute('width', Math.max(16, n.right - n.x + 6));

      const ring = el('rect', {
        class: 'plate-focus-ring', x: n.x - 8, y: n.y - 8,
        width: Math.max(18, n.right - n.x + 8), height: 16
      });
      ring.setAttribute('visibility', 'hidden');
      grp.appendChild(ring);

      grp.addEventListener('mouseenter', e => { familyTip(n, e); highlight(n); });
      grp.addEventListener('mousemove', moveTip);
      grp.addEventListener('mouseleave', () => { hideTip(); unhighlight(); });
      grp.addEventListener('click', () => openFamily(n, grp));
      grp.addEventListener('focus', () => { familyTip(n, grp); highlight(n); ring.setAttribute('visibility', 'visible'); });
      grp.addEventListener('blur', () => { hideTip(); unhighlight(); ring.setAttribute('visibility', 'hidden'); });
      grp.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFamily(n, grp); }
      });
    }

    if (DATA.rootLabel) {
      g.appendChild(el('text', {
        x: 0, y: rootNode.y + 5, 'font-size': 14, 'font-variant-caps': 'small-caps',
        fill: '#2a2115', 'letter-spacing': '.08em', 'font-family': 'Georgia,serif'
      }, DATA.rootLabel));
    }

    function fit() {
      const W = svg.clientWidth, H = svg.clientHeight;
      if (!W || !H) return;
      const xs = leaves.map(n => n.right);
      const ys = leaves.map(n => n.y);
      const cw = Math.max(...xs), ch = Math.max(...ys) - Math.min(...ys) + 50;
      const TOP = 34, BOT = 30;
      const s = Math.min((W - 90) / cw, (H - TOP - BOT) / ch, 1.2);
      const tx = Math.max(40, (W - cw * s) / 2);
      const ty = TOP + (H - TOP - BOT - ch * s) / 2 - Math.min(...ys) * s;
      g.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + s + ')');
    }

    /* ---------- interactions ---------- */
    function ancestors(n) { const a = []; let p = n; while (p) { a.push(p.id); p = p.parent; } return a; }
    function highlight(n) {
      const path = new Set(ancestors(n));
      for (const [id, e] of branches) e.setAttribute('stroke-opacity', path.has(id) ? 0.95 : 0.14);
    }
    function unhighlight() {
      for (const [, e] of branches) e.setAttribute('stroke-opacity', 0.85);
    }

    function moveTip(e) {
      if (tip.style.display !== 'block') return;
      const pad = 16, w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.clientX + pad, y = e.clientY + pad;
      if (x + w > innerWidth - 10) x = e.clientX - w - pad;
      if (y + h > innerHeight - 10) y = e.clientY - h - pad;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    }
    function hideTip() { tip.style.display = 'none'; tip.setAttribute('aria-hidden', 'true'); }

    function placeTip(target) {
      if (!target) return;
      if (typeof target.clientX === 'number') moveTip(target);
      else if (target.getBoundingClientRect) {
        const r = target.getBoundingClientRect();
        moveTip({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      }
    }

    function familyTip(n, target) {
      tip.innerHTML = '<div class="kick">' + kicker + '</div>'
        + '<h3>' + esc(n.name) + '</h3>'
        + (n.common ? '<div class="cname">' + esc(n.common) + '</div>' : '')
        + '<p><em>' + n.count + '</em> recorded species' + (n.meta ? ' · ' + esc(n.meta) : '') + '</p>'
        + (n.sample ? '<div class="more">' + esc(n.sample) + '</div>' : '');
      tip.style.display = 'block';
      tip.setAttribute('aria-hidden', 'false');
      placeTip(target);
    }
    function gapTip(n, target) {
      const names = n.dropped.slice(0, 6).join(' · ');
      tip.innerHTML = '<div class="kick">Not recorded in Uganda</div>'
        + '<h3>' + n.gap + ' ' + (n.gap === 1 ? nounOne : nounMany) + '</h3>'
        + '<p>They diverge on this branch, but none appear in the Uganda catalogue.</p>'
        + (names ? '<div class="more">' + esc(names) + (n.dropped.length > 6 ? ' …' : '') + '</div>' : '');
      tip.style.display = 'block';
      tip.setAttribute('aria-hidden', 'false');
      placeTip(target);
    }

    function openPanel(html, sourceEl) {
      panelInner.innerHTML = html;
      panel.setAttribute('data-open', 'true');
      panel.setAttribute('aria-hidden', 'false');
      trigger = sourceEl || null;
      closeBtn.focus({ preventScroll: true });
    }
    function closePanel() {
      if (panel.getAttribute('data-open') !== 'true') return;
      panel.setAttribute('data-open', 'false');
      panel.setAttribute('aria-hidden', 'true');
      if (trigger && document.contains(trigger) && trigger.focus) trigger.focus({ preventScroll: true });
      trigger = null;
    }

    function speciesRow(s) {
      const common = (s.name && s.name !== s.sci) ? s.name : null;
      return common
        ? '<div class="sp"><b>' + esc(common) + '</b><small>' + esc(s.sci) + '</small></div>'
        : '<div class="sp"><b><i>' + esc(s.sci) + '</i></b></div>';
    }

    function openFamily(n, sourceEl) {
      hideTip();
      let html = '<span class="kick">' + kicker + '</span><h2>' + esc(n.name) + '</h2>'
        + (n.common ? '<p class="cname">' + esc(n.common) + '</p>' : '')
        + '<p class="sub">' + n.count + ' recorded species' + (n.meta ? ' · ' + esc(n.meta) : '') + '</p>'
        + '<div class="rule"></div>';
      for (const item of n.items) {
        if (item.label) html += '<div class="famhead">' + esc(item.label)
          + (item.species.length ? ' · ' + item.species.length : '') + '</div>';
        for (const s of item.species) html += speciesRow(s);
        if (item.note) html += '<p class="note">' + esc(item.note) + '</p>';
      }
      if (n.note) html += '<p class="note">' + esc(n.note) + '</p>';
      openPanel(html, sourceEl);
    }
    function openGap(n, sourceEl) {
      hideTip();
      let html = '<span class="kick">Not recorded in Uganda</span><h2>' + n.gap + ' '
        + (n.gap === 1 ? nounOne : nounMany) + '</h2>'
        + '<p class="sub">These diverge on this branch of the ' + DATA.group.toLowerCase()
        + ' tree. None are in the Uganda catalogue.</p><div class="rule"></div>';
      for (const name of n.dropped) html += '<div class="gapitem">' + esc(name) + '</div>';
      openPanel(html, sourceEl);
    }

    closeBtn.addEventListener('click', closePanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePanel(); hideTip(); } });
    document.addEventListener('click', e => {
      if (!e.target.closest('.plate-panel') && !e.target.closest('.plate') && !e.target.closest('.plate-list')) closePanel();
    });

    /* ---------- small-screen list ---------- */
    if (listBox) {
      const body = listBox.querySelector('.plate-list-body');
      const ul = document.createElement('ul');
      for (const n of leaves) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<span>' + esc(n.name) + '</span><span class="n">' + n.count + '</span>';
        b.addEventListener('click', () => openFamily(n, b));
        li.appendChild(b);
        ul.appendChild(li);
      }
      body.appendChild(ul);
      const note = listBox.querySelector('.missing');
      if (note && DATA.summary && DATA.summary.missing) {
        const m = DATA.summary.missing;
        note.textContent = m + ' ' + (m === 1 ? nounOne + ' is' : nounMany + ' are') + ' not recorded in Uganda.';
      } else if (note && DATA.summary && DATA.summary.note) {
        note.textContent = DATA.summary.note;
      }
    }

    fit();
    window.addEventListener('resize', fit);
    return { fit };
  }

  window.mountPhylogenyPlate = mount;
})();
