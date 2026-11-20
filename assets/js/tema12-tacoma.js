/* =========================================================
   Tema 12 — Resonancia estructural: Tacoma Narrows y las tropas
   Multimedia con análisis: película de 1940 con marcas de tiempo,
   medición propia de la inclinación del tablero y una exploración
   de oscilación forzada (tropas marchando sobre un puente).
   ========================================================= */
window.Tema12 = (() => {
  let chart = null;

  /* ---------- Video y línea de tiempo ---------- */
  function initVideo() {
    const v = document.getElementById("t12-video");
    document.querySelectorAll("#t12-timeline [data-t]").forEach((b) => b.addEventListener("click", () => {
      v.currentTime = +b.dataset.t;
      const p = v.play(); if (p && p.catch) p.catch(() => {});
      v.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  }

  /* ---------- Gráfica de la inclinación medida ---------- */
  function makeChart() {
    if (chart) chart.destroy();
    const raw = window.TACOMA_TILT || [];
    if (!raw.length) return;
    const P = UI.palette();
    const t0 = raw[0][0];
    const pts = raw.map(([t, a]) => ({ x: t - t0, y: a }));
    const mean = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    chart = new Chart(document.getElementById("t12-tilt"), {
      type: "line",
      data: {
        datasets: [
          { label: "Inclinación del borde del tablero (medida cuadro por cuadro)", data: pts, borderColor: P.accent, backgroundColor: P.accent, borderWidth: 2.4, parsing: false },
          { label: "Valor medio", data: [{ x: 0, y: mean }, { x: pts[pts.length - 1].x, y: mean }], borderColor: P.muted, borderDash: [5, 5], borderWidth: 1.2, parsing: false },
        ],
      },
      options: {
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: { legend: { position: "top", align: "end" }, tooltip: { callbacks: { title: (it) => `video 1:${UI.fmt(26 + it[0].parsed.x, 2)} · tiempo real ≈ ${UI.fmt(it[0].parsed.x * 1.5, 2)} s` } } },
        scales: {
          x: UI.axis("Tiempo en la película desde 1:26 (s)", { min: 0, max: 5.9 }),
          y: UI.axis("Ángulo aparente del tablero (°)"),
        },
      },
    });
    // marcas de los dos máximos y del periodo
    chart.$bands = [
      { from: 1.55, to: 1.62, color: UI.css("--amber"), label: "máximo", labelColor: UI.css("--amber") },
      { from: 4.71, to: 4.78, color: UI.css("--amber"), label: "máximo · T = 3,1 s en el video", labelColor: UI.css("--amber") },
    ];
    chart.update("none");
  }

  /* ---------- Exploración: tropas sobre un puente ---------- */
  const sim = { y: 0, v: 0, t: 0, hist: [], ctx: null, cssW: 0, w: 0, h: 0, last: 0, visible: false, phases: [] };
  let c = {};
  const N_SOLD = 40, M_BRIDGE = 20000, F_STEP = 280; // masa modal (kg) y fuerza dinámica por soldado (N)

  function reset() { sim.y = 0; sim.v = 0; sim.t = 0; sim.hist = []; sim.phases = Array.from({ length: N_SOLD }, () => Math.random() * 2 * Math.PI); }

  function stepSim(dt) {
    const f0 = c.f0.value, fp = c.fp.value, z = c.z.value / 100, w0 = 2 * Math.PI * f0, wp = 2 * Math.PI * fp;
    const n = 20, h = dt / n;
    for (let i = 0; i < n; i++) {
      // fuerza total de los soldados: en paso todos en fase; rompiendo el paso, cada uno con su fase y un ritmo ligeramente distinto
      let F = 0;
      if (c.brk.checked) for (let s = 0; s < N_SOLD; s++) F += F_STEP * Math.cos(wp * (1 + 0.06 * Math.sin(s * 1.7)) * sim.t + sim.phases[s]);
      else F = N_SOLD * F_STEP * Math.cos(wp * sim.t);
      const a = F / M_BRIDGE - 2 * z * w0 * sim.v - w0 * w0 * sim.y;
      sim.v += a * h; sim.y += sim.v * h; sim.t += h;
    }
    sim.hist.push([sim.t, sim.y]);
    while (sim.hist.length && sim.t - sim.hist[0][0] > 20) sim.hist.shift();
  }

  function amp(fp) { // amplitud estacionaria en paso (m)
    const f0 = c.f0.value, z = c.z.value / 100, w0 = 2 * Math.PI * f0, w = 2 * Math.PI * fp;
    return (N_SOLD * F_STEP / M_BRIDGE) / Math.sqrt((w0 * w0 - w * w) ** 2 + (2 * z * w0 * w) ** 2);
  }

  function drawSim() {
    const cv = document.getElementById("t12-sim");
    const cw = cv.parentElement.clientWidth;
    if (!sim.ctx || sim.cssW !== cw) { const r = UI.fitCanvas(cv, cw < 600 ? 1.15 : 0.42); Object.assign(sim, { ctx: r.ctx, w: r.w, h: r.h, cssW: cw }); }
    const { ctx, w, h } = sim, P = UI.palette(), f = UI.fmt;
    if (w < 80) return;
    const narrow = w < 600;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.panel2; ctx.fillRect(0, 0, w, h);
    const Amax = Math.max(amp(c.f0.value), 0.01);
    // puente: primer modo vertical (medio seno) con la deflexión actual exagerada
    const bw = narrow ? w - 40 : w * 0.5 - 30, bx = 20, by = narrow ? h * 0.2 : h * 0.42, sc = (narrow ? h * 0.12 : h * 0.22) / Amax;
    ctx.fillStyle = P.line; ctx.fillRect(bx - 6, by - 4, 8, 50); ctx.fillRect(bx + bw - 2, by - 4, 8, 50);
    ctx.strokeStyle = P.text; ctx.lineWidth = 4; ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const xx = bx + (bw * i) / 60, yy = by + Math.sin((Math.PI * i) / 60) * sim.y * sc; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
    ctx.stroke();
    // soldados (puntos que suben y bajan con su paso)
    for (let s = 0; s < 14; s++) {
      const i = 4 + s * 4, xx = bx + (bw * i) / 60, yy = by + Math.sin((Math.PI * i) / 60) * sim.y * sc;
      const ph = c.brk.checked ? sim.phases[s * 2] : 0, bob = Math.max(0, Math.sin(2 * Math.PI * c.fp.value * sim.t + ph)) * 4;
      ctx.fillStyle = P.accent; ctx.fillRect(xx - 2, yy - 14 - bob, 4, 10); ctx.beginPath(); ctx.arc(xx, yy - 17 - bob, 3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = P.muted; ctx.font = "11px Public Sans, sans-serif";
    ctx.fillText(`${N_SOLD} soldados ${c.brk.checked ? "rompiendo el paso" : "marchando en paso"}${narrow ? "" : " · deformación exagerada"}`, bx, by + 64);
    // historial de la amplitud
    const gx = narrow ? 20 : w * 0.5 + 10, gy = narrow ? h * 0.42 : 18, gw = narrow ? w - 40 : w * 0.5 - 30, gh = narrow ? h * 0.25 : h * 0.42;
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
    ctx.beginPath(); ctx.moveTo(gx, gy + gh / 2); ctx.lineTo(gx + gw, gy + gh / 2); ctx.stroke();
    ctx.strokeStyle = P.accent; ctx.lineWidth = 1.6; ctx.beginPath();
    const t1 = sim.t, t0 = t1 - 20;
    sim.hist.forEach(([t, y], i) => { const px = gx + ((t - t0) / 20) * gw, py = gy + gh / 2 - (y / Amax) * (gh / 2 - 4); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.fillStyle = P.muted; ctx.fillText(narrow ? "centro del puente · últimos 20 s" : "desplazamiento del centro del puente · últimos 20 s", gx + 6, gy + 13);
    // curva de resonancia
    const ry = narrow ? h * 0.71 : gy + gh + 22, rh = narrow ? h * 0.26 : h - gh - 50;
    ctx.strokeStyle = P.line; ctx.strokeRect(gx, ry, gw, rh);
    ctx.strokeStyle = P.violet; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const fp = 1 + (2 * i) / 120, yy = ry + rh - (amp(fp) / Amax) * (rh - 8); i ? ctx.lineTo(gx + (i / 120) * gw, yy) : ctx.moveTo(gx, yy); }
    ctx.stroke();
    const mx = gx + ((c.fp.value - 1) / 2) * gw, my = ry + rh - (amp(c.fp.value) / Amax) * (rh - 8);
    ctx.fillStyle = P.pink; ctx.beginPath(); ctx.arc(mx, my, 5, 0, 7); ctx.fill();
    ctx.fillStyle = P.muted; ctx.fillText(narrow ? "amplitud según la marcha (1–3 Hz)" : "amplitud en paso según la frecuencia de marcha (1 a 3 Hz)", gx + 6, ry + 13);
    let peak = 0; sim.hist.forEach(([t, y]) => { if (t > t1 - 3) peak = Math.max(peak, Math.abs(y)); });
    document.getElementById("t12-ro").innerHTML = `
      <div class="ro"><div class="k">Frecuencia de marcha / natural</div><div class="v">${f(c.fp.value / c.f0.value, 2)}</div></div>
      <div class="ro"><div class="k">Amplitud actual del centro</div><div class="v">${f(peak * 1000, 1)} <small>mm</small></div></div>
      <div class="ro"><div class="k">Amplitud estable si marchan en paso</div><div class="v">${f(amp(c.fp.value) * 1000, 1)} <small>mm</small></div></div>
      <div class="ro"><div class="k">Amplificación máxima 1/(2ζ)</div><div class="v">× ${f(1 / (2 * c.z.value / 100), 0)}</div></div>`;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (now - sim.last) / 1000 || 0); sim.last = now;
    if (!sim.visible) return;
    stepSim(dt); drawSim();
  }

  function initSim() {
    c.f0 = UI.bindRange("t12-f0", (v) => `${UI.fmt(v, 2)} Hz`, reset);
    c.fp = UI.bindRange("t12-fp", (v) => `${UI.fmt(v, 2)} Hz`, reset);
    c.z = UI.bindRange("t12-z", (v) => `${UI.fmt(v, 1)} %`, reset);
    c.brk = document.getElementById("t12-brk");
    c.brk.addEventListener("change", reset);
    document.getElementById("t12-match").addEventListener("click", () => { c.fp.set(c.f0.value); });
    document.getElementById("t12-reset").addEventListener("click", reset);
    reset();
    const cv = document.getElementById("t12-sim");
    const io = new IntersectionObserver((en) => { sim.visible = en[0].isIntersecting; }, { threshold: 0.05 });
    io.observe(cv);
    window.addEventListener("resize", () => { sim.cssW = 0; });
    drawSim();
    requestAnimationFrame(loop);
  }

  function init() {
    initVideo();
    UI.onTheme(makeChart);
    makeChart();
    initSim();
  }
  return { init };
})();
