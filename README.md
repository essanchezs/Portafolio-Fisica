# Portafolio de Evidencias — Física I (FUN-18)

Universidad CENFOTEC · Escuela de Fundamentos · Período 2026-C3 · Sección FCV1
Estudiante: **Esteban Sánchez** · Docente: Andrés Castro Núñez

Página web personal donde documento cómo la física mecánica vista en clase aparece en el desarrollo de software real.
El portafolio es acumulativo: la estructura ya contempla los 13 temas del curso.

## Avance 1 — Cinemática y Dinámica

| # | Tema | Recurso prescrito |
|---|------|-------------------|
| 1 | Rastreo y navegación de un dron de reparto | Visualización de datos |
| 2 | El salto del personaje: cómo los motores de juego falsean la gravedad | Simulación interactiva |
| 3 | Gravedad artificial por rotación en hábitats espaciales | Diagrama |
| 4 | Llantas de Fórmula 1: la ventana de temperatura y el agarre | Visualización de datos |
| 5 | El resorte virtual detrás de un control háptico | Multimedia con análisis |

Cada tema incluye: (a) el caso de uso en Ingeniería del Software, con el caso concreto, la ecuación explícita y la
justificación frente a alternativas no físicas; y (b) el recurso de apoyo del tipo prescrito, elaborado por mí.

## Estructura

```
index.html               Página única con índice lateral y una sección por tema
assets/css/styles.css    Estilos (tema claro/oscuro, diseño adaptable)
assets/js/ui.js          Utilidades: tema, navegación, KaTeX, estilo de gráficas, CSV
assets/js/conexiones.js  Mapa de conexiones entre temas
assets/js/tema1-dron.js      Perfiles r(t), v(t), a(t) de una ruta de dron
assets/js/tema2-salto.js     Simulación del salto de un personaje (plataformero)
assets/js/tema3-habitat.js   Diagrama del hábitat rotatorio con ecuaciones
assets/js/tema4-llantas.js   Agarre de una llanta de F1 vs temperatura y carga
assets/js/tema5-haptico.js   Curva F(x) del gatillo adaptativo y tercera ley
```

Sin dependencias de compilación: HTML, CSS y JavaScript, con [Chart.js](https://www.chartjs.org/) y
[KaTeX](https://katex.org/) desde CDN. Publicado con GitHub Pages.

## Ver localmente

Cualquier servidor estático sirve, por ejemplo:

```bash
npx http-server . -p 8080
```
