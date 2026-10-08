/* =========================================================
   Tema 4 — Llantas de F1: ventana de temperatura y agarre
   Visualización de datos: μ(T) por compuesto (ventanas reales
   de Pirelli 2019), F_y,max(F_z) y velocidad máxima en curva.
   ========================================================= */
window.Tema4 = (() => {
  // Rangos de trabajo publicados por Pirelli para 2019 (°C)
  const COMPOUNDS = {
    C1: { lo: 110, hi: 140, mu: 1.60 },
    C2: { lo: 110, hi: 135, mu: 1.65 },
    C3: { lo: 105, hi: 135, mu: 1.70 },
    C4: { lo: 90, hi: 120, mu: 1.75 },
    C5: { lo: 85, hi: 115, mu: 1.80 },
  };
  const COLD_FRAC = 0.5; // agarre residual muy lejos de la ventana (fracción de μmax)
  const EDGE_KEEP = 0.95; // en los bordes de la ventana se conserva el 95 %
  const FZ0 = 4000; // carga nominal (N)
  const CAR = { m: 798, rho: 1.225, CLA: 4.5, g: 9.81 };

  let c = {}, charts = {};

  function muT(comp, T) {
    const k = COMPOUNDS[comp];
    const Tc = (k.lo + k.hi) / 2, hw = (k.hi - k.lo) / 2;
    const sigLow = hw / Math.sqrt(-Math.log(EDGE_KEEP));
    const sig = T < Tc ? sigLow : sigLow * 0.6; // cae más rápido por sobrecalentamiento
    const bell = Math.exp(-(((T - Tc) / sig) ** 2));
    return k.mu * (COLD_FRAC + (1 - COLD_FRAC) * bell);
  }

  function muLoad(mu0, Fz, p) {
    return Math.max(0.15, mu0 * (1 + p * (Fz - FZ0) / FZ0));
  }

  /** Velocidad máxima en curva de radio R (m/s). model: 'noaero' | 'coulomb' | 'mf' */
  function vmax(R, mu0, p, model) {
    const { m, rho, CLA, g } = CAR;
    const VCAP = 95; // ~340 km/h: tope de velocidad del auto
    if (model === "noaero") return Math.min(VCAP, Math.sqrt(mu0 * g * R));
    const grip = (v) => {
      const N = m * g + 0.5 * rho * CLA * v * v;
      if (model === "coulomb") return mu0 * N;
      const Fz = N / 4;
      return 4 * muLoad(mu0, Fz, p) * Fz;
    };
    // buscar la mayor v con m v²/R ≤ agarre(v)
    if (m * VCAP * VCAP / R <= grip(VCAP)) return VCAP;
    let lo = 0, hi = VCAP;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (m * mid * mid / R <= grip(mid)) lo = mid; else hi = mid;
    }
    return lo;
  }

  function hexA(color, a) {
    const m = color.match(/^#([0-9a-f]{6})$/i);
    if (!m) return color;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function compColors(P) {
    return { C1: P.muted, C2: P.violet, C3: P.amber, C4: P.pink, C5: P.accent };
  }

  function makeCharts() {
    Object.values(charts).forEach((ch) => ch.destroy());
    const P = UI.palette();
    const cols = compColors(P);
    const sel = c.comp.value;

    // --- μ(T)
    const Ts = []; for (let T = 30; T <= 180; T += 1) Ts.push(T);
    const sets = Object.keys(COMPOUNDS).map((k) => ({
      label: `${k} (${COMPOUNDS[k].lo}–${COMPOUNDS[k].hi} °C)`,
      data: Ts.map((T) => ({ x: T, y: muT(k, T) })),
      borderColor: cols[k], backgroundColor: cols[k],
      borderWidth: k === sel ? 3.4 : 1.4,
      parsing: false, order: k === sel ? 0 : 1,
    }));
    charts.muT = new Chart(document.getElementById("t4-muT"), {
      type: "line",
      data: { datasets: sets },
      options: {
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: { legend: { position: "top", align: "end" } },
        scales: {
          x: UI.axis("Temperatura de la superficie de la llanta T (°C)", { min: 30, max: 180 }),
          y: UI.axis("Coeficiente de agarre máximo μ (adimensional)", { min: 0.7, max: 1.9 }),
        },
      },
    });

    // --- F_y,max vs F_z
    const Fzs = []; for (let F = 0; F <= 12000; F += 100) Fzs.push(F);
    charts.FyFz = new Chart(document.getElementById("t4-FyFz"), {
      type: "line",
      data: { datasets: [] },
      options: {
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: { legend: { position: "top", align: "end" } },
        scales: {
          x: UI.axis("Carga vertical por llanta F_z (kN)", { min: 0, max: 12 }),
          y: UI.axis("Fuerza lateral máxima F_y,max (kN)", { min: 0 }),
        },
      },
    });
    charts.FyFz.$Fzs = Fzs;

    // --- v_max vs R
    charts.vR = new Chart(document.getElementById("t4-vR"), {
      type: "line",
      data: { datasets: [] },
      options: {
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: { legend: { position: "top", align: "end" } },
        scales: {
          x: UI.axis("Radio de la curva R (m)", { min: 15, max: 400 }),
          y: UI.axis("Velocidad máxima en curva (km/h)", { min: 0, max: 360 }),
        },
      },
    });
    update();
  }

  function update() {
    const P = UI.palette();
    const sel = c.comp.value, T = c.T.value, Fz = c.Fz.value, p = c.pdy2.value, R = c.R.value, dF = c.dfz.value;
    const k = COMPOUNDS[sel];
    const mu0 = muT(sel, T);
    const cols = compColors(P);

    // μ(T): resaltar compuesto, franja y cursor
    charts.muT.data.datasets.forEach((d) => {
      const key = d.label.slice(0, 2);
      d.borderWidth = key === sel ? 3.4 : 1.3;
      d.borderColor = key === sel ? cols[key] : hexA(cols[key], 0.55);
    });
    charts.muT.$bands = [{ from: k.lo, to: k.hi, color: hexA(cols[sel], 0.14), label: `Ventana Pirelli ${sel}: ${k.lo}–${k.hi} °C`, labelColor: cols[sel] }];
    charts.muT.$cursorX = T;
    charts.muT.update("none");

    // F_y vs F_z
    const Fzs = charts.FyFz.$Fzs;
    const staticFz = (CAR.m * CAR.g) / 4;
    const aeroFz = (CAR.m * CAR.g + 0.5 * CAR.rho * CAR.CLA * (250 / 3.6) ** 2) / 4;
    charts.FyFz.data.datasets = [
      { label: "Modelo simple F = μN", data: Fzs.map((F) => ({ x: F / 1000, y: (mu0 * F) / 1000 })), borderColor: P.muted, backgroundColor: P.muted, borderDash: [6, 5], parsing: false },
      { label: `Con sensibilidad a la carga (p_Dy2 = ${p.toFixed(2)})`, data: Fzs.map((F) => ({ x: F / 1000, y: (muLoad(mu0, F, p) * F) / 1000 })), borderColor: cols[sel], backgroundColor: cols[sel], borderWidth: 3, parsing: false },
      { label: "F_z elegido", type: "scatter", data: [{ x: Fz / 1000, y: (muLoad(mu0, Fz, p) * Fz) / 1000 }], backgroundColor: P.text, pointRadius: 5, parsing: false },
    ];
    charts.FyFz.$bands = [
      { from: staticFz / 1000 - 0.04, to: staticFz / 1000 + 0.04, color: hexA(P.green, 0.7), label: "en reposo", labelColor: P.green },
      { from: aeroFz / 1000 - 0.04, to: aeroFz / 1000 + 0.04, color: hexA(P.amber, 0.7), label: "a 250 km/h", labelColor: P.amber },
    ];
    charts.FyFz.update("none");

    // v_max vs R
    const Rs = []; for (let r = 15; r <= 400; r += 5) Rs.push(r);
    const kmh = (v) => v * 3.6;
    charts.vR.data.datasets = [
      { label: "Sin carga aerodinámica", data: Rs.map((r) => ({ x: r, y: kmh(vmax(r, mu0, p, "noaero")) })), borderColor: P.muted, backgroundColor: P.muted, borderDash: [6, 5], parsing: false },
      { label: "Con aero, F = μN", data: Rs.map((r) => ({ x: r, y: kmh(vmax(r, mu0, p, "coulomb")) })), borderColor: P.violet, backgroundColor: P.violet, parsing: false },
      { label: "Con aero y sensibilidad a la carga", data: Rs.map((r) => ({ x: r, y: kmh(vmax(r, mu0, p, "mf")) })), borderColor: cols[sel], backgroundColor: cols[sel], borderWidth: 3, parsing: false },
    ];
    charts.vR.$cursorX = R;
    charts.vR.update("none");

    // lecturas
    const f = UI.fmt;
    const FyC = mu0 * Fz, FyM = muLoad(mu0, Fz, p) * Fz;
    const F1 = Math.max(0, Fz - dF), F2 = Fz + dF;
    const axleC = mu0 * (F1 + F2);
    const axleM = muLoad(mu0, F1, p) * F1 + muLoad(mu0, F2, p) * F2;
    const axle0 = 2 * muLoad(mu0, Fz, p) * Fz;
    const vMF = vmax(R, mu0, p, "mf"), vNA = vmax(R, mu0, p, "noaero");
    const inWin = T >= k.lo && T <= k.hi;
    document.getElementById("t4-ro").innerHTML = `
      <div class="ro"><div class="k">μ de ${sel} a ${T} °C</div><div class="v">${f(mu0, 3)} <small>${inWin ? "dentro de la ventana" : "fuera de la ventana"}</small></div></div>
      <div class="ro"><div class="k">Agarre vs. su máximo</div><div class="v">${f((mu0 / k.mu) * 100, 1)} <small>%</small></div></div>
      <div class="ro"><div class="k">F_y,max simple (μN)</div><div class="v">${f(FyC / 1000, 2)} <small>kN</small></div></div>
      <div class="ro"><div class="k">F_y,max con sensibilidad</div><div class="v">${f(FyM / 1000, 2)} <small>kN (${f(((FyM - FyC) / FyC) * 100, 1)} %)</small></div></div>
      <div class="ro"><div class="k">Eje con ΔF_z = ${f(dF, 0)} N</div><div class="v">${f(axleM / 1000, 2)} <small>kN vs ${f(axle0 / 1000, 2)} sin transferencia</small></div></div>
      <div class="ro"><div class="k">Agarre perdido por transferencia</div><div class="v">${f(((axle0 - axleM) / axle0) * 100, 1)} <small>% (Coulomb: ${f(((2 * mu0 * Fz - axleC) / (2 * mu0 * Fz)) * 100, 1)} %)</small></div></div>
      <div class="ro"><div class="k">v máx en R = ${R} m</div><div class="v">${f(vMF * 3.6, 0)} <small>km/h (sin aero: ${f(vNA * 3.6, 0)})</small></div></div>
      <div class="ro"><div class="k">Aceleración lateral</div><div class="v">${f((vMF * vMF) / R / 9.81, 2)} <small>g</small></div></div>
    `;
  }

  function exportCSV() {
    const rows = [];
    for (let T = 30; T <= 180; T += 1) rows.push([T, ...Object.keys(COMPOUNDS).map((k) => muT(k, T))]);
    UI.downloadCSV("llantas_mu_vs_temperatura.csv", ["T_C", "mu_C1", "mu_C2", "mu_C3", "mu_C4", "mu_C5"], rows);
  }

  function init() {
    c.comp = document.getElementById("t4-comp");
    c.T = UI.bindRange("t4-T", (v) => `${v} °C`, update);
    c.Fz = UI.bindRange("t4-Fz", (v) => `${UI.fmt(v / 1000, 2)} kN`, update);
    c.pdy2 = UI.bindRange("t4-pdy2", (v) => UI.fmt(v, 2), update);
    c.R = UI.bindRange("t4-R", (v) => `${v} m`, update);
    c.dfz = UI.bindRange("t4-dfz", (v) => `${UI.fmt(v, 0)} N`, update);
    c.comp.addEventListener("change", update);
    document.getElementById("t4-csv").addEventListener("click", exportCSV);
    UI.onTheme(makeCharts);
    makeCharts();
  }

  return { init };
})();
