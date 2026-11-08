/* ==========================================================================
   Living Uganda · story.js
   The motion layer for the homepage: reveal on approach, a counting ledger,
   the header's measured state, the section rail, and one slow parallax.
   Deliberately small. No libraries; degrades to a fully static page.
   ========================================================================== */
(() => {
  'use strict';

  window.__storyReady = true;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ------------------------------------------------------------ image safety
     If anything below fails, the page must never hide its own content. */
  const revealAll = () => $$('[data-reveal]').forEach((el) => el.classList.add('in'));
  const failsafe = setTimeout(revealAll, 4000);

  /* --------------------------------------------------------------- reveals */
  if (!('IntersectionObserver' in window) || reduce) {
    revealAll();
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    $$('[data-reveal]').forEach((el) => io.observe(el));
    clearTimeout(failsafe);
    // Belt and braces: anything already in view on load reveals immediately.
    requestAnimationFrame(() => {
      $$('[data-reveal]').forEach((el) => {
        if (el.getBoundingClientRect().top < innerHeight * 0.92) el.classList.add('in');
      });
    });
  }

  /* -------------------------------------------------------------- counters */
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const fmt = (n) => n.toLocaleString('en-GB');

  const countUp = (el) => {
    const target = Number(el.dataset.to || 0);
    if (reduce) { el.textContent = fmt(target); return; }
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = fmt(Math.round(target * easeOut(p)));
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = fmt(target);
    };
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          countUp(entry.target);
          co.unobserve(entry.target);
        }
      },
      { threshold: 0.6 }
    );
    $$('.count').forEach((el) => co.observe(el));
  }

  /* ------------------------------------------------- header, progress, rail */
  const header = $('header');
  const progress = $('.progress i');
  const railLinks = $$('.rail a');
  const sections = $$('main section[id]');

  const onScroll = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.width = (max > 0 ? Math.min(1, y / max) : 0) * 100 + '%';
    if (header) header.classList.toggle('affix', y > 40);
  };

  let queued = false;
  const requestScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { onScroll(); queued = false; });
  };

  addEventListener('scroll', requestScroll, { passive: true });
  addEventListener('resize', requestScroll);
  onScroll();

  if ('IntersectionObserver' in window && railLinks.length) {
    const byId = new Map(railLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const so = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const link = byId.get(entry.target.id);
          if (!link) continue;
          if (entry.isIntersecting) {
            railLinks.forEach((a) => a.classList.remove('on'));
            link.classList.add('on');
          }
        }
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => byId.has(s.id) && so.observe(s));
  }

  /* -------------------------------------------------------------- parallax */
  const plx = $('.relation-media img.plx');
  if (plx && !reduce) {
    const host = plx.closest('.relation');
    let start = 0;
    let span = 1;
    const measure = () => {
      const r = host.getBoundingClientRect();
      start = r.top + scrollY;
      span = r.height + innerHeight * 0.2;
    };
    measure();

    let ticking = false;
    const frame = () => {
      const offset = (scrollY - start) / span - 0.1;
      const shift = Math.max(-1, Math.min(1, offset)) * 7;
      plx.style.transform = `translate3d(0,${shift}%,0)`;
      ticking = false;
    };

    addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(frame);
      },
      { passive: true }
    );
    addEventListener('resize', () => { measure(); frame(); });
    frame();
  }

  /* ------------------------------------------------ smooth anchor arrival */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = id && document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + scrollY - (header ? header.offsetHeight - 2 : 0);
      scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#' + id);
    });
  });
})();
