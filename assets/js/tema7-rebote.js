/* =========================================================
   Tema 7 — Coeficiente de restitución en un motor de juego
   Simulación interactiva: la misma pelota resuelta de forma
   exacta (referencia física) y como la resuelve un motor
   (paso fijo, mezcla de materiales y umbral de rebote).
   Abajo, un choque 1D entre dos cuerpos con p conservado.
   ========================================================= */
window.Tema7 = (() => {
  const G = 9.81, R = 0.033; // radio de una pelota de tenis (m)
  const E_REF = 0.745; // tenis según la ITF: de 254 cm rebota entre 135 y 147 cm → e = √(h'/h) ≈ 0,73–0,76
  const MIX = {
    average: (a, b) => (a + b) / 2,
    min: (a, b) => Math.min(a, b),
    multiply: (a, b) => a * b,
    max: (a, b) => Math.max(a, b),
  };
  const PRESETS = {
    ok: { e: 0.745, floor: 0.745, mix: "average", thr: 0, dt: 0, label: "Bien calibrada" },
    floor0: { e: 0.745, floor: 0, mix: "average", thr: 0, dt: 0 },
    unity: { e: 0.745, floor: 0.745, mix: "average", thr: 2, dt: 0.02 },
    e1: { e: 1, floor: 1, mix: "average", thr: 0, dt: 0 },
    e105: { e: 1.05, floor: 1.05, mix: "average", thr: 0, dt: 0 },
    bigdt: { e: 0.745, floor: 0.745, mix: "average", thr: 0, dt: 0.1 },
  };

  let c = {}, S = null, raf = 0, lastT = 0, ctx, W, H, cssW = 0, running = false;

  const eEngine = () => MIX[c.mix.value](c.e.value, c.floor.value);

  /** Estado de una pelota: altura de la base y (m), velocidad v (m/s, + hacia arriba). */
  function newBall(h) { return { y: h, v: 0, t: 0, bounces: 0, rest: false, trace: [[0, h]], peaks: [], lastImpact: 0, lastOut: 0, E0: G * h }; }

  function reset() {
    const h = c.h.value;
    S = { ref: newBall(h), eng: newBall(h), acc: 0, simT: 0 };
    running = false;
    draw(); readouts();
  }

  /** Referencia: integración exacta por eventos (sin paso de tiempo, sin umbral). */
  function stepExact(b, e, dt, thr) {
    let left = dt;
    while (left > 0 && !b.rest) {
      // tiempo hasta tocar el piso: y + v t − ½ g t² = 0
      const tHit = (b.v + Math.sqrt(b.v * b.v + 2 * G * b.y)) / G;
      if (tHit > left) { b.y += b.v * left - 0.5 * G * left * left; b.v -= G * left; b.t += left; left = 0; break; }
      b.t += tHit; left -= tHit;
      const vImp = -(b.v - G * tHit); // rapidez de impacto
      if (vImp < thr || vImp < 0.03) { if (vImp >= 0.03) { b.lastImpact = vImp; b.lastOut = 0; } b.y = 0; b.v = 0; b.rest = true; b.trace.push([b.t, 0]); break; }
      b.lastImpact = vImp;
      b.y = 0; b.v = e * vImp; b.lastOut = b.v; b.bounces++;
      b.trace.push([b.t, 0]);
      b.peaks.push((b.v * b.v) / (2 * G));
    }
  }

  /** Motor de juego: Euler semi-implícito con paso fijo, corrección de penetración y umbral. */
  function stepEngine(b, e, h, thr) {
    if (b.rest) { b.t += h; return; }
    b.v -= G * h;
    b.y += b.v * h;
    if (b.y < 0) {
      const vImp = -b.v;
      b.y = 0; // se saca la pelota del piso (esto agrega energía potencial si había penetración)
      if (vImp < thr || vImp < 0.03) { if (vImp >= 0.03) { b.lastImpact = vImp; b.lastOut = 0; } b.v = 0; b.rest = true; }
      else { b.lastImpact = vImp; b.v = e * vImp; b.lastOut = b.v; b.bounces++; b.peaks.push(null); }
    }
    b.t += h;
  }

  function advance(dtReal) {
    const tMax = 14;
    if (S.ref.t > tMax) { running = false; return; }
    stepExact(S.ref, E_REF, dtReal, 0);
    S.ref.trace.push([S.ref.t, S.ref.y]);
    const e = eEngine(), thr = +c.thr.value, h = +c.dt.value;
    if (h === 0) { stepExact(S.eng, e, dtReal, thr); S.eng.trace.push([S.eng.t, S.eng.y]); }
    else {
      S.acc += dtReal;
      while (S.acc >= h) { stepEngine(S.eng, e, h, thr); S.acc -= h; S.eng.trace.push([S.eng.t, S.eng.y]); trackPeak(S.eng); }
    }
    S.eng.maxY = Math.min(12, Math.max(S.eng.maxY || 0, S.eng.y));
    if (S.eng.trace.length > 4000) S.eng.trace.splice(1, 1000);
    if (S.ref.trace.length > 4000) S.ref.trace.splice(1, 1000);
  }

  // con paso fijo la altura máxima se mide en la trayectoria discreta
  function trackPeak(b) {
    if (!b.peaks.length) return;
    const i = b.peaks.length - 1;
    if (b.peaks[i] === null || b.y > b.peaks[i]) b.peaks[i] = b.y;
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    if (running) advance(dt);
    draw(); readouts();
    if (running) raf = requestAnimationFrame(loop);
  }

  function play() {
    if (S.ref.t > 0.01 || S.eng.t > 0.01) reset();
    running = true; lastT = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }

  /* ---------- Dibujo ---------- */
  function size() {
    const cv = document.getElementById("t7-sim");
    const r = UI.fitCanvas(cv, cv.parentElement.clientWidth < 600 ? 1.1 : 0.5);
    ctx = r.ctx; W = r.w; H = r.h; cssW = cv.parentElement.clientWidth;
  }

  function draw() {
    if (!ctx || cssW !== document.getElementById("t7-sim").parentElement.clientWidth) size();
    if (W < 80) return;
    const P = UI.palette();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = P.panel2; ctx.fillRect(0, 0, W, H);
    const narrow = W < 600;
    const laneW = narrow ? W : Math.max(W * 0.36, Math.min(320, W * 0.5));
    const plotX = narrow ? 0 : laneW, plotY = narrow ? H * 0.55 : 0, plotW = narrow ? W : W - laneW, plotH = narrow ? H * 0.45 : H;
    const top = 56, floorY = (narrow ? H * 0.55 : H) - 34;
    const hMax = Math.max(c.h.value, S.eng.maxY || 0, 1) * 1.12;
    const Y = (y) => floorY - (y / hMax) * (floorY - top);

    // regla de alturas
    ctx.strokeStyle = P.line; ctx.fillStyle = P.faint; ctx.font = "10.5px JetBrains Mono, monospace"; ctx.lineWidth = 1;
    const stepM = hMax > 3 ? 1 : 0.5;
    for (let m = 0; m <= hMax; m += stepM) { ctx.beginPath(); ctx.moveTo(26, Y(m)); ctx.lineTo(laneW - 8, Y(m)); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1; ctx.fillText(`${UI.fmt(m, 1)}`, 2, Y(m) + 3); }
    // piso
    ctx.fillStyle = P.muted; ctx.fillRect(20, floorY, laneW - 26, 3);

    const lanes = [
      { b: S.ref, x: 26 + (laneW - 34) * 0.28, col: P.green, title: "Física real", sub: `tenis ITF, e = ${UI.fmt(E_REF, 3)}` },
      { b: S.eng, x: 26 + (laneW - 34) * 0.74, col: P.accent, title: "Motor de juego", sub: `e efectivo = ${UI.fmt(eEngine(), 3)}` },
    ];
    lanes.forEach((L) => {
      // marcas de las alturas máximas alcanzadas
      ctx.strokeStyle = L.col; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5;
      L.b.peaks.forEach((pk) => { if (pk == null) return; ctx.beginPath(); ctx.moveTo(L.x - 16, Y(pk)); ctx.lineTo(L.x + 16, Y(pk)); ctx.stroke(); });
      ctx.globalAlpha = 1;
      // sombra en el piso
      const sh = Math.max(0.25, 1 - L.b.y / hMax);
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(L.x, floorY + 1, 13 * sh, 3.5 * sh, 0, 0, 7); ctx.fill();
      // pelota (con leve aplastamiento al tocar el piso)
      const squash = L.b.y < 0.02 && L.b.lastImpact > 0.5 && !L.b.rest ? 0.78 : 1;
      const rpx = 11;
      ctx.fillStyle = L.col; ctx.beginPath(); ctx.ellipse(L.x, Y(L.b.y) - rpx * squash, rpx / Math.sqrt(squash), rpx * squash, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = P.panel; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(L.x - 4, Y(L.b.y) - rpx * squash, rpx * 0.75, -0.9, 0.9); ctx.stroke();
      ctx.fillStyle = P.text; ctx.font = "600 12px Public Sans, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(L.title, L.x, 16); ctx.fillStyle = P.muted; ctx.font = "10.5px Public Sans, sans-serif"; ctx.fillText(L.sub, L.x, 30);
      ctx.fillText(`${L.b.bounces} rebotes`, L.x, floorY + 22);
      ctx.textAlign = "left";
    });

    // gráfica h(t)
    ctx.save(); ctx.translate(plotX, plotY);
    ctx.strokeStyle = P.line; ctx.beginPath(); if (narrow) { ctx.moveTo(0, 0); ctx.lineTo(plotW, 0); } else { ctx.moveTo(0, 0); ctx.lineTo(0, plotH); } ctx.stroke();
    const px0 = 52, py0 = plotH - 32, pw = plotW - px0 - 16, ph = plotH - 32 - 30;
    const tSpan = 10;
    const tNow = Math.max(S.ref.t, S.eng.t);
    const t0 = Math.max(0, tNow - tSpan);
    const X = (t) => px0 + ((t - t0) / tSpan) * pw, YY = (y) => py0 - (y / hMax) * ph;
    ctx.fillStyle = P.muted; ctx.font = "700 11px Public Sans, sans-serif"; ctx.fillText("ALTURA DE LA PELOTA vs. TIEMPO", px0, 18);
    ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px0 + pw, py0); ctx.moveTo(px0, py0); ctx.lineTo(px0, py0 - ph); ctx.stroke();
    ctx.fillStyle = P.faint; ctx.font = "10.5px JetBrains Mono, monospace";
    for (let s = Math.ceil(t0); s <= t0 + tSpan; s++) { ctx.fillText(`${s}`, X(s) - 3, py0 + 14); }
    ctx.fillText("t (s)", px0 + pw - 26, py0 + 26);
    ctx.save(); ctx.translate(14, py0 - ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText("altura h (m)", 0, 0); ctx.restore();
    ctx.fillText(UI.fmt(hMax / 1.12, 1), px0 - 30, YY(hMax / 1.12) + 3);
    const trace = (b, col, w) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); let first = true;
      b.trace.forEach(([t, y]) => { if (t < t0) return; first ? ctx.moveTo(X(t), YY(y)) : ctx.lineTo(X(t), YY(y)); first = false; });
      ctx.stroke();
    };
    // envolvente teórica h_n = e^{2n} h_0 de la referencia
    trace(S.ref, P.green, 1.6);
    trace(S.eng, P.accent, 2.2);
    ctx.restore();
  }

  function readouts() {
    const f = UI.fmt, e = eEngine(), h0 = c.h.value;
    const t0 = Math.sqrt((2 * h0) / G);
    const tRest = e < 1 ? (t0 * (1 + e)) / (1 - e) : Infinity;
    const b = S.eng;
    const Enow = G * b.y + 0.5 * b.v * b.v;
    const lost = b.lastImpact > 0 ? (1 - (b.lastOut * b.lastOut) / (b.lastImpact * b.lastImpact)) * 100 : 0;
    const verdict = e > 1 ? ["gana energía en cada choque", "--danger"] : e === 1 ? ["no pierde energía: rebota para siempre", "--amber"]
      : Math.abs(e - E_REF) < 0.05 && +c.thr.value === 0 ? ["parecido a una pelota real", "--green"] : ["se siente distinto a la real", "--amber"];
    document.getElementById("t7-ro").innerHTML = `
      <div class="ro"><div class="k">e efectivo (${c.mix.options[c.mix.selectedIndex].text.split(" ")[0].toLowerCase()})</div><div class="v">${f(e, 3)} <small style="color:var(${verdict[1]})">${verdict[0]}</small></div></div>
      <div class="ro"><div class="k">Impacto → rebote</div><div class="v">${f(b.lastImpact, 2)} → ${f(b.lastOut, 2)} <small>m/s</small></div></div>
      <div class="ro"><div class="k">Energía perdida en el choque (1 − e²)</div><div class="v">${f(lost, 1)} <small>%</small></div></div>
      <div class="ro"><div class="k">Energía mecánica actual / inicial</div><div class="v">${f((Enow / (G * h0)) * 100, 1)} <small>%</small></div></div>
      <div class="ro"><div class="k">Tiempo hasta el reposo (teoría)</div><div class="v">${Number.isFinite(tRest) ? f(tRest, 2) : "∞"} <small>s</small></div></div>
      <div class="ro"><div class="k">Altura del 1.<sup>er</sup> rebote: e²·h₀</div><div class="v">${f(e * e * h0, 2)} <small>m</small></div></div>`;
  }

  function applyPreset(k) {
    const p = PRESETS[k];
    c.e.set(p.e, true); c.floor.set(p.floor, true);
    c.mix.value = p.mix; c.thr.value = String(p.thr); c.dt.value = String(p.dt);
    document.querySelectorAll("[data-t7]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t7 === k)));
    play();
  }

  /* ---------- Choque 1D entre dos cuerpos ---------- */
  const col = { t: 0, raf: 0, ctx: null };
  function collideModel() {
    const m1 = c.m1.value, m2 = c.m2.value, v1 = c.v1.value, v2 = c.v2.value, e = c.e2.value;
    const M = m1 + m2, p = m1 * v1 + m2 * v2;
    const u1 = (p + m2 * e * (v2 - v1)) / M, u2 = (p + m1 * e * (v1 - v2)) / M;
    const K0 = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2, K1 = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
    return { m1, m2, v1, v2, e, u1, u2, p, p1: m1 * u1 + m2 * u2, K0, K1, approach: v1 > v2 };
  }
  function drawCollide() {
    const cv = document.getElementById("t7-col");
    if (!col.ctx || col.cssW !== cv.parentElement.clientWidth) { const r = UI.fitCanvas(cv, cv.parentElement.clientWidth < 600 ? 0.75 : 0.3); Object.assign(col, { ctx: r.ctx, w: r.w, h: r.h, cssW: cv.parentElement.clientWidth }); }
    const { ctx: g, w, h } = col, P = UI.palette(), m = collideModel();
    if (w < 80) { col.ctx = null; return; } // todavía sin ancho de diseño
    g.clearRect(0, 0, w, h); g.fillStyle = P.panel2; g.fillRect(0, 0, w, h);
    const trackY = h * 0.42, span = 8; // metros visibles
    const X = (x) => 20 + ((x + span / 2) / span) * (w - 40);
    g.fillStyle = P.line; g.fillRect(14, trackY + 26, w - 28, 3);
    // posiciones: chocan en x = 0 en t = 0 (antes: t < 0)
    const T = col.t - 1.2; // segundos respecto al choque
    const r1 = 0.18 + 0.12 * Math.cbrt(m.m1), r2 = 0.18 + 0.12 * Math.cbrt(m.m2);
    let x1, x2;
    if (!m.approach) { x1 = -r1 + m.v1 * col.t - 1; x2 = r2 + m.v2 * col.t + 1; }
    else if (T < 0) { x1 = -r1 + m.v1 * T; x2 = r2 + m.v2 * T; }
    else { x1 = -r1 + m.u1 * T; x2 = r2 + m.u2 * T; }
    const ball = (x, r, colr, lbl) => {
      const rp = (r / span) * (w - 40);
      g.fillStyle = colr; g.beginPath(); g.arc(X(x), trackY + 26 - rp, rp, 0, 7); g.fill();
      g.fillStyle = P.panel; g.font = "700 12px Public Sans, sans-serif"; g.textAlign = "center"; g.fillText(lbl, X(x), trackY + 30 - rp); g.textAlign = "left";
    };
    ball(x1, r1, P.accent, "1"); ball(x2, r2, P.amber, "2");
    // barras de momento antes y después
    const f = UI.fmt, by = h * 0.62, bw = Math.min(150, w * 0.18), pMax = Math.max(Math.abs(m.m1 * m.v1), Math.abs(m.m2 * m.v2), Math.abs(m.m1 * m.u1), Math.abs(m.m2 * m.u2), Math.abs(m.p), 1);
    const bar = (x0, label, vals) => {
      g.fillStyle = P.muted; g.font = "700 11px Public Sans, sans-serif"; g.fillText(label, x0, by);
      vals.forEach(([lbl, val, colr], i) => {
        const yy = by + 12 + i * 18, mid = x0 + bw / 2 + 30;
        g.fillStyle = P.line; g.fillRect(x0 + 30, yy, bw, 10);
        g.fillStyle = colr; const L = (val / pMax) * (bw / 2); g.fillRect(L >= 0 ? mid : mid + L, yy, Math.abs(L), 10);
        g.fillStyle = P.text; g.font = "11px JetBrains Mono, monospace"; g.fillText(lbl, x0, yy + 9); g.fillText(`${f(val, 2)}`, x0 + bw + 36, yy + 9);
      });
    };
    bar(16, "ANTES  p = m·v (kg·m/s)", [["p₁", m.m1 * m.v1, P.accent], ["p₂", m.m2 * m.v2, P.amber], ["Σp", m.p, P.text]]);
    bar(Math.max(w * 0.5, 16 + bw + 100), "DESPUÉS", [["p₁'", m.m1 * m.u1, P.accent], ["p₂'", m.m2 * m.u2, P.amber], ["Σp'", m.p1, P.text]]);
    g.fillStyle = P.muted; g.font = "11px Public Sans, sans-serif";
    if (m.approach) {
      g.fillText(`Energía cinética: ${f(m.K0, 2)} J → ${f(m.K1, 2)} J`, 16, 20);
      g.fillText(`Se pierde ${f(m.K0 > 0 ? (1 - m.K1 / m.K0) * 100 : 0, 1)} %, como predice e; Σp no cambia.`, 16, 36);
    } else g.fillText("Con estas velocidades los cuerpos se alejan: no hay choque.", 16, 20);
    document.getElementById("t7-col-ro").innerHTML = `
      <div class="ro"><div class="k">v₁' (después)</div><div class="v">${f(m.u1, 2)} <small>m/s</small></div></div>
      <div class="ro"><div class="k">v₂' (después)</div><div class="v">${f(m.u2, 2)} <small>m/s</small></div></div>
      <div class="ro"><div class="k">Σp antes = Σp después</div><div class="v">${f(m.p, 2)} = ${f(m.p1, 2)} <small>kg·m/s</small></div></div>
      <div class="ro"><div class="k">Velocidad del centro de masa</div><div class="v">${f(m.p / (m.m1 + m.m2), 2)} <small>m/s</small></div></div>`;
  }
  function runCollide() {
    cancelAnimationFrame(col.raf);
    col.t = 0; let last = performance.now();
    const st = (now) => { col.t += (now - last) / 1000; last = now; drawCollide(); if (col.t < 3.2) col.raf = requestAnimationFrame(st); };
    col.raf = requestAnimationFrame(st);
  }

  function init() {
    c.e = UI.bindRange("t7-e", (v) => UI.fmt(v, 2), () => { clearPresets(); play(); });
    c.floor = UI.bindRange("t7-floor", (v) => UI.fmt(v, 2), () => { clearPresets(); play(); });
    c.h = UI.bindRange("t7-h", (v) => `${UI.fmt(v, 2)} m`, () => play());
    c.mix = document.getElementById("t7-mix");
    c.thr = document.getElementById("t7-thr");
    c.dt = document.getElementById("t7-dt");
    [c.mix, c.thr, c.dt].forEach((el) => el.addEventListener("change", () => { clearPresets(); play(); }));
    document.getElementById("t7-drop").addEventListener("click", play);
    document.querySelectorAll("[data-t7]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.t7)));
    c.m1 = UI.bindRange("t7-m1", (v) => `${UI.fmt(v, 1)} kg`, () => { col.t = 0; drawCollide(); });
    c.m2 = UI.bindRange("t7-m2", (v) => `${UI.fmt(v, 1)} kg`, () => { col.t = 0; drawCollide(); });
    c.v1 = UI.bindRange("t7-v1", (v) => `${UI.fmt(v, 1)} m/s`, () => { col.t = 0; drawCollide(); });
    c.v2 = UI.bindRange("t7-v2", (v) => `${UI.fmt(v, 1)} m/s`, () => { col.t = 0; drawCollide(); });
    c.e2 = UI.bindRange("t7-e2", (v) => UI.fmt(v, 2), () => { col.t = 0; drawCollide(); });
    document.getElementById("t7-go").addEventListener("click", runCollide);
    window.addEventListener("resize", () => { size(); draw(); col.ctx = null; drawCollide(); });
    UI.onTheme(() => { draw(); drawCollide(); });
    size(); reset(); drawCollide();
    // arranca solo cuando la simulación entra en pantalla
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting && S.ref.t === 0) { play(); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(document.getElementById("t7-sim"));
  }
  function clearPresets() { document.querySelectorAll("[data-t7]").forEach((b) => b.setAttribute("aria-pressed", "false")); }

  return { init };
})();
