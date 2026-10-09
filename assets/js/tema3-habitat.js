/* =========================================================
   Tema 3 — Gravedad artificial por rotación
   Diagrama propio en SVG con ecuaciones anotadas y valores
   recalculados a partir del radio y la gravedad objetivo.
   ========================================================= */
window.Tema3 = (() => {
  const G = 9.81;
  let c = {}, phase = 0, last = 0, visible = true;

  const F = (n, d = 2) => UI.fmt(n, d);

  function compute() {
    const r = c.r.value, gt = c.g.value * G, h = c.h.value;
    const w = Math.sqrt(gt / r);
    return {
      r, gt, h, w,
      rpm: (60 * w) / (2 * Math.PI),
      T: (2 * Math.PI) / w,
      f: w / (2 * Math.PI),
      v: w * r,
      ghead: w * w * (r - h),
      grad: h / r,
      cor: 2 * w * 1.4,
    };
  }

  function comfort(rpm) {
    if (rpm <= 2) return ["cómodo sin adaptación", "--green"];
    if (rpm <= 4) return ["tolerable con adaptación", "--amber"];
    if (rpm <= 6) return ["exigente, mareo probable", "--accent-2"];
    return ["fuera de los criterios de confort", "--danger"];
  }

  function build() {
    const svg = document.getElementById("t3-diagram");
    const s = (v) => `style="${v}"`;
    const cx = 265, cy = 290, Rf = 215, Rh = 242;
    const marker = (id, color) =>
      `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" ${s(`fill:var(${color})`)}/></marker>`;

    let spokes = "";
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      spokes += `<line x1="${cx + 36 * Math.cos(a)}" y1="${cy + 36 * Math.sin(a)}" x2="${cx + (Rf - 4) * Math.cos(a)}" y2="${cy + (Rf - 4) * Math.sin(a)}" ${s("stroke:var(--line);stroke-width:7;stroke-linecap:round")}/>`;
    }
    let windows = "";
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12 + Math.PI / 24;
      windows += `<circle cx="${cx + (Rf + 13) * Math.cos(a)}" cy="${cy + (Rf + 13) * Math.sin(a)}" r="3" ${s("fill:var(--accent);opacity:.55")}/>`;
    }
    // ángulo de la cota del radio
    const ra = (205 * Math.PI) / 180;
    const rx = cx + Rf * Math.cos(ra), ry = cy + Rf * Math.sin(ra);

    // estación en vista lateral
    const sx = 790, sy = 150;
    const eqs = (x, y, lines, color = "--text", size = 14) =>
      lines.map((l, i) => `<text x="${x}" y="${y + i * (size + 7)}" ${s(`fill:var(${color});font:${size}px 'JetBrains Mono',monospace`)}>${l}</text>`).join("");

    svg.innerHTML = `
      <defs>
        ${marker("m-acc", "--accent")}${marker("m-pink", "--accent-2")}${marker("m-green", "--green")}${marker("m-amber", "--amber")}${marker("m-muted", "--muted")}
      </defs>
      <rect x="0" y="0" width="1000" height="650" rx="14" ${s("fill:var(--panel-2)")}/>

      <!-- ===== Vista frontal ===== -->
      <text x="20" y="30" ${s("fill:var(--muted);font:600 13px Inter,sans-serif;letter-spacing:.08em")}>VISTA A LO LARGO DEL EJE</text>

      <circle cx="${cx}" cy="${cy}" r="${Rh}" ${s("fill:none;stroke:var(--muted);stroke-width:2")}/>
      <circle cx="${cx}" cy="${cy}" r="${Rf}" ${s("fill:none;stroke:var(--violet);stroke-width:3")}/>
      <path d="M ${cx - Rh} ${cy} A ${Rh} ${Rh} 0 1 0 ${cx + Rh} ${cy} A ${Rh} ${Rh} 0 1 0 ${cx - Rh} ${cy} M ${cx - Rf} ${cy} A ${Rf} ${Rf} 0 1 1 ${cx + Rf} ${cy} A ${Rf} ${Rf} 0 1 1 ${cx - Rf} ${cy}" ${s("fill:var(--violet);opacity:.10;fill-rule:evenodd")}/>
      <g id="t3-rot">${spokes}${windows}</g>
      <circle cx="${cx}" cy="${cy}" r="34" ${s("fill:var(--panel);stroke:var(--muted);stroke-width:2")}/>
      <circle cx="${cx}" cy="${cy}" r="9" ${s("fill:none;stroke:var(--text);stroke-width:2")}/>
      <circle cx="${cx}" cy="${cy}" r="3" ${s("fill:var(--text)")}/>
      <text x="${cx + 44}" y="${cy - 8}" ${s("fill:var(--text);font:600 12.5px Inter,sans-serif")}>⊙ eje de giro</text>
      <text x="${cx + 44}" y="${cy + 8}" ${s("fill:var(--muted);font:11px Inter,sans-serif")}>(sale de la pantalla)</text>

      <!-- ω -->
      <path d="M ${cx + 58 * Math.cos(-2.3)} ${cy + 58 * Math.sin(-2.3)} A 58 58 0 0 1 ${cx + 58 * Math.cos(-0.7)} ${cy + 58 * Math.sin(-0.7)}" ${s("fill:none;stroke:var(--amber);stroke-width:2.5")} marker-start="url(#m-amber)"/>
      <text x="${cx - 10}" y="${cy - 66}" ${s("fill:var(--amber);font:700 17px 'Space Grotesk',sans-serif")}>ω</text>

      <!-- cota del radio -->
      <line x1="${cx}" y1="${cy}" x2="${rx}" y2="${ry}" ${s("stroke:var(--text);stroke-width:1.6;stroke-dasharray:6 5")} marker-end="url(#m-muted)"/>
      <text x="${(cx + rx) / 2 - 30}" y="${(cy + ry) / 2 - 12}" ${s("fill:var(--text);font:700 16px 'Space Grotesk',sans-serif")}>r</text>
      <text id="t3-rlabel" x="${(cx + rx) / 2 - 62}" y="${(cy + ry) / 2 + 8}" ${s("fill:var(--muted);font:12px 'JetBrains Mono',monospace")}></text>

      <!-- tripulante en el piso (abajo) -->
      <g ${s("stroke:var(--text);stroke-width:3;stroke-linecap:round;fill:none")}>
        <circle cx="${cx}" cy="${cy + Rf - 62}" r="9" ${s("fill:var(--panel)")}/>
        <line x1="${cx}" y1="${cy + Rf - 53}" x2="${cx}" y2="${cy + Rf - 24}"/>
        <line x1="${cx}" y1="${cy + Rf - 46}" x2="${cx - 13}" y2="${cy + Rf - 32}"/>
        <line x1="${cx}" y1="${cy + Rf - 46}" x2="${cx + 13}" y2="${cy + Rf - 32}"/>
        <line x1="${cx}" y1="${cy + Rf - 24}" x2="${cx - 9}" y2="${cy + Rf}"/>
        <line x1="${cx}" y1="${cy + Rf - 24}" x2="${cx + 9}" y2="${cy + Rf}"/>
      </g>
      <!-- N -->
      <line x1="${cx - 30}" y1="${cy + Rf}" x2="${cx - 30}" y2="${cy + Rf - 78}" ${s("stroke:var(--green);stroke-width:3.5")} marker-end="url(#m-green)"/>
      <text x="${cx - 165}" y="${cy + Rf - 96}" ${s("fill:var(--green);font:700 14px Inter,sans-serif")}>N = mω²r</text>
      <text x="${cx - 165}" y="${cy + Rf - 79}" ${s("fill:var(--muted);font:11px Inter,sans-serif")}>piso → tripulante</text>
      <!-- a_c -->
      <line x1="${cx + 30}" y1="${cy + Rf - 28}" x2="${cx + 30}" y2="${cy + Rf - 108}" ${s("stroke:var(--accent-2);stroke-width:3.5")} marker-end="url(#m-pink)"/>
      <text x="${cx + 40}" y="${cy + Rf - 96}" ${s("fill:var(--accent-2);font:700 14px Inter,sans-serif")}>a_c = ω²r = v²/r</text>
      <text x="${cx + 40}" y="${cy + Rf - 79}" ${s("fill:var(--muted);font:11px Inter,sans-serif")}>siempre apunta al eje</text>
      <!-- v tangencial -->
      <line x1="${cx + 18}" y1="${cy + Rf + 13}" x2="${cx + 118}" y2="${cy + Rf + 13}" ${s("stroke:var(--accent);stroke-width:3.5")} marker-end="url(#m-acc)"/>
      <text x="${cx + 122}" y="${cy + Rf + 18}" ${s("fill:var(--accent);font:700 14px Inter,sans-serif")}>v = ωr</text>
      <text x="${cx + 122}" y="${cy + Rf + 34}" ${s("fill:var(--muted);font:11px Inter,sans-serif")}>tangente al anillo</text>
      <text x="${cx - 120}" y="${cy + Rf + 52}" ${s("fill:var(--faint);font:11px Inter,sans-serif")}>“abajo” para el tripulante = hacia afuera del anillo (tripulante no a escala)</text>

      <!-- ecuaciones de la vista frontal -->
      ${eqs(20, 62, ["ω = 2π/T = 2πf", "rpm = 60ω / 2π", "g_ap = ω²r"], "--text", 13)}

      <!-- ===== Vista lateral ===== -->
      <line x1="555" y1="20" x2="555" y2="600" ${s("stroke:var(--line);stroke-width:1")}/>
      <text x="580" y="30" ${s("fill:var(--muted);font:600 13px Inter,sans-serif;letter-spacing:.08em")}>VISTA LATERAL (CORTE)</text>
      <line x1="590" y1="${sy}" x2="985" y2="${sy}" ${s("stroke:var(--amber);stroke-width:2;stroke-dasharray:14 5 3 5")}/>
      <text x="900" y="${sy - 8}" ${s("fill:var(--amber);font:600 12px Inter,sans-serif")}>eje de giro</text>
      <rect x="${sx - 16}" y="${sy - 22}" width="32" height="44" rx="6" ${s("fill:var(--panel);stroke:var(--muted);stroke-width:2")}/>
      <line x1="${sx}" y1="${sy - 22}" x2="${sx}" y2="${sy - 92}" ${s("stroke:var(--line);stroke-width:6")}/>
      <line x1="${sx}" y1="${sy + 22}" x2="${sx}" y2="${sy + 92}" ${s("stroke:var(--line);stroke-width:6")}/>
      <ellipse cx="${sx}" cy="${sy - 108}" rx="40" ry="18" ${s("fill:var(--violet);opacity:.18;stroke:var(--violet);stroke-width:2.5")}/>
      <ellipse cx="${sx}" cy="${sy + 108}" rx="40" ry="18" ${s("fill:var(--violet);opacity:.18;stroke:var(--violet);stroke-width:2.5")}/>
      <line x1="${sx + 58}" y1="${sy}" x2="${sx + 58}" y2="${sy + 122}" ${s("stroke:var(--text);stroke-width:1.5")} marker-start="url(#m-muted)" marker-end="url(#m-muted)"/>
      <text x="${sx + 66}" y="${sy + 66}" ${s("fill:var(--text);font:700 15px 'Space Grotesk',sans-serif")}>r</text>
      <text x="${sx - 160}" y="${sy + 116}" ${s("fill:var(--muted);font:11px Inter,sans-serif")}>piso = cara exterior del tubo</text>
      <line x1="${sx - 60}" y1="${sy + 121}" x2="${sx + 30}" y2="${sy + 121}" ${s("stroke:var(--green);stroke-width:2")}/>

      <!-- DCL -->
      <text x="580" y="320" ${s("fill:var(--muted);font:600 13px Inter,sans-serif;letter-spacing:.08em")}>CUERPO LIBRE</text>
      <rect x="600" y="400" width="64" height="64" rx="8" ${s("fill:var(--panel);stroke:var(--text);stroke-width:2")}/>
      <text x="626" y="438" ${s("fill:var(--text);font:700 16px 'Space Grotesk',sans-serif")}>m</text>
      <line x1="632" y1="400" x2="632" y2="336" ${s("stroke:var(--green);stroke-width:3.5")} marker-end="url(#m-green)"/>
      <text x="642" y="350" ${s("fill:var(--green);font:700 13.5px Inter,sans-serif")}>N (hacia el eje)</text>
      ${eqs(580, 500, ["ΣF = N = m·a_c", "N = mω²r"], "--text", 13)}
      ${eqs(580, 560, ["Sin rotación: N = 0", "y el tripulante flota.", "N es lo que siente", "como su “peso”."], "--muted", 11.5)}

      <!-- gradiente cabeza-pies -->
      <text x="790" y="320" ${s("fill:var(--muted);font:600 13px Inter,sans-serif;letter-spacing:.08em")}>GRADIENTE</text>
      <line x1="800" y1="460" x2="800" y2="370" ${s("stroke:var(--muted);stroke-width:2")}/>
      <circle cx="800" cy="364" r="7" ${s("fill:none;stroke:var(--muted);stroke-width:2")}/>
      <line id="t3-gh" x1="815" y1="368" x2="815" y2="368" ${s("stroke:var(--accent-2);stroke-width:3")} marker-end="url(#m-pink)"/>
      <line id="t3-gf" x1="815" y1="460" x2="815" y2="460" ${s("stroke:var(--accent-2);stroke-width:3")} marker-end="url(#m-pink)"/>
      <text id="t3-ghl" x="830" y="372" ${s("fill:var(--text);font:12px 'JetBrains Mono',monospace")}></text>
      <text id="t3-gfl" x="830" y="464" ${s("fill:var(--text);font:12px 'JetBrains Mono',monospace")}></text>
      <text x="790" y="500" ${s("fill:var(--text);font:12.5px 'JetBrains Mono',monospace")}>g_cab/g_pies = 1 − h/r</text>
      <text id="t3-gradl" x="790" y="520" ${s("fill:var(--accent-2);font:700 12.5px 'JetBrains Mono',monospace")}></text>
      <text id="t3-comfort" x="790" y="560" ${s("font:700 12.5px Inter,sans-serif")}></text>
      <text id="t3-cor" x="790" y="582" ${s("fill:var(--muted);font:12px 'JetBrains Mono',monospace")}></text>
      <text id="t3-cor2" x="790" y="600" ${s("fill:var(--muted);font:11px Inter,sans-serif")}>(Coriolis al caminar a 1,4 m/s)</text>

      <!-- recuadro de resultados -->
      <rect x="18" y="578" width="520" height="62" rx="10" ${s("fill:var(--panel);stroke:var(--line)")}/>
      <text id="t3-res1" x="32" y="602" ${s("fill:var(--text);font:13px 'JetBrains Mono',monospace")}></text>
      <text id="t3-res2" x="32" y="626" ${s("fill:var(--text);font:13px 'JetBrains Mono',monospace")}></text>
    `;
  }

  function update() {
    const d = compute();
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set("t3-rlabel", `${F(d.r, 0)} m`);
    set("t3-res1", `ω = √(g/r) = ${F(d.w, 4)} rad/s   →   ${F(d.rpm, 2)} rpm`);
    set("t3-res2", `T = ${F(d.T, 1)} s   f = ${F(d.f, 4)} Hz   v = ωr = ${F(d.v, 1)} m/s`);
    // flechas del gradiente: longitudes proporcionales a g en pies y cabeza
    const Lf = 50, Lh = Lf * (1 - d.grad);
    // flechas horizontales, para comparar longitudes a simple vista
    document.getElementById("t3-gh").setAttribute("x2", 815 + Lh);
    document.getElementById("t3-gf").setAttribute("x2", 815 + Lf);
    document.getElementById("t3-ghl").setAttribute("x", 825 + Lh);
    document.getElementById("t3-gfl").setAttribute("x", 825 + Lf);
    set("t3-ghl", `cabeza ${F(d.ghead, 2)} m/s²`);
    set("t3-gfl", `pies ${F(d.gt, 2)} m/s²`);
    set("t3-gradl", `${F(d.grad * 100, 2)} % menos en la cabeza`);
    const [txt, col] = comfort(d.rpm);
    const cf = document.getElementById("t3-comfort");
    cf.textContent = `${F(d.rpm, 2)} rpm: ${txt}`;
    cf.style.fill = `var(${col})`;
    set("t3-cor", `a_cor = 2ωv = ${F(d.cor, 2)} m/s²`);
    set("t3-cor2", `(Coriolis al caminar a 1,4 m/s: ${F((d.cor / d.gt) * 100, 1)} % de g)`);
  }

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (!visible || !c.anim.checked) return;
    const d = compute();
    const wDisp = Math.min(d.w * 10, (2 * Math.PI) / 2.2); // ×10 real, con tope para radios pequeños
    phase -= wDisp * dt; // antihorario en pantalla (y hacia abajo)
    const g = document.getElementById("t3-rot");
    if (g) g.setAttribute("transform", `rotate(${(phase * 180) / Math.PI} 265 300)`);
  }

  function table() {
    const rows = [1, 2, 3, 4, 6, 10].map((rpm) => {
      const w = (rpm * 2 * Math.PI) / 60;
      const r = G / (w * w);
      const cls = rpm === 2 ? ' style="background:color-mix(in srgb, var(--green) 10%, transparent)"' : "";
      return `<tr${cls}><td class="num">${rpm}</td><td class="num">${F(w, 4)}</td><td class="num">${F(r, 1)}</td><td class="num">${F(60 / rpm, 1)}</td><td class="num">${F(w * r, 1)}</td><td class="num">${F((1.8 / r) * 100, 2)} %</td><td class="num">${F(2 * w * 1.4, 2)}</td><td>${comfort(rpm)[0]}</td></tr>`;
    }).join("");
    document.getElementById("t3-table").innerHTML = `
      <table class="compare">
        <thead><tr><th class="num">rpm</th><th class="num">ω (rad/s)</th><th class="num">r para 1 g (m)</th><th class="num">T (s)</th><th class="num">v = ωr (m/s)</th><th class="num">Gradiente (h = 1,8 m)</th><th class="num">Coriolis a 1,4 m/s (m/s²)</th><th>Criterio de confort [3]</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  /* ---------- Zona interactiva: soltar una pelota dentro del hábitat ---------- */
  const play = { t: 0, running: false, raf: 0, ctx: null, w: 0, h: 0 };

  /** Trayectoria de una pelota soltada a altura hr sobre el piso de un anillo de radio r que gira con ω. */
  function dropModel() {
    const d = compute();
    const hr = Math.min(c.hr.value, d.r * 0.9);
    const rho = d.r - hr, w = d.w, vt = w * rho;
    // marco inercial: la pelota sigue en línea recta con la velocidad tangencial que tenía al soltarla
    const tHit = Math.sqrt(d.r * d.r - rho * rho) / vt;
    const thBall = Math.atan(w * tHit), thFeet = w * tHit;
    const behind = d.r * (thFeet - thBall);
    const tEarth = Math.sqrt((2 * hr) / d.gt);
    return { ...d, hr, rho, vt, tHit, thBall, thFeet, behind, tEarth };
  }

  /** Posición de la pelota en el marco que gira con el hábitat: (desplazamiento a lo largo del piso, altura). */
  function rotPos(m, t) {
    const x = m.rho, y = m.vt * t; // inercial, con la pelota soltada en ángulo 0
    const rad = Math.hypot(x, y), ang = Math.atan2(y, x) - m.w * t;
    return { s: m.r * ang, hgt: m.r - rad, ix: x, iy: y };
  }

  function drawPlay() {
    const cv = document.getElementById("t3-play");
    const cssW = cv.parentElement.clientWidth;
    if (!play.ctx || play.cssW !== cssW) { const r = UI.fitCanvas(cv, window.innerWidth < 700 ? 1.05 : 0.46); Object.assign(play, { ctx: r.ctx, w: r.w, h: r.h, cssW }); }
    const { ctx, w, h } = play, P = UI.palette(), m = dropModel();
    const t = Math.min(play.t, m.tHit);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = P.panel2; ctx.fillRect(0, 0, w, h);
    const narrow = w < 560;
    const half = narrow ? { w, h: h / 2 } : { w: w / 2, h };

    // --- Panel 1: vista desde afuera (marco inercial)
    const cx = half.w / 2, cy = half.h / 2 + 8, R = Math.min(half.w, half.h) * 0.38;
    ctx.fillStyle = P.muted; ctx.font = "700 11px Inter, sans-serif"; ctx.fillText("VISTA DESDE AFUERA (no gira)", 12, 18);
    ctx.save(); ctx.translate(cx, cy);
    const rot = -m.w * t; // el hábitat gira antihorario en pantalla (ángulo decreciente)
    ctx.strokeStyle = P.violet; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = P.line; ctx.lineWidth = 4;
    for (let k = 0; k < 6; k++) { const a = rot + (k * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * Math.cos(a), R * Math.sin(a)); ctx.stroke(); }
    // pies del tripulante: arrancan abajo (ángulo π/2 en pantalla) y giran con el piso
    const aFeet = Math.PI / 2 + rot;
    const fx = R * Math.cos(aFeet), fy = R * Math.sin(aFeet);
    const hpx = Math.max(16, (m.hr / m.r) * R);
    ctx.strokeStyle = P.text; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - Math.cos(aFeet) * hpx * 1.3, fy - Math.sin(aFeet) * hpx * 1.3); ctx.stroke();
    ctx.fillStyle = P.green; ctx.beginPath(); ctx.arc(fx, fy, 4, 0, 7); ctx.fill();
    // pelota en el marco inercial: ángulo atan(ωt) y radio ρ·√(1+(ωt)²); altura dibujada exagerada
    const wt = m.w * t, rhoT = m.rho * Math.sqrt(1 + wt * wt);
    const radVis = (rv) => R - hpx * ((m.r - rv) / m.hr);
    const aBall = Math.PI / 2 - Math.atan(wt);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = P.amber; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const tt = (t * i) / 40, w2 = m.w * tt, rv = m.rho * Math.sqrt(1 + w2 * w2), aa = Math.PI / 2 - Math.atan(w2); const X2 = radVis(rv) * Math.cos(aa), Y2 = radVis(rv) * Math.sin(aa); i ? ctx.lineTo(X2, Y2) : ctx.moveTo(X2, Y2); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.amber; ctx.beginPath(); ctx.arc(radVis(rhoT) * Math.cos(aBall), radVis(rhoT) * Math.sin(aBall), 6, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = P.faint; ctx.font = "10.5px Inter, sans-serif";
    ctx.fillText("La pelota sigue recta (1.ª ley) y el piso gira debajo. Altura exagerada.", 12, half.h - 10);

    // --- Panel 2: lo que ve el tripulante (marco que gira), con zoom
    const ox = narrow ? 0 : half.w, oy = narrow ? half.h : 0;
    ctx.save(); ctx.translate(ox, oy);
    ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(narrow ? w : 0, narrow ? 0 : h); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = "700 11px Inter, sans-serif"; ctx.fillText("LO QUE VE EL TRIPULANTE (gira con él)", 12, 18);
    const L = 54, B = half.h - 40, Rr = half.w - 20, T = 34;
    const maxBehind = Math.max(Math.abs(m.behind) * 1.25, 0.05);
    const Xs = (sv) => L + ((sv + maxBehind) / (maxBehind * 1.6)) * (Rr - L); // el desplazamiento hacia atrás es negativo
    const Ys = (hv) => B - (hv / (m.hr * 1.15)) * (B - T);
    // piso y regla
    ctx.fillStyle = P.violet; ctx.fillRect(L - 10, B, Rr - L + 20, 3);
    ctx.fillStyle = P.faint; ctx.font = "10px JetBrains Mono, monospace";
    ctx.fillText(`${UI.fmt(m.hr, 2)} m`, 6, Ys(m.hr) + 3); ctx.fillText("0", 30, B + 3);
    ctx.fillText(`← ${UI.fmt(maxBehind * 100, 1)} cm atrás`, L, B + 18);
    // tripulante y su mano
    const feetX = Xs(0);
    ctx.strokeStyle = P.text; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(feetX, B); ctx.lineTo(feetX, Ys(m.hr) - 6); ctx.stroke();
    ctx.fillStyle = P.text; ctx.beginPath(); ctx.arc(feetX, Ys(m.hr) - 14, 7, 0, 7); ctx.fill();
    // caída esperada en la Tierra (vertical)
    ctx.setLineDash([3, 4]); ctx.strokeStyle = P.green; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(feetX + 10, Ys(m.hr)); ctx.lineTo(feetX + 10, B); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.green; ctx.font = "10.5px Inter, sans-serif"; ctx.fillText("en la Tierra caería aquí", feetX + 14, Ys(m.hr * 0.5));
    // trayectoria en el marco que gira
    ctx.strokeStyle = P.amber; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const tt = (t * i) / 80, q = rotPos(m, tt); const X2 = Xs(q.s), Y2 = Ys(q.hgt); i ? ctx.lineTo(X2, Y2) : ctx.moveTo(X2, Y2); }
    ctx.stroke();
    const q = rotPos(m, t);
    ctx.fillStyle = P.amber; ctx.beginPath(); ctx.arc(Xs(q.s), Ys(q.hgt), 6, 0, 7); ctx.fill();
    if (play.t >= m.tHit) { ctx.fillStyle = P.amber; ctx.font = "700 12px Inter, sans-serif"; ctx.fillText(`cayó ${UI.fmt(Math.abs(m.behind) * 100, 1)} cm detrás`, Xs(-m.behind) - 20, B - 10); }
    ctx.fillStyle = P.faint; ctx.font = "10.5px Inter, sans-serif";
    ctx.fillText("Escala horizontal ampliada para que se note el desvío (Coriolis).", 12, half.h - 10);
    ctx.restore();

    const f = UI.fmt;
    document.getElementById("t3-play-ro").innerHTML = `
      <div class="ro"><div class="k">Tiempo de caída</div><div class="v">${f(m.tHit, 3)} <small>s</small></div></div>
      <div class="ro"><div class="k">En la Tierra (misma g)</div><div class="v">${f(m.tEarth, 3)} <small>s</small></div></div>
      <div class="ro"><div class="k">Cae detrás de los pies</div><div class="v">${f(Math.abs(m.behind) * 100, 1)} <small>cm</small></div></div>
      <div class="ro"><div class="k">Velocidad de la mano (ω·(r−h))</div><div class="v">${f(m.vt, 2)} <small>m/s</small></div></div>`;
  }

  function dropBall() {
    cancelAnimationFrame(play.raf);
    const m = dropModel();
    play.t = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { play.t = m.tHit; drawPlay(); return; }
    const slow = Math.max(1, 1.6 / m.tHit); // caídas muy rápidas se ven en cámara lenta (~1,6 s)
    let last = performance.now();
    const stepAnim = (now) => {
      play.t += ((now - last) / 1000) / slow; last = now;
      drawPlay();
      if (play.t < m.tHit) play.raf = requestAnimationFrame(stepAnim);
    };
    play.raf = requestAnimationFrame(stepAnim);
  }

  function initPlay() {
    c.hr = UI.bindRange("t3-hr", (v) => `${UI.fmt(v, 2)} m`, () => { play.t = 0; drawPlay(); });
    document.getElementById("t3-drop").addEventListener("click", dropBall);
    document.querySelectorAll("[data-t3r]").forEach((b) => b.addEventListener("click", () => {
      c.r.set(+b.dataset.t3r); c.g.set(1); play.t = 0; drawPlay(); dropBall();
    }));
    ["t3-r", "t3-g"].forEach((id) => document.getElementById(id).addEventListener("input", () => { play.t = 0; drawPlay(); }));
    window.addEventListener("resize", () => { play.cssW = 0; drawPlay(); });
    UI.onTheme(drawPlay);
    drawPlay();
  }

  function init() {
    c.r = UI.bindRange("t3-r", (v) => `${v} m`, update);
    c.g = UI.bindRange("t3-g", (v) => `${UI.fmt(v, 2)} g (${UI.fmt(v * G, 2)} m/s²)`, update);
    c.h = UI.bindRange("t3-h", (v) => `${UI.fmt(v, 2)} m`, update);
    c.anim = document.getElementById("t3-anim");
    build();
    update();
    table();
    const svg = document.getElementById("t3-diagram");
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(svg);
    requestAnimationFrame((t) => { last = t; animate(t); });
    initPlay();
  }

  return { init };
})();
