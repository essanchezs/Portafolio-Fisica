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
      options: opts(UI.axis("Tiempo del ciclo t (s)", { min: 0 }), UI.axis("Velocidad (km/h)", Object.assign({ min: 0 }, fixW))),
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
          y: { stacked: true, grid: { display: false }, title: { display: true, text: "Flujo de energía", font: { weight: "600" } } },
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
    initDrive();
  }

  /* ---------- Exploración interactiva: manejar y frenar ---------- */
  const drv = { v: 0, x: 0, gas: false, brk: false, auto: null, Erec: 0, Eheat: 0, Econv: 0, Euse: 0, Prec: 0, Pb: 0, Pcap: 0, ev: null, lastEv: null, ctx: null, cssW: 0, w: 0, h: 0, raf: 0, last: 0, visible: false };
  const P_DRIVE = 150000; // potencia de tracción del modelo (W)

  function drvStep(dt) {
    const car = CARS[c.car.value], m = car.etw * LB;
    const eta = c.eta.value / 100, Pmax = c.pmax.value * 1000;
    const gas = drv.auto ? false : drv.gas;
    const brk = drv.auto ? true : drv.brk;
    const aB = drv.auto ? drv.auto : c.dbrake.value;
    const v = drv.v, s = v / MPH;
    const Frl = v > 0.05 ? (car.A + car.B * s + car.C * s * s) * LBF : 0;
    const Fm = gas && v < 50 ? Math.min(m * 3, P_DRIVE / Math.max(v, 1)) : 0;
    const Fb = brk && v > 0.01 ? m * aB : 0;
    const Pb = Fb * v; // potencia de frenado
    const fadeK = c.fade.checked ? Math.min(1, (v * 3.6) / FADE_KMH) : 1;
    const cap = Math.min(Pb, Pmax) * fadeK; // lo que absorbe el motor
    drv.Pb = Pb; drv.Pcap = cap; drv.Prec = cap * eta;
    drv.Erec += cap * eta * dt; drv.Econv += cap * (1 - eta) * dt; drv.Eheat += (Pb - cap) * dt; drv.Euse += (Fm * v * dt) / ETA_DRIVE;
    // frenada en curso: energía de frenado y cuánto volvió
    if (brk && v > 0.05) {
      if (!drv.ev) drv.ev = { v0: v, Eb: 0, Er: 0 };
      drv.ev.Eb += Pb * dt; drv.ev.Er += cap * eta * dt;
    } else if (drv.ev) { drv.lastEv = drv.ev; drv.ev = null; }
    drv.v = Math.max(0, v + ((Fm - Fb - Frl) / m) * dt);
    if (drv.v === 0 && drv.auto) { drv.auto = null; if (drv.ev) { drv.lastEv = drv.ev; drv.ev = null; } }
    drv.x += drv.v * dt;
  }

  function drvDraw() {
    const cv = document.getElementById("t6-drive");
    const cw = cv.parentElement.clientWidth;
    if (!drv.ctx || drv.cssW !== cw) { const r = UI.fitCanvas(cv, cw < 600 ? 1.5 : 0.4); Object.assign(drv, { ctx: r.ctx, w: r.w, h: r.h, cssW: cw }); }
    const { ctx, w, h } = drv, P = UI.palette(), f = UI.fmt;
    if (w < 80) return;
    const car = CARS[c.car.value], m = car.etw * LB;
    const narrow = w < 600;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = P.panel2; ctx.fillRect(0, 0, w, h);
    // ---- escena (arriba en celular, izquierda en escritorio)
    const sw = narrow ? w : w * 0.58, sh = narrow ? h * 0.42 : h;
    const roadY = sh * 0.72, pxm = 9; // píxeles por metro
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sw, sh); ctx.clip();
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    // postes de referencia cada 20 m (paralaje)
    for (let k = -1; k < sw / (20 * pxm * 0.6) + 2; k++) {
      const px = k * 20 * pxm * 0.6 - ((drv.x * pxm * 0.6) % (20 * pxm * 0.6));
      ctx.fillStyle = P.line; ctx.fillRect(px, roadY - 70, 3, 70);
      ctx.beginPath(); ctx.arc(px + 1.5, roadY - 72, 5, 0, 7); ctx.fill();
    }
    ctx.fillStyle = P.muted; ctx.fillRect(0, roadY, sw, 4);
    ctx.fillStyle = P.line; ctx.fillRect(0, roadY + 4, sw, sh - roadY - 4);
    for (let k = -1; k < sw / 60 + 2; k++) { const px = k * 60 - ((drv.x * pxm) % 60); ctx.fillStyle = P.faint; ctx.fillRect(px, roadY + 18, 30, 3); }
    // auto (vista lateral)
    const cx = sw * 0.42, L = Math.min(150, sw * 0.4), H = L * 0.27, wr = L * 0.11;
    const by = roadY - wr * 1.0;
    ctx.fillStyle = P.accent;
    ctx.beginPath();
    ctx.moveTo(cx - L / 2, by); ctx.lineTo(cx - L / 2, by - H * 0.55); ctx.quadraticCurveTo(cx - L * 0.45, by - H * 0.7, cx - L * 0.3, by - H * 0.72);
    ctx.lineTo(cx - L * 0.15, by - H * 1.25); ctx.lineTo(cx + L * 0.15, by - H * 1.25); ctx.lineTo(cx + L * 0.3, by - H * 0.72);
    ctx.quadraticCurveTo(cx + L * 0.5, by - H * 0.62, cx + L / 2, by - H * 0.3); ctx.lineTo(cx + L / 2, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.panel2; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(cx - L * 0.12, by - H * 1.15); ctx.lineTo(cx + L * 0.13, by - H * 1.15); ctx.lineTo(cx + L * 0.25, by - H * 0.76); ctx.lineTo(cx - L * 0.25, by - H * 0.76); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // luces de freno
    if ((drv.brk || drv.auto) && drv.v > 0.05) { ctx.fillStyle = P.danger; ctx.fillRect(cx - L / 2 - 2, by - H * 0.5, 5, H * 0.22); }
    const rot = drv.x / (wr / pxm);
    [cx - L * 0.3, cx + L * 0.3].forEach((wx) => {
      ctx.fillStyle = P.text; ctx.beginPath(); ctx.arc(wx, roadY - wr, wr, 0, 7); ctx.fill();
      ctx.strokeStyle = P.panel2; ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) { const a = rot + (k * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(wx, roadY - wr); ctx.lineTo(wx + Math.cos(a) * wr * 0.75, roadY - wr + Math.sin(a) * wr * 0.75); ctx.stroke(); }
    });
    // flujo de energía sobre el auto
    if (drv.Pb > 100) {
      UI.arrow(ctx, cx, by - H * 1.4, cx, by - H * 1.4 - 26, P.green, 3, 9);
      ctx.fillStyle = P.green; ctx.font = "600 11.5px Public Sans, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`a la batería ${f(drv.Prec / 1000, 0)} kW`, cx, by - H * 1.4 - 32);
      if (drv.Pb - drv.Pcap > 100) { ctx.fillStyle = P.danger; ctx.fillText(`calor en frenos ${f((drv.Pb - drv.Pcap) / 1000, 0)} kW`, cx, roadY + 38); }
      ctx.textAlign = "left";
    }
    ctx.restore();
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.beginPath(); if (narrow) { ctx.moveTo(0, sh); ctx.lineTo(w, sh); } else { ctx.moveTo(sw, 0); ctx.lineTo(sw, h); } ctx.stroke();
    ctx.fillStyle = P.text; ctx.font = "700 22px JetBrains Mono, monospace"; ctx.fillText(`${f(drv.v * 3.6, 0)} km/h`, 14, 30);
    ctx.fillStyle = P.muted; ctx.font = "11px Public Sans, sans-serif"; ctx.fillText(car.name, 14, 48);

    // ---- panel de energía
    const ox = narrow ? 14 : sw + 18, oy = narrow ? sh + 16 : 18, pw = narrow ? w - 28 : w - sw - 34;
    const K = 0.5 * m * drv.v * drv.v;
    const Eref = Math.max(0.5 * m * (130 / 3.6) ** 2, drv.Erec + drv.Eheat + drv.Econv, K);
    const rows = [
      ["Energía cinética ½mv²", K, P.violet],
      ["Volvió a la batería", drv.Erec, P.green],
      ["Pérdidas del motor", drv.Econv, P.amber],
      ["Calor en los frenos", drv.Eheat, P.danger],
    ];
    ctx.fillStyle = P.muted; ctx.font = "700 11px Public Sans, sans-serif"; ctx.fillText("ENERGÍA (Wh)", ox, oy + 8);
    rows.forEach(([lbl, val, col], i) => {
      const y = oy + 22 + i * 34;
      ctx.fillStyle = P.text; ctx.font = "12px Public Sans, sans-serif"; ctx.fillText(lbl, ox, y + 8);
      ctx.textAlign = "right"; ctx.font = "12px JetBrains Mono, monospace"; ctx.fillText(f(val / 3600, 1), ox + pw, y + 8); ctx.textAlign = "left";
      ctx.fillStyle = P.line; ctx.fillRect(ox, y + 14, pw, 7);
      ctx.fillStyle = col; ctx.fillRect(ox, y + 14, Math.min(pw, (val / Eref) * pw), 7);
    });
    // medidor de potencia de frenado contra el límite del motor
    const my = oy + 22 + 4 * 34 + 6;
    ctx.fillStyle = P.muted; ctx.font = "700 11px Public Sans, sans-serif"; ctx.fillText("POTENCIA DE FRENADO (kW)", ox, my + 8);
    const Pscale = Math.max(150000, drv.Pb) * 1.05;
    ctx.fillStyle = P.line; ctx.fillRect(ox, my + 16, pw, 12);
    ctx.fillStyle = P.green; ctx.fillRect(ox, my + 16, (drv.Pcap / Pscale) * pw, 12);
    ctx.fillStyle = P.danger; ctx.fillRect(ox + (drv.Pcap / Pscale) * pw, my + 16, ((drv.Pb - drv.Pcap) / Pscale) * pw, 12);
    const lx = ox + ((c.pmax.value * 1000) / Pscale) * pw;
    ctx.strokeStyle = P.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, my + 12); ctx.lineTo(lx, my + 32); ctx.stroke();
    ctx.fillStyle = P.text; ctx.font = "11px JetBrains Mono, monospace"; ctx.textAlign = lx > ox + pw - 60 ? "right" : "left";
    ctx.fillText(`límite ${c.pmax.value}`, lx + (ctx.textAlign === "right" ? -4 : 4), my + 44); ctx.textAlign = "left";

    const ev = drv.ev || drv.lastEv;
    document.getElementById("t6-drive-ro").innerHTML = `
      <div class="ro"><div class="k">Potencia de frenado P = F·v</div><div class="v">${f(drv.Pb / 1000, 1)} <small>kW</small></div></div>
      <div class="ro"><div class="k">${drv.ev ? "Frenada en curso" : "Última frenada"}: recuperado</div><div class="v" style="color:var(--green)">${ev && ev.Eb > 0 ? f((ev.Er / ev.Eb) * 100, 0) : "—"} <small>% de su energía</small></div></div>
      <div class="ro"><div class="k">Desde</div><div class="v">${ev ? f(ev.v0 * 3.6, 0) : "—"} <small>km/h</small></div></div>
      <div class="ro"><div class="k">Energía consumida al acelerar</div><div class="v">${f(drv.Euse / 3600, 1)} <small>Wh</small></div></div>`;
  }

  function drvLoop(now) {
    drv.raf = requestAnimationFrame(drvLoop);
    const dt = Math.min(0.05, (now - drv.last) / 1000 || 0); drv.last = now;
    if (!drv.visible) return;
    for (let k = 0; k < 4; k++) drvStep(dt / 4);
    drvDraw();
  }

  function initDrive() {
    c.dbrake = UI.bindRange("t6-dbrake", (v) => `${UI.fmt(v, 1)} m/s²`);
    const hold = (id, key) => {
      const b = document.getElementById(id);
      const on = (e) => { e.preventDefault(); drv.auto = null; drv[key] = true; b.setAttribute("aria-pressed", "true"); };
      const off = () => { drv[key] = false; b.setAttribute("aria-pressed", "false"); };
      b.addEventListener("pointerdown", on); ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, off));
    };
    hold("t6-gas", "gas"); hold("t6-brk", "brk");
    const cv = document.getElementById("t6-drive");
    cv.addEventListener("keydown", (e) => { if (e.key === "ArrowUp") { drv.gas = true; drv.auto = null; e.preventDefault(); } if (e.key === "ArrowDown") { drv.brk = true; drv.auto = null; e.preventDefault(); } });
    cv.addEventListener("keyup", (e) => { if (e.key === "ArrowUp") drv.gas = false; if (e.key === "ArrowDown") drv.brk = false; });
    document.querySelectorAll("[data-t6demo]").forEach((b) => b.addEventListener("click", () => {
      drv.v = 100 / 3.6; drv.auto = +b.dataset.t6demo; drv.ev = null; drv.lastEv = null;
      c.dbrake.set(drv.auto, true);
    }));
    const io = new IntersectionObserver((en) => { drv.visible = en[0].isIntersecting; }, { threshold: 0.05 });
    io.observe(cv);
    window.addEventListener("resize", () => { drv.cssW = 0; });
    drvDraw();
    drv.raf = requestAnimationFrame(drvLoop);
  }

  return { init, simulate, CARS, CYCLES };
})();
