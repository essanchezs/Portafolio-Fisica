/* =========================================================
   Tema 6 — Frenado regenerativo en un vehículo eléctrico
   Visualización de datos: balance de energía segundo a segundo
   sobre los ciclos de manejo de la EPA, con la resistencia al
   avance F = A + Bv + Cv² publicada por la EPA para cada auto.
   ========================================================= */
window.Tema6 = (() => {
  const MPH = 0.44704, LBF = 4.4482216, LB = 0.45359237;
  // EPA Test Car List, año modelo 2025 (pruebas UDDS): masa equivalente de prueba y coeficientes objetivo
  const CARS = {
    model3: { name: "Tesla Model 3 Long Range RWD", etw: 4250, A: 27.02, B: 0.2873, C: 0.0122, test: "RTSL10086702" },
    leaf: { name: "Nissan Leaf", etw: 3875, A: 25.89, B: 0.3449, C: 0.01945, test: "JNSX10050525" },
    f150: { name: "Ford F-150 Lightning", etw: 6500, A: 38.74, B: 0.335, C: 0.03526, test: "NFMX10073310" },
  };
  const CYCLES = { udds: "Ciclo urbano UDDS (EPA)", hwfet: "Ciclo de carretera HWFET (EPA)" };
  const ETA_DRIVE = 0.88; // batería → ruedas al traccionar (supuesto)
  const FADE_KMH = 8; // por debajo de esta velocidad la regeneración se desvanece

  let c = {}, charts = {}, last = null;

  /** Recorre el ciclo segundo a segundo y devuelve las series y el balance de energía. */
  function simulate() {
    const car = CARS[c.car.value];
    const mph = window.DRIVE_CYCLES[c.cycle.value];
    const m = car.etw * LB;
    const eta = c.eta.value / 100, Pmax = c.pmax.value * 1000, fade = c.fade.checked;
    const n = mph.length;
    const v = mph.map((x) => x * MPH);
    const rows = [];
    let dist = 0, Eneed = 0, Erl = 0, Ebrake = 0, Erec = 0, Elimit = 0, Ebat = 0, EbatNo = 0;
    let Kpeak = 0;
    for (let i = 0; i < n; i++) {
      const a = (v[Math.min(n - 1, i + 1)] - v[Math.max(0, i - 1)]) / (i === 0 || i === n - 1 ? 1 : 2);
      const s = mph[i];
      const Frl = v[i] > 0.05 ? (car.A + car.B * s + car.C * s * s) * LBF : 0; // resistencia al avance (N)
      const Fw = m * a + Frl; // fuerza que deben dar las ruedas: ΣF = m a
      const P = Fw * v[i]; // potencia en las ruedas (W)
      let Prec = 0, Pfric = 0;
      if (P > 0) { Eneed += P; Erl += Frl * v[i]; Ebat += P / ETA_DRIVE; EbatNo += P / ETA_DRIVE; }
      else if (P < 0) {
        const Pb = -P;
        const kmh = v[i] * 3.6;
        const fadeK = fade ? Math.min(1, kmh / FADE_KMH) : 1;
        const Pcap = Math.min(Pb, Pmax) * fadeK; // lo que el motor puede absorber
        Prec = Pcap * eta;
        Pfric = Pb - Pcap;
        Ebrake += Pb; Erec += Prec; Elimit += Pfric;
        Ebat -= Prec;
      }
      Kpeak = Math.max(Kpeak, 0.5 * m * v[i] * v[i]);
      dist += v[i];
      rows.push({ t: i, kmh: v[i] * 3.6, a, Frl, P, Prec, Pfric, Ebat, EbatNo });
    }
    const J2kWh = 1 / 3.6e6;
    return {
      car, m, rows, dist,
      Eneed: Eneed * J2kWh, Erl: Erl * J2kWh, Ebrake: Ebrake * J2kWh, Erec: Erec * J2kWh,
      Econv: (Ebrake - Elimit) * (1 - eta) * J2kWh, Efric: Elimit * J2kWh,
      Ebat: Ebat * J2kWh, EbatNo: EbatNo * J2kWh, Kpeak,
    };
  }

  function makeCharts() {
    Object.values(charts).forEach((ch) => ch.destroy());
    const opts = (x, y, extra = {}) => ({
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: { legend: { position: "top", align: "end" } },
      scales: Object.assign({ x, y }, extra),
    });
    // eje y con ancho fijo para que las dos gráficas compartan la misma escala de tiempo
    const fixW = { afterFit: (sc) => { sc.width = 64; } };
    charts.v = new Chart(document.getElementById("t6-v"), {
      type: "line", data: { datasets: [] },
      options: opts(UI.axis("", { min: 0, display: false }), UI.axis("Velocidad (km/h)", Object.assign({ min: 0 }, fixW))),
    });
    charts.p = new Chart(document.getElementById("t6-p"), {
      type: "line", data: { datasets: [] },
      options: opts(UI.axis("Tiempo del ciclo t (s)", { min: 0 }), UI.axis("Potencia en las ruedas P = F·v (kW)", fixW)),
    });
    charts.E = new Chart(document.getElementById("t6-E"), {
      type: "line", data: { datasets: [] },
      options: opts(UI.axis("Tiempo del ciclo t (s)", { min: 0 }), UI.axis("Energía tomada de la batería (kWh)", { min: 0 })),
    });
    charts.bal = new Chart(document.getElementById("t6-bal"), {
      type: "bar", data: { labels: [], datasets: [] },
      options: {
        indexAxis: "y",
        plugins: { legend: { position: "top", align: "start" }, tooltip: { callbacks: { label: (it) => `${it.dataset.label}: ${UI.fmt(it.raw * 1000, 0)} Wh` } } },
        scales: {
          x: UI.axis("Energía en el ciclo (kWh)", { stacked: true, min: 0 }),
          y: { stacked: true, grid: { display: false } },
        },
      },
    });
    update();
  }

  function update() {
    const P = UI.palette();
    const r = simulate();
    last = r;
    const step = r.rows.length > 1000 ? 2 : 1;
    const pts = r.rows.filter((_, i) => i % step === 0);
    // A) velocidad y potencia
    charts.v.data.datasets = [
      { label: "Velocidad del ciclo (datos EPA)", data: pts.map((d) => ({ x: d.t, y: d.kmh })), borderColor: P.text, backgroundColor: P.text, borderWidth: 1.6, parsing: false },
    ];
    charts.v.options.scales.x.max = r.rows.length - 1;
    charts.v.update("none");
    charts.p.data.datasets = [
      { label: "Tracción (P > 0)", data: pts.map((d) => ({ x: d.t, y: Math.max(0, d.P) / 1000 })), borderColor: P.accent, backgroundColor: hexA(P.accent, 0.18), fill: "origin", borderWidth: 1, parsing: false },
      { label: "Frenado recuperado", data: pts.map((d) => ({ x: d.t, y: -d.Prec / 1000 })), borderColor: P.green, backgroundColor: hexA(P.green, 0.35), fill: "origin", borderWidth: 1, parsing: false },
      { label: "No recuperado (fricción y pérdidas)", data: pts.map((d) => ({ x: d.t, y: d.P < 0 ? d.P / 1000 : 0 })), borderColor: P.danger, backgroundColor: hexA(P.danger, 0.14), fill: "-1", borderWidth: 1, parsing: false, order: 3 },
    ];
    charts.p.options.scales.x.max = r.rows.length - 1;
    charts.p.update("none");
    // B) energía acumulada
    charts.E.data.datasets = [
      { label: "Sin frenado regenerativo", data: pts.map((d) => ({ x: d.t, y: d.EbatNo / 3.6e6 })), borderColor: P.muted, backgroundColor: P.muted, borderDash: [6, 5], parsing: false },
      { label: "Con frenado regenerativo", data: pts.map((d) => ({ x: d.t, y: d.Ebat / 3.6e6 })), borderColor: P.green, backgroundColor: P.green, borderWidth: 2.6, parsing: false },
    ];
    charts.E.options.scales.x.max = r.rows.length - 1;
    charts.E.update("none");
    // C) balance
    const kin = Math.max(0, r.Eneed - r.Erl);
    charts.bal.data.labels = ["Trabajo de las ruedas al traccionar", "Energía de las frenadas (−ΔK)"];
    charts.bal.data.datasets = [
      { label: "Vencer la resistencia (aire, rodadura, transmisión)", data: [r.Erl, 0], backgroundColor: P.muted },
      { label: "Energía cinética ganada (½mv²)", data: [kin, 0], backgroundColor: P.violet },
      { label: "Vuelve a la batería", data: [0, r.Erec], backgroundColor: P.green },
      { label: "Pérdidas en motor e inversor", data: [0, r.Econv], backgroundColor: P.amber },
      { label: "Frenos de fricción (calor)", data: [0, r.Efric], backgroundColor: P.danger },
    ];
    charts.bal.update("none");

    const f = UI.fmt, km = r.dist / 1000;
    const save = r.EbatNo > 0 ? (1 - r.Ebat / r.EbatNo) * 100 : 0;
    document.getElementById("t6-ro").innerHTML = `
      <div class="ro"><div class="k">Distancia del ciclo</div><div class="v">${f(km, 2)} <small>km</small></div></div>
      <div class="ro"><div class="k">Masa (EPA)</div><div class="v">${f(r.m, 0)} <small>kg</small></div></div>
      <div class="ro"><div class="k">Energía de las frenadas</div><div class="v">${f(r.Ebrake * 1000, 0)} <small>Wh</small></div></div>
      <div class="ro"><div class="k">Recuperada a la batería</div><div class="v">${f(r.Erec * 1000, 0)} <small>Wh (${f(r.Ebrake > 0 ? (r.Erec / r.Ebrake) * 100 : 0, 0)} % del frenado)</small></div></div>
      <div class="ro"><div class="k">Consumo sin regeneración</div><div class="v">${f((r.EbatNo * 1000) / km, 0)} <small>Wh/km</small></div></div>
      <div class="ro"><div class="k">Consumo con regeneración</div><div class="v">${f((r.Ebat * 1000) / km, 0)} <small>Wh/km</small></div></div>
      <div class="ro"><div class="k">Ahorro de energía</div><div class="v" style="color:var(--green)">${f(save, 1)} <small>%</small></div></div>
      <div class="ro"><div class="k">Autonomía extra equivalente</div><div class="v">${f(r.Ebat > 0 ? (r.EbatNo / r.Ebat - 1) * 100 : 0, 1)} <small>%</small></div></div>`;
    document.getElementById("t6-carnote").textContent =
      `${r.car.name}: masa equivalente ${r.car.etw} lb (${f(r.m, 0)} kg), A = ${r.car.A} lbf, B = ${r.car.B} lbf/mph, C = ${r.car.C} lbf/mph² (prueba EPA ${r.car.test}).`;
  }

  function hexA(color, a) {
    const m = String(color).match(/^#([0-9a-f]{6})$/i);
    if (!m) return color;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function exportCSV() {
    if (!last) return;
    UI.downloadCSV(`frenado_${c.car.value}_${c.cycle.value}.csv`,
      ["t_s", "v_kmh", "a_ms2", "F_resistencia_N", "P_ruedas_W", "P_recuperada_W", "P_friccion_W", "E_bateria_J"],
      last.rows.map((d) => [d.t, d.kmh, d.a, d.Frl, d.P, d.Prec, d.Pfric, d.Ebat]));
  }

  function init() {
    if (!window.DRIVE_CYCLES) return;
    c.car = document.getElementById("t6-car");
    c.cycle = document.getElementById("t6-cycle");
    c.fade = document.getElementById("t6-fade");
    c.eta = UI.bindRange("t6-eta", (v) => `${v} %`, update);
    c.pmax = UI.bindRange("t6-pmax", (v) => `${v} kW`, update);
    [c.car, c.cycle, c.fade].forEach((el) => el.addEventListener("change", update));
    document.getElementById("t6-csv").addEventListener("click", exportCSV);
    UI.onTheme(makeCharts);
    makeCharts();
  }

  return { init, simulate, CARS, CYCLES };
})();
