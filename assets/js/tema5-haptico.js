/* =========================================================
   Tema 5 — El resorte virtual detrás de un control háptico
   Video con análisis + curva F(x) del gatillo adaptativo e
   ilustración de la tercera ley y la fuerza restauradora.
   ========================================================= */
window.Tema5 = (() => {
  const XMAX = 10; // recorrido ilustrativo (mm)
  const FMAX = 6; // fuerza máxima ilustrativa del actuador (N)
  const RETURN_K = 0.04; // resorte mecánico débil de retorno (N/mm)

  let c = {}, chart = null, canvas, ctx, W, H;
  let x = 0, vxl = 0, releasing = false, raf = null;

  /** Fuerza del actuador según el modo (N), x en mm. */
  function force(mode, k, xx) {
    switch (mode) {
      case "slope": return Math.min(FMAX, k * xx);
      case "zones": {
        const zone = Math.min(9, Math.floor(xx / (XMAX / 10)));
        const xc = (zone + 0.5) * (XMAX / 10);
        const level = Math.round(8 * Math.min(1, (k * xc) / FMAX)); // 0–8
        return (level / 8) * FMAX;
      }
      case "feedback": return xx >= 3 ? Math.min(FMAX, k * 6) : 0;
      case "weapon": return xx >= 2 && xx <= 6 ? Math.min(FMAX, k * 7) : 0;
      case "bow": return Math.min(FMAX, (k / 0.6) * FMAX * (xx / XMAX) ** 2);
      default: return 0;
    }
  }
  const total = (xx) => force(c.mode.value, c.k.value, xx) + RETURN_K * xx;

  function energy(xx) {
    // U = ∫ F dx (regla del trapecio), N·mm = mJ
    const n = 200;
    let U = 0;
    for (let i = 0; i < n; i++) {
      const a = (xx * i) / n, b = (xx * (i + 1)) / n;
      U += ((total(a) + total(b)) / 2) * (b - a);
    }
    return U;
  }

  function hexA(color, a) {
    const m = color.match(/^#([0-9a-f]{6})$/i);
    if (!m) return color;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function makeChart() {
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("t5-fx"), {
      type: "line",
      data: { datasets: [] },
      options: {
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: { legend: { position: "top", align: "end" } },
        scales: {
          x: UI.axis("Desplazamiento del gatillo x (mm)", { min: 0, max: XMAX }),
          y: UI.axis("Fuerza restauradora |F| (N)", { min: 0, max: 8 }),
        },
      },
    });
    updateChart();
  }

  function updateChart() {
    const P = UI.palette();
    const k = c.k.value, mode = c.mode.value;
    const xs = []; for (let i = 0; i <= 400; i++) xs.push((XMAX * i) / 400);
    const curve = xs.map((xx) => ({ x: xx, y: total(xx) }));
    chart.data.datasets = [
      { label: "Área = energía U (trabajo del dedo)", data: curve.filter((p) => p.x <= x + 1e-9), borderColor: "transparent", backgroundColor: hexA(P.green, 0.22), fill: "origin", parsing: false, stepped: false },
      { label: "Hooke ideal F = kx", data: xs.map((xx) => ({ x: xx, y: k * xx })), borderColor: P.muted, borderDash: [6, 5], parsing: false },
      { label: "Curva programada en el gatillo", data: curve, borderColor: P.green, backgroundColor: P.green, borderWidth: 3, parsing: false },
      { label: "Posición actual", type: "scatter", data: [{ x, y: total(x) }], backgroundColor: P.pink, pointRadius: 6, parsing: false },
    ];
    chart.update("none");
  }

  function resize() {
    const r = UI.fitCanvas(canvas, 0.62);
    ctx = r.ctx; W = r.w; H = r.h;
  }

  function drawTrigger() {
    const P = UI.palette();
    ctx.clearRect(0, 0, W, H);
    const s = W / 420; // escala del dibujo (diseñado a 420 × 260)
    const px = 215 * s, py = 40 * s; // pivote del gatillo
    const ang = -(x / XMAX) * 0.4; // apretar = la punta se mueve hacia la derecha (hacia adentro)
    const F = total(x);
    const font = (w, sz) => `${w} ${sz * s}px Inter, sans-serif`;

    // carcasa
    ctx.fillStyle = P.panel; ctx.strokeStyle = P.line; ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(150 * s, 12 * s, 255 * s, 46 * s, 12 * s); else ctx.rect(150 * s, 12 * s, 255 * s, 46 * s);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.faint; ctx.font = font(400, 10.5);
    ctx.fillText("carcasa del control", 300 * s, 40 * s);

    // motor + engranes (gira al moverse el gatillo)
    const mx = 345 * s, my = 145 * s;
    ctx.fillStyle = P.panel2; ctx.strokeStyle = P.muted; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 28 * s, 0, 7); ctx.fill(); ctx.stroke();
    const rot = x * 0.9;
    for (let i = 0; i < 12; i++) {
      const a = rot + (i * Math.PI) / 6;
      ctx.beginPath(); ctx.moveTo(mx + 28 * s * Math.cos(a), my + 28 * s * Math.sin(a)); ctx.lineTo(mx + 35 * s * Math.cos(a), my + 35 * s * Math.sin(a)); ctx.stroke();
    }
    ctx.fillStyle = P.muted; ctx.font = font(600, 10); ctx.textAlign = "center";
    ctx.fillText("motor +", mx, my - 2 * s); ctx.fillText("engranes", mx, my + 11 * s); ctx.textAlign = "left";

    // gatillo
    const toWorld = (lx, ly) => [px + lx * Math.cos(ang) - ly * Math.sin(ang), py + lx * Math.sin(ang) + ly * Math.cos(ang)];
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = P.violet; ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(-9 * s, 0); ctx.lineTo(13 * s, 0);
    ctx.quadraticCurveTo(26 * s, 85 * s, 6 * s, 160 * s);
    ctx.lineTo(-14 * s, 160 * s);
    ctx.quadraticCurveTo(3 * s, 85 * s, -9 * s, 0);
    ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
    const [tx0, ty0] = toWorld(-6 * s, 150 * s);
    ctx.fillStyle = P.violet; ctx.font = font(600, 10.5); ctx.fillText("gatillo", tx0 + 14 * s, ty0 + 14 * s);

    // brazo del actuador hasta la cara trasera del gatillo
    const [cxW, cyW] = toWorld(19 * s, 100 * s);
    ctx.strokeStyle = P.muted; ctx.lineWidth = 5 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(mx - 26 * s, my - 6 * s); ctx.lineTo(cxW, cyW); ctx.stroke();

    // pivote
    ctx.fillStyle = P.text; ctx.beginPath(); ctx.arc(px, py, 4.5 * s, 0, 7); ctx.fill();

    // dedo sobre la cara delantera
    const [fxW, fyW] = toWorld(-10 * s, 128 * s);
    ctx.fillStyle = hexA(P.amber, 0.9);
    ctx.beginPath(); ctx.ellipse(fxW - 38 * s, fyW, 36 * s, 14 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#3a2600"; ctx.font = font(700, 10.5); ctx.fillText("dedo", fxW - 52 * s, fyW + 4 * s);

    // fuerzas: par acción-reacción, iguales y opuestas, sobre cuerpos distintos
    const L = Math.min(150 * s, 16 * s * F);
    if (F > 0.02) {
      const y1 = fyW - 26 * s, y2 = fyW + 26 * s;
      UI.arrow(ctx, fxW - L, y1, fxW, y1, P.pink, 3);
      UI.arrow(ctx, fxW, y2, fxW - L, y2, P.green, 3);
      ctx.font = font(600, 10.5);
      ctx.fillStyle = P.pink; ctx.fillText(`F dedo→gatillo = ${UI.fmt(F, 2)} N`, 10 * s, y1 - 8 * s);
      ctx.fillStyle = P.green; ctx.fillText(`F gatillo→dedo = ${UI.fmt(F, 2)} N`, 10 * s, y2 + 18 * s);
    }
    ctx.fillStyle = P.muted; ctx.font = font(400, 10);
    ctx.fillText(releasing ? "Soltado (cámara lenta ×60): el motor regresa el gatillo" : "Arrastre horizontalmente sobre el dibujo para apretar el gatillo", 10 * s, H - 8 * s);
  }

  function readouts() {
    const f = UI.fmt;
    const k = c.k.value, mode = c.mode.value;
    const F = total(x);
    const dx = 0.05;
    const kEff = (total(Math.min(XMAX, x + dx)) - total(Math.max(0, x - dx))) / (Math.min(XMAX, x + dx) - Math.max(0, x - dx));
    const U = energy(x), Umax = energy(XMAX);
    const zone = Math.min(9, Math.floor(x / (XMAX / 10)));
    const level = mode === "zones" ? Math.round((force("zones", k, x) / FMAX) * 8) : null;
    document.getElementById("t5-ro").innerHTML = `
      <div class="ro"><div class="k">Posición x</div><div class="v">${f(x, 2)} <small>mm</small></div></div>
      <div class="ro"><div class="k">|F gatillo→dedo|</div><div class="v">${f(F, 2)} <small>N</small></div></div>
      <div class="ro"><div class="k">|F dedo→gatillo| (3.ª ley)</div><div class="v">${f(F, 2)} <small>N</small></div></div>
      <div class="ro"><div class="k">Rigidez local dF/dx</div><div class="v">${f(kEff, 2)} <small>N/mm</small></div></div>
      <div class="ro"><div class="k">Energía U = ∫F dx</div><div class="v">${f(U, 2)} <small>mJ</small></div></div>
      <div class="ro"><div class="k">Salto relativo (h ∝ U)</div><div class="v">${f(Umax > 0 ? (U / Umax) * 100 : 0, 0)} <small>% del máximo</small></div></div>
      ${level !== null ? `<div class="ro"><div class="k">Zona / nivel</div><div class="v">${zone} / ${level} <small>de 8</small></div></div>` : ""}
    `;
  }

  function render() {
    drawTrigger();
    readouts();
    if (chart) updateChart();
  }

  function setX(v) {
    x = Math.max(0, Math.min(XMAX, v));
    c.x.set(+x.toFixed(2), true);
    render();
  }

  function release() {
    releasing = true;
    vxl = 0;
    let last = performance.now();
    cancelAnimationFrame(raf);
    const m = 0.01; // masa efectiva ilustrativa del gatillo (kg)
    const SLOW = 60; // cámara lenta: el regreso real dura milisegundos
    const step = (now) => {
      const dt = Math.min(0.03, (now - last) / 1000) / SLOW; last = now;
      // a = F/m (m/s²) ×1000 → mm/s²; con amortiguamiento para que no oscile indefinidamente
      for (let i = 0; i < 10; i++) {
        const a = (-total(x) / m) * 1000 - 300 * vxl;
        vxl += a * (dt / 10);
        x += vxl * (dt / 10);
        if (x <= 0) { x = 0; vxl = 0; }
      }
      c.x.set(+x.toFixed(2), true);
      render();
      if (x > 0.001 && Math.abs(vxl) > 0.001) raf = requestAnimationFrame(step);
      else { releasing = false; render(); }
    };
    raf = requestAnimationFrame(step);
  }

  function init() {
    canvas = document.getElementById("t5-trigger");
    c.mode = document.getElementById("t5-mode");
    c.k = UI.bindRange("t5-k", (v) => `${UI.fmt(v, 2)} N/mm`, render);
    c.x = UI.bindRange("t5-x", (v) => `${UI.fmt(v, 2)} mm`, (v) => { releasing = false; cancelAnimationFrame(raf); x = v; render(); });
    c.mode.addEventListener("change", render);
    document.getElementById("t5-release").addEventListener("click", release);

    // arrastrar sobre el diagrama
    let dragging = false;
    const toX = (e) => {
      const r = canvas.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width; // 0..1
      return ((u - 0.2) / 0.7) * XMAX;
    };
    canvas.addEventListener("pointerdown", (e) => { dragging = true; releasing = false; cancelAnimationFrame(raf); canvas.setPointerCapture(e.pointerId); setX(toX(e)); });
    canvas.addEventListener("pointermove", (e) => { if (dragging) setX(toX(e)); });
    const up = () => { if (dragging) { dragging = false; release(); } };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.style.touchAction = "none";
    canvas.style.cursor = "ew-resize";

    // marcas de tiempo del video
    const iframe = document.getElementById("t5-video");
    document.querySelectorAll(".timeline .ts").forEach((b) => {
      b.setAttribute("role", "button");
      b.setAttribute("tabindex", "0");
      const go = () => {
        iframe.src = `https://www.youtube-nocookie.com/embed/8VBZ1upH93w?rel=0&autoplay=1&start=${b.dataset.t}`;
        iframe.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      b.addEventListener("click", go);
      b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });

    resize();
    window.addEventListener("resize", () => { resize(); drawTrigger(); });
    UI.onTheme(() => { makeChart(); drawTrigger(); });
    makeChart();
    setX(6);
  }

  return { init };
})();
