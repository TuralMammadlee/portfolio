(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const INK = '#1B2540';
  const root = document.documentElement;
  const isDark = () => root.dataset.theme === 'dark';

  /* ------------------------------------------------------------------
     1. Background network: cartoon nodes, proximity edges, data packets,
        and links that reach toward the cursor.
  ------------------------------------------------------------------ */
  (function network() {
    const canvas = $('#net');
    const ctx = canvas.getContext('2d');
    const DAY = { fills: ['#5BB8FF', '#5BB8FF', '#FFC83D', '#6EDBB4'], edge: '27,37,64', stroke: 'rgba(27,37,64,.55)', dot: '#FFC83D', ring: INK };
    const NIGHT = { fills: ['#9FA8FF', '#F3EFD2', '#F3EFD2', '#8FD0FF'], edge: '175,185,255', stroke: 'rgba(210,215,255,.6)', dot: '#F3EFD2', ring: '#B7BDFF' };
    let pal = DAY;
    const LINK = 150;
    const MOUSE_LINK = 190;
    let w = 0, h = 0, dpr = 1, nodes = [], packets = [], lastSpawn = 0;
    const mouse = { x: -9999, y: -9999 };

    const makeNode = () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: 3.5 + Math.random() * 2.5, ci: (Math.random() * 4) | 0,
    });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(60, Math.round((w * h) / 24000));
      while (nodes.length < target) nodes.push(makeNode());
      if (nodes.length > target) nodes.length = target;
      nodes.forEach((n) => { n.x = Math.min(n.x, w); n.y = Math.min(n.y, h); });
      if (reduceMotion) draw();
    }

    function spawnPacket(now) {
      if (now - lastSpawn < 500 || packets.length > 10) return;
      const a = nodes[(Math.random() * nodes.length) | 0];
      if (!a) return;
      const near = nodes.filter((b) => b !== a && Math.hypot(a.x - b.x, a.y - b.y) < LINK);
      if (!near.length) return;
      packets.push({ a, b: near[(Math.random() * near.length) | 0], t: 0, s: 0.012 + Math.random() * 0.01 });
      lastSpawn = now;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(${pal.edge},${(1 - d / LINK) * 0.26})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (dm < MOUSE_LINK) {
          ctx.strokeStyle = `rgba(${pal.edge},${(1 - dm / MOUSE_LINK) * 0.6})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.stroke;
      for (const n of nodes) {
        ctx.fillStyle = pal.fills[n.ci];
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      if (mouse.x > -999) {
        ctx.fillStyle = pal.dot; ctx.strokeStyle = pal.ring; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      for (const p of packets) {
        const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        ctx.fillStyle = pal.dot; ctx.strokeStyle = pal.ring; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    function tick(now) {
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;
        const dx = mouse.x - n.x, dy = mouse.y - n.y, d = Math.hypot(dx, dy);
        if (d < MOUSE_LINK && d > 1) { n.x += (dx / d) * 0.3; n.y += (dy / d) * 0.3; }
      }
      for (const p of packets) p.t += p.s;
      packets = packets.filter((p) => p.t < 1);
      spawnPacket(now);
      draw();
      requestAnimationFrame(tick);
    }

    window.addEventListener('themechange', () => { pal = isDark() ? NIGHT : DAY; if (reduceMotion) draw(); });
    pal = isDark() ? NIGHT : DAY;
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    resize();
    if (!reduceMotion) requestAnimationFrame(tick);
  })();

  /* ------------------------------------------------------------------
     2. Navigation: scrolled state, progress sun, mobile menu, active link
  ------------------------------------------------------------------ */
  (function nav() {
    const bar = $('#nav'), toggle = $('#navToggle'), links = $('#navLinks');
    const pBar = $('#progressBar'), pSun = $('#progressSun');
    const onScroll = () => {
      bar.classList.toggle('scrolled', window.scrollY > 12);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      pBar.style.width = (p * 100) + '%';
      pSun.style.left = (p * 100) + '%';
      pSun.style.transform = `rotate(${p * 1440}deg)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', (e) => {
      if (e.target.closest('a')) { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
    });

    // Sections without their own nav link belong to the nearest one above them.
    const owner = { top: null, about: 'about', skills: 'about', experience: 'experience', projects: 'projects', lab: 'projects', cinema: 'cinema', contact: 'contact' };
    const map = new Map($$('a', links).map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        map.forEach((a) => a.classList.remove('active'));
        const a = map.get(owner[en.target.id]);
        if (a && !a.classList.contains('nav-cta')) a.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(owner).forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  })();

  /* ------------------------------------------------------------------
     3. Scroll reveal, stat counters, timeline marker
  ------------------------------------------------------------------ */
  (function reveal() {
    const items = $$('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      items.forEach((el) => io.observe(el));
    }

    const fmt = (n, d) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    $$('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count), d = parseInt(el.dataset.decimals || '0', 10);
      const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      const render = (v) => { el.textContent = pre + fmt(v, d) + suf; };
      if (reduceMotion) return;
      render(0);
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now(), dur = 1500;
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur);
          render(end * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step); else render(end);
        };
        requestAnimationFrame(step);
      });
      io.observe(el);
    });

    const tl = $('#timeline'), marker = $('#tlMarker'), line = marker.parentElement;
    const update = () => {
      const r = tl.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (window.innerHeight * 0.55 - r.top) / r.height));
      marker.style.top = (p * (line.offsetHeight - 24)) + 'px';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  })();

  /* ------------------------------------------------------------------
     4. Hero: bouncing title letters, mascot, floaties, patch inspector
  ------------------------------------------------------------------ */
  (function hero() {
    // letters
    let i = 0;
    $$('#title .word').forEach((word) => {
      const svg = $('svg', word);
      const text = word.childNodes[0].textContent;
      word.textContent = '';
      for (const ch of text) {
        const s = document.createElement('span');
        s.className = 'ch'; s.style.setProperty('--i', i++); s.textContent = ch;
        word.appendChild(s);
      }
      if (svg) word.appendChild(svg);
    });

    // patch inspector
    const frame = $('#visionFrame'), cell = $('#vCell'), out = $('#vReadout');
    const COLS = 12, ROWS = 11;
    const move = (e) => {
      const r = frame.getBoundingClientRect();
      const c = Math.max(0, Math.min(COLS - 1, Math.floor(((e.clientX - r.left) / r.width) * COLS)));
      const rw = Math.max(0, Math.min(ROWS - 1, Math.floor(((e.clientY - r.top) / r.height) * ROWS)));
      cell.style.transform = `translate(${c * 100}%, ${rw * 100}%)`;
      out.textContent = `patch ${String(rw).padStart(2, '0')},${String(c).padStart(2, '0')}`;
    };
    frame.addEventListener('pointermove', move);
    frame.addEventListener('pointerdown', (e) => { frame.classList.add('touch'); move(e); });
    frame.addEventListener('pointerleave', () => frame.classList.remove('touch'));

    if (reduceMotion) {
      $$('.packets animateMotion').forEach((a) => a.parentElement.remove());
    }
  })();

  /* ------------------------------------------------------------------
     5. Projects: four up front, four on request (Hick's law)
  ------------------------------------------------------------------ */
  (function projects() {
    const btn = $('#moreBtn'), more = $('#moreCards');
    btn.addEventListener('click', () => {
      const open = more.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Show fewer' : 'Show 4 more';
      if (open) $$('.card', more).forEach((c) => c.classList.add('in'));
    });
  })();

  /* ------------------------------------------------------------------
     6. Lab: genetic algorithm that evolves a 20x20 binary image
  ------------------------------------------------------------------ */
  (function lab() {
    const N = 20, L = N * N, POP = 80, ELITE = 2, MUT = 0.004, STEP_EVERY = 3;
    const WRONG = '#FF7A5C', PAPER = '#FFFFFF';
    const cT = $('#gaTarget'), cB = $('#gaBest'), cP = $('#gaPlot');
    const tCtx = cT.getContext('2d'), bCtx = cB.getContext('2d'), pCtx = cP.getContext('2d');
    const elGen = $('#gaGen'), elFit = $('#gaFit'), elWrong = $('#gaWrong');
    const runBtn = $('#gaRun'), resetBtn = $('#gaReset'), confetti = $('#confetti');

    const blank = () => new Uint8Array(L);
    function disc(g, cx, cy, r) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - cx, y - cy) <= r) g[y * N + x] = 1;
    }
    function line(g, x0, y0, x1, y1) {
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        g[Math.round(y0 + (y1 - y0) * t) * N + Math.round(x0 + (x1 - x0) * t)] = 1;
      }
    }
    const targets = {
      sun() {
        const g = blank(), c = (N - 1) / 2;
        disc(g, c, c, 4.2);
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          line(g, c + Math.cos(a) * 6.6, c + Math.sin(a) * 6.6, c + Math.cos(a) * 9, c + Math.sin(a) * 9);
        }
        return g;
      },
      smile() {
        const g = blank(), c = (N - 1) / 2;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const d = Math.hypot(x - c, y - c);
          if (Math.abs(d - 8.4) < 0.9) g[y * N + x] = 1;
          if (d > 5.2 && d < 6.3 && y > c + 1.5) g[y * N + x] = 1;
        }
        disc(g, 6.8, 7, 1.3); disc(g, 12.2, 7, 1.3);
        return g;
      },
      net() {
        const g = blank();
        const pts = [[3, 3], [16, 4], [9.5, 9.5], [4, 16], [16, 16]];
        [[0, 2], [1, 2], [3, 2], [4, 2], [0, 1], [3, 4]].forEach(([a, b]) => line(g, pts[a][0], pts[a][1], pts[b][0], pts[b][1]));
        pts.forEach(([x, y]) => disc(g, x, y, 1.6));
        return g;
      },
    };

    let target = targets.sun(), pop = [], fits = [], gen = 0, history = [], celebrated = false, frame = 0;
    let running = !reduceMotion, visible = false;

    const fitness = (g) => { let s = 0; for (let i = 0; i < L; i++) if (g[i] === target[i]) s++; return s; };
    const rand = () => { const g = new Uint8Array(L); for (let i = 0; i < L; i++) g[i] = Math.random() < 0.5 ? 1 : 0; return g; };
    function evaluate() {
      const scored = pop.map((g) => ({ g, f: fitness(g) })).sort((a, b) => b.f - a.f);
      pop = scored.map((s) => s.g); fits = scored.map((s) => s.f);
    }
    function reset() {
      pop = Array.from({ length: POP }, rand);
      gen = 0; history = []; celebrated = false;
      evaluate(); history.push(fits[0]); render();
    }
    function tournament() {
      let best = (Math.random() * POP) | 0;
      for (let k = 0; k < 2; k++) { const c = (Math.random() * POP) | 0; if (fits[c] > fits[best]) best = c; }
      return pop[best];
    }
    function step() {
      const next = pop.slice(0, ELITE);
      while (next.length < POP) {
        const a = tournament(), b = tournament(), child = new Uint8Array(L);
        for (let i = 0; i < L; i++) {
          let v = Math.random() < 0.5 ? a[i] : b[i];
          if (Math.random() < MUT) v ^= 1;
          child[i] = v;
        }
        next.push(child);
      }
      pop = next; gen++; evaluate(); history.push(fits[0]);
    }

    function paintTarget() {
      for (let i = 0; i < L; i++) { tCtx.fillStyle = target[i] ? INK : PAPER; tCtx.fillRect(i % N, (i / N) | 0, 1, 1); }
    }
    function paintBest() {
      const g = pop[0];
      for (let i = 0; i < L; i++) {
        bCtx.fillStyle = g[i] !== target[i] ? WRONG : (g[i] ? INK : PAPER);
        bCtx.fillRect(i % N, (i / N) | 0, 1, 1);
      }
    }
    function paintPlot() {
      const W = cP.width, H = cP.height, pad = 12;
      pCtx.clearRect(0, 0, W, H);
      pCtx.strokeStyle = '#D9D4C3'; pCtx.lineWidth = 2; pCtx.setLineDash([6, 6]);
      [0.5, 0.75, 1].forEach((v) => {
        const y = H - pad - ((v - 0.5) / 0.5) * (H - pad * 2);
        pCtx.beginPath(); pCtx.moveTo(0, y); pCtx.lineTo(W, y); pCtx.stroke();
      });
      pCtx.setLineDash([]);
      const span = Math.max(100, history.length - 1);
      pCtx.beginPath();
      history.forEach((f, i) => {
        const x = (i / span) * (W - pad * 2) + pad;
        const y = H - pad - ((f / L - 0.5) / 0.5) * (H - pad * 2);
        i ? pCtx.lineTo(x, y) : pCtx.moveTo(x, y);
      });
      pCtx.strokeStyle = INK; pCtx.lineWidth = 6; pCtx.lineJoin = 'round'; pCtx.lineCap = 'round'; pCtx.stroke();
      pCtx.strokeStyle = '#5BB8FF'; pCtx.lineWidth = 3; pCtx.stroke();
    }
    function render() {
      paintBest(); paintPlot();
      elGen.textContent = gen.toLocaleString('en-US');
      elFit.textContent = ((fits[0] / L) * 100).toFixed(1) + '%';
      elWrong.textContent = L - fits[0];
    }
    function setLabel() { runBtn.textContent = fits[0] === L ? 'Again' : (running ? 'Pause' : 'Run'); }

    function celebrate() {
      confetti.innerHTML = '';
      const colors = ['#FFC83D', '#5BB8FF', '#6EDBB4', '#FF7A5C', '#FFB3C7'];
      for (let i = 0; i < 40; i++) {
        const p = document.createElement('i');
        const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
        p.style.background = colors[i % colors.length];
        p.style.setProperty('--x', Math.cos(a) * d + 'px');
        p.style.setProperty('--y', Math.sin(a) * d - 60 + 'px');
        p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
        confetti.appendChild(p);
      }
      setTimeout(() => { confetti.innerHTML = ''; }, 1800);
    }

    function loop() {
      if (running && visible && fits[0] < L && ++frame % STEP_EVERY === 0) {
        step(); render(); setLabel();
        if (fits[0] === L && !celebrated) { celebrated = true; if (!reduceMotion) celebrate(); }
      }
      requestAnimationFrame(loop);
    }

    runBtn.addEventListener('click', () => {
      if (fits[0] === L) { reset(); running = true; } else running = !running;
      setLabel();
    });
    resetBtn.addEventListener('click', () => { reset(); running = true; setLabel(); });
    $$('#gaTargets button').forEach((b) => b.addEventListener('click', () => {
      $$('#gaTargets button').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      target = targets[b.dataset.target]();
      paintTarget(); reset(); running = true; setLabel();
    }));

    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0.25 }).observe($('#lab'));
    paintTarget(); reset(); setLabel();
    requestAnimationFrame(loop);
  })();

  /* ------------------------------------------------------------------
     7. Skills graph. Seven group hubs are visible, one group opens at a time.
        Built from the list in the HTML so the markup stays the single source.
  ------------------------------------------------------------------ */
  (function skills() {
    const host = $('#skillsGraph');
    const groups = $$('#skillsList .skill-group').map((g) => ({
      name: $('h3', g).textContent, cat: g.dataset.cat,
      items: $$('li', g).map((li) => li.textContent),
    }));
    const FILL = { ml: '#5BB8FF', sw: '#FFC83D', data: '#6EDBB4' };
    const NS = 'http://www.w3.org/2000/svg';
    const W = 1100, H = 820, CX = W / 2, CY = H / 2;
    const el = (name, attrs = {}, parent) => {
      const e = document.createElementNS(NS, name);
      for (const k in attrs) {
        if (typeof attrs[k] === 'string' && attrs[k].startsWith('var(')) e.style.setProperty(k, attrs[k]);
        else e.setAttribute(k, attrs[k]);
      }
      if (parent) parent.appendChild(e);
      return e;
    };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Skills grouped by area' });
    const gCore = el('g', {}, svg);
    const gGroups = el('g', {}, svg);
    const gHubs = el('g', {}, svg);
    const gCenter = el('g', {}, svg);

    const center = { bx: CX, by: CY, x: CX, y: CY, ph: 0, sp: 0 };
    const all = [center], edges = [], hubs = [], leaves = [];
    const wraps = [], hubEls = [];

    groups.forEach((grp, gi) => {
      const fill = FILL[grp.cat] || FILL.ml;
      const theta = (-90 + gi * (360 / groups.length)) * Math.PI / 180;
      const hub = { bx: CX + Math.cos(theta) * 300, by: CY + Math.sin(theta) * 250, ph: gi * 1.3, sp: 0.5, gi };
      hub.x = hub.bx; hub.y = hub.by;
      all.push(hub); hubs.push(hub);

      const core = el('line', { class: 'sg-edge sg-core', 'stroke-dasharray': '2 9' }, gCore);
      edges.push({ line: core, a: center, b: hub });

      const wrap = el('g', { class: 'grp' }, gGroups);
      wraps.push(wrap);

      const n = grp.items.length;
      const spread = Math.min(2.6, 1.3 + n * 0.2);
      grp.items.forEach((name, k) => {
        const phi = theta + (n === 1 ? 0 : (k / (n - 1) - 0.5) * spread);
        const R = 112 + (k % 2) * 34;
        const leaf = { bx: hub.bx + Math.cos(phi) * R, by: hub.by + Math.sin(phi) * R, ph: gi * 2 + k * 0.9, sp: 0.8 + (k % 3) * 0.2, gi, cos: Math.cos(phi) };
        leaf.x = leaf.bx; leaf.y = leaf.by;
        all.push(leaf);
        const ln = el('line', { class: 'sg-edge' }, wrap);
        edges.push({ line: ln, a: hub, b: leaf });
        const lg = el('g', {}, wrap);
        const li = el('g', { class: 'leaf-in' }, lg);
        li.style.setProperty('--i', k);
        el('circle', { r: 6.5, fill, stroke: 'var(--line)', 'stroke-width': 2 }, li);
        const side = leaf.cos >= 0 ? 'start' : 'end';
        const t = el('text', { class: 'sg-label', x: side === 'start' ? 14 : -14, y: 5, 'text-anchor': side }, li);
        t.textContent = name;
        leaf.w = name.length * 7.8; leaf.side = side; leaf.node = lg; leaf.inner = li;
        leaves.push(leaf);
      });

      // hub pill with a hard shadow and an item counter
      const hubG = el('g', { class: 'sg-hub' }, gHubs);
      const inner = el('g', { class: 'hub-in' }, hubG);
      const tw = grp.name.length * 9.4 + 44;
      el('rect', { x: -tw / 2, y: -16, width: tw, height: 34, rx: 17, fill, stroke: 'var(--line)', 'stroke-width': 2 }, inner);
      const label = el('text', { class: 'sg-hub-label', x: -8, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, inner);
      label.textContent = grp.name;
      el('circle', { cx: tw / 2 - 18, cy: 1, r: 10, fill: '#fff', stroke: 'var(--line)', 'stroke-width': 1.5 }, inner);
      const cnt = el('text', { class: 'sg-count', x: tw / 2 - 18, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, inner);
      cnt.textContent = n;
      hub.node = hubG; hub.hw = tw;
      hubEls.push(hubG);
      hubG.addEventListener('pointerenter', () => open(gi));
      hubG.addEventListener('click', () => open(gi));
    });

    // centre node
    el('circle', { class: 'sg-halo', r: 46, fill: '#FFC83D', 'fill-opacity': 0.3 }, gCenter);
    el('circle', { r: 30, fill: '#FFC83D', stroke: 'var(--line)', 'stroke-width': 2.5 }, gCenter);
    const ct = el('text', { x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font-family:Fredoka,sans-serif;font-weight:700;font-size:19px;fill:#1B2540' }, gCenter);
    ct.textContent = 'TM';
    center.node = gCenter;
    host.appendChild(svg);

    // Push overlapping labels apart inside each group
    const box = (l) => (l.side === 'start' ? { x1: l.bx - 9, x2: l.bx + 15 + l.w } : { x1: l.bx - 15 - l.w, x2: l.bx + 9 });
    const overlap = (a, b) => {
      const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      const oy = Math.min(a.by, b.by) + 11 - (Math.max(a.by, b.by) - 11);
      return ox > 0 && oy > 0 ? { ox, oy } : null;
    };
    const fixed = hubs.map((h) => ({ x1: h.bx - h.hw / 2 - 8, x2: h.bx + h.hw / 2 + 8, by: h.by }));
    fixed.push({ x1: CX - 56, x2: CX + 56, by: CY });
    for (let it = 0; it < 160; it++) {
      for (let i = 0; i < leaves.length; i++) {
        const a = leaves[i], ra = { ...box(a), by: a.by };
        for (const f of fixed) {
          const o = overlap(ra, f);
          if (o) a.by += (a.by >= f.by ? 1 : -1) * (o.oy / 2 + 1);
        }
        for (let j = i + 1; j < leaves.length; j++) {
          const b = leaves[j];
          if (b.gi !== a.gi) continue;
          const o = overlap(ra, { ...box(b), by: b.by });
          if (!o) continue;
          const dir = a.by >= b.by ? 1 : -1;
          a.by += dir * (o.oy / 2 + 0.5); b.by -= dir * (o.oy / 2 + 0.5);
        }
        a.by = Math.max(16, Math.min(H - 16, a.by));
        a.bx = Math.max(a.side === 'end' ? a.w + 22 : 10, Math.min(a.side === 'start' ? W - a.w - 24 : W - 10, a.bx));
      }
    }
    // each leaf springs out of its hub
    leaves.forEach((l) => {
      const hub = hubs[l.gi];
      l.inner.style.setProperty('--dx', (hub.bx - l.bx) + 'px');
      l.inner.style.setProperty('--dy', (hub.by - l.by) + 'px');
    });

    let current = -1;
    function open(gi) {
      if (gi === current) return;
      current = gi;
      wraps.forEach((w, i) => w.classList.toggle('open', i === gi));
      hubEls.forEach((h, i) => h.classList.toggle('open', i === gi));
    }

    function place(t) {
      all.forEach((p) => {
        if (p === center) { p.x = p.bx; p.y = p.by; }
        else {
          p.x = p.bx + Math.sin(t * 0.0007 * p.sp + p.ph) * 3.5;
          p.y = p.by + Math.cos(t * 0.0006 * p.sp + p.ph * 1.7) * 3.5;
        }
        if (p.node) p.node.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      });
      edges.forEach((e) => {
        e.line.setAttribute('x1', e.a.x.toFixed(1)); e.line.setAttribute('y1', e.a.y.toFixed(1));
        e.line.setAttribute('x2', e.b.x.toFixed(1)); e.line.setAttribute('y2', e.b.y.toFixed(1));
      });
    }

    place(0);
    open(groups.findIndex((g) => g.name === 'Deep learning'));
    if (reduceMotion) return;
    let on = false;
    new IntersectionObserver((e) => { on = e[0].isIntersecting; }, { threshold: 0.05 }).observe(host);
    const loop = (t) => { if (on) place(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  })();

  /* ------------------------------------------------------------------
     8. Contact: copy email, footer year
  ------------------------------------------------------------------ */
  (function contact() {
    const btn = $('#copyMail'), msg = $('#copied');
    btn.addEventListener('click', async () => {
      const mail = $('#mailLink').textContent.trim();
      try {
        await navigator.clipboard.writeText(mail);
        msg.textContent = 'Copied';
      } catch (_) {
        msg.textContent = 'Press Ctrl+C';
        const r = document.createRange(); r.selectNodeContents($('#mailLink'));
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      }
      setTimeout(() => { msg.textContent = ''; }, 2000);
    });
    $('#year').textContent = new Date().getFullYear();
  })();

  /* ------------------------------------------------------------------
     9. Theme: the sun in the corner switches day and night.
        Night turns the sun into a moon and lets the bats peek in.
  ------------------------------------------------------------------ */
  (function theme() {
    const btn = $('#themeToggle');
    const meta = $('meta[name="theme-color"]');
    const bats = $$('.bat');
    const sync = () => {
      const dark = isDark();
      btn.setAttribute('aria-pressed', String(dark));
      const label = dark ? 'Switch to day mode' : 'Switch to dark mode';
      btn.setAttribute('aria-label', label); btn.title = label;
      if (meta) meta.setAttribute('content', dark ? '#0E1330' : '#FFF8E6');
      window.dispatchEvent(new Event('themechange'));
    };
    sync();
    btn.addEventListener('click', () => {
      const dark = !isDark();
      root.classList.add('theme-anim');
      if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (_) {}
      sync();
      setTimeout(() => root.classList.remove('theme-anim'), 800);
    });

    // bat pupils follow the cursor
    if (reduceMotion) return;
    window.addEventListener('pointermove', (e) => {
      if (!isDark()) return;
      bats.forEach((b) => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260) * 2.6;
        const flip = b.classList.contains('bat-r1') || b.classList.contains('bat-r2') ? -1 : 1;
        $$('.bpupil', b).forEach((p) => p.setAttribute('transform', `translate(${(dx / d) * k * flip} ${(dy / d) * k})`));
      });
    }, { passive: true });
  })();

  /* ------------------------------------------------------------------
     10. Cinema: dust drifting through the projector beam
  ------------------------------------------------------------------ */
  (function cinema() {
    const host = $('#dust');
    if (!host) return;
    for (let i = 0; i < 22; i++) {
      const d = document.createElement('i');
      d.style.left = (18 + Math.random() * 64) + '%';
      d.style.top = (4 + Math.random() * 62) + '%';
      d.style.setProperty('--s', (1 + Math.random() * 2.2).toFixed(1) + 'px');
      d.style.setProperty('--t', (9 + Math.random() * 12).toFixed(1) + 's');
      d.style.setProperty('--dx', ((Math.random() - 0.5) * 60).toFixed(0) + 'px');
      d.style.animationDelay = (-Math.random() * 20).toFixed(1) + 's';
      host.appendChild(d);
    }
  })();
})();
