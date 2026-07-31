# Estado de la sesión — stick-rush (handoff)

> **Cómo continuar tras reiniciar:** di a Claude «revisa `ESTADO.md` y continúa con el siguiente
> paso». Este fichero es la memoria entre sesiones: mantenlo corto, veraz y al día.

---

## ⏭️ SIGUIENTE PASO (lo primero al volver)

1. **Probar la versión Godot** (nueva, 2026-07-06): instalar Godot 4.3+, abrir
   `godot/project.godot`, F5. Escrita SIN ejecutar (Godot no está instalado en esta máquina):
   si el editor avisa de algo, serán detalles de API, no de diseño. Ver `godot/README.md`
   (estructura, mecánica espejo del web, export desktop y camino a Steam).
2. **Mirar la escena 3D con los ojos** (pendiente real, no verificado): abrir
   `http://localhost:3111/game` en un Chrome en primer plano y comprobar que se ve la máquina,
   que los soportes apoyan en el suelo y que los palos caen y se atrapan con clic. En esta
   sesión no se pudo: la pestaña de automatización corre en segundo plano
   (`document.visibilityState === 'hidden'`), y ahí Chrome no ejecuta `requestAnimationFrame`,
   así que R3F ni dimensiona el canvas ni pinta. No es un fallo de la app: con la pestaña en
   primer plano el bucle arranca solo.
3. Probar el modo XR en un visor real (VR y AR) y afinar la captura con mandos
   (`npm run dev:https`): se reutiliza el sistema de punteros de `@react-three/xr` (mismos
   eventos de clic), sin validar en hardware. Comprobar allí la escala del jugador
   (`XR_PLAYER_SCALE`, ajustada a ojo) y que en AR se ve el passthrough.
4. Consolidar git (manual): poner `develop` al día (está en el bootstrap y los agentes de
   Organízate parten de develop); borrar el worktree muerto de `agent/inicializar-proyecto-…`
   (sin commits) con `git worktree remove`.

## Qué es stick-rush

- Juego web (Next.js + React Three Fiber) de palos que cuelgan de una máquina
  semicircular y caen de forma escalonada; el jugador los atrapa con clic (navegador)
  o con los mandos (XR VR/AR). Selecciona nº de palos (5–13) y dificultad.

## Decisiones firmes

- Stack: Next.js 16 (App Router) + React 19 + TypeScript; R3F + drei + three +
  `@react-three/xr`; Tailwind v4. Estado global con **Context API** (sin Zustand/Redux).
- `npm` como gestor de paquetes (se descartó el pnpm que generó el scaffold).
- `build` fija `NODE_ENV=production` en el script porque el entorno exporta
  `NODE_ENV=development`, que rompía la prerenderización de `/_global-error`.

## Hecho hasta ahora

- Base de la suite de Organízate instalada (`.claude/rules/`, `.claude/agents/`, `CLAUDE.md`).
- Proyecto Next.js inicializado e instalado (R3F, drei, xr, three).
- Primera versión jugable del juego:
  - `StartScreen` (selección de palos y dificultad, CTA, botones VR/AR si hay soporte).
  - Escena 3D: `StickMachine` (arco con TubeGeometry), `Stick` (caída + captura + glow),
    `Ground` (plano + grid), `HUD` (marcador y pantalla de fin).
  - Contexto de juego (`gameStore`) y config (`gameConfig`).
  - `global-error.tsx` con UI propia.
- Verificado: `npm run lint` (0 problemas), `npm run typecheck` (0 errores),
  `npm run build` (OK, rutas `/`, `/game`, `/_not-found` prerenderizadas),
  `npm run start` sirve `/` y `/game` con HTTP 200.

## Corregido en la revisión (2026-07-31, rama `fix/xr-escena-y-hud`)

- **AR ya no pinta el escenario**: `SceneBackdrop` (en `GameCanvas.tsx`) omite fondo, niebla,
  suelo y `<Environment>` cuando el modo es `immersive-ar`, para que se vea el passthrough y
  solo quede la máquina. R3F crea el renderer con `alpha: true`, así que basta con no pintar.
- **Escala del jugador en XR**: `XROrigin` se agranda con `XR_PLAYER_SCALE` (2.2), de modo que
  el mundo se percibe a ~1/2.2 y el arco queda ~1.3 m sobre los ojos. Evita rehacer la
  geometría, que la versión Godot replica. **El valor está calculado, no probado en visor.**
- **Soportes apoyados**: van de `GROUND_Y` al arranque del arco, en el web y en Godot
  (`main.gd`), que tenía el mismo fallo.
- **HUD 3D en inmersivo** (`XRHud.tsx`): una ficha por palo (atrapado / perdido / pendiente),
  distinguidas por color *y* por tamaño y altura. Sin texto a propósito: `<Text>` de drei
  descargaría las fuentes de un CDN. Al terminar, una barra marca la pausa
  (`XR_RESTART_DELAY_MS`) antes de encadenar la siguiente partida.
- **Doble resolución de un palo**: `Stick.tsx` usa un ref de guarda (dos mandos XR sobre el
  mismo palo, o captura justo al tocar el suelo, ya no suman dos veces) y devuelve el cursor
  al desmontarse.
- **Bug crítico encontrado al arreglar lo anterior**: `XRSessionController` hacía
  `resetGame()` con `mode == null && gameState === 'playing'`, y en escritorio `mode` es null
  siempre → al pulsar "Jugar" la partida se cancelaba sola y volvía al menú. **El modo
  escritorio estaba roto.** Ahora se recuerda si hubo sesión inmersiva antes de volver al menú.
- `gameStore` expone `resolved` (palos resueltos) y deriva `finished` en vez de guardarlo,
  eliminando el ref mutable y el riesgo de perder resoluciones simultáneas.

## Pendiente / próximos pasos

- Validar y pulir la interacción XR con mandos en hardware real.
- Posibles mejoras: sonido al atrapar/perder, animación de "vibración" de los palos
  colgando, temporizador/puntuación por tiempo, escenario VR más elaborado.
- Tests: aún no hay (no se ha configurado runner). Buen candidato: lógica de
  `gameStore` (resolución de partida) y `clampStickCount`.

## Caveats y notas

- El Canvas R3F se carga con `dynamic(..., { ssr: false })`; depende de WebGL/`window`.
- El `GameProvider` se monta a nivel de página (no en el root layout) para no
  arrastrar contexto cliente a la página interna `/_global-error`.
- El puerto 3000 puede estar ocupado por otro proceso del sistema; usar `PORT=...`
  para `npm run start` si hace falta.
