/* =========================================================
   Tema 10 — Spring animations (iOS / Framer Motion)
   Simulación interactiva: una tarjeta animada por un resorte
   amortiguado m·x'' + c·x' + k·x = 0, comparada con los tres
   regímenes y con una animación de duración fija.
   ========================================================= */
window.Tema10 = (() => {
  let c = {}, ctx = null, W = 0, H = 0, cssW = 0, visible = false, last = 0;
  // estado: posición normalizada (0 = izquierda, 1 = derecha) y velocidad (1/s)
  const S = { x: 0, v: 0, target: 0, t: 0, hist: [], drag: null };
  const reg = [ // los tres regímenes con la misma k y m que el usuario
    { name: "Subamortiguado", z: 0.3, col: "--accent", x: 0, v: 0 },
    { name: "Crítico", z: 1, col: "--green", x: 0, v: 0 },
    { name: "Sobreamortiguado", z: 2.5, col: "--violet", x: 0, v: 0 },
  ];
  // animación de duración fija (como una transición CSS con ease-in-out): al cambiar de destino arranca de cero
  const fixed = { x: 0, from: 0, to: 0, t0: 0, dur: 0.5 };
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  const params = () => ({ k: c.k.value, b: c.b.value, m: c.m.value });
  const zeta = (p) => p.b / (2 * Math.sqrt(p.k * p.m));

  function step(dt) {
    const p = params();
    const sub = 8, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      if (!S.drag) {
        const a = (-p.k * (S.x - S.target) - p.b * S.v) / p.m;
        S.v += a * h; S.x += S.v * h;
      }
      reg.forEach((r) => {
        const b = r.z * 2 * Math.sqrt(p.k * p.m);
        const a = (-p.k * (r.x - S.target) - b * r.v) / p.m;
        r.v += a * h; r.x += r.v * h;
      });
    }
    S.t += dt;
    if (c.auto.checked && !S.drag && S.t - (S.lt || 0) > 2.5) toggle();
    const u = Math.min(1, (S.t - fixed.t0) / fixed.dur);
    fixed.x = fixed.from + (fixed.to - fixed.from) * ease(u);
    S.hist.push([S.t, S.x, reg[0].x, reg[1].x, reg[2].x, fixed.x]);
    while (S.hist.length && S.t - S.hist[0][0] > 3) S.hist.shift();
  }

  function toggle() {
    S.target = S.target ? 0 : 1;
    S.lt = S.t;
    fixed.from = fixed.x; fixed.to = S.target; fixed.t0 = S.t;
  }

  function size() {
    const cv = document.getElementById("t10-sim");
    cssW = cv.parentElement.clientWidth;
    const r = UI.fitCanvas(cv, cssW < 600 ? 1.5 : 0.56);
    ctx = r.ctx; W = r.w; H = r.h;
  }

  function lane(y, h, x, col, label, sub, big) {
    const P = UI.palette(), L = 20, R = W - 20, cw = big ? 64 : 34, ch = big ? h - 10 : h - 8;
    ctx.fillStyle = P.line; ctx.fillRect(L, y + h / 2 - 1, R - L, 2);
    ctx.setLineDash([3, 4]); ctx.strokeStyle = P.faint;
    [0, 1].forEach((p) => { const px = L + cw / 2 + p * (R - L - cw); ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke(); });
    ctx.setLineDash([]);
    const px = L + x * (R - L - cw);
    ctx.fillStyle = col; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, y + (h - ch) / 2, cw, ch, big ? 10 : 6); else ctx.rect(px, y + (h - ch) / 2, cw, ch);
    ctx.fill();
    ctx.fillStyle = P.muted; ctx.font = `${big ? 600 : 500} ${big ? 12 : 11}px Public Sans, sans-serif`;
    ctx.fillText(label, L, y - 4);
    if (sub) { ctx.textAlign = "right"; ctx.fillText(sub, R, y - 4); ctx.textAlign = "left"; }
  }

  function draw() {
    const cv = document.getElementById("t10-sim");
    if (!ctx || cssW !== cv.parentElement.clientWidth) size();
    if (W < 80) return;
    const P = UI.palette(), p = params(), z = zeta(p), f = UI.fmt;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = P.panel2; ctx.fillRect(0, 0, W, H);
    const narrow = W < 600;
    // carriles
    let y = 26;
    lane(y, narrow ? 50 : 56, S.x, P.accent, narrow ? "Su resorte" : "Su resorte (haga clic o arrastre la tarjeta)", `ζ = ${f(z, 2)}`, true);
    y += narrow ? 78 : 84;
    reg.forEach((r) => { lane(y, 24, r.x, UI.css(r.col), `${r.name} (ζ = ${f(r.z, 1)})`, "", false); y += 42; });
    lane(y, 24, fixed.x, P.muted, narrow ? "Duración fija 0,5 s (sin física)" : "Duración fija de 0,5 s con curva ease-in-out (sin física)", "", false);
    y += 40;
    // gráfica x(t) de los últimos 3 s
    const gx = 20, gy = y + 6, gw = W - 40, gh = H - gy - 28;
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
    const Y = (v) => gy + gh - ((v + 0.25) / 1.5) * gh;
    [0, 1].forEach((v) => { ctx.setLineDash([3, 4]); ctx.strokeStyle = P.faint; ctx.beginPath(); ctx.moveTo(gx, Y(v)); ctx.lineTo(gx + gw, Y(v)); ctx.stroke(); ctx.setLineDash([]); });
    ctx.fillStyle = P.faint; ctx.font = "10.5px JetBrains Mono, monospace";
    ctx.fillText("destino", gx + 4, Y(S.target) - 4);
    ctx.fillText("posición x(t) · últimos 3 s", gx + 4, gy + 13);
    const t1 = S.t, t0 = t1 - 3, X = (t) => gx + ((t - t0) / 3) * gw;
    const series = [[5, P.muted, 1.4], [4, UI.css("--violet"), 1.4], [3, UI.css("--green"), 1.4], [2, P.accent, 1.2], [1, P.accent, 3]];
    series.forEach(([i, col, wdt]) => {
      ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.globalAlpha = i === 2 ? 0.45 : 1; ctx.beginPath();
      S.hist.forEach((h, j) => { const px = X(h[0]), py = Math.max(gy, Math.min(gy + gh, Y(h[i]))); j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke(); ctx.globalAlpha = 1;
    });
    ctx.fillStyle = P.faint; ctx.fillText("t (s)", gx + gw - 30, gy + gh + 16);

    // lecturas
    const w0 = Math.sqrt(p.k / p.m);
    const regime = z < 0.999 ? "subamortiguado: rebota" : z <= 1.001 ? "crítico: llega sin rebotar" : "sobreamortiguado: llega lento, sin rebotar";
    const over = z < 1 ? Math.exp((-z * Math.PI) / Math.sqrt(1 - z * z)) * 100 : 0;
    const ts = z < 1 ? 4 / (z * w0) : z === 1 ? 5.8 / w0 : 4 / ((z - Math.sqrt(z * z - 1)) * w0);
    const dur = 2 * Math.PI * Math.sqrt(p.m / p.k), bounce = 1 - z;
    document.getElementById("t10-ro").innerHTML = `
      <div class="ro"><div class="k">ω₀ = √(k/m)</div><div class="v">${f(w0, 2)} <small>rad/s</small></div></div>
      <div class="ro"><div class="k">ζ = c / 2√(km)</div><div class="v" style="color:var(${z < 0.999 ? "--accent" : z <= 1.001 ? "--green" : "--violet"})">${f(z, 2)} <small>${regime}</small></div></div>
      <div class="ro"><div class="k">Sobrepaso del destino</div><div class="v">${f(over, 1)} <small>%</small></div></div>
      <div class="ro"><div class="k">Tiempo hasta quedar a 2 %</div><div class="v">${f(Math.min(ts, 99), 2)} <small>s</small></div></div>
      <div class="ro"><div class="k">En SwiftUI: duration · bounce</div><div class="v">${f(dur, 2)} s · ${f(bounce, 2)}</div></div>`;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
    if (!visible) return;
    step(dt); draw();
  }

  function preset(k, b, m) { c.k.set(k, true); c.b.set(b, true); c.m.set(m, true); }

  function init() {
    c.k = UI.bindRange("t10-k", (v) => `${UI.fmt(v, 0)} N/m`);
    c.b = UI.bindRange("t10-b", (v) => `${UI.fmt(v, 1)} N·s/m`);
    c.m = UI.bindRange("t10-m", (v) => `${UI.fmt(v, 2)} kg`);
    c.auto = document.getElementById("t10-auto");
    const presets = {
      framer: () => preset(100, 10, 1),
      ios: () => preset(157.9, 17.6, 1),
      crit: () => { const p = params(); preset(p.k, 2 * Math.sqrt(p.k * p.m), p.m); },
      over: () => { const p = params(); preset(p.k, Math.min(60, 2.5 * 2 * Math.sqrt(p.k * p.m)), p.m); },
      zero: () => { const p = params(); preset(p.k, 0, p.m); },
    };
    document.querySelectorAll("[data-t10]").forEach((b) => b.addEventListener("click", () => {
      presets[b.dataset.t10]();
      document.querySelectorAll("[data-t10]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      toggle();
    }));
    ["t10-k", "t10-b", "t10-m"].forEach((id) => document.getElementById(id).addEventListener("input", () => document.querySelectorAll("[data-t10]").forEach((x) => x.setAttribute("aria-pressed", "false"))));
    document.getElementById("t10-go").addEventListener("click", toggle);
    // arrastrar la tarjeta y soltarla con velocidad
    const cv = document.getElementById("t10-sim");
    const toX = (e) => { const r = cv.getBoundingClientRect(); return Math.max(-0.2, Math.min(1.2, (e.clientX - r.left - 20 - 32) / (W - 40 - 64))); };
    cv.addEventListener("pointerdown", (e) => {
      const r = cv.getBoundingClientRect(), py = e.clientY - r.top;
      if (py > 120) { toggle(); return; }
      S.drag = { x: toX(e), t: performance.now(), v: 0 }; S.x = S.drag.x; S.v = 0; cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      if (!S.drag) return;
      const now = performance.now(), nx = toX(e), dt = Math.max(1, now - S.drag.t) / 1000;
      S.drag.v = 0.7 * S.drag.v + 0.3 * ((nx - S.drag.x) / dt); S.drag.x = nx; S.drag.t = now; S.x = nx;
    });
    const up = () => {
      if (!S.drag) return;
      const moved = Math.abs(S.drag.v) > 0.05;
      S.v = S.drag.v; S.drag = null;
      // al soltar, el destino es el lado hacia donde va o el más cercano; el resorte conserva la velocidad del dedo
      const goal = moved ? (S.v > 0 ? 1 : 0) : S.target ? 0 : 1;
      if (goal !== S.target) toggle();
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.05 });
    io.observe(cv);
    window.addEventListener("resize", () => { cssW = 0; });
    UI.onTheme(draw);
    size(); draw();
    requestAnimationFrame(loop);
  }

  return { init };
})();
