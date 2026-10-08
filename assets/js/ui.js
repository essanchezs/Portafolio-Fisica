/* =========================================================
   Utilidades compartidas: tema claro/oscuro, navegación,
   ecuaciones (KaTeX), estilo de gráficas y exportación CSV.
   ========================================================= */

const UI = (() => {
  const listeners = [];

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function palette() {
    return {
      text: css("--text"),
      muted: css("--muted"),
      faint: css("--faint"),
      grid: css("--chart-grid"),
      chartText: css("--chart-text"),
      panel: css("--panel"),
      panel2: css("--panel-2"),
      line: css("--line"),
      accent: css("--accent"),
      pink: css("--accent-2"),
      amber: css("--amber"),
      green: css("--green"),
      violet: css("--violet"),
      danger: css("--danger"),
    };
  }

  /* ---------- Tema ---------- */
  function getTheme() {
    try { return localStorage.getItem("pf-theme"); } catch (e) { return null; }
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("pf-theme", t); } catch (e) { /* sin almacenamiento */ }
    if (window.Chart) applyChartDefaults();
    listeners.forEach((cb) => cb(palette()));
  }
  function initTheme() {
    const saved = getTheme();
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.setAttribute("data-theme", saved || (prefersLight ? "light" : "dark"));
    document.querySelectorAll("[data-theme-toggle]").forEach((b) =>
      b.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme");
        applyTheme(cur === "dark" ? "light" : "dark");
      })
    );
  }
  function onTheme(cb) { listeners.push(cb); }

  /* ---------- Chart.js ---------- */
  function applyChartDefaults() {
    const p = palette();
    Chart.defaults.color = p.chartText;
    Chart.defaults.borderColor = p.grid;
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.font.size = 11.5;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 3;
    Chart.defaults.plugins.tooltip.backgroundColor = p.panel;
    Chart.defaults.plugins.tooltip.titleColor = p.text;
    Chart.defaults.plugins.tooltip.bodyColor = p.text;
    Chart.defaults.plugins.tooltip.borderColor = p.line;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.animation = false;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.elements.point.radius = 0;
    Chart.defaults.elements.line.borderWidth = 2;
  }

  /** Eje lineal con título (siempre con unidades). */
  function axis(title, extra = {}) {
    return Object.assign(
      {
        type: "linear",
        title: { display: true, text: title, font: { weight: "600" } },
        grid: { color: palette().grid },
        ticks: { maxTicksLimit: 8 },
      },
      extra
    );
  }

  /** Plugin: línea vertical (cursor de tiempo) en x = chart.$cursorX */
  const cursorPlugin = {
    id: "cursorLine",
    afterDatasetsDraw(chart) {
      const x = chart.$cursorX;
      if (x == null) return;
      const { ctx, chartArea, scales } = chart;
      const px = scales.x.getPixelForValue(x);
      if (px < chartArea.left || px > chartArea.right) return;
      ctx.save();
      ctx.strokeStyle = palette().pink;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px, chartArea.top);
      ctx.lineTo(px, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  /** Plugin: bandas sombreadas en x (ventanas de temperatura, etc.) */
  const bandPlugin = {
    id: "xBands",
    beforeDatasetsDraw(chart) {
      const bands = chart.$bands;
      if (!bands) return;
      const { ctx, chartArea, scales } = chart;
      bands.forEach((b) => {
        const x1 = scales.x.getPixelForValue(b.from);
        const x2 = scales.x.getPixelForValue(b.to);
        ctx.save();
        ctx.fillStyle = b.color;
        const top = b.yFrom != null ? scales.y.getPixelForValue(b.yTo) : chartArea.top;
        const bot = b.yFrom != null ? scales.y.getPixelForValue(b.yFrom) : chartArea.bottom;
        ctx.fillRect(Math.max(x1, chartArea.left), top, Math.min(x2, chartArea.right) - Math.max(x1, chartArea.left), bot - top);
        if (b.label) {
          ctx.fillStyle = b.labelColor || palette().muted;
          ctx.font = "600 10.5px Inter, sans-serif";
          ctx.fillText(b.label, Math.max(x1, chartArea.left) + 4, top + 12);
        }
        ctx.restore();
      });
    },
  };

  /* ---------- CSV ---------- */
  function downloadCSV(filename, header, rows) {
    const lines = [header.join(",")].concat(rows.map((r) => r.map((v) => (typeof v === "number" ? +v.toFixed(5) : v)).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- Controles ---------- */
  /** Conecta un <input type=range> con su <output>, con formateo. */
  function bindRange(id, fmt, onInput) {
    const el = document.getElementById(id);
    const out = document.querySelector(`output[for="${id}"]`);
    const update = () => {
      if (out) out.textContent = fmt(parseFloat(el.value));
      if (onInput) onInput(parseFloat(el.value));
    };
    el.addEventListener("input", update);
    if (out) out.textContent = fmt(parseFloat(el.value));
    return {
      el,
      get value() { return parseFloat(el.value); },
      set(v, silent) { el.value = v; if (out) out.textContent = fmt(parseFloat(el.value)); if (!silent && onInput) onInput(parseFloat(el.value)); },
    };
  }

  const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toLocaleString("es-CR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");

  /** Ajusta un canvas al ancho de su contenedor con DPR. */
  function fitCanvas(canvas, aspect) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.parentElement.clientWidth;
    const h = Math.round(w * aspect);
    canvas.style.height = h + "px";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /** Dibuja una flecha en canvas. */
  function arrow(ctx, x1, y1, x2, y2, color, width = 2, head = 9) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    const h = Math.min(head, len * 0.5);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(ang) * h * 0.8, y2 - Math.sin(ang) * h * 0.8); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(ang - 0.42), y2 - h * Math.sin(ang - 0.42));
    ctx.lineTo(x2 - h * Math.cos(ang + 0.42), y2 - h * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ---------- Navegación ---------- */
  function initNav() {
    const links = [...document.querySelectorAll(".nav a[href^='#']")];
    const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            const a = map.get(e.target.id);
            if (a) a.classList.add("active");
          }
        });
      },
      { rootMargin: "-35% 0px -60% 0px" }
    );
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });

    document.querySelectorAll("[data-nav-toggle]").forEach((b) =>
      b.addEventListener("click", () => document.body.classList.toggle("nav-open"))
    );
    links.forEach((a) => a.addEventListener("click", () => document.body.classList.remove("nav-open")));
    document.addEventListener("click", (e) => {
      if (document.body.classList.contains("nav-open") && !e.target.closest(".sidebar") && !e.target.closest("[data-nav-toggle]")) {
        document.body.classList.remove("nav-open");
      }
    });
  }

  function initMath() {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    }
  }

  /* ---------- Fondo animado del encabezado (campo de partículas en órbita) ---------- */
  function initHero() {
    const c = document.getElementById("hero-canvas");
    if (!c) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W, H, ctx;
    const parts = Array.from({ length: 70 }, () => ({
      r: 60 + Math.random() * 520,
      th: Math.random() * Math.PI * 2,
      w: 0.0006 + Math.random() * 0.0016,
      s: 0.6 + Math.random() * 1.8,
    }));
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = c.clientWidth; H = c.clientHeight;
      c.width = W * dpr; c.height = H * dpr;
      ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame(t) {
      const p = palette();
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.82, cy = H * 0.55;
      ctx.strokeStyle = p.line; ctx.lineWidth = 1;
      [120, 220, 340, 480].forEach((r) => { ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.42, -0.25, 0, Math.PI * 2); ctx.stroke(); });
      parts.forEach((q, i) => {
        // ω = v/r → las partículas internas giran más rápido (como un disco kepleriano)
        const th = q.th + (reduce ? 0 : t * q.w * (300 / q.r));
        const x = cx + q.r * Math.cos(th) * Math.cos(-0.25) - q.r * 0.42 * Math.sin(th) * Math.sin(-0.25);
        const y = cy + q.r * Math.cos(th) * Math.sin(-0.25) + q.r * 0.42 * Math.sin(th) * Math.cos(-0.25);
        ctx.fillStyle = i % 3 === 0 ? p.accent : i % 3 === 1 ? p.violet : p.pink;
        ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.arc(x, y, q.s, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (!reduce) requestAnimationFrame(frame);
    }
    size();
    addEventListener("resize", size);
    requestAnimationFrame(frame);
  }

  function init() {
    initTheme();
    if (window.Chart) {
      applyChartDefaults();
      Chart.register(cursorPlugin, bandPlugin);
    }
    initNav();
    initMath();
    initHero();
  }

  return { init, palette, onTheme, axis, downloadCSV, bindRange, fmt, fitCanvas, arrow, css };
})();
