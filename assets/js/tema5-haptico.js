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
    const r = UI.fitCanvas(canvas, window.innerWidth < 700 ? 0.6 : 0.34);
    ctx = r.ctx; W = r.w; H = r.h;
  }

  /** Geometría del dibujo: pared a la izquierda, manija (el gatillo) a la derecha. */
  let geo = { restX: 0, k: 1 };

  /** Resorte virtual: la manija comprime un resorte contra una pared; x es el recorrido del gatillo. */
  function drawTrigger() {
    const P = UI.palette();
    ctx.clearRect(0, 0, W, H);
    const wallX = 56, cy = H * 0.5, handleW = 26, handleH = Math.min(96, H * 0.5);
    const restX = W * 0.7;
    const k = ((restX - wallX) * 0.62) / XMAX; // px por mm
    geo = { restX, k, handleW };
    const hx = restX - x * k; // cara izquierda de la manija
    const F = total(x);

    // pared con rayado
    ctx.fillStyle = P.line; ctx.fillRect(wallX - 14, cy - handleH * 0.8, 14, handleH * 1.6);
    ctx.strokeStyle = P.faint; ctx.lineWidth = 1;
    for (let yy = cy - handleH * 0.8; yy < cy + handleH * 0.8; yy += 9) { ctx.beginPath(); ctx.moveTo(wallX - 14, yy + 9); ctx.lineTo(wallX, yy); ctx.stroke(); }

    // zonas del modo discretizado (10 tramos con su nivel)
    if (c.mode.value === "zones") {
      for (let z = 0; z < 10; z++) {
        const lvl = Math.round((force("zones", c.k.value, (z + 0.5)) / 6) * 8);
        ctx.fillStyle = UI.css("--accent"); ctx.globalAlpha = 0.04 + lvl * 0.025;
        ctx.fillRect(restX - (z + 1) * k, cy + handleH * 0.62, k - 1, 10);
      }
      ctx.globalAlpha = 1;
    }

    // resorte (espiral) entre la pared y la manija
    const coils = 12, amp = handleH * 0.22, len = hx - wallX;
    ctx.strokeStyle = P.muted; ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(wallX, cy);
    for (let i = 0; i <= coils * 2; i++) {
      const px = wallX + 10 + ((len - 20) * i) / (coils * 2);
      ctx.lineTo(px, cy + (i === 0 || i === coils * 2 ? 0 : i % 2 ? -amp : amp));
    }
    ctx.lineTo(hx, cy); ctx.stroke();

    // manija
    ctx.fillStyle = P.text; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hx, cy - handleH / 2, handleW, handleH, 6); else ctx.rect(hx, cy - handleH / 2, handleW, handleH);
    ctx.fill();
    ctx.fillStyle = P.panel; ctx.fillRect(hx + handleW / 2 - 1, cy - handleH / 2 + 10, 2, handleH - 20);

    // regla del recorrido en mm
    const ry = cy + handleH * 0.62 + 22;
    ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(restX - XMAX * k, ry); ctx.lineTo(restX, ry); ctx.stroke();
    ctx.fillStyle = P.faint; ctx.font = "10.5px JetBrains Mono, monospace"; ctx.textAlign = "center";
    for (let mm = 0; mm <= XMAX; mm += 2) { ctx.fillRect(restX - mm * k, ry - 3, 1, 6); ctx.fillText(mm + " mm", restX - mm * k, ry + 16); }
    ctx.textAlign = "left";

    // fuerzas: par acción-reacción sobre cuerpos distintos (dedo y gatillo)
    if (F > 0.02) {
      const L = Math.min(W - restX - handleW - 40, 18 * F);
      const ax = hx + handleW + 12;
      UI.arrow(ctx, ax + L, cy - 16, ax, cy - 16, P.accent, 2.2);
      UI.arrow(ctx, ax, cy + 16, ax + L, cy + 16, P.accent2 || UI.css("--accent-2"), 2.2);
      ctx.font = "12px Public Sans, sans-serif";
      ctx.fillStyle = P.accent; ctx.fillText(`dedo → gatillo  ${UI.fmt(F, 2)} N`, ax, cy - 26);
      ctx.fillStyle = UI.css("--accent-2"); ctx.fillText(`gatillo → dedo  ${UI.fmt(F, 2)} N`, ax, cy + 38);
    }
    ctx.fillStyle = P.muted; ctx.font = "12px Public Sans, sans-serif";
    ctx.fillText(releasing ? "Soltado: la fuerza restauradora devuelve la manija (cámara lenta ×60)" : "Arrastre la manija hacia la pared para comprimir el resorte", 16, 22);
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
      <div class="ro"><div class="k">Energía relativa</div><div class="v">${f(Umax > 0 ? (U / Umax) * 100 : 0, 0)} <small>% de la carga máxima</small></div></div>
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
      const px = e.clientX - r.left - geo.handleW / 2;
      return (geo.restX - px) / geo.k;
    };
    canvas.addEventListener("pointerdown", (e) => { dragging = true; releasing = false; cancelAnimationFrame(raf); canvas.setPointerCapture(e.pointerId); setX(toX(e)); });
    canvas.addEventListener("pointermove", (e) => { if (dragging) setX(toX(e)); });
    const up = () => { if (dragging) { dragging = false; release(); } };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";

    // marcas de tiempo del video
    // Se usa la API del reproductor de YouTube para saltar al instante dentro de la misma
    // sesión (sin recargar el video ni volver a mostrar anuncios).
    const iframe = document.getElementById("t5-video");
    let player = null, playerReady = false;
    const initPlayer = () => {
      if (player || !window.YT || !YT.Player) return;
      player = new YT.Player("t5-video", { events: { onReady: () => { playerReady = true; } } });
    };
    if (window.YT && YT.Player) initPlayer();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); initPlayer(); };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    document.querySelectorAll(".timeline .ts").forEach((b) => {
      b.setAttribute("role", "button");
      b.setAttribute("tabindex", "0");
      const go = () => {
        const t = parseFloat(b.dataset.t);
        if (playerReady && player.seekTo) {
          player.seekTo(t, true);
          player.playVideo();
        } else {
          // respaldo si la API aún no cargó: recargar en el instante pedido
          iframe.src = `https://www.youtube-nocookie.com/embed/8VBZ1upH93w?rel=0&enablejsapi=1&autoplay=1&start=${t}`;
        }
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
