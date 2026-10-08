/* =========================================================
   Tema 2 — El salto del personaje
   Simulación interactiva: plataformero con física integrada a
   paso fijo, trayectoria predicha recalculada en vivo.
   ========================================================= */
window.Tema2 = (() => {
  const DT = 1 / 240;
  const G_EARTH = 9.81;
  const PW = 0.8, PH = 1.8; // tamaño del personaje (m)
  const SUSTAIN = 0.2; // VarJumpTime de Celeste (s)
  const WORLD = 48; // el escenario se repite cada 48 m

  const PRESETS = {
    real: { v0: 3.13, g: 9.81, fall: 1, vx: 3, maxfall: 80, vj: false, half: false },
    heroic: { v0: 8.86, g: 9.81, fall: 1, vx: 6, maxfall: 80, vj: false, half: false },
    arcade: { v0: 20, g: 50, fall: 1.8, vx: 7, maxfall: 80, vj: true, sus: false, half: false },
    // Celeste: 1 px ≈ 0,145 m → g 900 px/s² ≈ 130,5 m/s²; JumpSpeed 105 px/s ≈ 15,2 m/s;
    // MaxFall 160 px/s ≈ 23,2 m/s; MaxRun 90 px/s ≈ 13,05 m/s
    celeste: { v0: 15.2, g: 130.5, fall: 1, vx: 13.05, maxfall: 23.2, vj: false, sus: true, half: true },
    moon: { v0: 3.13, g: 1.62, fall: 1, vx: 3, maxfall: 80, vj: false, half: false },
    heavy: { v0: 14, g: 40, fall: 3, vx: 6, maxfall: 80, vj: false, half: false },
  };

  const PLATFORMS = [
    { x: 9, y: 2.0, w: 4 }, { x: 17, y: 3.6, w: 3.5 }, { x: 24, y: 1.2, w: 3 },
    { x: 30, y: 5.2, w: 4 }, { x: 38, y: 2.6, w: 3.5 },
  ];

  let c = {};
  let canvas, ctx, W, H;
  let P = {
    x: 2, y: 0, vx: 0, vy: 0, onGround: true, held: false, sustain: 0, face: 1,
    trace: [], lastJump: null, jumpT: 0, jumpStart: 0, apex: 0,
  };
  const keys = { left: false, right: false, jump: false };
  let auto = true, autoWait = 0.6, visible = true, focused = false, acc = 0, lastTime = 0;
  let pred = null;
  let charts = {};
  let viewH = 8;

  /* ---------- Física ---------- */
  function params() {
    return {
      v0: c.v0.value, g: c.g.value, fall: c.fall.value, vx: c.vx.value, maxfall: c.maxfall.value,
      vj: c.vj.checked, sus: c.sus.checked, half: c.half.checked,
    };
  }

  function gEff(p, vy, held) {
    let g = p.g;
    if (vy < 0) g *= p.fall;
    if (p.half && held && Math.abs(vy) < 0.38 * p.v0) g *= 0.5;
    return g;
  }

  /** Integra un salto desde el suelo; held(t) indica si el botón está presionado. */
  function simulateJump(p, holdTime) {
    let y = 0, vy = p.v0, t = 0, sustain = p.sus ? SUSTAIN : 0, held = true, tApex = 0, hMax = 0;
    const pts = [{ t: 0, y: 0, vy }];
    let cut = false;
    while (t < 30) {
      if (held && t >= holdTime) {
        held = false;
        sustain = 0;
        if (p.vj && vy > 0 && !cut) { vy *= 0.5; cut = true; }
      }
      // mismo orden que Player.cs: primero la gravedad, luego el salto variable sostiene la velocidad
      vy -= gEff(p, vy, held) * DT;
      vy = Math.max(vy, -p.maxfall);
      if (p.sus && held && sustain > 0) { vy = Math.max(vy, p.v0); sustain -= DT; }
      y += vy * DT;
      t += DT;
      if (y > hMax) { hMax = y; tApex = t; }
      if (y <= 0) { pts.push({ t, y: 0, vy }); break; }
      if (pts.length < 4000 && Math.round(t / DT) % 4 === 0) pts.push({ t, y, vy });
    }
    return { pts, hMax, tApex, tAir: t, tDown: t - tApex };
  }

  function predict() {
    const p = params();
    const full = simulateJump(p, Infinity);
    const tap = p.vj || p.sus ? simulateJump(p, 0.04) : null;
    // comparación: misma altura con g real y sin trucos
    const v0r = Math.sqrt(2 * G_EARTH * full.hMax);
    const ghost = simulateJump({ v0: v0r, g: G_EARTH, fall: 1, vx: p.vx, maxfall: 1e9, vj: false, sus: false, half: false }, Infinity);
    pred = { p, full, tap, ghost, v0r };
    // escala vertical de la vista
    // la vista crece con el salto para que la trayectoria completa siempre quepa en pantalla
    viewH = Math.min(Math.max(6.5, full.hMax * 1.3 + 2.5), 5000);
  }

  function step(dt) {
    const p = params();
    // control
    let dir = 0;
    if (auto) {
      dir = 1;
    } else {
      dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    }
    if (dir) P.face = dir;
    P.vx = dir * p.vx;

    // salto
    const wantJump = auto ? (P.onGround && (autoWait -= dt) <= 0) : keys.jump;
    if (wantJump && P.onGround && !P.jumpLatch) {
      P.vy = p.v0; P.onGround = false; P.sustain = p.sus ? SUSTAIN : 0; P.held = true; P.jumpLatch = true;
      P.trace = [{ t: 0, y: P.y, vy: P.vy }]; P.jumpT = 0; P.jumpStart = P.y; P.apex = P.y; P.cut = false;
      autoWait = 0.55;
    }
    if (!wantJump) P.jumpLatch = false;
    const holding = auto ? true : keys.jump;
    if (!P.onGround) {
      if (P.held && !holding) {
        P.held = false;
        P.sustain = 0;
        if (p.vj && P.vy > 0 && !P.cut) { P.vy *= 0.5; P.cut = true; }
      }
      P.vy -= gEff(p, P.vy, P.held) * dt;
      P.vy = Math.max(P.vy, -p.maxfall);
      if (p.sus && P.held && P.sustain > 0) { P.vy = Math.max(P.vy, p.v0); P.sustain -= dt; }
    }
    const prevY = P.y;
    P.x += P.vx * dt;
    P.y += P.vy * dt;

    // colisiones: suelo y plataformas de un solo sentido
    let landed = false;
    if (P.y <= 0) { P.y = 0; landed = true; }
    else if (P.vy <= 0) {
      for (const pl of platformsNear(P.x)) {
        if (P.x + PW / 2 > pl.x && P.x - PW / 2 < pl.x + pl.w && prevY >= pl.y - 1e-6 && P.y <= pl.y) {
          P.y = pl.y; landed = true; break;
        }
      }
    }
    if (landed && !P.onGround) {
      P.onGround = true; P.vy = 0;
      if (P.trace.length > 2) { P.trace.push({ t: P.jumpT, y: P.y - P.jumpStart, vy: 0 }); P.lastJump = P.trace.slice(); updateCharts(); }
    }
    if (P.onGround && !landed) {
      // ¿caminó fuera del borde de una plataforma?
      const on = P.y <= 0 || platformsNear(P.x).some((pl) => Math.abs(P.y - pl.y) < 1e-6 && P.x + PW / 2 > pl.x && P.x - PW / 2 < pl.x + pl.w);
      if (!on) { P.onGround = false; P.held = false; P.trace = [{ t: 0, y: 0, vy: 0 }]; P.jumpT = 0; P.jumpStart = P.y; P.apex = P.y; }
    }
    if (!P.onGround) {
      P.jumpT += dt;
      P.apex = Math.max(P.apex, P.y);
      if (P.trace.length < 6000) P.trace.push({ t: P.jumpT, y: P.y - P.jumpStart, vy: P.vy });
    }
  }

  /** Plataformas que se repiten cada WORLD metros (x no se envuelve, así el rastro es continuo). */
  function platformsNear(x) {
    const k = Math.floor(x / WORLD);
    const out = [];
    for (let r = k - 1; r <= k + 1; r++) PLATFORMS.forEach((pl) => out.push({ x: pl.x + r * WORLD, y: pl.y, w: pl.w }));
    return out;
  }
  function niceStep(x) {
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const m = x / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }

  /* ---------- Dibujo ---------- */
  function resize() {
    const r = UI.fitCanvas(canvas, window.innerWidth < 700 ? 0.75 : 0.46);
    ctx = r.ctx; W = r.w; H = r.h;
  }

  function draw() {
    const C = UI.palette();
    const groundPx = 34;
    const sc = (H - groundPx - 14) / viewH; // px por metro
    const camX = P.x - (W * 0.28) / sc;
    const X = (x) => (x - camX) * sc;
    const Y = (y) => H - groundPx - y * sc;

    ctx.clearRect(0, 0, W, H);
    // cielo
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, C.panel2); sky.addColorStop(1, C.panel);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // regla de alturas
    const step = niceStep(viewH / 7);
    ctx.font = "10.5px JetBrains Mono, monospace";
    for (let yy = 0; yy <= viewH; yy += step) {
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(34, Y(yy)); ctx.lineTo(W, Y(yy)); ctx.stroke();
      ctx.fillStyle = C.faint; ctx.fillText(`${+yy.toFixed(2)} m`, 4, Y(yy) + 4);
    }

    // plataformas (repetidas)
    const viewW = W / sc;
    const r0 = Math.floor(camX / WORLD) - 1, r1 = Math.min(r0 + 60, Math.floor((camX + viewW) / WORLD) + 1);
    if (0.35 * sc >= 1.5) for (let rep = r0; rep <= r1; rep++) {
      PLATFORMS.forEach((pl) => {
        const x0 = X(pl.x + rep * WORLD);
        if (x0 > W || x0 + pl.w * sc < 0) return;
        ctx.fillStyle = C.line; roundRect(ctx, x0, Y(pl.y), pl.w * sc, Math.max(6, 0.35 * sc), 4); ctx.fill();
        ctx.fillStyle = C.violet; ctx.fillRect(x0, Y(pl.y), pl.w * sc, 3);
        ctx.fillStyle = C.faint; ctx.fillText(`${pl.y} m`, x0 + 4, Y(pl.y) - 4);
      });
    }
    // suelo
    ctx.fillStyle = C.line; ctx.fillRect(0, H - groundPx, W, groundPx);
    ctx.fillStyle = C.green; ctx.fillRect(0, H - groundPx, W, 3);
    ctx.fillStyle = C.faint;
    const xStep = niceStep(70 / sc); // una marca cada ~70 px
    const m0 = Math.ceil(camX / xStep) * xStep;
    for (let xm = m0; X(xm) < W; xm += xStep) {
      ctx.fillRect(X(xm), H - groundPx + 3, 1, 6);
      ctx.fillText(`${+xm.toFixed(2)}`, X(xm) + 2, H - groundPx + 20);
    }
    ctx.fillText("x (m)", W - 40, H - 6);

    // trayectoria predicha (desde la posición actual si está en el suelo, si no desde el despegue)
    const p = pred.p;
    const baseX = P.onGround ? P.x : (P.takeoffX ?? P.x);
    const baseY = P.onGround ? P.y : P.jumpStart;
    const dirx = P.face || 1;
    const path = (pts, color, dash, width) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.beginPath();
      pts.forEach((q, i) => {
        const px = X(baseX + dirx * p.vx * q.t), py = Y(baseY + q.y);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke(); ctx.restore();
    };
    if (c.ghost.checked) path(pred.ghost.pts, C.amber, [6, 6], 2);
    if (pred.tap) path(pred.tap.pts, C.violet, [2, 5], 2);
    path(pred.full.pts, C.accent, [], 2.4);

    // ápice
    const ax = X(baseX + dirx * p.vx * pred.full.tApex), ay = Y(baseY + pred.full.hMax);
    ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(ax, ay, 4, 0, 7); ctx.fill();
    ctx.font = "600 11.5px Inter, sans-serif";
    ctx.fillText(`h máx = ${UI.fmt(pred.full.hMax, 2)} m`, ax + 8, ay - 8);
    ctx.setLineDash([3, 4]); ctx.strokeStyle = C.accent; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, Y(baseY)); ctx.stroke(); ctx.setLineDash([]);

    // rastro real
    if (!P.onGround && P.trailPts) {
      ctx.fillStyle = C.pink;
      P.trailPts.forEach((q, i) => { if (i % 6 === 0) { ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), 1.8, 0, 7); ctx.fill(); } });
    }

    // personaje
    // tamaño mínimo en pantalla para que siga visible cuando la vista se aleja mucho
    const pw = Math.max(PW * sc, 9), ph = Math.max(PH * sc, 20);
    const px = X(P.x) - pw / 2, py = Y(P.y) - ph;
    ctx.fillStyle = C.pink;
    roundRect(ctx, px, py, pw, ph, Math.min(8, pw * 0.3)); ctx.fill();
    ctx.fillStyle = "#fff";
    const eyeX = X(P.x) + P.face * pw * 0.22, eyeY = py + ph * 0.22;
    ctx.beginPath(); ctx.arc(eyeX, eyeY, Math.max(2, pw * 0.11), 0, 7); ctx.fill();
    // vector velocidad (longitud en píxeles acotada)
    if (!P.onGround) {
      const vmag = Math.hypot(P.vx, P.vy) || 1, Lpx = Math.min(70, vmag * 4);
      UI.arrow(ctx, X(P.x), py + ph / 2, X(P.x) + (P.vx / vmag) * Lpx, py + ph / 2 - (P.vy / vmag) * Lpx, C.text, 2);
    }

    // leyenda
    ctx.font = "11px Inter, sans-serif";
    let ly = 18;
    const leg = (col, txt, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(W - 250, ly - 4); ctx.lineTo(W - 222, ly - 4); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.text; ctx.fillText(txt, W - 214, ly); ly += 17;
    };
    leg(C.accent, "Trayectoria predicha (botón sostenido)", []);
    if (pred.tap) leg(C.violet, "Toque corto (salto variable)", [2, 5]);
    if (c.ghost.checked) leg(C.amber, "Misma altura con g = 9,81 m/s²", [6, 6]);

    if (!focused) {
      ctx.fillStyle = C.muted; ctx.font = "600 12px Inter, sans-serif";
      ctx.fillText(auto ? "Modo demostración · haga clic aquí para controlar con el teclado" : "Haga clic aquí para controlar con el teclado", 44, 20);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------- Lecturas y gráficas ---------- */
  function readouts() {
    const f = UI.fmt, p = pred.p, fl = pred.full;
    const hIdeal = p.v0 * p.v0 / (2 * p.g);
    document.getElementById("t2-ro").innerHTML = `
      <div class="ro"><div class="k">g en múltiplos de la Tierra</div><div class="v">${f(p.g / G_EARTH, 2)} <small>g</small></div></div>
      <div class="ro"><div class="k">h = v₀²/2g (ideal)</div><div class="v">${f(hIdeal, 2)} <small>m</small></div></div>
      <div class="ro"><div class="k">h máx simulada</div><div class="v">${f(fl.hMax, 2)} <small>m</small></div></div>
      <div class="ro"><div class="k">Tiempo de subida</div><div class="v">${f(fl.tApex, 3)} <small>s</small></div></div>
      <div class="ro"><div class="k">Tiempo de bajada</div><div class="v">${f(fl.tDown, 3)} <small>s</small></div></div>
      <div class="ro"><div class="k">Tiempo en el aire</div><div class="v">${f(fl.tAir, 3)} <small>s</small></div></div>
      <div class="ro"><div class="k">Alcance horizontal</div><div class="v">${f(p.vx * fl.tAir, 2)} <small>m</small></div></div>
      <div class="ro"><div class="k">Misma h con g real</div><div class="v">${f(pred.ghost.tAir, 2)} <small>s en el aire</small></div></div>
    `;
    const h = c.h.value, th = c.th.value;
    document.getElementById("t2-design-out").innerHTML = `g = 2h/t<sub>h</sub>² = <b>${f(2 * h / (th * th), 2)}</b> m/s² · v₀ = 2h/t<sub>h</sub> = <b>${f(2 * h / th, 2)}</b> m/s`;
  }

  function chartData() {
    const C = UI.palette();
    const series = (pts, key) => pts.map((q) => ({ x: q.t, y: q[key] }));
    const mk = (key) => {
      const sets = [];
      if (P.lastJump) sets.push({ label: "Último salto real", data: series(P.lastJump, key), borderColor: C.pink, backgroundColor: C.pink, borderWidth: 2.6, parsing: false });
      sets.push({ label: "Predicción (sostenido)", data: series(pred.full.pts, key), borderColor: C.accent, backgroundColor: C.accent, borderDash: P.lastJump ? [5, 4] : [], parsing: false });
      if (pred.tap) sets.push({ label: "Toque corto", data: series(pred.tap.pts, key), borderColor: C.violet, backgroundColor: C.violet, borderDash: [2, 4], parsing: false });
      if (c.ghost.checked) sets.push({ label: "g = 9,81 (misma h)", data: series(pred.ghost.pts, key), borderColor: C.amber, backgroundColor: C.amber, borderDash: [6, 5], parsing: false });
      return sets;
    };
    return { y: mk("y"), vy: mk("vy") };
  }

  function makeCharts() {
    Object.values(charts).forEach((ch) => ch.destroy());
    const d = chartData();
    const opts = (yTitle) => ({
      type: "line",
      options: {
        plugins: { legend: { position: "top", align: "end" } },
        scales: { x: UI.axis("Tiempo desde el despegue t (s)", { min: 0 }), y: UI.axis(yTitle) },
      },
    });
    charts.y = new Chart(document.getElementById("t2-yt"), Object.assign(opts("Altura sobre el despegue y (m)"), { data: { datasets: d.y } }));
    charts.vy = new Chart(document.getElementById("t2-vt"), Object.assign(opts("Velocidad vertical v_y (m/s)"), { data: { datasets: d.vy } }));
  }

  function updateCharts() {
    if (!charts.y) return;
    const d = chartData();
    charts.y.data.datasets = d.y; charts.vy.data.datasets = d.vy;
    charts.y.update("none"); charts.vy.update("none");
  }

  function onParamChange() {
    predict();
    readouts();
    updateCharts();
    if (!visible) draw();
  }

  /* ---------- Bucle ---------- */
  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible) { lastTime = now; return; }
    let dt = Math.min(0.1, (now - lastTime) / 1000 || 0);
    lastTime = now;
    acc += dt;
    while (acc >= DT) {
      if (P.onGround) P.takeoffX = P.x;
      step(DT);
      acc -= DT;
    }
    // rastro en coordenadas del mundo
    if (!P.onGround) {
      P.trailPts = P.trailPts || [];
      P.trailPts.push({ x: P.x, y: P.y });
      if (P.trailPts.length > 900) P.trailPts.shift();
    } else {
      P.trailPts = [];
    }
    draw();
  }

  function applyPreset(name) {
    const s = PRESETS[name];
    c.v0.set(s.v0, true); c.g.set(s.g, true); c.fall.set(s.fall, true); c.vx.set(s.vx, true); c.maxfall.set(s.maxfall, true);
    c.vj.checked = s.vj; c.sus.checked = !!s.sus; c.half.checked = s.half;
    document.querySelectorAll("#t2-presets [data-preset]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.preset === name));
    P.lastJump = null;
    onParamChange();
  }

  function init() {
    canvas = document.getElementById("t2-canvas");
    const ms = (v) => `${UI.fmt(v, 2)} m/s`;
    c.v0 = UI.bindRange("t2-v0", ms, onParamChange);
    c.g = UI.bindRange("t2-g", (v) => `${UI.fmt(v, 2)} m/s²`, onParamChange);
    c.fall = UI.bindRange("t2-fall", (v) => `×${UI.fmt(v, 2)}`, onParamChange);
    c.vx = UI.bindRange("t2-vx", ms, onParamChange);
    c.maxfall = UI.bindRange("t2-maxfall", (v) => (v >= 80 ? "sin límite" : ms(v)), onParamChange);
    c.h = UI.bindRange("t2-h", (v) => `${UI.fmt(v, 2)} m`, readouts);
    c.th = UI.bindRange("t2-th", (v) => `${UI.fmt(v, 2)} s`, readouts);
    c.vj = document.getElementById("t2-var");
    c.half = document.getElementById("t2-half");
    c.sus = document.getElementById("t2-sustain");
    c.ghost = document.getElementById("t2-ghost");
    [c.vj, c.sus, c.half, c.ghost].forEach((el) => el.addEventListener("change", onParamChange));

    document.getElementById("t2-apply").addEventListener("click", () => {
      const h = c.h.value, th = c.th.value;
      c.g.set(Math.min(140, 2 * h / (th * th)), true);
      c.v0.set(Math.min(30, 2 * h / th), true);
      c.fall.set(1, true); c.maxfall.set(80, true); c.half.checked = false;
      P.lastJump = null;
      onParamChange();
    });
    document.querySelectorAll("#t2-presets [data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));

    // teclado (solo cuando la escena tiene el foco, para no robar la barra espaciadora a la página)
    canvas.addEventListener("focus", () => { focused = true; });
    canvas.addEventListener("blur", () => { focused = false; keys.left = keys.right = keys.jump = false; });
    canvas.addEventListener("pointerdown", () => { canvas.focus(); auto = false; });
    const map = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "jump", ArrowUp: "jump", KeyW: "jump" };
    canvas.addEventListener("keydown", (e) => {
      if (map[e.code]) { keys[map[e.code]] = true; auto = false; e.preventDefault(); }
      if (e.code === "KeyR") { P.x = 2; P.y = 0; P.vy = 0; P.onGround = true; P.trailPts = []; }
    });
    canvas.addEventListener("keyup", (e) => { if (map[e.code]) { keys[map[e.code]] = false; e.preventDefault(); } });
    // botones táctiles
    document.querySelectorAll("[data-touch]").forEach((b) => {
      const k = b.dataset.touch;
      const on = (e) => { e.preventDefault(); keys[k] = true; auto = false; };
      const off = (e) => { e.preventDefault(); keys[k] = false; };
      b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off);
      b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off);
    });

    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(canvas);
    resize();
    window.addEventListener("resize", () => { resize(); draw(); });
    UI.onTheme(() => { makeCharts(); draw(); });

    applyPreset("arcade");
    makeCharts();
    requestAnimationFrame((t) => { lastTime = t; loop(t); });
  }

  return { init };
})();
