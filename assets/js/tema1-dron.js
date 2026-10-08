/* =========================================================
   Tema 1 — Rastreo y navegación de un dron de reparto
   Visualización de datos: perfiles r(t), v(t), a(t) generados
   a partir de rutas declaradas, con límites de aceleración.
   ========================================================= */
window.Tema1 = (() => {
  // Rutas declaradas. Rumbo inicial: este (x+). Ángulo + = giro a la izquierda.
  const ROUTES = {
    A: {
      name: "Entrega urbana",
      segs: [
        { L: 400 }, { R: 60, ang: 90 }, { L: 500 }, { R: 40, ang: -90 },
        { L: 300 }, { R: 80, ang: 45 }, { L: 350 },
      ],
    },
    B: {
      name: "Rodeo de zona restringida",
      segs: [
        { L: 200 }, { R: 50, ang: 60 }, { R: 50, ang: -120 }, { R: 50, ang: 60 },
        { L: 300 }, { R: 30, ang: -90 }, { L: 250 },
      ],
    },
    C: {
      name: "Circuito de inspección",
      segs: [{ L: 300 }, { R: 70, ang: 180 }, { L: 300 }, { R: 70, ang: 180 }],
    },
  };

  const DS = 0.25; // paso de discretización a lo largo de la ruta (m)
  const DT = 0.1; // muestreo de los datos (s) → 10 Hz
  const GPS_SIGMA = 1.5;

  let state = { data: null, charts: {}, t: 0, playing: false, raf: null };
  let ctrl = {};

  /* ---------- Geometría de la ruta ---------- */
  function buildPath(segs) {
    const pts = [{ s: 0, x: 0, y: 0, psi: 0, k: 0, seg: 0 }];
    let x = 0, y = 0, psi = 0, s = 0;
    segs.forEach((sg, idx) => {
      const len = sg.L != null ? sg.L : (Math.abs(sg.ang) * Math.PI / 180) * sg.R;
      const k = sg.L != null ? 0 : Math.sign(sg.ang) / sg.R;
      const n = Math.max(1, Math.round(len / DS));
      const ds = len / n;
      for (let i = 0; i < n; i++) {
        const pm = psi + k * ds / 2; // integración por punto medio
        x += Math.cos(pm) * ds;
        y += Math.sin(pm) * ds;
        psi += k * ds;
        s += ds;
        pts.push({ s, x, y, psi, k, seg: idx });
      }
    });
    return pts;
  }

  /* ---------- Perfil de rapidez (dos pasadas) ---------- */
  function speedProfile(pts, vc, at, alat) {
    const n = pts.length;
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const k = Math.abs(pts[i].k);
      v[i] = k > 0 ? Math.min(vc, Math.sqrt(alat / k)) : vc;
    }
    v[0] = 0; v[n - 1] = 0;
    for (let i = 1; i < n; i++) {
      const ds = pts[i].s - pts[i - 1].s;
      v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * at * ds));
    }
    for (let i = n - 2; i >= 0; i--) {
      const ds = pts[i + 1].s - pts[i].s;
      v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * at * ds));
    }
    return v;
  }

  /* ---------- Generación de datos en el tiempo ---------- */
  function generate() {
    const route = ROUTES[ctrl.route.value];
    const vc = ctrl.vc.value, at = ctrl.at.value, alat = ctrl.alat.value;
    const W = ctrl.wind.value, wth = ctrl.wdir.value * Math.PI / 180;
    const wx = W * Math.cos(wth), wy = W * Math.sin(wth);

    const pts = buildPath(route.segs);
    const v = speedProfile(pts, vc, at, alat);
    const n = pts.length;

    // tiempo acumulado a lo largo de la ruta
    const t = new Float64Array(n);
    for (let i = 1; i < n; i++) {
      const ds = pts[i].s - pts[i - 1].s;
      t[i] = t[i - 1] + (2 * ds) / Math.max(v[i] + v[i - 1], 1e-6);
    }
    // aceleración tangencial a_t = v dv/ds (diferencia centrada)
    const atArr = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      const ds = pts[i1].s - pts[i0].s;
      atArr[i] = ds > 0 ? (v[i1] ** 2 - v[i0] ** 2) / (2 * ds) : 0;
    }

    const T = t[n - 1];
    const rows = [];
    let j = 0;
    for (let tm = 0; tm <= T + 1e-9; tm += DT) {
      while (j < n - 2 && t[j + 1] < tm) j++;
      const f = t[j + 1] > t[j] ? Math.min(1, Math.max(0, (tm - t[j]) / (t[j + 1] - t[j]))) : 0;
      const P = pts[j], Q = pts[j + 1];
      const x = P.x + (Q.x - P.x) * f;
      const y = P.y + (Q.y - P.y) * f;
      const psi = P.psi + (Q.psi - P.psi) * f;
      const sp = v[j] + (v[j + 1] - v[j]) * f;
      const a_t = atArr[j] + (atArr[j + 1] - atArr[j]) * f;
      const k = f < 0.5 ? P.k : Q.k;
      const a_n = sp * sp * k; // signo + = hacia la izquierda
      const c = Math.cos(psi), s = Math.sin(psi);
      const vx = sp * c, vy = sp * s;
      const ax = a_t * c - a_n * s, ay = a_t * s + a_n * c;
      const vax = vx - wx, vay = vy - wy;
      rows.push({
        t: +tm.toFixed(3), x, y, vx, vy, v: sp, ax, ay, a: Math.hypot(ax, ay),
        a_t, a_n: Math.abs(a_n), R: k ? 1 / Math.abs(k) : Infinity, seg: P.seg,
        vair: Math.hypot(vax, vay), crab: sp > 0.5 ? angleDiff(Math.atan2(vay, vax), psi) * 180 / Math.PI : 0,
      });
    }

    // GPS ruidoso y derivación numérica (diferencias centradas)
    let rnd = mulberry32(7);
    const gauss = () => { const u = 1 - rnd(), w = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); };
    const mx = rows.map((r) => r.x + GPS_SIGMA * gauss());
    const my = rows.map((r) => r.y + GPS_SIGMA * gauss());
    const noisy = rows.map((r, i) => {
      if (i === 0 || i === rows.length - 1) return null;
      const nvx = (mx[i + 1] - mx[i - 1]) / (2 * DT), nvy = (my[i + 1] - my[i - 1]) / (2 * DT);
      const nax = (mx[i + 1] - 2 * mx[i] + mx[i - 1]) / (DT * DT), nay = (my[i + 1] - 2 * my[i] + my[i - 1]) / (DT * DT);
      return { t: r.t, x: mx[i], y: my[i], v: Math.hypot(nvx, nvy), a: Math.hypot(nax, nay) };
    }).filter(Boolean);

    const length = pts[n - 1].s;
    state.data = { rows, pts, noisy, T, length, wind: { x: wx, y: wy, W }, route };
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Gráficas ---------- */
  function ds(label, color, key, opts = {}) {
    return Object.assign({ label, borderColor: color, backgroundColor: color, data: state.data.rows.map((r) => ({ x: r.t, y: r[key] })), parsing: false }, opts);
  }

  function makeCharts() {
    Object.values(state.charts).forEach((c) => c.destroy());
    const P = UI.palette();
    const d = state.data;
    const xAxis = UI.axis("Tiempo t (s)", { min: 0, max: Math.ceil(d.T) });
    const noisy = ctrl.noise.checked;

    const base = (datasets, yTitle, extraY = {}) => ({
      type: "line",
      data: { datasets },
      options: {
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: { legend: { position: "top", align: "end" } },
        scales: { x: xAxis, y: UI.axis(yTitle, extraY) },
      },
    });

    state.charts.pos = new Chart(document.getElementById("t1-pos"), base([
      ds("x (este)", P.accent, "x"),
      ds("y (norte)", P.pink, "y"),
    ], "Posición (m)"));

    const vMax = Math.max(...d.rows.map((r) => Math.max(r.v, r.vair))) * 1.15 + 1;
    const vSets = [
      ds("vₓ", P.accent, "vx"),
      ds("v_y", P.pink, "vy"),
      ds("|v| rapidez", P.text, "v", { borderWidth: 2.5 }),
    ];
    if (d.wind.W > 0) vSets.push(ds("|v| respecto al aire", P.amber, "vair", { borderDash: [5, 4] }));
    if (noisy) vSets.push({ label: "|v| derivada de GPS ruidoso", type: "scatter", data: d.noisy.map((r) => ({ x: r.t, y: r.v })), backgroundColor: P.faint, pointRadius: 1.4, showLine: false, parsing: false });
    state.charts.vel = new Chart(document.getElementById("t1-vel"), base(vSets, "Velocidad (m/s)", { min: -vMax, max: vMax }));

    const aMax = Math.max(...d.rows.map((r) => r.a)) * 1.25 + 0.3;
    const aSets = [
      ds("aₓ", P.accent, "ax"),
      ds("a_y", P.pink, "ay"),
      ds("|a|", P.text, "a", { borderWidth: 2.5 }),
    ];
    if (noisy) aSets.push({ label: "|a| derivada de GPS ruidoso", type: "scatter", data: d.noisy.map((r) => ({ x: r.t, y: r.a })), backgroundColor: P.faint, pointRadius: 1.4, showLine: false, parsing: false });
    state.charts.acc = new Chart(document.getElementById("t1-acc"), base(aSets, "Aceleración (m/s²)", { min: -aMax, max: aMax }));

    state.charts.tn = new Chart(document.getElementById("t1-tn"), base([
      ds("a_t tangencial (cambia la rapidez)", P.green, "a_t"),
      ds("a_n = v²/R normal (cambia la dirección)", P.violet, "a_n", { fill: { target: "origin", above: hexA(P.violet, 0.12) } }),
    ], "Aceleración (m/s²)", { min: -aMax, max: aMax }));
    setCursor(state.t);
  }

  function hexA(color, a) {
    // admite #rrggbb
    const m = color.match(/^#([0-9a-f]{6})$/i);
    if (!m) return color;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------- Mapa ---------- */
  function drawMap() {
    const canvas = document.getElementById("t1-map");
    const { ctx, w, h } = UI.fitCanvas(canvas, window.innerWidth < 700 ? 0.8 : 0.48);
    const P = UI.palette();
    const d = state.data;
    const xs = d.pts.map((p) => p.x), ys = d.pts.map((p) => p.y);
    let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 46;
    const span = Math.max(maxX - minX, (maxY - minY) * (w - 2 * pad) / (h - 2 * pad), 1);
    const sc = Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxY - minY || 1));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const X = (x) => w / 2 + (x - cx) * sc;
    const Y = (y) => h / 2 - (y - cy) * sc;

    ctx.clearRect(0, 0, w, h);
    // cuadrícula con escala en metros
    const stepM = niceStep(span / 8);
    ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.fillStyle = P.faint; ctx.font = "10.5px JetBrains Mono, monospace";
    const gx0 = Math.floor((cx - w / 2 / sc) / stepM) * stepM;
    for (let gx = gx0; X(gx) < w; gx += stepM) {
      ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), h); ctx.stroke();
      ctx.fillText(`${Math.round(gx)}`, X(gx) + 3, h - 6);
    }
    const gy0 = Math.floor((cy - h / 2 / sc) / stepM) * stepM;
    for (let gy = gy0; Y(gy) > 0; gy += stepM) {
      ctx.beginPath(); ctx.moveTo(0, Y(gy)); ctx.lineTo(w, Y(gy)); ctx.stroke();
      ctx.fillText(`${Math.round(gy)}`, 4, Y(gy) - 3);
    }
    ctx.fillStyle = P.muted; ctx.font = "600 11px Inter, sans-serif";
    ctx.fillText("x (m, este) →", w - 96, h - 20);
    ctx.fillText("↑ y (m, norte)", 12, 38);

    // ruta coloreada por rapidez
    const vmax = Math.max(...d.rows.map((r) => r.v), 1);
    for (let i = 1; i < d.rows.length; i++) {
      const r0 = d.rows[i - 1], r1 = d.rows[i];
      ctx.strokeStyle = speedColor(r1.v / vmax);
      ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(X(r0.x), Y(r0.y)); ctx.lineTo(X(r1.x), Y(r1.y)); ctx.stroke();
    }
    // puntos de GPS ruidoso
    if (ctrl.noise.checked) {
      ctx.fillStyle = P.faint;
      d.noisy.forEach((p, i) => { if (i % 2 === 0) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 1.3, 0, 7); ctx.fill(); } });
    }
    // inicio y destino
    const first = d.rows[0], last = d.rows[d.rows.length - 1];
    marker(ctx, X(first.x), Y(first.y), P.green, "Centro de distribución");
    marker(ctx, X(last.x), Y(last.y), P.pink, d.route.name === "Circuito de inspección" ? "" : "Cliente");

    // leyenda de rapidez
    const lgW = 120;
    const grd = ctx.createLinearGradient(w - lgW - 16, 0, w - 16, 0);
    grd.addColorStop(0, speedColor(0)); grd.addColorStop(0.5, speedColor(0.5)); grd.addColorStop(1, speedColor(1));
    ctx.fillStyle = grd; ctx.fillRect(w - lgW - 16, 14, lgW, 6);
    ctx.fillStyle = P.muted; ctx.font = "10.5px Inter, sans-serif";
    ctx.fillText("0", w - lgW - 16, 34);
    ctx.textAlign = "right"; ctx.fillText(`${vmax.toFixed(1)} m/s`, w - 16, 34); ctx.textAlign = "left";
    ctx.fillText("rapidez |v|", w - lgW - 16, 10);

    // viento
    if (d.wind.W > 0) {
      const ox = w - 60, oy = 70, L = 16 + d.wind.W * 3;
      UI.arrow(ctx, ox - (d.wind.x / d.wind.W) * L / 2, oy + (d.wind.y / d.wind.W) * L / 2, ox + (d.wind.x / d.wind.W) * L / 2, oy - (d.wind.y / d.wind.W) * L / 2, P.amber, 2.5);
      ctx.fillStyle = P.amber; ctx.fillText(`viento ${d.wind.W} m/s`, ox - 40, oy + 34);
    }

    // dron en el tiempo t con vectores
    const r = sampleAt(state.t);
    const px = X(r.x), py = Y(r.y);
    const vScale = 6, aScale = 20;
    UI.arrow(ctx, px, py, px + r.vx * vScale, py - r.vy * vScale, P.accent, 2.6);
    UI.arrow(ctx, px, py, px + r.ax * aScale, py - r.ay * aScale, P.pink, 2.6);
    ctx.fillStyle = P.text; ctx.strokeStyle = P.panel; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 6.5, 0, 7); ctx.fill(); ctx.stroke();
    // etiquetas de vectores
    ctx.font = "600 11px Inter, sans-serif";
    ctx.fillStyle = P.accent; ctx.fillText("v", px + r.vx * vScale + 6, py - r.vy * vScale);
    ctx.fillStyle = P.pink; if (r.a > 0.05) ctx.fillText("a", px + r.ax * aScale + 6, py - r.ay * aScale);
    ctx.fillStyle = P.muted; ctx.font = "10.5px Inter, sans-serif";
    ctx.fillText(`Escala de vectores: v ×${vScale} px/(m/s) · a ×${aScale} px/(m/s²)`, 12, 18);
  }

  function marker(ctx, x, y, color, label) {
    ctx.save();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    ctx.fillStyle = UI.palette().text; ctx.font = "600 11px Inter, sans-serif";
    if (label) ctx.fillText(label, x + 10, y + 16);
    ctx.restore();
  }
  function speedColor(f) {
    // de violeta (lento) a cian (rápido)
    const a = [167, 139, 250], b = [76, 201, 240], c = [94, 227, 161];
    const lerp = (p, q, u) => p.map((v, i) => Math.round(v + (q[i] - v) * u));
    const col = f < 0.5 ? lerp(a, b, f * 2) : lerp(b, c, (f - 0.5) * 2);
    return `rgb(${col.join(",")})`;
  }
  function niceStep(x) {
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const m = x / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function sampleAt(t) {
    const rows = state.data.rows;
    const i = Math.min(rows.length - 1, Math.max(0, Math.round(t / DT)));
    return rows[i];
  }

  /* ---------- Lecturas ---------- */
  function readouts() {
    const r = sampleAt(state.t);
    const d = state.data;
    const f = UI.fmt;
    const el = document.getElementById("t1-ro");
    const segType = d.route.segs[r.seg].L != null ? "recta" : `curva R = ${d.route.segs[r.seg].R} m`;
    el.innerHTML = `
      <div class="ro"><div class="k">Posición r</div><div class="v">(${f(r.x, 1)}, ${f(r.y, 1)}) <small>m</small></div></div>
      <div class="ro"><div class="k">Velocidad v</div><div class="v">(${f(r.vx, 2)}, ${f(r.vy, 2)}) <small>m/s</small></div></div>
      <div class="ro"><div class="k">Rapidez |v|</div><div class="v">${f(r.v, 2)} <small>m/s</small></div></div>
      <div class="ro"><div class="k">Aceleración a</div><div class="v">(${f(r.ax, 2)}, ${f(r.ay, 2)}) <small>m/s²</small></div></div>
      <div class="ro"><div class="k">a_t | a_n = v²/R</div><div class="v">${f(r.a_t, 2)} | ${f(r.a_n, 2)} <small>m/s²</small></div></div>
      <div class="ro"><div class="k">Tramo actual</div><div class="v" style="font-size:.9rem">${segType}</div></div>
      <div class="ro"><div class="k">Distancia total</div><div class="v">${f(d.length / 1000, 2)} <small>km</small></div></div>
      <div class="ro"><div class="k">Tiempo total (ETA)</div><div class="v">${f(d.T, 1)} <small>s</small></div></div>
      ${d.wind.W > 0 ? `<div class="ro"><div class="k">Ángulo de cangrejeo</div><div class="v">${f(r.crab, 1)}<small>°</small></div></div>` : ""}
    `;
    document.getElementById("t1-time-out").textContent = `t = ${f(state.t, 1)} s`;
  }

  function setCursor(t) {
    Object.values(state.charts).forEach((c) => { c.$cursorX = t; c.draw(); });
  }

  function update(t) {
    state.t = t;
    drawMap();
    readouts();
    setCursor(t);
  }

  function regenerate() {
    generate();
    const T = state.data.T;
    ctrl.time.max = T.toFixed(1);
    if (state.t > T) state.t = T;
    ctrl.time.value = state.t;
    makeCharts();
    update(state.t);
    routeTable();
  }

  function routeTable() {
    const d = state.data;
    let s = 0;
    const rows = d.route.segs.map((sg, i) => {
      const len = sg.L != null ? sg.L : (Math.abs(sg.ang) * Math.PI / 180) * sg.R;
      s += len;
      const desc = sg.L != null ? `Recta de ${sg.L} m` : `Arco R = ${sg.R} m, giro ${Math.abs(sg.ang)}° a la ${sg.ang > 0 ? "izquierda" : "derecha"}`;
      const vlim = sg.L != null ? "—" : `${UI.fmt(Math.min(ctrl.vc.value, Math.sqrt(ctrl.alat.value * sg.R)), 1)} m/s`;
      return `<tr><td>${i + 1}</td><td>${desc}</td><td class="num">${UI.fmt(len, 1)}</td><td class="num">${UI.fmt(s, 1)}</td><td class="num">${vlim}</td></tr>`;
    }).join("");
    document.getElementById("t1-route-table").innerHTML = `
      <table class="compare" style="margin-top:10px">
        <thead><tr><th>#</th><th>Ruta ${ctrl.route.value}: ${d.route.name} (inicio en (0, 0), rumbo este)</th><th class="num">Longitud (m)</th><th class="num">Acumulado (m)</th><th class="num">v máx. en curva √(a_lat·R)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  /* ---------- Animación ---------- */
  function togglePlay() {
    state.playing = !state.playing;
    const btn = document.getElementById("t1-play");
    btn.textContent = state.playing ? "❚❚ Pausa" : "▶ Reproducir";
    if (state.playing) {
      if (state.t >= state.data.T - 0.05) state.t = 0;
      let last = performance.now();
      const speedup = Math.max(4, state.data.T / 14); // recorrido completo en ~14 s
      const step = (now) => {
        if (!state.playing) return;
        const dt = (now - last) / 1000; last = now;
        let t = state.t + dt * speedup;
        if (t >= state.data.T) { t = state.data.T; state.playing = false; btn.textContent = "▶ Reproducir"; }
        ctrl.time.value = t;
        update(t);
        if (state.playing) state.raf = requestAnimationFrame(step);
      };
      state.raf = requestAnimationFrame(step);
    }
  }

  function exportCSV() {
    const d = state.data;
    UI.downloadCSV(`dron_ruta_${ctrl.route.value}.csv`,
      ["t_s", "x_m", "y_m", "vx_m_s", "vy_m_s", "rapidez_m_s", "ax_m_s2", "ay_m_s2", "a_tangencial_m_s2", "a_normal_m_s2", "a_magnitud_m_s2", "rapidez_aire_m_s"],
      d.rows.map((r) => [r.t, r.x, r.y, r.vx, r.vy, r.v, r.ax, r.ay, r.a_t, r.a_n, r.a, r.vair]));
  }

  function init() {
    const ms = (v) => `${UI.fmt(v, 1)} m/s`;
    const ms2 = (v) => `${UI.fmt(v, 1)} m/s²`;
    ctrl.route = document.getElementById("t1-route");
    ctrl.noise = document.getElementById("t1-noise");
    ctrl.vc = UI.bindRange("t1-vc", ms, regenerate);
    ctrl.at = UI.bindRange("t1-at", ms2, regenerate);
    ctrl.alat = UI.bindRange("t1-alat", ms2, regenerate);
    ctrl.wind = UI.bindRange("t1-wind", ms, regenerate);
    ctrl.wdir = UI.bindRange("t1-wdir", (v) => `${v}° desde el este`, regenerate);
    ctrl.time = document.getElementById("t1-time");
    ctrl.route.addEventListener("change", () => { state.t = 0; regenerate(); });
    ctrl.noise.addEventListener("change", () => { makeCharts(); drawMap(); });
    ctrl.time.addEventListener("input", () => update(parseFloat(ctrl.time.value)));
    document.getElementById("t1-play").addEventListener("click", togglePlay);
    document.getElementById("t1-csv").addEventListener("click", exportCSV);
    window.addEventListener("resize", () => drawMap());
    UI.onTheme(() => { makeCharts(); drawMap(); });
    state.t = 0;
    regenerate();
    // ubica el cursor en el primer giro para que se vean ambos vectores
    const firstTurn = state.data.rows.find((r) => r.a_n > 0.5);
    if (firstTurn) { ctrl.time.value = firstTurn.t + 2; update(firstTurn.t + 2); }
  }

  return { init };
})();
