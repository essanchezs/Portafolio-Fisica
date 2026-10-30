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
        scales: { x: { grid: { display: false } }, y: UI.axis("Rapidez respecto al Sol (km/s)", { min: 0 }) },
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
  }

  return { init, encounterTable: () => (D ? encounterTable() : []), vEsc, energy };
})();
