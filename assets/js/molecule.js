/* Hero molecule: a small disulfide linker fragment drawn on a 2D canvas.
   - Coordinates come from an RDKit conformer (heavy atoms only, centered at the origin, in Å).
   - Drag (or arrow keys) rotates it. The readout below the canvas is computed from the
     rotated coordinates on every update, so the "stays the same" distance is a real measurement.
   No libraries. To swap the molecule, replace MOL (see README.md). */
(() => {
  'use strict';

  const MOL = {
  // SMILES: NC(=O)CCSSC(C)(C)CCC(=O)O  (illustrative hindered-disulfide linker fragment)
  atoms: [
    { e: "N", p: [5.625, -0.341, 1.234] },
    { e: "C", p: [4.656, -0.937, 0.481] },
    { e: "O", p: [4.602, -2.156, 0.373] },
    { e: "C", p: [3.694, 0.028, -0.169] },
    { e: "C", p: [2.671, -0.719, -1.014] },
    { e: "S", p: [1.535, 0.426, -1.876] },
    { e: "S", p: [0.408, 1.228, -0.351] },
    { e: "C", p: [-1.149, 0.193, -0.229] },
    { e: "C", p: [-0.791, -1.279, 0.014] },
    { e: "C", p: [-1.938, 0.337, -1.536] },
    { e: "C", p: [-1.915, 0.79, 0.987] },
    { e: "C", p: [-3.262, 0.156, 1.352] },
    { e: "C", p: [-4.404, 0.566, 0.465] },
    { e: "O", p: [-5.163, -0.19, -0.119] },
    { e: "O", p: [-4.57, 1.898, 0.388] }
  ],
  bonds: [[0, 1, 1], [1, 2, 2], [1, 3, 1], [3, 4, 1], [4, 5, 1], [5, 6, 1], [6, 7, 1], [7, 8, 1], [7, 9, 1], [7, 10, 1], [10, 11, 1], [11, 12, 1], [12, 13, 2], [12, 14, 1]],   // [atomA, atomB, bondOrder]
  ss: [5, 6]        // indices of the two sulfur atoms
  };

  const canvas = document.getElementById('mol');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const RADII = { C: 0.40, N: 0.42, O: 0.42, S: 0.58 };   // ball-and-stick radii in Å
  const CAMERA = 40;          // camera distance in Å (perspective strength)
  const AUTO_SPIN = 0.32;     // rad/s about the vertical axis when idle

  const atoms = MOL.atoms.map(a => ({ el: a.e, p: a.p }));
  const bonds = MOL.bonds;
  const [iS1, iS2] = MOL.ss;
  const maxR = Math.max(...atoms.map(a => Math.hypot(a.p[0], a.p[1], a.p[2])));

  /* ---------- small 3x3 matrix helpers ---------- */
  const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const mul = (A, B) => {
    const R = new Array(9);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return R;
  };
  const apply = (M, p) => [
    M[0] * p[0] + M[1] * p[1] + M[2] * p[2],
    M[3] * p[0] + M[4] * p[1] + M[5] * p[2],
    M[6] * p[0] + M[7] * p[1] + M[8] * p[2]
  ];
  // Keep R a proper rotation after many small updates (Gram–Schmidt on the rows).
  const orthonormalize = M => {
    let r0 = [M[0], M[1], M[2]], r1 = [M[3], M[4], M[5]];
    const n0 = Math.hypot(...r0); r0 = r0.map(v => v / n0);
    const d = r0[0] * r1[0] + r0[1] * r1[1] + r0[2] * r1[2];
    r1 = r1.map((v, i) => v - d * r0[i]);
    const n1 = Math.hypot(...r1); r1 = r1.map(v => v / n1);
    const r2 = [
      r0[1] * r1[2] - r0[2] * r1[1],
      r0[2] * r1[0] - r0[0] * r1[2],
      r0[0] * r1[1] - r0[1] * r1[0]
    ];
    return [...r0, ...r1, ...r2];
  };

  /* ---------- color helpers ---------- */
  const hexToRgb = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const shade = (hex, amt) => {           // amt > 0 lightens, amt < 0 darkens
    const t = amt < 0 ? 0 : 255, k = Math.abs(amt);
    const c = hexToRgb(hex).map(v => Math.round(v + (t - v) * k));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };

  let C = {};
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    C = {
      C: g('--atom-c'), N: g('--atom-n'), O: g('--atom-o'), S: g('--atom-s'),
      bond: g('--bond'), hl: g('--sulfur'), ink: g('--ink'), surface: g('--surface'),
      sans: g('--font-sans') || 'sans-serif'
    };
  };

  /* ---------- state ---------- */
  let R = mul(rotX(0.7), rotY(Math.PI));   // starting pose: chosen so the S–S bond is seen side-on and no atoms overlap
  let vx = 0, vy = 0;                     // angular velocity (rad/s) about X and Y
  let dragging = false, lastX = 0, lastY = 0, lastT = 0;
  let W = 0, H = 0, frames = 0;

  const applyRotation = (ax, ay) => {
    R = mul(mul(rotX(ax), rotY(ay)), R);
    if (++frames % 600 === 0) R = orthonormalize(R);
  };

  /* ---------- sizing ---------- */
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /* ---------- drawing ---------- */
  const rotated = () => atoms.map(a => apply(R, a.p));

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    const scale = Math.min(W, H) / (2 * maxR * 1.14);
    const cx = W / 2, cy = H / 2;

    const Q = rotated();
    const proj = Q.map(q => {
      const s = CAMERA / (CAMERA - q[2]);
      return { x: cx + q[0] * scale * s, y: cy + q[1] * scale * s, s, z: q[2] };
    });

    const items = [];
    bonds.forEach(([i, j, order]) => items.push({ kind: 'bond', i, j, order, z: (Q[i][2] + Q[j][2]) / 2 }));
    atoms.forEach((a, i) => items.push({ kind: 'atom', i, z: Q[i][2] }));
    items.sort((a, b) => a.z - b.z);       // far to near

    ctx.lineCap = 'round';

    items.forEach(it => {
      if (it.kind === 'bond') {
        const a = proj[it.i], b = proj[it.j];
        const s = (a.s + b.s) / 2;
        const isSS = (it.i === iS1 && it.j === iS2) || (it.i === iS2 && it.j === iS1);

        if (isSS) {
          ctx.save();
          ctx.strokeStyle = C.hl;
          ctx.shadowColor = C.hl;
          ctx.shadowBlur = 16;
          ctx.lineWidth = 0.34 * scale * s;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.restore();
          return;
        }

        ctx.strokeStyle = C.bond;
        if (it.order === 2) {
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const ox = (-dy / len) * 0.14 * scale * s, oy = (dx / len) * 0.14 * scale * s;
          ctx.lineWidth = 0.13 * scale * s;
          ctx.beginPath(); ctx.moveTo(a.x + ox, a.y + oy); ctx.lineTo(b.x + ox, b.y + oy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(a.x - ox, a.y - oy); ctx.lineTo(b.x - ox, b.y - oy); ctx.stroke();
        } else {
          ctx.lineWidth = 0.22 * scale * s;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      } else {
        const a = atoms[it.i], p = proj[it.i];
        const r = (RADII[a.el] || 0.4) * scale * p.s;
        const base = C[a.el] || C.C;
        const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
        g.addColorStop(0, shade(base, 0.5));
        g.addColorStop(0.55, base);
        g.addColorStop(1, shade(base, -0.3));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
    });

    // Labels for the two sulfur atoms, drawn last so they are never hidden.
    ctx.font = `600 13px ${C.sans}`;
    ctx.textBaseline = 'alphabetic';
    [[iS1, 'S\u2081'], [iS2, 'S\u2082']].forEach(([i, label]) => {
      const p = proj[i], r = RADII.S * scale * p.s;
      const tx = p.x + r * 0.95, ty = p.y - r * 0.95;
      ctx.lineWidth = 4; ctx.strokeStyle = C.surface; ctx.lineJoin = 'round';
      ctx.strokeText(label, tx, ty);
      ctx.fillStyle = C.ink;
      ctx.fillText(label, tx, ty);
    });
  };

  /* ---------- readout ---------- */
  const el = {
    s1: document.querySelector('[data-ro="s1"]'),
    s2: document.querySelector('[data-ro="s2"]'),
    dist: document.querySelector('[data-ro="dist"]')
  };
  const num = v => {
    const t = (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
    return t.startsWith('-') ? '\u2212' + t.slice(1) : t;
  };
  const triple = q => `${num(q[0])}, ${num(q[1])}, ${num(q[2])}`;
  const updateReadout = () => {
    const Q = rotated();
    const a = Q[iS1], b = Q[iS2];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (el.s1) el.s1.textContent = triple(a);
    if (el.s2) el.s2.textContent = triple(b);
    if (el.dist) el.dist.textContent = d.toFixed(2) + ' \u00C5';
  };

  /* ---------- animation loop ---------- */
  let raf = 0, last = 0, lastRO = 0, visible = true;

  const step = dt => {
    if (dragging) return;
    const target = reduceMotion.matches ? 0 : AUTO_SPIN;
    const k = 1 - Math.exp(-dt * 1.6);
    vy += (target - vy) * k;
    vx += (0 - vx) * k;
    if (Math.abs(vx) > 1e-4 || Math.abs(vy) > 1e-4) applyRotation(vx * dt, vy * dt);
  };

  const frame = now => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    draw();
    if (now - lastRO > 80) { updateReadout(); lastRO = now; }
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  /* ---------- input ---------- */
  canvas.addEventListener('pointerdown', e => {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
    vx = 0; vy = 0;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dxA = (e.clientX - lastX) * 0.011;     // radians per pixel
    const dyA = (e.clientY - lastY) * 0.011;
    const dt = Math.max((e.timeStamp - lastT) / 1000, 0.001);
    applyRotation(-dyA, dxA);
    const clamp = v => Math.max(-6, Math.min(6, v));
    vy = clamp(0.5 * vy + 0.5 * (dxA / dt));
    vx = clamp(0.5 * vx + 0.5 * (-dyA / dt));
    lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('is-dragging');
    if (reduceMotion.matches) { vx = 0; vy = 0; }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);

  canvas.addEventListener('keydown', e => {
    const step = 0.16;
    const map = { ArrowLeft: [0, -step], ArrowRight: [0, step], ArrowUp: [-step, 0], ArrowDown: [step, 0] };
    if (!map[e.key]) return;
    e.preventDefault();
    applyRotation(map[e.key][0], map[e.key][1]);
  });

  /* ---------- setup ---------- */
  readColors();
  resize();
  updateReadout();
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('themechange', readColors);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(readColors, 0));

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    visible ? start() : stop();
  }).observe(canvas);
  start();
})();
