/* =========================================================
   Tema 11 — Síntesis de sonido: armónicos y timbre
   Multimedia con análisis: dos grabaciones reales de la misma
   nota (La3) analizadas en el navegador (FFT): forma de onda,
   espectro y amplitud de cada armónico. Extra: sintetizador
   aditivo con PeriodicWave de la Web Audio API.
   ========================================================= */
window.Tema11 = (() => {
  const FILES = {
    clar: { url: "assets/audio/clarinete-la3.wav", name: "Clarinete", col: "--accent" },
    vio: { url: "assets/audio/violin-la3.wav", name: "Violín", col: "--amber" },
  };
  const NH = 12;
  let charts = {}, data = {};

  /* ---------- FFT radix-2 (in place) ---------- */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ar = re[i + k], ai = im[i + k], br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ar + br; im[i + k] = ai + bi; re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  /** Frecuencia fundamental por autocorrelación. */
  function f0Of(x, sr) {
    const N = 4096, lo = Math.floor(sr / 600), hi = Math.floor(sr / 70);
    const r = (l) => { let s = 0; for (let i = 0; i < N; i++) s += x[i] * x[i + l]; return s; };
    const ac = []; let best = 0;
    for (let l = lo; l <= hi; l++) { ac[l] = r(l); best = Math.max(best, ac[l]); }
    // el periodo es el primer máximo local con correlación alta (un múltiplo del periodo también correlaciona igual de bien)
    let lag = lo;
    for (let l = lo + 1; l < hi; l++) if (ac[l] >= 0.85 * best && ac[l] >= ac[l - 1] && ac[l] >= ac[l + 1]) { lag = l; break; }
    const a = ac[lag - 1], b = ac[lag], c = ac[lag + 1], d = (a - c) / (2 * (a - 2 * b + c));
    return sr / (lag + (Number.isFinite(d) ? d : 0));
  }

  function analyse(buf) {
    const sr = buf.sampleRate, x = buf.getChannelData(0);
    const start = Math.floor(0.5 * sr), N = 16384;
    const seg = x.slice(start, start + N);
    const f0 = f0Of(seg, sr);
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = seg[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    fft(re, im);
    const mag = new Float64Array(N / 2);
    for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
    const df = sr / N;
    const harm = [];
    for (let n = 1; n <= NH; n++) {
      const a = Math.floor((n * f0 * 0.97) / df), b = Math.ceil((n * f0 * 1.03) / df);
      let m = 0; for (let i = a; i <= b; i++) m = Math.max(m, mag[i]);
      harm.push(m);
    }
    const hmax = Math.max(...harm);
    const rel = harm.map((v) => v / hmax);
    const mmax = Math.max(...mag);
    const spec = [];
    for (let i = 1; i < Math.min(N / 2, Math.floor(3200 / df)); i += 2) spec.push({ x: i * df, y: Math.max(-60, 20 * Math.log10(mag[i] / mmax + 1e-9)) });
    // tres periodos desde un cruce por cero ascendente
    let z = start + 2000; while (z < x.length - 1 && !(x[z] < 0 && x[z + 1] >= 0)) z++;
    const per = sr / f0, wave = [];
    let peak = 0; for (let i = 0; i < 3 * per; i++) peak = Math.max(peak, Math.abs(x[z + i]));
    for (let i = 0; i < 3 * per; i++) wave.push({ x: (i / sr) * 1000, y: x[z + i] / peak });
    // centroide espectral y energía en armónicos pares/impares
    let num = 0, den = 0; rel.forEach((a, i) => { num += (i + 1) * f0 * a * a; den += a * a; });
    const even = rel.filter((_, i) => (i + 1) % 2 === 0).reduce((s, a) => s + a * a, 0), odd = rel.filter((_, i) => (i + 1) % 2 === 1).reduce((s, a) => s + a * a, 0);
    return { f0, rel, spec, wave, centroid: num / den, evenShare: even / (even + odd), dur: buf.duration };
  }

  function makeCharts() {
    Object.values(charts).forEach((ch) => ch.destroy());
    if (!data.clar || !data.vio) return;
    const P = UI.palette(), col = { clar: P.accent, vio: P.amber };
    const opts = (x, y, extra = {}) => Object.assign({ interaction: { mode: "nearest", axis: "x", intersect: false }, plugins: { legend: { position: "top", align: "end" } }, scales: { x, y } }, extra);
    charts.wave = new Chart(document.getElementById("t11-wave"), {
      type: "line",
      data: { datasets: ["clar", "vio"].map((k) => ({ label: `${FILES[k].name} (f₀ = ${UI.fmt(data[k].f0, 1)} Hz)`, data: data[k].wave, borderColor: col[k], backgroundColor: col[k], borderWidth: 2, parsing: false })) },
      options: opts(UI.axis("Tiempo (ms)", { min: 0, max: 13.6 }), UI.axis("Presión sonora (normalizada)", { min: -1.1, max: 1.1 })),
    });
    charts.spec = new Chart(document.getElementById("t11-spec"), {
      type: "line",
      data: { datasets: ["clar", "vio"].map((k) => ({ label: FILES[k].name, data: data[k].spec, borderColor: col[k], backgroundColor: col[k], borderWidth: 1.4, parsing: false })) },
      options: opts(UI.axis("Frecuencia (Hz)", { min: 0, max: 3200 }), UI.axis("Nivel relativo (dB)", { min: -60, max: 0 })),
    });
    charts.spec.$bands = Array.from({ length: 13 }, (_, i) => ({ from: (i + 1) * 220 - 4, to: (i + 1) * 220 + 4, color: UI.css("--line"), label: i < 12 ? `${i + 1}` : "" }));
    charts.spec.update("none");
    charts.harm = new Chart(document.getElementById("t11-harm"), {
      type: "bar",
      data: { labels: Array.from({ length: NH }, (_, i) => `${i + 1}`), datasets: ["clar", "vio"].map((k) => ({ label: FILES[k].name, data: data[k].rel, backgroundColor: col[k] })) },
      options: { plugins: { legend: { position: "top", align: "end" }, tooltip: { callbacks: { title: (it) => `Armónico ${it[0].label} (${UI.fmt(220 * +it[0].label, 0)} Hz aprox.)`, label: (it) => `${it.dataset.label}: ${UI.fmt(it.raw, 2)}` } } },
        scales: { x: { grid: { display: false }, title: { display: true, text: "Número de armónico n (frecuencia n·f₀)", font: { weight: "600" } } }, y: UI.axis("Amplitud relativa al armónico más fuerte", { min: 0, max: 1.05 }) } },
    });
    const f = UI.fmt, a = data.clar, b = data.vio;
    document.getElementById("t11-ro").innerHTML = `
      <div class="ro"><div class="k">f₀ medida: clarinete · violín</div><div class="v">${f(a.f0, 1)} · ${f(b.f0, 1)} <small>Hz (La3 = 220 Hz)</small></div></div>
      <div class="ro"><div class="k">Energía en armónicos pares</div><div class="v">${f(a.evenShare * 100, 0)} % · ${f(b.evenShare * 100, 0)} <small>%</small></div></div>
      <div class="ro"><div class="k">Armónico más fuerte</div><div class="v">n = ${a.rel.indexOf(1) + 1} · n = ${b.rel.indexOf(1) + 1}</div></div>
      <div class="ro"><div class="k">Centroide espectral (“brillo”)</div><div class="v">${f(a.centroid, 0)} · ${f(b.centroid, 0)} <small>Hz</small></div></div>`;
  }

  async function load() {
    try {
      const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
      for (const k of Object.keys(FILES)) {
        const ab = await fetch(FILES[k].url).then((r) => r.arrayBuffer());
        const buf = await ac.decodeAudioData(ab);
        live.pcm[k] = { x: buf.getChannelData(0), sr: buf.sampleRate };
        data[k] = analyse(buf);
      }
      makeCharts();
      // el sintetizador arranca con el timbre medido del clarinete
      setHarm(data.clar.rel.slice(0, 10));
    } catch (e) {
      document.getElementById("t11-ro").innerHTML = `<div class="ro"><div class="k">No se pudo analizar el audio</div><div class="v"><small>${e.message}</small></div></div>`;
    }
  }

  /* ---------- Análisis en vivo mientras suena cada muestra ---------- */
  const live = { key: null, pcm: {}, raf: 0, frame: 0, synthAn: null, synthUntil: 0 };

  /** Toma 'periods' periodos desde un cruce por cero ascendente del buffer de tiempo. */
  function periodsFrom(buf, sr, f0, periods) {
    const per = sr / f0;
    let z = 0; while (z < buf.length - per * periods - 2 && !(buf[z] < 0 && buf[z + 1] >= 0)) z++;
    const n = Math.floor(per * periods), out = [];
    for (let i = 0; i <= n && z + i < buf.length; i++) out.push(buf[z + i]);
    return out;
  }

  /** Espectro (dB relativos) y armónicos de N muestras alrededor del índice i0. */
  function liveSpectrum(x, sr, i0, f0) {
    const N = 8192, re = new Float64Array(N), im = new Float64Array(N), st = Math.max(0, Math.min(x.length - N, i0 - N / 2));
    for (let i = 0; i < N; i++) re[i] = x[st + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    fft(re, im);
    const df = sr / N, top = Math.floor(3200 / df), mag = new Float64Array(top + 1);
    let mx = 1e-12; for (let i = 1; i <= top; i++) { mag[i] = Math.hypot(re[i], im[i]); mx = Math.max(mx, mag[i]); }
    const spec = []; for (let i = 1; i <= top; i++) spec.push({ x: i * df, y: Math.max(-60, 20 * Math.log10(mag[i] / mx + 1e-9)) });
    const hm = [];
    for (let n = 1; n <= NH; n++) { let m = 0; for (let i = Math.floor((n * f0 * 0.97) / df); i <= Math.min(top, Math.ceil((n * f0 * 1.03) / df)); i++) m = Math.max(m, mag[i]); hm.push(m); }
    const hx = Math.max(...hm, 1e-12);
    return { spec, harm: hm.map((v) => v / hx), level: mx };
  }

  function liveFrame() {
    live.raf = 0;
    let again = false;
    const k = live.key;
    if (k && live.pcm[k] && charts.wave) {
      const el = document.getElementById(k === "clar" ? "t11-a1" : "t11-a2");
      again = !el.paused;
      const { x, sr } = live.pcm[k], f0 = data[k] ? data[k].f0 : 220, idx = k === "clar" ? 0 : 1;
      const i0 = Math.min(x.length - 1, Math.floor(el.currentTime * sr));
      // forma de onda: tres periodos desde el cruce por cero más cercano al instante actual
      const seg = periodsFrom(x.subarray(i0, Math.min(x.length, i0 + Math.ceil((sr / f0) * 5))), sr, f0, 3);
      let pk = 1e-6; seg.forEach((v) => { pk = Math.max(pk, Math.abs(v)); });
      charts.wave.data.datasets[idx].data = pk > 0.002 ? seg.map((v, i) => ({ x: (i / sr) * 1000, y: v / pk })) : [];
      charts.wave.update("none");
      if (live.frame++ % 2 === 0) {
        const r = liveSpectrum(x, sr, i0, f0);
        charts.spec.data.datasets[idx].data = r.spec; charts.spec.update("none");
        charts.harm.data.datasets[idx].data = r.harm; charts.harm.update("none");
      }
    }
    if (live.synthAn && performance.now() < live.synthUntil) {
      again = true;
      const td = new Float32Array(live.synthAn.fftSize); live.synthAn.getFloatTimeDomainData(td);
      drawSynth(periodsFrom(td, audio.sampleRate, 220, 2));
    } else if (live.synthAn && live.synthUntil) { live.synthUntil = 0; drawSynth(); }
    if (again) live.raf = requestAnimationFrame(liveFrame);
  }
  function startLive() { if (!live.raf) live.raf = requestAnimationFrame(liveFrame); }

  /** Vuelve a las curvas del análisis estable (parte sostenida de cada grabación). */
  function restoreStatic(k) {
    if (!charts.wave || !data[k]) return;
    const idx = k === "clar" ? 0 : 1;
    charts.wave.data.datasets[idx].data = data[k].wave; charts.wave.update("none");
    charts.spec.data.datasets[idx].data = data[k].spec; charts.spec.update("none");
    charts.harm.data.datasets[idx].data = data[k].rel; charts.harm.update("none");
  }

  function setLiveLabel() {
    const el = document.getElementById("t11-live");
    if (el) el.textContent = live.key ? `● En vivo: ${FILES[live.key].name.toLowerCase()}. Las gráficas se calculan con lo que está sonando.` : "Análisis estable de la parte sostenida de cada nota. Reproduzca una muestra para verlo en vivo.";
  }

  function initLive() {
    ["clar", "vio"].forEach((k) => {
      const el = document.getElementById(k === "clar" ? "t11-a1" : "t11-a2");
      if (!el) return;
      el.addEventListener("play", () => {
        // solo una muestra a la vez: la otra se detiene y vuelve a su análisis estable
        ["clar", "vio"].forEach((o) => { if (o !== k) { const oe = document.getElementById(o === "clar" ? "t11-a1" : "t11-a2"); if (oe && !oe.paused) oe.pause(); restoreStatic(o); } });
        live.key = k;
        // reiniciar las curvas de esta muestra antes de dibujarlas en vivo
        const idx = k === "clar" ? 0 : 1;
        if (charts.wave) {
          charts.wave.data.datasets[idx].data = []; charts.wave.update("none");
          charts.spec.data.datasets[idx].data = []; charts.spec.update("none");
          charts.harm.data.datasets[idx].data = Array(NH).fill(0); charts.harm.update("none");
        }
        setLiveLabel(); startLive();
      });
      const stop = () => { if (live.key === k) { live.key = null; setLiveLabel(); } };
      el.addEventListener("pause", stop);
      el.addEventListener("ended", () => { stop(); restoreStatic(k); });
      el.addEventListener("seeked", () => { if (live.key === k) startLive(); });
    });
    setLiveLabel();
  }

  /* ---------- Exploración: sintetizador aditivo ---------- */
  let sliders = [], audio = null;
  function harm() { return sliders.map((s) => +s.value); }
  function setHarm(a) { sliders.forEach((s, i) => { s.value = a[i] || 0; }); drawSynth(); }
  function drawSynth(liveY) {
    const cv = document.getElementById("t11-synth");
    if (!cv) return;
    const r = UI.fitCanvas(cv, cv.parentElement.clientWidth < 600 ? 0.5 : 0.22), g = r.ctx, P = UI.palette(), A = harm();
    g.clearRect(0, 0, r.w, r.h); g.fillStyle = P.panel2; g.fillRect(0, 0, r.w, r.h);
    let N = 400, y = []; let pk = 1e-9;
    if (liveY) { y = liveY; N = y.length - 1; y.forEach((v) => { pk = Math.max(pk, Math.abs(v)); }); pk = Math.max(pk, 0.05); }
    else for (let i = 0; i <= N; i++) { const t = (i / N) * 2; let s = 0; A.forEach((a, k) => { s += a * Math.sin(2 * Math.PI * (k + 1) * t); }); y.push(s); pk = Math.max(pk, Math.abs(s)); }
    g.strokeStyle = P.line; g.beginPath(); g.moveTo(10, r.h / 2); g.lineTo(r.w - 10, r.h / 2); g.stroke();
    g.strokeStyle = P.green; g.lineWidth = 2.2; g.beginPath();
    y.forEach((v, i) => { const px = 10 + (i / N) * (r.w - 20), py = r.h / 2 - (v / pk) * (r.h / 2 - 10); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
    g.fillStyle = P.muted; g.font = "11px Public Sans, sans-serif"; g.fillText(liveY ? "● en vivo: lo que está sonando (2 periodos)" : "forma de onda resultante (2 periodos)", 12, 14);
  }
  function play() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const A = harm(), real = new Float32Array(A.length + 1), imag = new Float32Array(A.length + 1);
      A.forEach((a, i) => { imag[i + 1] = a; });
      const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime;
      osc.setPeriodicWave(audio.createPeriodicWave(real, imag));
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.25, t + 0.04); gain.gain.setValueAtTime(0.25, t + 1.2); gain.gain.linearRampToValueAtTime(0, t + 1.6);
      if (!live.synthAn) { live.synthAn = audio.createAnalyser(); live.synthAn.fftSize = 4096; live.synthAn.connect(audio.destination); }
      osc.connect(gain).connect(live.synthAn); osc.start(t); osc.stop(t + 1.65);
      live.synthUntil = performance.now() + 1700; startLive();
    } catch (e) { /* sin audio en este navegador */ }
  }
  function initSynth() {
    const box = document.getElementById("t11-sliders");
    box.innerHTML = Array.from({ length: 10 }, (_, i) => `<div class="ctrl"><label for="t11-h${i + 1}">Armónico ${i + 1} (${(i + 1) * 220} Hz)</label><input type="range" id="t11-h${i + 1}" min="0" max="1" step="0.01" value="${i === 0 ? 1 : 0}" /></div>`).join("");
    sliders = Array.from({ length: 10 }, (_, i) => document.getElementById(`t11-h${i + 1}`));
    sliders.forEach((s) => s.addEventListener("input", () => drawSynth()));
    const P = {
      clar: () => data.clar ? data.clar.rel.slice(0, 10) : [1, 0, 0.8, 0, 0.54, 0, 0.08, 0.09, 0.06, 0],
      vio: () => data.vio ? data.vio.rel.slice(0, 10) : [0.12, 1, 0.19, 0.36, 0.35, 0.07, 0.31, 0.25, 0.14, 0.13],
      sine: () => [1],
      square: () => Array.from({ length: 10 }, (_, i) => ((i + 1) % 2 ? 1 / (i + 1) : 0)),
      saw: () => Array.from({ length: 10 }, (_, i) => 1 / (i + 1)),
    };
    document.querySelectorAll("[data-t11]").forEach((b) => b.addEventListener("click", () => { setHarm(P[b.dataset.t11]()); play(); }));
    document.getElementById("t11-play").addEventListener("click", play);
    window.addEventListener("resize", () => drawSynth());
    UI.onTheme(() => drawSynth());
    drawSynth();
  }

  function init() {
    initSynth();
    initLive();
    UI.onTheme(makeCharts);
    load();
  }
  return { init };
})();
