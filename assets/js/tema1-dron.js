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

  /* ---------- Escena del mapa (zona interactiva) ---------- */
  const scene = { ctx: null, w: 0, h: 0, cssW: 0, rotor: 0, particles: [], drag: null, city: null, cityKey: "" };

  function sizeMap() {
    const canvas = document.getElementById("t1-map");
    const cssW = canvas.parentElement.clientWidth;
    if (scene.ctx && scene.cssW === cssW) return;
    const r = UI.fitCanvas(canvas, window.innerWidth < 700 ? 0.8 : 0.5);
    Object.assign(scene, { ctx: r.ctx, w: r.w, h: r.h, cssW });
  }

  /** Geometría de pantalla: escala (px/m) y transformaciones mundo → pantalla. */
  function view() {
    const d = state.data, w = scene.w, h = scene.h;
    const xs = d.pts.map((p) => p.x), ys = d.pts.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 54;
    const sc = Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxY - minY || 1));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return { sc, cx, cy, X: (x) => w / 2 + (x - cx) * sc, Y: (y) => h / 2 - (y - cy) * sc, inv: (px, py) => ({ x: (px - w / 2) / sc + cx, y: -(py - h / 2) / sc + cy }) };
  }

  /** Manzanas y árboles generados de forma determinista alrededor de la ruta (solo decorativos). */
  function buildCity(V) {
    const key = ctrl.route.value + "|" + scene.w + "x" + scene.h;
    if (scene.city && scene.cityKey === key) return scene.city;
    const rnd = mulberry32(ctrl.route.value.charCodeAt(0) * 97);
    const pts = state.data.pts.filter((_, i) => i % 40 === 0);
    const far = (x, y, m) => pts.every((p) => Math.hypot(p.x - x, p.y - y) > m);
    const tl = V.inv(0, 0), br = V.inv(scene.w, scene.h);
    const cell = 70, blocks = [], trees = [];
    for (let gx = Math.floor(tl.x / cell) * cell; gx < br.x + cell; gx += cell) {
      for (let gy = Math.floor(br.y / cell) * cell; gy < tl.y + cell; gy += cell) {
        const bw = 34 + rnd() * 22, bh = 30 + rnd() * 24, x = gx + (cell - bw) / 2, y = gy + (cell - bh) / 2;
        if (far(x + bw / 2, y + bh / 2, 46)) blocks.push({ x, y, w: bw, h: bh, tone: rnd(), floors: 1 + Math.floor(rnd() * 4) });
        else if (far(gx + cell / 2, gy + cell / 2, 22) && rnd() > 0.35) trees.push({ x: gx + rnd() * cell, y: gy + rnd() * cell, r: 4 + rnd() * 5 });
      }
    }
    scene.city = { blocks, trees }; scene.cityKey = key;
    return scene.city;
  }

  function drawDrone(ctx, x, y, ang, s, rotor, P, tilt) {
    ctx.save();
    // sombra en el suelo
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(x + 10, y + 14, s * 0.9, s * 0.55, ang, 0, 7); ctx.fill();
    ctx.translate(x - tilt.x, y - tilt.y); ctx.rotate(ang);
    // brazos en X
    ctx.strokeStyle = P.text; ctx.lineWidth = Math.max(2, s * 0.14); ctx.lineCap = "round";
    const arm = s * 0.9;
    const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    corners.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(a * arm * 0.7, b * arm * 0.7); ctx.stroke(); });
    // rotores girando
    corners.forEach(([a, b], i) => {
      const rx = a * arm * 0.7, ry = b * arm * 0.7;
      ctx.fillStyle = "rgba(160,170,200,0.25)"; ctx.beginPath(); ctx.arc(rx, ry, s * 0.42, 0, 7); ctx.fill();
      ctx.strokeStyle = P.muted; ctx.lineWidth = 1.6;
      const ph = rotor * (i % 2 ? 1 : -1);
      ctx.beginPath(); ctx.moveTo(rx + Math.cos(ph) * s * 0.4, ry + Math.sin(ph) * s * 0.4); ctx.lineTo(rx - Math.cos(ph) * s * 0.4, ry - Math.sin(ph) * s * 0.4); ctx.stroke();
    });
    // cuerpo, paquete y luz del frente
    ctx.fillStyle = P.accent; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = P.amber; ctx.fillRect(-s * 0.16, -s * 0.16, s * 0.32, s * 0.32);
    ctx.fillStyle = P.pink; ctx.beginPath(); ctx.arc(s * 0.36, 0, s * 0.08, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawMap() {
    sizeMap();
    const { ctx, w, h } = scene;
    const P = UI.palette();
    const d = state.data;
    const V = view(), { X, Y, sc } = V;
    ctx.clearRect(0, 0, w, h);

    // suelo, manzanas y árboles
    ctx.fillStyle = P.panel2; ctx.fillRect(0, 0, w, h);
    const city = buildCity(V);
    city.blocks.forEach((b) => {
      const x = X(b.x), y = Y(b.y + b.h), bw = b.w * sc, bh = b.h * sc;
      ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(x + 2 + b.floors, y + 2 + b.floors, bw, bh);
      ctx.fillStyle = b.tone > 0.5 ? P.line : P.panel; ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.strokeRect(x, y, bw, bh);
    });
    city.trees.forEach((t) => { ctx.fillStyle = hexA(P.green, 0.35); ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), Math.max(2, t.r * sc), 0, 7); ctx.fill(); });

    // ruta planificada (punteada) y tramo ya volado (color por rapidez)
    ctx.setLineDash([6, 6]); ctx.strokeStyle = P.muted; ctx.lineWidth = 2;
    ctx.beginPath(); d.rows.forEach((r, i) => (i ? ctx.lineTo(X(r.x), Y(r.y)) : ctx.moveTo(X(r.x), Y(r.y)))); ctx.stroke(); ctx.setLineDash([]);
    const vmax = Math.max(...d.rows.map((r) => r.v), 1);
    const iNow = Math.min(d.rows.length - 1, Math.round(state.t / DT));
    for (let i = 1; i <= iNow; i++) {
      const r0 = d.rows[i - 1], r1 = d.rows[i];
      ctx.strokeStyle = speedColor(r1.v / vmax); ctx.lineWidth = 4.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(X(r0.x), Y(r0.y)); ctx.lineTo(X(r1.x), Y(r1.y)); ctx.stroke();
    }
    if (ctrl.noise.checked) {
      ctx.fillStyle = P.faint;
      d.noisy.forEach((p, i) => { if (i % 2 === 0) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 1.3, 0, 7); ctx.fill(); } });
    }

    // centro de distribución y cliente
    const first = d.rows[0], last = d.rows[d.rows.length - 1];
    const building = (x, y, col, label, roof) => {
      ctx.fillStyle = col; ctx.fillRect(x - 13, y - 9, 26, 18);
      ctx.fillStyle = P.text; ctx.beginPath(); ctx.moveTo(x - 16, y - 9); ctx.lineTo(x, y - 20); ctx.lineTo(x + 16, y - 9); ctx.closePath(); ctx.fill();
      ctx.font = "600 11px Public Sans, sans-serif"; ctx.fillStyle = P.text; ctx.fillText(label, x + 18, y + 18);
      if (roof) { ctx.fillStyle = P.panel; ctx.font = "700 9px Public Sans, sans-serif"; ctx.fillText(roof, x - 3, y + 4); }
    };
    building(X(first.x), Y(first.y), P.green, "Centro de distribución", "H");
    if (d.route.name !== "Circuito de inspección") building(X(last.x), Y(last.y), P.pink, iNow >= d.rows.length - 1 ? "Cliente · ¡entregado!" : "Cliente", "");

    // partículas de viento (se mueven en la dirección del vector viento real)
    const W = d.wind;
    if (W.W > 0) {
      ctx.strokeStyle = hexA(P.amber, 0.55); ctx.lineWidth = 1.4;
      const ux = W.x / W.W, uy = -W.y / W.W, len = 6 + W.W * 1.6;
      scene.particles.forEach((p) => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - ux * len, p.y - uy * len); ctx.stroke(); });
    }

    // dron: apunta según su velocidad respecto al aire y se inclina hacia donde acelera
    const r = sampleAt(state.t);
    const px = X(r.x), py = Y(r.y);
    const vax = r.vx - W.x, vay = r.vy - W.y;
    const heading = Math.hypot(vax, vay) > 0.3 ? Math.atan2(-vay, vax) : Math.atan2(-r.vy, r.vx || 1);
    const tilt = { x: r.ax * 1.2, y: -r.ay * 1.2 };
    if (ctrl.vectors.checked) {
      const vScale = 6, aScale = 20;
      UI.arrow(ctx, px, py, px + r.vx * vScale, py - r.vy * vScale, P.accent, 2.6);
      if (r.a > 0.05) UI.arrow(ctx, px, py, px + r.ax * aScale, py - r.ay * aScale, P.pink, 2.6);
      ctx.font = "700 12px Public Sans, sans-serif";
      ctx.fillStyle = P.accent; ctx.fillText("v", px + r.vx * vScale + 6, py - r.vy * vScale);
      ctx.fillStyle = P.pink; if (r.a > 0.05) ctx.fillText("a", px + r.ax * aScale + 6, py - r.ay * aScale);
    }
    drawDrone(ctx, px, py, heading, 20, scene.rotor, P, tilt);

    // brújula de viento
    const ox = w - 52, oy = 62;
    ctx.fillStyle = hexA(P.panel, 0.85); ctx.beginPath(); ctx.arc(ox, oy, 30, 0, 7); ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = "700 9px Public Sans, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("N", ox, oy - 19); ctx.fillText("E", ox + 21, oy + 3); ctx.fillText("S", ox, oy + 25); ctx.fillText("O", ox - 21, oy + 3);
    if (W.W > 0) UI.arrow(ctx, ox - (W.x / W.W) * 14, oy + (W.y / W.W) * 14, ox + (W.x / W.W) * 16, oy - (W.y / W.W) * 16, P.amber, 2.5);
    ctx.fillStyle = W.W > 0 ? P.amber : P.faint; ctx.font = "600 10.5px Public Sans, sans-serif";
    ctx.fillText(W.W > 0 ? `viento ${UI.fmt(W.W, 1)} m/s` : "sin viento", ox, oy + 46);
    ctx.textAlign = "left";
    // barra de escala y leyenda de rapidez
    const barM = niceStep(140 / sc);
    ctx.fillStyle = P.text; ctx.fillRect(14, h - 22, barM * sc, 3);
    ctx.font = "10.5px JetBrains Mono, monospace"; ctx.fillText(`${barM} m`, 14, h - 28);
    const lgW = 110, lx = 14, ly = 16;
    const grd = ctx.createLinearGradient(lx, 0, lx + lgW, 0);
    grd.addColorStop(0, speedColor(0)); grd.addColorStop(0.5, speedColor(0.5)); grd.addColorStop(1, speedColor(1));
    ctx.fillStyle = grd; ctx.fillRect(lx, ly + 6, lgW, 5);
    ctx.fillStyle = P.muted; ctx.font = "10.5px Public Sans, sans-serif";
    ctx.fillText(`rapidez: 0 → ${vmax.toFixed(1)} m/s`, lx, ly);
    // flecha mientras se arrastra para soplar viento
    if (scene.drag) {
      const { x0, y0, x1, y1 } = scene.drag;
      UI.arrow(ctx, x0, y0, x1, y1, P.amber, 3);
      const mag = Math.min(12, Math.hypot(x1 - x0, y1 - y0) / 10);
      ctx.fillStyle = P.amber; ctx.font = "700 12px Public Sans, sans-serif"; ctx.fillText(`${UI.fmt(mag, 1)} m/s`, x1 + 8, y1);
    }
  }

  /** Bucle ambiental: rotores y viento se animan aunque la reproducción esté en pausa. */
  function ambient() {
    let last = performance.now(), visible = true;
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(document.getElementById("t1-map"));
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (!visible || !state.data) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      scene.rotor += dt * 40;
      const W = state.data.wind;
      if (W.W > 0) {
        if (scene.particles.length < 90) scene.particles = Array.from({ length: 90 }, () => ({ x: Math.random() * scene.w, y: Math.random() * scene.h }));
        const k = 30 + W.W * 14, vx = (W.x / W.W) * k, vy = -(W.y / W.W) * k;
        scene.particles.forEach((p) => {
          p.x += vx * dt; p.y += vy * dt;
          if (p.x < -20) p.x += scene.w + 40; if (p.x > scene.w + 20) p.x -= scene.w + 40;
          if (p.y < -20) p.y += scene.h + 40; if (p.y > scene.h + 20) p.y -= scene.h + 40;
        });
      }
      if (!state.playing) drawMap();
    };
    requestAnimationFrame(tick);
  }

  /** Arrastrar sobre el mapa sopla viento: dirección y largo del arrastre fijan el vector viento. */
  function windDrag() {
    const canvas = document.getElementById("t1-map");
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener("pointerdown", (e) => { const p = pos(e); scene.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => { if (!scene.drag) return; const p = pos(e); scene.drag.x1 = p.x; scene.drag.y1 = p.y; });
    const end = () => {
      if (!scene.drag) return;
      const { x0, y0, x1, y1 } = scene.drag; scene.drag = null;
      const dx = x1 - x0, dy = -(y1 - y0), L = Math.hypot(dx, dy);
      if (L < 8) return; // un clic sin arrastrar no cambia el viento
      ctrl.wind.set(Math.min(12, Math.round((L / 10) * 2) / 2), true);
      let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 5) * 5;
      if (deg < 0) deg += 360;
      if (deg >= 360) deg -= 360;
      ctrl.wdir.set(deg, true);
      scene.particles = [];
      regenerate();
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.style.touchAction = "none";
    canvas.style.cursor = "crosshair";
  }

  function marker(ctx, x, y, color, label) {
    ctx.save();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    ctx.fillStyle = UI.palette().text; ctx.font = "600 11px Public Sans, sans-serif";
    if (label) ctx.fillText(label, x + 10, y + 16);
    ctx.restore();
  }
  /** Color de la ruta según la rapidez: de gris (lento) al azul acero del tema (rápido). */
  function speedColor(f) {
    const rgb = (h) => { const m = h.match(/^#([0-9a-f]{6})$/i); const n = m ? parseInt(m[1], 16) : 0x888888; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const a = rgb(UI.css("--faint")), b = rgb(UI.css("--accent"));
    return "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, f)))).join(",") + ")";
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
    ctrl.vectors = document.getElementById("t1-vectors");
    ctrl.vectors.addEventListener("change", drawMap);
    ctrl.vc = UI.bindRange("t1-vc", ms, regenerate);
    ctrl.at = UI.bindRange("t1-at", ms2, regenerate);
    ctrl.alat = UI.bindRange("t1-alat", ms2, regenerate);
    ctrl.wind = UI.bindRange("t1-wind", ms, regenerate);
    ctrl.wdir = UI.bindRange("t1-wdir", (v) => `${v}° desde el este`, regenerate);
    ctrl.time = document.getElementById("t1-time");
    ctrl.route.addEventListener("change", () => { state.t = 0; scene.city = null; regenerate(); });
    ctrl.noise.addEventListener("change", () => { makeCharts(); drawMap(); });
    ctrl.time.addEventListener("input", () => update(parseFloat(ctrl.time.value)));
    document.getElementById("t1-play").addEventListener("click", togglePlay);
    document.getElementById("t1-csv").addEventListener("click", exportCSV);
    window.addEventListener("resize", () => { scene.cssW = 0; drawMap(); });
    UI.onTheme(() => { makeCharts(); drawMap(); });
    windDrag();
    ambient();
    state.t = 0;
    regenerate();
    // ubica el cursor en el primer giro para que se vean ambos vectores
    const firstTurn = state.data.rows.find((r) => r.a_n > 0.5);
    if (firstTurn) { ctrl.time.value = firstTurn.t + 2; update(firstTurn.t + 2); }
  }

  return { init };
})();
