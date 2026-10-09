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

  /* ---------- Zona interactiva: tomar una curva con un F1 ---------- */
  const lap = { t: 0, running: false, raf: 0, ctx: null, cssW: 0, w: 0, h: 0, result: null };
  const HALF_ROAD = 7; // media anchura de la pista (m)

  function lapModel() {
    const sel = c.comp.value, T = c.T.value, R = c.R.value, p = c.pdy2.value;
    const mu0 = muT(sel, T);
    const v = c.vin.value / 3.6;
    const vMax = vmax(R, mu0, p, "mf");
    const { m, rho, CLA, g } = CAR;
    const N = m * g + 0.5 * rho * CLA * v * v;
    const aAvail = (4 * muLoad(mu0, N / 4, p) * (N / 4)) / m; // aceleración lateral que la fricción puede dar
    const aNeed = (v * v) / R;
    const Ract = aNeed > aAvail ? (v * v) / aAvail : R; // radio que la llanta logra sostener
    return { sel, T, R, mu0, v, vMax, aAvail, aNeed, Ract, ok: aNeed <= aAvail };
  }

  function tireColor(sel, T, P) {
    const k = COMPOUNDS[sel];
    if (T < k.lo) return P.accent; // fría
    if (T > k.hi) return P.danger; // sobrecalentada
    return P.green; // dentro de la ventana
  }

  /** Posición sobre un arco de radio Rr que arranca en (0,0) hacia +y y gira a la derecha. */
  function arcPos(Rr, s) {
    const phi = Math.PI - s / Rr;
    return { x: Rr + Rr * Math.cos(phi), y: Rr * Math.sin(phi), head: Math.atan2(-Math.cos(phi), Math.sin(phi)) };
  }

  function drawLap() {
    const cv = document.getElementById("t4-play");
    const cssW = cv.parentElement.clientWidth;
    if (!lap.ctx || lap.cssW !== cssW) { const r = UI.fitCanvas(cv, window.innerWidth < 700 ? 0.9 : 0.46); Object.assign(lap, { ctx: r.ctx, w: r.w, h: r.h, cssW }); }
    const { ctx, w, h } = lap, P = UI.palette(), m = lapModel();
    const R = m.R, arcLen = (Math.PI / 2) * R;
    // encuadre: recta de entrada, curva de 90° y recta de salida
    const minX = -HALF_ROAD - 30, maxX = R + R * 0.35 + 30, minY = -R * 0.45, maxY = R + HALF_ROAD + 30;
    const sc = Math.min((w - 30) / (maxX - minX), (h - 30) / (maxY - minY));
    const X = (x) => 15 + (x - minX) * sc, Y = (y) => h - 15 - (y - minY) * sc;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = P.panel2; ctx.fillRect(0, 0, w, h);
    // grava (zona de escape) y pista
    const road = (Rr, col, width) => {
      ctx.strokeStyle = col; ctx.lineWidth = width * sc; ctx.lineCap = "butt";
      ctx.beginPath(); ctx.moveTo(X(0), Y(minY)); ctx.lineTo(X(0), Y(0));
      for (let i = 0; i <= 60; i++) { const q = arcPos(Rr, (arcLen * i) / 60); ctx.lineTo(X(q.x), Y(q.y)); }
      ctx.lineTo(X(maxX), Y(R)); ctx.stroke();
    };
    road(R, hexA(P.amber, 0.18), HALF_ROAD * 2 + 24);
    road(R, P.line, HALF_ROAD * 2);
    // pianos (curbs) en el borde interior y exterior
    ctx.setLineDash([6, 6]); ctx.strokeStyle = P.danger; ctx.lineWidth = 3;
    [R - HALF_ROAD, R + HALF_ROAD].forEach((rr) => {
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) { const a = Math.PI - (Math.PI / 2) * (i / 60); const x = R + rr * Math.cos(a), y = rr * Math.sin(a); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.fillStyle = P.muted; ctx.font = "600 11px Public Sans, sans-serif";
    ctx.fillText(`Curva de R = ${R} m`, X(R) - 40, Y(R * 0.35));
    ctx.fillText("zona de escape (grava)", X(R + HALF_ROAD + 4), Y(R * 0.2));

    // trayectoria del auto: si la fricción no alcanza, describe un arco más abierto (R_real = v²/a_max)
    const travel = lap.t * m.v; // metros recorridos
    const sOnArc = Math.min(travel, (Math.PI / 2) * m.Ract);
    let pos = arcPos(m.Ract, sOnArc);
    let offRoad = false;
    if (!m.ok) {
      const dist = Math.hypot(pos.x - R, pos.y) - R; // cuánto se abrió respecto al centro de la pista
      offRoad = dist > HALF_ROAD;
    }
    if (travel > (Math.PI / 2) * m.Ract) { const extra = travel - (Math.PI / 2) * m.Ract; pos = { x: pos.x + extra, y: pos.y, head: 0 }; }
    // huellas de derrape
    if (!m.ok && lap.t > 0) {
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2;
      ctx.beginPath(); for (let i = 0; i <= 40; i++) { const q = arcPos(m.Ract, (sOnArc * i) / 40); i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y)); } ctx.stroke();
    }
    // auto (vista superior) con llantas coloreadas por temperatura
    const carL = Math.max(5.6 * sc, 40), carW = Math.max(2 * sc, 16);
    const tc = tireColor(m.sel, m.T, P);
    ctx.save(); ctx.translate(X(pos.x), Y(pos.y)); ctx.rotate(-pos.head);
    ctx.fillStyle = tc;
    [[0.3, 0.55], [0.3, -0.55], [-0.32, 0.55], [-0.32, -0.55]].forEach(([fx, fy]) => ctx.fillRect(fx * carL - carL * 0.09, fy * carW - carW * 0.18, carL * 0.18, carW * 0.36));
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.moveTo(carL * 0.5, 0); ctx.lineTo(carL * 0.1, carW * 0.28); ctx.lineTo(-carL * 0.45, carW * 0.32); ctx.lineTo(-carL * 0.45, -carW * 0.32); ctx.lineTo(carL * 0.1, -carW * 0.28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.text; ctx.fillRect(-carL * 0.5, -carW * 0.5, carL * 0.08, carW); // alerón trasero
    ctx.fillRect(carL * 0.42, -carW * 0.45, carL * 0.06, carW * 0.9); // alerón delantero
    ctx.restore();

    // mensaje
    const done = lap.t > 0 && travel >= (Math.PI / 2) * m.Ract;
    if (lap.t > 0 && (done || offRoad)) {
      ctx.font = "800 16px Public Sans, sans-serif";
      ctx.fillStyle = m.ok ? P.green : P.danger;
      ctx.fillText(m.ok ? "✓ ¡Tomó la curva!" : "✗ ¡Se salió a la grava!", 16, 26);
    }
    // medidor de g lateral
    const gx = w - 150, gy = 18;
    ctx.fillStyle = P.muted; ctx.font = "600 11px Public Sans, sans-serif"; ctx.fillText("g lateral: pedido vs. disponible", gx - 30, gy);
    const bar = (val, y, col, label) => {
      const max = Math.max(m.aNeed, m.aAvail) / 9.81 * 1.15;
      ctx.fillStyle = P.line; ctx.fillRect(gx - 30, y, 170, 8);
      ctx.fillStyle = col; ctx.fillRect(gx - 30, y, (val / 9.81 / max) * 170, 8);
      ctx.fillStyle = P.text; ctx.font = "11px JetBrains Mono, monospace"; ctx.fillText(`${label} ${UI.fmt(val / 9.81, 2)} g`, gx - 30, y + 22);
    };
    bar(m.aNeed, gy + 8, m.ok ? P.accent : P.danger, "pide");
    bar(m.aAvail, gy + 38, tc, "da  ");

    const f = UI.fmt;
    document.getElementById("t4-play-ro").innerHTML = `
      <div class="ro"><div class="k">Velocidad máxima en esta curva</div><div class="v">${f(m.vMax * 3.6, 0)} <small>km/h</small></div></div>
      <div class="ro"><div class="k">a pedida = v²/R</div><div class="v">${f(m.aNeed / 9.81, 2)} <small>g</small></div></div>
      <div class="ro"><div class="k">a disponible = μN/m</div><div class="v">${f(m.aAvail / 9.81, 2)} <small>g</small></div></div>
      <div class="ro"><div class="k">Llantas (${m.sel} a ${m.T} °C)</div><div class="v" style="color:${tc}">${m.T < COMPOUNDS[m.sel].lo ? "frías" : m.T > COMPOUNDS[m.sel].hi ? "sobrecalentadas" : "en ventana"}</div></div>`;
  }

  function runLap() {
    cancelAnimationFrame(lap.raf);
    const m = lapModel();
    lap.t = 0;
    const total = ((Math.PI / 2) * m.Ract + 40) / m.v; // segundos reales hasta salir de la curva
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { lap.t = total; drawLap(); return; }
    const speedup = total / 2.6; // la animación dura ~2,6 s
    let last = performance.now();
    const stepAnim = (now) => {
      lap.t += ((now - last) / 1000) * speedup; last = now;
      drawLap();
      if (lap.t < total) lap.raf = requestAnimationFrame(stepAnim);
    };
    lap.raf = requestAnimationFrame(stepAnim);
  }

  function initLap() {
    c.vin = UI.bindRange("t4-vin", (v) => `${v} km/h`, () => { lap.t = 0; drawLap(); });
    document.getElementById("t4-go").addEventListener("click", runLap);
    document.getElementById("t4-warm").addEventListener("click", () => { c.T.set(Math.min(170, c.T.value + 10)); lap.t = 0; drawLap(); });
    document.getElementById("t4-cool").addEventListener("click", () => { c.T.set(Math.max(40, c.T.value - 10)); lap.t = 0; drawLap(); });
    ["t4-T", "t4-R", "t4-pdy2", "t4-comp"].forEach((id) => document.getElementById(id).addEventListener(id === "t4-comp" ? "change" : "input", () => { lap.t = 0; drawLap(); }));
    window.addEventListener("resize", () => { lap.cssW = 0; drawLap(); });
    UI.onTheme(drawLap);
    drawLap();
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
    initLap();
  }

  return { init };
})();
