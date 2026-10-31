/* =========================================================
   Tema 9 — Asistencia gravitatoria de las Voyager
   Visualización de datos: rapidez heliocéntrica de las sondas
   (efemérides de NASA/JPL Horizons), rapidez de escape del Sol
   y energía orbital específica en cada encuentro planetario.
   ========================================================= */
window.Tema9 = (() => {
  const GM_SUN = 1.32712440018e11; // km³/s²
  const AU = 149597870.7; // km
  let c = {}, charts = {}, D = null;

  const vEsc = (rAU) => Math.sqrt((2 * GM_SUN) / (rAU * AU));
  const energy = (v, rAU) => (v * v) / 2 - GM_SUN / (rAU * AU); // km²/s² = MJ/kg

  /** Valor de la serie en el instante t (año decimal) más cercano. */
  function at(series, t) {
    let lo = 0, hi = series.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (series[mid][0] < t) lo = mid; else hi = mid; }
    return Math.abs(series[lo][0] - t) < Math.abs(series[hi][0] - t) ? series[lo] : series[hi];
  }

  /** Rapidez antes y después de cada encuentro, medida a ±40 días (fuera del pozo del planeta). */
  function encounterTable() {
    const rows = [];
    ["v1", "v2"].forEach((k) => D.encounters[k].forEach((e) => {
      const b = at(D[k], e.t - 40 / 365.25), a = at(D[k], e.t + 40 / 365.25);
      rows.push({ probe: k === "v1" ? "Voyager 1" : "Voyager 2", k, ...e, vb: b[1], va: a[1], dv: a[1] - b[1], eb: energy(b[1], b[2]), ea: energy(a[1], a[2]) });
    }));
    return rows.sort((x, y) => x.t - y.t);
  }

  const RANGES = {
    all: [1977.6, 1992],
    v2j: [1979.3, 1979.75], v1j: [1979.0, 1979.35], v1s: [1980.7, 1981.05], v2s: [1981.5, 1981.82], v2u: [1985.9, 1986.25], v2n: [1989.45, 1989.85],
  };

  function makeCharts() {
    Object.values(charts).forEach((ch) => ch.destroy());
    const opts = (yTitle, extra = {}) => ({
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: {
        legend: { position: "top", align: "end" },
        tooltip: { callbacks: { title: (it) => yearToDate(it[0].parsed.x) } },
      },
      scales: { x: UI.axis("Fecha (año)", { ticks: { maxTicksLimit: 10, callback: (v) => (Number.isInteger(v) ? v : yearToDate(v, true)) } }), y: UI.axis(yTitle, extra) },
    });
    charts.v = new Chart(document.getElementById("t9-v"), { type: "line", data: { datasets: [] }, options: opts("Rapidez respecto al Sol (km/s)", { min: 0 }) });
    charts.e = new Chart(document.getElementById("t9-e"), { type: "line", data: { datasets: [] }, options: opts("Energía específica ε (MJ/kg)") });
    charts.dv = new Chart(document.getElementById("t9-dv"), {
      type: "bar", data: { labels: [], datasets: [] },
      options: {
        plugins: { legend: { position: "top", align: "end" }, tooltip: { callbacks: { label: (it) => `${it.dataset.label}: ${UI.fmt(it.raw, 2)} km/s` } } },
        scales: { x: { grid: { display: false }, title: { display: true, text: "Encuentro planetario (sonda · planeta)", font: { weight: "600" } } }, y: UI.axis("Rapidez respecto al Sol (km/s)", { min: 0 }) },
      },
    });
    update();
  }

  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function yearToDate(y, short) {
    const yr = Math.floor(y), frac = y - yr;
    const d = new Date(Date.UTC(yr, 0, 1) + frac * 365.25 * 86400000);
    return short ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  function update() {
    const P = UI.palette();
    const [x0, x1] = RANGES[c.range.value];
    const show = { v1: c.v1.checked, v2: c.v2.checked };
    const col = { v1: P.accent, v2: P.amber };
    const thin = (arr) => {
      const inR = arr.filter((p) => p[0] >= x0 - 0.02 && p[0] <= x1 + 0.02);
      const step = Math.max(1, Math.floor(inR.length / 900));
      return inR.filter((_, i) => i % step === 0);
    };
    const sets = [], esets = [];
    ["v1", "v2"].forEach((k) => {
      if (!show[k]) return;
      const name = k === "v1" ? "Voyager 1" : "Voyager 2";
      const s = thin(D[k]);
      sets.push({ label: name, data: s.map((p) => ({ x: p[0], y: p[1] })), borderColor: col[k], backgroundColor: col[k], borderWidth: 2.4, parsing: false });
      if (c.esc.checked) sets.push({ label: `Rapidez de escape del Sol en la posición de la ${name}`, data: s.map((p) => ({ x: p[0], y: vEsc(p[2]) })), borderColor: col[k], backgroundColor: col[k], borderDash: [5, 5], borderWidth: 1.3, parsing: false });
      esets.push({ label: name, data: s.map((p) => ({ x: p[0], y: energy(p[1], p[2]) })), borderColor: col[k], backgroundColor: col[k], borderWidth: 2.4, parsing: false });
    });
    esets.push({ label: "ε = 0: frontera entre órbita ligada y escape", data: [{ x: x0, y: 0 }, { x: x1, y: 0 }], borderColor: P.green, backgroundColor: P.green, borderDash: [6, 4], borderWidth: 1.4, parsing: false });

    const bands = [];
    ["v1", "v2"].forEach((k) => {
      if (!show[k]) return;
      D.encounters[k].forEach((e) => bands.push({ from: e.t - 0.004, to: e.t + 0.004, color: UI.css("--line"), label: `${k === "v1" ? "V1" : "V2"} · ${e.name}`, labelColor: col[k], labelDy: k === "v2" ? 15 : 0 }));
    });
    [charts.v, charts.e].forEach((ch, i) => {
      ch.data.datasets = i === 0 ? sets : esets;
      ch.options.scales.x.min = x0; ch.options.scales.x.max = x1;
      // en la gráfica angosta de energía se dejan solo las franjas, sin texto, para que no se encimen
      ch.$bands = bands.filter((b) => b.from >= x0 && b.to <= x1).map((b) => (i === 0 ? b : Object.assign({}, b, { label: "" })));
      ch.update("none");
    });

    // Δv por encuentro
    const rows = encounterTable().filter((r) => show[r.k]);
    charts.dv.data.labels = rows.map((r) => `${r.probe === "Voyager 1" ? "V1" : "V2"} · ${r.name}`);
    charts.dv.data.datasets = [
      { label: "40 días antes", data: rows.map((r) => r.vb), backgroundColor: P.muted },
      { label: "40 días después", data: rows.map((r) => r.va), backgroundColor: rows.map((r) => (r.dv >= 0 ? P.green : P.danger)) },
    ];
    charts.dv.update("none");

    const f = UI.fmt;
    document.getElementById("t9-table").innerHTML = `
      <table class="compare">
        <thead><tr><th>Sonda</th><th>Planeta</th><th>Máximo acercamiento</th><th class="num">r al Sol (UA)</th><th class="num">v antes (km/s)</th><th class="num">v después (km/s)</th><th class="num">Δv (km/s)</th><th class="num">v escape (km/s)</th><th class="num">ε antes → después (MJ/kg)</th></tr></thead>
        <tbody>${encounterTable().map((r) => `<tr><td>${r.probe}</td><td>${r.name}</td><td>${r.date}</td><td class="num">${f(r.r, 2)}</td><td class="num">${f(r.vb, 2)}</td><td class="num">${f(r.va, 2)}</td><td class="num" style="color:var(${r.dv >= 0 ? "--green" : "--danger"});font-weight:600">${r.dv >= 0 ? "+" : ""}${f(r.dv, 2)}</td><td class="num">${f(vEsc(r.r), 2)}</td><td class="num">${f(r.eb, 1)} → ${f(r.ea, 1)}</td></tr>`).join("")}</tbody>
      </table>`;

    const j2 = encounterTable().find((r) => r.k === "v2" && r.name === "Júpiter");
    document.getElementById("t9-ro").innerHTML = `
      <div class="ro"><div class="k">V2 en Júpiter: antes → después</div><div class="v">${f(j2.vb, 1)} → ${f(j2.va, 1)} <small>km/s</small></div></div>
      <div class="ro"><div class="k">Ganancia sin combustible</div><div class="v" style="color:var(--green)">+${f(j2.dv, 1)} <small>km/s</small></div></div>
      <div class="ro"><div class="k">ε antes → después</div><div class="v">${f(j2.eb, 0)} → ${f(j2.ea, 0)} <small>MJ/kg</small></div></div>
      <div class="ro"><div class="k">Escape del Sol a esa distancia</div><div class="v">${f(vEsc(j2.r), 1)} <small>km/s: ${j2.va > vEsc(j2.r) ? "ya escapa" : "aún ligada"}</small></div></div>`;
  }

  function exportCSV() {
    const rows = [];
    ["v1", "v2"].forEach((k) => D[k].forEach((p) => rows.push([k === "v1" ? "Voyager 1" : "Voyager 2", p[0], p[1], p[2], vEsc(p[2]), energy(p[1], p[2])])));
    UI.downloadCSV("voyager_rapidez_heliocentrica.csv", ["sonda", "anio", "v_kms", "r_UA", "v_escape_kms", "energia_MJkg"], rows);
  }

  function init() {
    D = window.VOYAGER_DATA;
    if (!D) return;
    c.range = document.getElementById("t9-range");
    c.v1 = document.getElementById("t9-show1");
    c.v2 = document.getElementById("t9-show2");
    c.esc = document.getElementById("t9-esc");
    [c.range, c.v1, c.v2, c.esc].forEach((el) => el.addEventListener("change", update));
    document.getElementById("t9-csv").addEventListener("click", exportCSV);
    UI.onTheme(makeCharts);
    makeCharts();
    initFly();
  }

  /* ---------- Exploración interactiva: diseñar una asistencia gravitatoria ---------- */
  // GM (km³/s²), radio ecuatorial (km) y rapidez orbital media (km/s)
  const PLANETS = {
    jup: { name: "Júpiter", GM: 1.26687e8, R: 71492, V: 13.07, col: "--amber" },
    sat: { name: "Saturno", GM: 3.7931e7, R: 60268, V: 9.69, col: "--amber" },
    nep: { name: "Neptuno", GM: 6.8365e6, R: 24764, V: 5.43, col: "--accent" },
  };
  const fly = { s: 0, ctx: null, cssW: 0, w: 0, h: 0, last: 0, visible: false };
  const rotv = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const norm = (v) => Math.hypot(v[0], v[1]);

  /** Hipérbola exacta del problema de dos cuerpos en el marco del planeta. */
  function flyModel() {
    const p = PLANETS[c.pl.value];
    const vinf = c.vinf.value, rp = c.rp.value * p.R;
    const e = 1 + (rp * vinf * vinf) / p.GM; // excentricidad
    const a = p.GM / (vinf * vinf); // semieje (valor absoluto)
    const delta = 2 * Math.asin(1 / e); // ángulo que gira la velocidad relativa
    const phi = (c.phi.value * Math.PI) / 180;
    const vin = [vinf * Math.cos(phi), vinf * Math.sin(phi)];
    const Vp = [p.V, 0];
    // los dos sentidos posibles de giro; "por detrás" es el que deja Δv a favor de V_p
    const outs = [1, -1].map((sg) => ({ sg, vout: rotv(vin, sg * delta) }));
    outs.forEach((o) => { o.gain = o.vout[0] - vin[0]; });
    outs.sort((x, y) => y.gain - x.gain);
    const pick = c.side.value === "back" ? outs[0] : outs[1];
    const sIn = [Vp[0] + vin[0], Vp[1] + vin[1]], sOut = [Vp[0] + pick.vout[0], Vp[1] + pick.vout[1]];
    return { p, vinf, rp, e, a, delta, phi, vin, vout: pick.vout, sg: pick.sg, Vp, sIn, sOut, dv: norm(sOut) - norm(sIn), dvMax: 2 * vinf * Math.sin(delta / 2) };
  }

  /** Posición en el marco del planeta para la anomalía hiperbólica F (km). */
  function hypPos(m, F) {
    // marco perifocal con el periapsis sobre +x; luego se rota para que la asíntota de llegada coincida con v_in
    const b = m.a * Math.sqrt(m.e * m.e - 1);
    let x = m.a * (m.e - Math.cosh(F)), y = b * Math.sinh(F);
    const dir0 = [m.a * 1, b * 1]; // dirección de llegada en el perifocal (F → −∞): (+a, +b) normalizada
    // con giro negativo se refleja la órbita
    if (m.sg < 0) y = -y;
    const d0 = m.sg < 0 ? [dir0[0], -dir0[1]] : dir0;
    const rot = Math.atan2(m.vin[1], m.vin[0]) - Math.atan2(d0[1], d0[0]);
    return rotv([x, y], rot);
  }

  function flyDraw() {
    const cv = document.getElementById("t9-play");
    const cw = cv.parentElement.clientWidth;
    if (!fly.ctx || fly.cssW !== cw) { const r = UI.fitCanvas(cv, cw < 600 ? 1.45 : 0.5); Object.assign(fly, { ctx: r.ctx, w: r.w, h: r.h, cssW: cw }); }
    const { ctx, w, h } = fly, P = UI.palette(), f = UI.fmt;
    if (w < 80) return;
    const m = flyModel(), narrow = w < 600;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = P.panel2; ctx.fillRect(0, 0, w, h);
    const pw = narrow ? w : w / 2, ph = narrow ? h / 2 : h;

    // ---- panel 1: marco del planeta
    const legend = (x, y, items) => items.forEach(([t, col], i) => {
      ctx.font = "600 11.5px JetBrains Mono, monospace"; const tw = ctx.measureText(t).width;
      ctx.fillStyle = P.panel2; ctx.globalAlpha = 0.85; ctx.fillRect(x - 3, y + i * 17 - 12, tw + 22, 16); ctx.globalAlpha = 1;
      ctx.fillStyle = col; ctx.fillRect(x, y + i * 17 - 5, 12, 3); ctx.fillText(t, x + 17, y + i * 17);
    });
    ctx.fillStyle = P.muted; ctx.font = "700 11px Public Sans, sans-serif"; ctx.fillText(`MARCO DE ${m.p.name.toUpperCase()}: LA RAPIDEZ NO CAMBIA`, 12, 18);
    ctx.font = "11px JetBrains Mono, monospace"; ctx.fillStyle = P.muted;
    ctx.fillText(`δ = ${f((m.delta * 180) / Math.PI, 1)}°  r_p = ${f(m.rp / 1000, 0)} mil km`, 12, 34);
    const top = 44, bot = ph - 44;
    const cx = pw / 2, cy = (top + bot) / 2;
    const view = Math.max(m.rp * 4, m.p.R * 6); // km desde el centro hasta el borde del dibujo
    const sc = (0.95 * Math.min(pw - 24, bot - top) / 2) / view;
    const X = (x) => cx + x * sc, Y = (y) => cy - y * sc;
    const rP = Math.max(9, m.p.R * sc);
    ctx.fillStyle = UI.css(m.p.col); ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(cx, cy, rP, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    UI.arrow(ctx, cx - rP * 0.6, cy, cx + rP * 0.6 + 2, cy, P.panel2, 2, 6); // sentido de avance del planeta
    // hipérbola hasta r = view
    const Fmax = Math.acosh(Math.max(1.0001, (view / m.a + 1) / m.e)); // r = a(e·cosh F − 1)
    ctx.strokeStyle = P.text; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const F = -Fmax + (2 * Fmax * i) / 200; const [x, y] = hypPos(m, F); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
    ctx.stroke();
    // sonda animada (tiempo físico: t ∝ e·sinh F − F)
    const tScale = Math.sqrt((m.a ** 3) / m.p.GM);
    const tMax = tScale * (m.e * Math.sinh(Fmax) - Fmax);
    const tNow = -tMax + (fly.s % 1) * 2 * tMax;
    let F = Math.asinh(tNow / tScale / m.e);
    for (let k = 0; k < 20; k++) F -= (m.e * Math.sinh(F) - F - tNow / tScale) / (m.e * Math.cosh(F) - 1);
    const [bx, by] = hypPos(m, F);
    ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(X(bx), Y(by), 5, 0, 7); ctx.fill();
    // flechas v∞ de entrada y salida, de la misma longitud, sobre los extremos de la trayectoria
    const L = Math.min(pw, bot - top) * 0.16;
    const pin = hypPos(m, -Fmax), pout = hypPos(m, Fmax);
    const ui = [m.vin[0] / m.vinf, -m.vin[1] / m.vinf], uo = [m.vout[0] / m.vinf, -m.vout[1] / m.vinf];
    UI.arrow(ctx, X(pin[0]), Y(pin[1]), X(pin[0]) + ui[0] * L, Y(pin[1]) + ui[1] * L, P.accent, 3, 10);
    UI.arrow(ctx, X(pout[0]) - uo[0] * L, Y(pout[1]) - uo[1] * L, X(pout[0]), Y(pout[1]), P.green, 3, 10);
    legend(12, ph - 26, [[`entra v∞ = ${f(m.vinf, 1)} km/s`, P.accent], [`sale  v∞ = ${f(m.vinf, 1)} km/s`, P.green]]);

    // ---- panel 2: suma de vectores en el marco del Sol
    ctx.save(); ctx.translate(narrow ? 0 : pw, narrow ? ph : 0);
    ctx.strokeStyle = P.line; ctx.beginPath(); if (narrow) { ctx.moveTo(0, 0); ctx.lineTo(w, 0); } else { ctx.moveTo(0, 0); ctx.lineTo(0, h); } ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = "700 11px Public Sans, sans-serif"; ctx.fillText("MARCO DEL SOL: v☉ = V_planeta + v_rel", 12, 18);
    // se encuadran los cuatro puntos del diagrama de velocidades
    const pts = [[0, 0], m.Vp, m.sIn, m.sOut];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const aT = 34, aB = ph - 82, aL = 20, aR = pw - 20;
    const k = Math.min((aR - aL) / Math.max(x1 - x0, 1e-6), (aB - aT) / Math.max(y1 - y0, 1e-6));
    const ox = aL + ((aR - aL) - (x1 - x0) * k) / 2 - x0 * k, oy = aT + ((aB - aT) - (y1 - y0) * k) / 2 + y1 * k;
    const tip = (v) => [ox + v[0] * k, oy - v[1] * k];
    const Vt = tip(m.Vp), rin = tip(m.sIn), rout = tip(m.sOut);
    UI.arrow(ctx, ox, oy, Vt[0], Vt[1], P.muted, 3, 11);
    ctx.setLineDash([5, 4]);
    UI.arrow(ctx, Vt[0], Vt[1], rin[0], rin[1], P.accent, 1.6, 8);
    UI.arrow(ctx, Vt[0], Vt[1], rout[0], rout[1], P.green, 1.6, 8);
    ctx.setLineDash([]);
    ctx.strokeStyle = P.faint; ctx.lineWidth = 1; ctx.beginPath();
    const a0 = Math.atan2(-m.vin[1], m.vin[0]), a1 = Math.atan2(-m.vout[1], m.vout[0]);
    ctx.arc(Vt[0], Vt[1], m.vinf * k * 0.35, a0, a1, m.sg > 0); ctx.stroke();
    UI.arrow(ctx, ox, oy, rin[0], rin[1], P.accent, 3.2, 12);
    UI.arrow(ctx, ox, oy, rout[0], rout[1], P.green, 3.2, 12);
    ctx.fillStyle = P.text; ctx.beginPath(); ctx.arc(ox, oy, 3, 0, 7); ctx.fill();
    legend(12, ph - 62, [[`V_p del planeta ${f(m.p.V, 1)} km/s`, P.muted], [`antes   ${f(norm(m.sIn), 2)} km/s`, P.accent], [`después ${f(norm(m.sOut), 2)} km/s`, P.green]]);
    ctx.font = "700 13px Public Sans, sans-serif"; ctx.fillStyle = m.dv >= 0 ? P.green : P.danger;
    ctx.fillText(`${m.dv >= 0 ? "Gana" : "Pierde"} ${f(Math.abs(m.dv), 2)} km/s sin combustible`, 12, ph - 8);
    ctx.restore();

    document.getElementById("t9-play-ro").innerHTML = `
      <div class="ro"><div class="k">v∞ entra = v∞ sale (marco del planeta)</div><div class="v">${f(m.vinf, 2)} <small>km/s</small></div></div>
      <div class="ro"><div class="k">Ángulo de desvío δ</div><div class="v">${f((m.delta * 180) / Math.PI, 1)} <small>°</small></div></div>
      <div class="ro"><div class="k">Rapidez respecto al Sol</div><div class="v">${f(norm(m.sIn), 2)} → ${f(norm(m.sOut), 2)} <small>km/s</small></div></div>
      <div class="ro"><div class="k">Δv (máximo posible 2v∞·sen(δ/2))</div><div class="v" style="color:var(${m.dv >= 0 ? "--green" : "--danger"})">${m.dv >= 0 ? "+" : ""}${f(m.dv, 2)} <small>(${f(m.dvMax, 2)}) km/s</small></div></div>`;
  }

  function flyLoop(now) {
    requestAnimationFrame(flyLoop);
    const dt = Math.min(0.05, (now - fly.last) / 1000 || 0); fly.last = now;
    if (!fly.visible) return;
    fly.s = Math.min(fly.s + dt / 4, 0.999); // un paso completo dura 4 s y se queda al final
    flyDraw();
  }

  function initFly() {
    c.pl = document.getElementById("t9-pl");
    c.side = document.getElementById("t9-side");
    const re = () => { fly.s = 0; flyDraw(); };
    c.vinf = UI.bindRange("t9-vinf", (v) => `${UI.fmt(v, 1)} km/s`, re);
    c.rp = UI.bindRange("t9-rp", (v) => `${UI.fmt(v, 1)} radios`, re);
    c.phi = UI.bindRange("t9-phi", (v) => `${v}°`, re);
    [c.pl, c.side].forEach((el) => el.addEventListener("change", re));
    document.getElementById("t9-fly").addEventListener("click", re);
    const cv = document.getElementById("t9-play");
    const io = new IntersectionObserver((en) => { fly.visible = en[0].isIntersecting; }, { threshold: 0.05 });
    io.observe(cv);
    window.addEventListener("resize", () => { fly.cssW = 0; flyDraw(); });
    UI.onTheme(flyDraw);
    flyDraw();
    requestAnimationFrame(flyLoop);
  }

  return { init, flyModel: () => flyModel(), encounterTable: () => (D ? encounterTable() : []), vEsc, energy };
})();
