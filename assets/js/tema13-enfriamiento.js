/* =========================================================
   Tema 13 — Enfriamiento líquido de un centro de datos
   Visualización de datos: velocidad y presión del refrigerante a
   lo largo del circuito de un rack (CDU → tubería → manifold →
   manguera → placa fría → retorno), con continuidad (Q = A·v),
   Bernoulli y pérdidas por fricción de Darcy–Weisbach.
   ========================================================= */
window.Tema13 = (() => {
  // PG25 (25 % propilenglicol) a ≈ 35 °C, valores de diseño
  const FLUID = { rho: 1020, cp: 3900, mu: 2.0e-3 };
  const G = 9.81, P0 = 300000; // presión manométrica de salida de la CDU (Pa)
  const P_ATM = 101325, P_VAP = 5600; // presión atmosférica y de vapor (agua a 35 °C), en Pa
  let c = {}, charts = {}, last = null;

  /** Tramos del circuito en orden. share = fracción del caudal total que pasa por un solo conducto del tramo. */
  function circuit() {
    const N = c.n.value, D1 = c.d1.value / 1000, D2 = c.d2.value / 1000, D3 = c.d3.value / 1000;
    const cpA = c.cp.value * 1e-4; // sección de paso de una placa fría (m²)
    const cpDh = 0.8e-3; // diámetro hidráulico de los microcanales (m)
    return [
      { name: "Tubería de suministro (CDU → rack)", L: 10, D: D1, A: Math.PI * D1 * D1 / 4, share: 1, dz: 0 },
      { name: "Manifold vertical de suministro", L: 2, D: D2, A: Math.PI * D2 * D2 / 4, share: 1, dz: 2 },
      { name: "Manguera de una bandeja", L: 1, D: D3, A: Math.PI * D3 * D3 / 4, share: 1 / N, dz: 0 },
      { name: "Placa fría (microcanales)", L: 0.15, D: cpDh, A: cpA, share: 1 / N, dz: 0 },
      { name: "Manguera de retorno", L: 1, D: D3, A: Math.PI * D3 * D3 / 4, share: 1 / N, dz: 0 },
      { name: "Manifold vertical de retorno", L: 2, D: D2, A: Math.PI * D2 * D2 / 4, share: 1, dz: -2 },
      { name: "Tubería de retorno (rack → CDU)", L: 10, D: D1, A: Math.PI * D1 * D1 / 4, share: 1, dz: 0 },
    ];
  }

  function friction(Re) {
    if (Re < 2300) return 64 / Re; // laminar
    return 0.316 / Math.pow(Re, 0.25); // Blasius, tubo liso turbulento
  }

  function compute() {
    const P = c.p.value * 1000, dT = c.dt.value;
    const mdot = P / (FLUID.cp * dT); // kg/s
    const Q = mdot / FLUID.rho; // m³/s
    const segs = circuit();
    let x = 0, z = 0, pIdeal = P0, pReal = P0, loss = 0;
    const v0 = (Q * segs[0].share) / segs[0].A;
    const pts = [];
    segs.forEach((s) => {
      const q = Q * s.share, v = q / s.A, Re = (FLUID.rho * v * s.D) / FLUID.mu, f = friction(Re);
      s.v = v; s.q = q; s.Re = Re; s.f = f;
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const xi = x + (s.L * i) / n, zi = z + (s.dz * i) / n;
        const hl = f * ((s.L * i) / n / s.D) * 0.5 * FLUID.rho * v * v; // pérdida acumulada dentro del tramo
        // Bernoulli entre la salida de la CDU (v0, z=0) y este punto
        const pb = P0 + 0.5 * FLUID.rho * (v0 * v0 - v * v) - FLUID.rho * G * zi;
        pts.push({ x: xi, v, pIdeal: pb, pReal: pb - loss - hl, seg: s.name });
      }
      const segLoss = f * (s.L / s.D) * 0.5 * FLUID.rho * v * v;
      s.dp = segLoss;
      loss += segLoss; x += s.L; z += s.dz;
    });
    return { P, dT, mdot, Q, lpm: Q * 60000, segs, pts, loss };
  }

  function makeCharts() {
    Object.values(charts).forEach((ch) => ch.destroy());
    const opts = (x, y) => ({ interaction: { mode: "nearest", axis: "x", intersect: false }, plugins: { legend: { position: "top", align: "end" } }, scales: { x, y } });
    charts.v = new Chart(document.getElementById("t13-v"), { type: "line", data: { datasets: [] }, options: opts(UI.axis("Posición a lo largo del circuito (m)", { min: 0 }), UI.axis("Velocidad media del refrigerante v (m/s)", { min: 0 })) });
    charts.p = new Chart(document.getElementById("t13-pres"), { type: "line", data: { datasets: [] }, options: opts(UI.axis("Posición a lo largo del circuito (m)", { min: 0 }), UI.axis("Presión manométrica (kPa)")) });
    charts.a = new Chart(document.getElementById("t13-a"), {
      type: "scatter", data: { datasets: [] },
      options: {
        plugins: { legend: { position: "top", align: "end" }, tooltip: { callbacks: { label: (it) => `${it.raw.n || it.dataset.label}: A = ${UI.fmt(it.raw.x, 2)} cm², v = ${UI.fmt(it.raw.y, 2)} m/s` } } },
        scales: { x: UI.axis("Sección de paso A (cm², escala log)", { type: "logarithmic", min: 0.1, max: 100 }), y: UI.axis("Velocidad v = Q/A (m/s, escala log)", { type: "logarithmic", min: 0.05, max: 20 }) },
      },
    });
    update();
  }

  function update() {
    const P = UI.palette(), r = compute();
    last = r;
    const segBands = [];
    let x = 0; const cols = [P.line, "transparent"];
    r.segs.forEach((s, i) => { segBands.push({ from: x, to: x + s.L, color: i % 2 ? "transparent" : UI.css("--panel-2"), label: "" }); x += s.L; });
    charts.v.data.datasets = [{ label: "Velocidad v = Q_tramo / A_tramo", data: r.pts.map((p) => ({ x: p.x, y: p.v })), borderColor: P.accent, backgroundColor: P.accent, borderWidth: 2.6, stepped: true, parsing: false }];
    charts.v.options.scales.x.max = x; charts.v.$bands = segBands; charts.v.update("none");
    charts.p.data.datasets = [
      { label: "Bernoulli ideal (sin fricción)", data: r.pts.map((p) => ({ x: p.x, y: p.pIdeal / 1000 })), borderColor: P.muted, backgroundColor: P.muted, borderDash: [6, 5], parsing: false },
      { label: "Con pérdidas por fricción (Darcy–Weisbach)", data: r.pts.map((p) => ({ x: p.x, y: p.pReal / 1000 })), borderColor: P.pink, backgroundColor: P.pink, borderWidth: 2.6, parsing: false },
    ];
    charts.p.options.scales.x.max = x; charts.p.$bands = segBands; charts.p.update("none");
    // v en función de la sección: curvas v = Q/A para el caudal total y para el de una bandeja
    const curve = (q) => { const out = []; for (let e = -1; e <= 2; e += 0.05) { const A = Math.pow(10, e); out.push({ x: A, y: q / (A * 1e-4) }); } return out; };
    const uniq = []; r.segs.forEach((s) => { if (!uniq.find((u) => u.name.split(" ")[0] === s.name.split(" ")[0] && Math.abs(u.A - s.A) < 1e-9)) uniq.push(s); });
    charts.a.data.datasets = [
      { type: "line", label: `Caudal total Q = ${UI.fmt(r.lpm, 0)} L/min`, data: curve(r.Q), borderColor: P.accent, backgroundColor: P.accent, borderWidth: 1.6, pointRadius: 0, parsing: false },
      { type: "line", label: `Caudal de una bandeja Q/${c.n.value} = ${UI.fmt(r.lpm / c.n.value, 1)} L/min`, data: curve(r.Q / c.n.value), borderColor: P.amber, backgroundColor: P.amber, borderWidth: 1.6, pointRadius: 0, parsing: false },
      { label: "Tramos del circuito", data: r.segs.slice(0, 4).map((s) => ({ x: s.A * 1e4, y: s.v, n: s.name })), backgroundColor: P.text, pointRadius: 6, parsing: false },
    ];
    charts.a.update("none");

    const f = UI.fmt, cp = r.segs[3], hose = r.segs[2], main = r.segs[0];
    const pmin = Math.min(...r.pts.map((p) => p.pReal)) + P_ATM;
    document.getElementById("t13-ro").innerHTML = `
      <div class="ro"><div class="k">Caudal necesario Q = P / (ρ·c_p·ΔT)</div><div class="v">${f(r.lpm, 0)} <small>L/min (${f(r.lpm / (r.P / 1000), 2)} L/min por kW)</small></div></div>
      <div class="ro"><div class="k">Caudal por bandeja</div><div class="v">${f(r.lpm / c.n.value, 1)} <small>L/min</small></div></div>
      <div class="ro"><div class="k">v en la tubería principal</div><div class="v">${f(main.v, 2)} <small>m/s (Re ${f(main.Re, 0)})</small></div></div>
      <div class="ro"><div class="k">v en la manguera de una bandeja</div><div class="v">${f(hose.v, 2)} <small>m/s</small></div></div>
      <div class="ro"><div class="k">v en la placa fría</div><div class="v">${f(cp.v, 2)} <small>m/s (Re ${f(cp.Re, 0)}, ${cp.Re < 2300 ? "laminar" : "turbulento"})</small></div></div>
      <div class="ro"><div class="k">Caída de presión del circuito</div><div class="v">${f(r.loss / 1000, 1)} <small>kPa (${f(r.loss / 1e5, 2)} bar)</small></div></div>
      <div class="ro"><div class="k">Presión absoluta mínima (vapor: 5,6 kPa)</div><div class="v" style="color:var(${pmin > P_VAP ? "--green" : "--danger"})">${pmin > P_VAP ? f(pmin / 1000, 1) : "&lt; 5,6"} <small>kPa · ${pmin > P_VAP ? "sin cavitación" : "¡cavitación! la bomba no alcanza"}</small></div></div>
      <div class="ro"><div class="k">Chorro de una fuga a la salida de la CDU (Torricelli)</div><div class="v">${f(Math.sqrt((2 * P0) / FLUID.rho), 1)} <small>m/s</small></div></div>`;
    document.getElementById("t13-table").innerHTML = `
      <table class="compare"><thead><tr><th>Tramo</th><th class="num">D (mm)</th><th class="num">A (cm²)</th><th class="num">Q del conducto (L/min)</th><th class="num">v (m/s)</th><th class="num">Re</th><th class="num">Δp por fricción (kPa)</th></tr></thead>
      <tbody>${r.segs.map((s) => `<tr><td>${s.name}</td><td class="num">${f(s.D * 1000, 1)}</td><td class="num">${f(s.A * 1e4, 2)}</td><td class="num">${f(s.q * 60000, 1)}</td><td class="num">${f(s.v, 2)}</td><td class="num">${f(s.Re, 0)}</td><td class="num">${f(s.dp / 1000, 1)}</td></tr>`).join("")}</tbody></table>`;
  }

  function exportCSV() {
    if (!last) return;
    UI.downloadCSV("circuito_enfriamiento.csv", ["x_m", "tramo", "v_ms", "p_ideal_kPa", "p_real_kPa"], last.pts.map((p) => [p.x, `"${p.seg}"`, p.v, p.pIdeal / 1000, p.pReal / 1000]));
  }

  function init() {
    c.p = UI.bindRange("t13-p", (v) => `${v} kW`, update);
    c.dt = UI.bindRange("t13-dt", (v) => `${v} °C`, update);
    c.n = UI.bindRange("t13-n", (v) => `${v}`, update);
    c.d1 = UI.bindRange("t13-d1", (v) => `${v} mm`, update);
    c.d2 = UI.bindRange("t13-d2", (v) => `${v} mm`, update);
    c.d3 = UI.bindRange("t13-d3", (v) => `${UI.fmt(v, 1)} mm`, update);
    c.cp = UI.bindRange("t13-cp", (v) => `${UI.fmt(v, 2)} cm²`, update);
    document.getElementById("t13-csv").addEventListener("click", exportCSV);
    UI.onTheme(makeCharts);
    makeCharts();
  }
  return { init, compute: () => compute() };
})();
