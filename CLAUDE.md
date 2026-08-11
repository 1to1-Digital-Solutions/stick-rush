# CLAUDE.md — stick-rush

**Qué es:** Aplicación web para ejcutar en navegadores de headset de realidad mixta. El juego consiste en hacer el juego de Falling Sticks Game, el tipico juego que hay unos palos (sticks) que caen hacia el suelo de forma aleatoria y el usuario tiene que intentar atraparlos. Voy intentar explicarlo, los palos cuelgan de una maquina en forma semicircular. Al acceder a la aplicacion el usuario decidira cuantos palos quiere, entre 5 y 13, tambien elegira la dificultad (facil, medio, dificil, experto, imposible), que modificara la velocidad con la que caen los sticks al suelo. Tienen que caer de forma escalonada y aleatoria.
Si la aplicacion se juega desde un navegador normal (sin un headset), para "pillar los sticks" se hace haciendo click con el raton. Pero si se juega desde un visor de XR, la idea es que pueda seleccionar modo VR o AR. En modo VR tendra un escenario cargado. Si esta en AR, solo estara la maquina y el usuario. Para coger los palos se hace con los mandos de xr.
Quiero que la app se construya con next.js, y librerias como drei, react three fiber y WebXR

**Cómo se construye:** sigue las reglas de `.claude/rules/` (arquitectura, seguridad, diseño,
git) en cada cambio. Lee primero el contexto del repo, haz el cambio mínimo y enfocado, reutiliza
antes de crear y verifica (typecheck/lint/build/tests) antes de dar nada por terminado.

**Estado y siguiente paso:** ver **`ESTADO.md`** — ese fichero es el handoff entre sesiones e
indica qué toca hacer ahora.

**Decisiones firmes:**
- (Documenta aquí las decisiones de stack y producto que no se renegocian: lenguaje, framework,
  base de datos, despliegue, etc.)
- Commits manuales: no commitear sin que se pida.

> Base instalada con la suite de Organízate. Las reglas comunes viven en `.claude/rules/` y los
> agentes reutilizables en `.claude/agents/`. La provenance de lo instalado está en
> `.organizate/install-state.json`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
