/* =========================================================
   Tema 8 — Ruedas de reacción
   Diagrama propio en SVG: intercambio de momento angular entre
   el satélite y su rueda (L total = 0), y qué pasa cuando la
   rueda llega a su velocidad máxima (saturación y descarga).
   ========================================================= */
window.Tema8 = (() => {
  let c = {}, anim = { t: 0, last: 0 }, visible = true;
  const F = (n, d = 2) => UI.fmt(n, d);
  const RPM = (w) => (w * 60) / (2 * Math.PI);

  function compute() {
    const Is = c.Is.value, Iw = c.Iw.value, wmax = (c.wmax.value * 2 * Math.PI) / 60;
    const th = (c.th.value * Math.PI) / 180, T = c.T.value, td = c.td.value / 1000; // N·m
    // perfil de maniobra "acelerar y frenar" (bang-bang): ω_s crece hasta la mitad y luego baja
    const wsPeak = (2 * th) / T;
    const alphaS = wsPeak / (T / 2);
    const tau = Is * alphaS; // torque que el motor debe dar
    const wwPeak = (Is / Iw) * wsPeak; // rapidez que alcanza la rueda
    const Lmax = Iw * wmax;
    const tSat = Lmax / td; // segundos hasta saturar con una perturbación constante
    const thMax = (Iw / Is) * wmax * (T / 2); // el mayor giro posible en T con la rueda al máximo
    return { Is, Iw, wmax, th, T, td, wsPeak, alphaS, tau, wwPeak, Lmax, tSat, ok: wwPeak <= wmax, thMax };
  }

  /** Estado de la maniobra en el instante t (s): ángulo y velocidades. */
  function profile(d, t) {
    const T = d.T, a = d.alphaS;
    let ws, th;
    if (t <= 0) { ws = 0; th = 0; }
    else if (t < T / 2) { ws = a * t; th = 0.5 * a * t * t; }
    else if (t < T) { const u = T - t; ws = a * u; th = d.th - 0.5 * a * u * u; }
    else { ws = 0; th = d.th; }
    if (!d.ok) { const cap = (d.Iw / d.Is) * d.wmax; ws = Math.min(ws, cap); }
    return { ws, th, ww: -(d.Is / d.Iw) * ws };
  }

  const s = (v) => `style="${v}"`;
  const mk = (id, col) => `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" ${s(`fill:var(${col})`)}/></marker>`;
  const txt = (x, y, t, st, anchor = "start") => `<text x="${x}" y="${y}" text-anchor="${anchor}" ${s(st)}>${t}</text>`;
  const mono = (sz = 13, col = "--text", w = 400) => `fill:var(${col});font:${w} ${sz}px 'JetBrains Mono',monospace`;
  const sans = (sz = 12, col = "--muted", w = 400) => `fill:var(${col});font:${w} ${sz}px 'Public Sans',sans-serif`;
  /** Arco con flecha (sentido horario si cw) */
  const arcArrow = (cx, cy, r, a0, a1, col, cw, w = 2.5) => {
    const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return `<path d="M ${x0} ${y0} A ${r} ${r} 0 ${large} ${cw ? 1 : 0} ${x1} ${y1}" ${s(`fill:none;stroke:var(${col});stroke-width:${w}`)} marker-end="url(#${col === "--amber" ? "m8-amber" : col === "--accent" ? "m8-acc" : "m8-pink"})"/>`;
  };

  function build() {
    const d = compute();
    const svg = document.getElementById("t8-diagram");
    const cx = 250, cy = 300;
    // ---- panel izquierdo: satélite y rueda
    let panel = "";
    for (let i = 0; i < 4; i++) panel += `<line x1="${cx - 220 + i * 26}" y1="${cy - 40}" x2="${cx - 220 + i * 26}" y2="${cy + 40}" ${s("stroke:var(--panel);stroke-width:2")}/>`;
    let panelR = "";
    for (let i = 0; i < 4; i++) panelR += `<line x1="${cx + 120 + i * 26}" y1="${cy - 40}" x2="${cx + 120 + i * 26}" y2="${cy + 40}" ${s("stroke:var(--panel);stroke-width:2")}/>`;
    let spokes = "";
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; spokes += `<line x1="${cx}" y1="${cy}" x2="${cx + 40 * Math.cos(a)}" y2="${cy + 40 * Math.sin(a)}" ${s("stroke:var(--amber);stroke-width:3;stroke-linecap:round")}/>`; }

    // barras de L
    const bx = 250, by = 540, bwid = 190;
    const Lw = d.Iw * Math.min(d.wwPeak, d.wmax), Ls = -Lw;
    const lscale = bwid / Math.max(d.Lmax, Lw, 1e-9);

    // ---- panel derecho: saturación
    const px = 600, py = 120, pw = 360, ph = 190; // gráfica ω_rueda(t)
    const tA = 1, tB = 1.6, tC = 2.3; // fases normalizadas: acumula, saturada, descarga
    const Xn = (u) => px + (u / tC) * pw, Yw = (w) => py + ph - w * ph * 0.82;
    const wLine = `M ${Xn(0)} ${Yw(0)} L ${Xn(tA)} ${Yw(1)} L ${Xn(tB)} ${Yw(1)} L ${Xn(tC)} ${Yw(0.12)}`;
    let thErr = `M ${Xn(tA)} ${Yw(0)}`;
    for (let i = 1; i <= 20; i++) { const u = tA + ((tB - tA) * i) / 20; thErr += ` L ${Xn(u)} ${Yw(0.75 * ((u - tA) / (tB - tA)) ** 2)}`; }
    for (let i = 1; i <= 10; i++) { const u = tB + ((tC - tB) * i) / 10; thErr += ` L ${Xn(u)} ${Yw(0.75 * (1 - i / 10))}`; }
    const days = d.tSat / 86400;

    svg.innerHTML = `
      <defs>${mk("m8-acc", "--accent")}${mk("m8-amber", "--amber")}${mk("m8-pink", "--accent-2")}${mk("m8-green", "--green")}${mk("m8-muted", "--muted")}${mk("m8-danger", "--danger")}</defs>
      <rect x="0" y="0" width="1000" height="660" rx="14" ${s("fill:var(--panel-2)")}/>
      ${txt(20, 30, "INTERCAMBIO DE MOMENTO ANGULAR", "fill:var(--muted);font:600 13px 'Public Sans',sans-serif;letter-spacing:.08em")}
      ${txt(20, 56, "Στ_ext = 0  ⇒  L_total = I_s·ω_s + I_w·ω_w = constante = 0", mono(13))}
      ${txt(20, 78, "ω_s = −(I_w / I_s)·ω_w        τ_rueda = I_w·α_w = −I_s·α_s", mono(13))}

      <g id="t8-body">
        <rect x="${cx - 225}" y="${cy - 44}" width="110" height="88" rx="4" ${s("fill:var(--accent);opacity:.75")}/>${panel}
        <rect x="${cx + 115}" y="${cy - 44}" width="110" height="88" rx="4" ${s("fill:var(--accent);opacity:.75")}/>${panelR}
        <line x1="${cx - 115}" y1="${cy}" x2="${cx - 72}" y2="${cy}" ${s("stroke:var(--muted);stroke-width:4")}/>
        <line x1="${cx + 72}" y1="${cy}" x2="${cx + 115}" y2="${cy}" ${s("stroke:var(--muted);stroke-width:4")}/>
        <rect x="${cx - 72}" y="${cy - 72}" width="144" height="144" rx="10" ${s("fill:var(--panel);stroke:var(--text);stroke-width:2.5")}/>
        <line x1="${cx}" y1="${cy - 72}" x2="${cx}" y2="${cy - 100}" ${s("stroke:var(--text);stroke-width:2")}/>
        <circle cx="${cx}" cy="${cy - 106}" r="7" ${s("fill:none;stroke:var(--text);stroke-width:2")}/>
        ${txt(cx + 14, cy - 102, "antena / telescopio", sans(11))}
      </g>
      <circle cx="${cx}" cy="${cy}" r="46" ${s("fill:none;stroke:var(--amber);stroke-width:3")}/>
      <g id="t8-wheel">${spokes}</g>
      <circle cx="${cx}" cy="${cy}" r="6" ${s("fill:var(--text)")}/>
      ${txt(cx - 46, cy + 92, "⊙ eje z (sale de la pantalla)", sans(11, "--text", 600))}
      ${arcArrow(cx, cy, 60, -2.6, -0.6, "--amber", true)}
      ${txt(cx + 80, cy - 58, "ω_w (rueda)", sans(13, "--amber", 700))}
      ${arcArrow(cx, cy, 140, 2.2, 0.9, "--accent", false)}
      ${txt(cx + 40, cy + 150, "ω_s (satélite, sentido contrario)", sans(13, "--accent", 700))}
      ${txt(cx - 230, cy - 104, "τ: motor → rueda", sans(12, "--amber", 700))}
      ${txt(cx - 230, cy - 88, "−τ: rueda → satélite (3.ª ley)", sans(12, "--accent", 700))}
      ${txt(cx - 230, cy + 72, "Nada sale del satélite:", sans(11))}
      ${txt(cx - 230, cy + 87, "las fuerzas del motor son internas.", sans(11))}

      ${txt(20, 476, "MOMENTO ANGULAR EN EL PICO DE LA MANIOBRA", "fill:var(--muted);font:600 12px 'Public Sans',sans-serif;letter-spacing:.08em")}
      <line x1="${bx}" y1="${by - 34}" x2="${bx}" y2="${by + 54}" ${s("stroke:var(--text);stroke-width:1.5")}/>
      ${txt(bx, by + 70, "0", mono(11, "--muted"), "middle")}
      <rect x="${bx}" y="${by - 26}" width="${Lw * lscale}" height="18" ${s("fill:var(--amber)")}/>
      ${txt(20, by - 12, "L_rueda", mono(12, "--amber", 600))}
      ${txt(bx + Lw * lscale + 8, by - 12, `+${F(Lw, 3)} N·m·s`, mono(12, "--text"))}
      <rect x="${bx + Ls * lscale}" y="${by + 2}" width="${-Ls * lscale}" height="18" ${s("fill:var(--accent)")}/>
      ${txt(20, by + 16, "L_satélite", mono(12, "--accent", 600))}
      ${txt(bx + 8, by + 16, `${F(Ls, 3)} N·m·s`, mono(12, "--text"))}
      <rect x="${bx - 2}" y="${by + 28}" width="4" height="18" ${s("fill:var(--green)")}/>
      ${txt(20, by + 42, "Σ L", mono(12, "--green", 600))}
      ${txt(bx + 8, by + 42, "0 (se conserva)", mono(12, "--green"))}
      <line x1="${bx + d.Lmax * lscale}" y1="${by - 34}" x2="${bx + d.Lmax * lscale}" y2="${by - 4}" ${s("stroke:var(--danger);stroke-width:2;stroke-dasharray:4 3")}/>
      ${txt(bx + d.Lmax * lscale, by - 40, "L_max = I_w·ω_max", sans(11, "--danger", 700), "end")}

      <rect x="18" y="604" width="490" height="44" rx="10" ${s("fill:var(--panel);stroke:var(--line)")}/>
      <text id="t8-res" x="32" y="631" ${s(mono(12.5))}></text>

      <!-- ===== Panel derecho: saturación ===== -->
      <line x1="540" y1="20" x2="540" y2="640" ${s("stroke:var(--line);stroke-width:1")}/>
      ${txt(560, 30, "¿Y CUANDO LA RUEDA LLEGA A SU MÁXIMO?", "fill:var(--muted);font:600 13px 'Public Sans',sans-serif;letter-spacing:.08em")}
      ${txt(560, 56, "Perturbación constante τ_d (presión solar, gradiente gravitatorio):", sans(12, "--text"))}
      ${txt(560, 76, "Δω_w = τ_d·t / I_w   →   t_sat = I_w·ω_max / τ_d", mono(13))}

      <rect x="${Xn(tA)}" y="${py - 6}" width="${Xn(tB) - Xn(tA)}" height="${ph + 6}" ${s("fill:var(--danger);opacity:.08")}/>
      <rect x="${Xn(tB)}" y="${py - 6}" width="${Xn(tC) - Xn(tB)}" height="${ph + 6}" ${s("fill:var(--green);opacity:.08")}/>
      <line x1="${px}" y1="${py + ph}" x2="${px + pw + 10}" y2="${py + ph}" ${s("stroke:var(--text);stroke-width:1.5")} marker-end="url(#m8-muted)"/>
      <line x1="${px}" y1="${py + ph}" x2="${px}" y2="${py - 14}" ${s("stroke:var(--text);stroke-width:1.5")} marker-end="url(#m8-muted)"/>
      ${txt(px + pw + 10, py + ph + 36, "tiempo t →", sans(11), "end")}
      <line x1="${px}" y1="${Yw(1)}" x2="${px + pw}" y2="${Yw(1)}" ${s("stroke:var(--danger);stroke-width:1.5;stroke-dasharray:5 4")}/>
      ${txt(px - 6, Yw(1) + 4, "ω_max", mono(11, "--danger", 600), "end")}
      <path d="${wLine}" ${s("fill:none;stroke:var(--amber);stroke-width:3")}/>
      <path d="${thErr}" ${s("fill:none;stroke:var(--accent-2);stroke-width:2.5;stroke-dasharray:7 4")}/>
      ${txt(px + 8, py + 4, "— ω_w de la rueda", sans(12, "--amber", 700))}
      ${txt(px + 8, py + 20, "- - error de apuntado del satélite", sans(12, "--accent-2", 700))}
      ${txt((Xn(0) + Xn(tA)) / 2, py + ph + 18, "① la rueda absorbe τ_d", sans(11, "--text", 600), "middle")}
      ${txt((Xn(tA) + Xn(tB)) / 2, py + ph + 18, "② saturada", sans(11, "--danger", 700), "middle")}
      ${txt((Xn(tB) + Xn(tC)) / 2, py + ph + 18, "③ descarga", sans(11, "--green", 700), "middle")}
      <text id="t8-tsat" x="${(Xn(0) + Xn(tA)) / 2}" y="${Yw(0.45)}" text-anchor="middle" ${s(mono(11.5, "--text"))}></text>

      ${txt(560, 372, "① Mientras |ω_w| < ω_max, la rueda gira un poco más rápido para", sans(12, "--text"))}
      ${txt(578, 390, "absorber el torque externo y el satélite sigue quieto.", sans(12, "--text"))}
      ${txt(560, 414, "② Al llegar a ω_max la rueda ya no puede acelerar: no hay torque", sans(12, "--text"))}
      ${txt(578, 432, "de reacción disponible y τ_d empieza a girar al satélite:", sans(12, "--text"))}
      ${txt(578, 452, "θ_error = ½·(τ_d / I_s)·t²", mono(12.5, "--accent-2", 600))}
      ${txt(560, 478, "③ Descarga de momento: un torque externo (barras magnéticas,", sans(12, "--text"))}
      ${txt(578, 496, "τ = m × B, o propulsores) frena la rueda sin mover al satélite.", sans(12, "--text"))}
      ${txt(578, 514, "Solo un torque externo cambia L_total:  Στ_ext = dL/dt", mono(12.5, "--green", 600))}

      <!-- pequeño esquema de la descarga -->
      <rect x="600" y="540" width="70" height="70" rx="8" ${s("fill:var(--panel);stroke:var(--text);stroke-width:2")}/>
      <circle cx="635" cy="575" r="22" ${s("fill:none;stroke:var(--amber);stroke-width:2.5")}/>
      ${arcArrow(635, 575, 30, 0.3, 2.4, "--amber", true, 2)}
      <line x1="690" y1="575" x2="760" y2="575" ${s("stroke:var(--green);stroke-width:3")} marker-start="url(#m8-green)"/>
      ${txt(770, 570, "barra magnética", sans(12, "--green", 700))}
      ${txt(770, 586, "τ_ext opuesto a L_rueda", sans(11))}
      ${txt(770, 604, "(campo magnético terrestre B)", sans(11))}
    `;
    update();
  }

  function update() {
    const d = compute();
    const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    set("t8-res", d.ok
      ? `girar ${F(c.th.value, 0)}° en ${F(d.T, 0)} s → la rueda llega a ${F(RPM(d.wwPeak), 0)} rpm (máx. ${F(c.wmax.value, 0)})`
      : `NO alcanza: harían falta ${F(RPM(d.wwPeak), 0)} rpm; máx. ${F(c.wmax.value, 0)} rpm → ${F((d.thMax * 180) / Math.PI, 0)}°`);
    const tsat = d.tSat;
    set("t8-tsat", `t_sat ≈ ${tsat > 86400 ? F(tsat / 86400, 1) + " días" : tsat > 3600 ? F(tsat / 3600, 1) + " h" : F(tsat, 0) + " s"}`);
    const f = UI.fmt;
    document.getElementById("t8-ro").innerHTML = `
      <div class="ro"><div class="k">ω_s máxima del satélite</div><div class="v">${f(d.wsPeak * 1000, 2)} <small>mrad/s (${f((d.wsPeak * 180) / Math.PI, 2)} °/s)</small></div></div>
      <div class="ro"><div class="k">Torque del motor τ = I_s·α_s</div><div class="v">${f(d.tau * 1000, 1)} <small>mN·m</small></div></div>
      <div class="ro"><div class="k">ω_w máxima de la rueda</div><div class="v" style="color:var(${d.ok ? "--text" : "--danger"})">${f(RPM(d.wwPeak), 0)} <small>rpm ${d.ok ? "✓ cabe" : "✗ supera ω_max"}</small></div></div>
      <div class="ro"><div class="k">Capacidad L_max = I_w·ω_max</div><div class="v">${f(d.Lmax, 3)} <small>N·m·s</small></div></div>
      <div class="ro"><div class="k">Tiempo hasta saturar con τ_d</div><div class="v">${tsat > 86400 ? f(tsat / 86400, 2) + " <small>días</small>" : f(tsat / 3600, 2) + " <small>h</small>"}</div></div>
      <div class="ro"><div class="k">Relación de inercias I_s / I_w</div><div class="v">${f(d.Is / d.Iw, 0)} <small>: 1</small></div></div>`;
  }

  /* Animación de la maniobra (dura ~4 s en pantalla); la rueda se dibuja más lenta para que se vea girar. */
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - anim.last) / 1000 || 0);
    anim.last = now;
    if (!visible || !c.anim.checked) return;
    const d = compute();
    const speed = d.T / 4; // la maniobra completa dura ~4 s en pantalla
    anim.t += dt * speed;
    const cycleT = d.T * 1.6;
    if (anim.t > cycleT) anim.t = 0;
    // a la vuelta se regresa al ángulo inicial para que la animación sea cíclica
    const forward = anim.t <= d.T * 1.3;
    const p = profile(d, forward ? anim.t : 0);
    const thDisp = forward ? p.th : d.ok ? d.th * Math.max(0, 1 - (anim.t - d.T * 1.3) / (d.T * 0.3)) : 0;
    const body = document.getElementById("t8-body");
    if (body) body.setAttribute("transform", `rotate(${(-thDisp * 180) / Math.PI} 250 300)`);
    const slow = Math.max(1, ((d.Is / d.Iw) * d.th) / (6 * Math.PI)); // la rueda da ~3 vueltas en pantalla
    const wheelAng = (-(d.Is / d.Iw) * thDisp) / slow;
    const wheel = document.getElementById("t8-wheel");
    if (wheel) wheel.setAttribute("transform", `rotate(${(-wheelAng * 180) / Math.PI} 250 300)`);
  }

  function init() {
    const rb = () => build();
    c.Is = UI.bindRange("t8-Is", (v) => `${F(v, 0)} kg·m²`, rb);
    c.Iw = UI.bindRange("t8-Iw", (v) => `${F(v, 3)} kg·m²`, rb);
    c.wmax = UI.bindRange("t8-wmax", (v) => `${F(v, 0)} rpm`, rb);
    c.th = UI.bindRange("t8-th", (v) => `${F(v, 0)}°`, rb);
    c.T = UI.bindRange("t8-T", (v) => `${F(v, 0)} s`, rb);
    c.td = UI.bindRange("t8-td", (v) => `${F(v, 2)} mN·m`, rb);
    c.anim = document.getElementById("t8-anim");
    const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.05 });
    io.observe(document.getElementById("t8-diagram"));
    build();
    requestAnimationFrame(frame);
  }

  return { init };
})();
