/* Punto de entrada: inicializa la interfaz y cada tema de forma aislada
   (si un recurso falla, los demás siguen funcionando). */
document.addEventListener("DOMContentLoaded", () => {
  UI.init();
  [window.Conexiones, window.Tema1, window.Tema2, window.Tema3, window.Tema4, window.Tema5].forEach((m) => {
    if (!m) return;
    try { m.init(); } catch (err) { console.error("Error al iniciar un recurso:", err); }
  });
  // Las ecuaciones y gráficas cambian la altura de la página al renderizarse:
  // se vuelve a ubicar el ancla de la URL para que el enlace a un tema funcione.
  if (location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "instant" }), 120);
  }
});
