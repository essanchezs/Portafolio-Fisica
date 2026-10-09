/* Mapa de conexiones entre temas (SVG generado). */
window.Conexiones = (() => {
  const nodes = [
    { id: 1, x: 150, y: 140, t: ["Tema 1", "Dron de reparto"], c: "--accent" },
    { id: 2, x: 240, y: 345, t: ["Tema 2", "Salto del personaje"], c: "--accent-2" },
    { id: 3, x: 490, y: 45, t: ["Tema 3", "Gravedad artificial"], c: "--amber" },
    { id: 4, x: 830, y: 140, t: ["Tema 4", "Llantas de F1"], c: "--accent" },
    { id: 5, x: 740, y: 345, t: ["Tema 5", "Resorte háptico"], c: "--green" },
    { id: 0, x: 490, y: 225, t: ["Clase", "Semanas 2–5"], c: "--violet", hub: true },
  ];
  const edges = [
    [1, 3, "a = v²/R = ω²r"],
    [3, 4, "m v²/R ≤ μN"],
    [2, 5, "½kx² = mgh"],
    [1, 2, "MRUA por componentes"],
    [4, 5, "fuerzas de contacto: μN, −kx"],
    [0, 1, "S2 vectores"],
    [0, 2, "S2 caída libre"],
    [0, 3, "S2 circular · S3 normal"],
    [0, 4, "S3 fricción"],
    [0, 5, "S3 Hooke · S4 energía"],
  ];

  function render() {
    const svg = document.getElementById("connections-svg");
    if (!svg) return;
    const P = UI.palette();
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    let s = "";
    edges.forEach(([a, b, label]) => {
      const A = byId[a], B = byId[b];
      const hub = a === 0 || b === 0;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${hub ? P.line : P.muted}" stroke-width="${hub ? 1.5 : 2}" stroke-dasharray="${hub ? "4 5" : ""}"/>`;
      const w = label.length * 6.6 + 14;
      s += `<rect x="${mx - w / 2}" y="${my - 11}" width="${w}" height="22" rx="11" fill="${P.panel2}" stroke="${P.line}"/>`;
      s += `<text x="${mx}" y="${my + 4}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="${hub ? P.muted : P.text}">${label}</text>`;
    });
    nodes.forEach((n) => {
      const col = UI.css(n.c);
      const w = 170, h = 58;
      const href = n.id ? `#tema-${n.id}` : "#inicio";
      s += `<a href="${href}"><g style="cursor:pointer">`;
      s += `<rect x="${n.x - w / 2}" y="${n.y - h / 2}" width="${w}" height="${h}" rx="14" fill="${P.panel}" stroke="${col}" stroke-width="${n.hub ? 1.5 : 2}"/>`;
      s += `<text x="${n.x}" y="${n.y - 5}" text-anchor="middle" font-family="Source Serif 4, serif" font-weight="700" font-size="14" fill="${col}">${n.t[0]}</text>`;
      s += `<text x="${n.x}" y="${n.y + 15}" text-anchor="middle" font-family="Public Sans, sans-serif" font-size="13" fill="${P.text}">${n.t[1]}</text>`;
      s += `</g></a>`;
    });
    svg.innerHTML = s;
  }

  function init() {
    render();
    UI.onTheme(render);
  }
  return { init };
})();
