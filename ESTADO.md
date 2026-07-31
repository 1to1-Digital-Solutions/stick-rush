# Estado de la sesión — stick-rush (handoff)

> **Cómo continuar tras reiniciar:** di a Claude «revisa `ESTADO.md` y continúa con el siguiente
> paso». Este fichero es la memoria entre sesiones: mantenlo corto, veraz y al día.

---

## ⏭️ SIGUIENTE PASO (lo primero al volver)

1. **Desplegar un preview en Vercel** y probarlo desde el visor (ver "Notas para el deploy").
2. Probar el modo XR en un visor real (VR y AR) y afinar la captura con mandos
   (`npm run dev:https`): se reutiliza el sistema de punteros de `@react-three/xr` (mismos
   eventos de clic), sin validar en hardware. Comprobar que en AR se ve el passthrough y que,
   con el aro horizontal, los palos caen al alcance del brazo.
3. Consolidar git (manual): poner `develop` al día (está en el bootstrap y los agentes de
   Organízate parten de develop); borrar el worktree muerto de `agent/inicializar-proyecto-…`
   (sin commits) con `git worktree remove`.

## 🔒 Godot: congelado hasta cerrar el web

**Decisión (2026-07-31): no se toca `godot/` mientras se itera en el web.** Primero se deja el
web como debe quedar (jugabilidad, look, XR) y solo entonces se porta el resultado final a
Godot, de una vez. Portar cada iteración por el camino sería trabajo tirado.

Pendiente para ese momento (no antes):

- [ ] Replicar en Godot el rediseño del web: aro **horizontal** alrededor del jugador, escala
      humana (metros), velocidades en m/s, estética de feria y palos amarillos. Hoy `godot/`
      mantiene el arco vertical y las unidades viejas. Detalle en `godot/README.md`.
- [ ] Decidir qué pasa con un palo perdido: en el web se queda clavado en el suelo, en Godot
      desaparece.
- [ ] Abrir el proyecto en Godot 4.3+ por primera vez (se escribió sin ejecutarlo, no hay Godot
      en esta máquina) y revisar los avisos del editor.

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

## Verificado en navegador (2026-07-31)

Prueba end-to-end sobre el build de producción con Chromium headless (Playwright, instalado
fuera del repo; el script vive en el scratchpad de la sesión, no se ha añadido como dependencia):
menú → elegir 9 palos y Fácil → Jugar → clics sobre los palos → fin de partida.

- La escena renderiza: ~1.000 draw calls/s, canvas dimensionado, palos cayendo escalonados.
- Se atrapan con clic (marcador 0/9 → 1/9) y la partida cierra sola al resolverse todos.
- **Cero peticiones a dominios externos.**
- Consola limpia salvo un aviso de `THREE.Clock` deprecado, que viene de dentro de las
  librerías, no del código del proyecto.

Ojo con el entorno: si se prueba en una pestaña que Chrome tiene en segundo plano
(`document.visibilityState === 'hidden'`), no se ejecuta `requestAnimationFrame` y R3F ni
dimensiona el canvas ni pinta. El canvas en blanco ahí no indica un bug de la app.

## Notas para el deploy en Vercel

- **No hace falta configurar nada**: no hay variables de entorno, ni base de datos, ni
  peticiones a terceros. `npm run build` (con su `NODE_ENV=production`) funciona tal cual.
- **El emulador WebXR no aparecerá**: `@react-three/xr` inyecta IWER solo cuando el hostname es
  exactamente `localhost` (de ahí el botón "Enter XR" y el aviso de "Multiple instances of
  Three.js" en local). Comprobado sirviendo por `127.0.0.1`: ambos desaparecen.
- **Protección de deployments**: si el preview tiene activada Vercel Authentication, el
  navegador del visor tendrá que hacer login en Vercel para abrirlo. Conviene desactivarla para
  ese preview o usar un dominio de producción.
- **Abrir la URL directa en el visor**, no embebida en un iframe (la vista previa del dashboard
  de Vercel lo es): WebXR necesita `allow="xr-spatial-tracking"` en el iframe padre.
- HTTPS con certificado válido, así que en el visor no hay que aceptar avisos de certificado
  como con `npm run dev:https`.

## Rediseño de la máquina (2026-07-31)

La máquina era un arco **vertical** con el jugador delante: en XR los palos del centro le caían
sobre la cabeza. Ahora es un aro **horizontal** (semicírculo en el plano XZ) y el jugador se
planta en el centro, así que los palos le caen alrededor, al alcance del brazo.

- Toda la escena pasa a **escala humana (1 unidad = 1 metro)**: aro de 1.25 m de radio a 2.15 m
  de altura, palos de 42 cm, suelo en y=0. Con eso desaparece el apaño de agrandar al jugador en
  XR (`XR_PLAYER_SCALE`): ahora va a 1:1.
- Las velocidades por dificultad se recalcularon a m/s para conservar los tiempos de caída
  (Fácil ~5.7 s, Imposible ~0.7 s) sobre el nuevo recorrido de 1.6 m.
- Estética de feria: aro a rayas rojas y crema, guirnalda de bombillas, postes dorados, suelo de
  moqueta roja y palos de madera amarilla (todos del mismo color).
- Escenario: HDRI de carpa de espectáculos servido desde `public/hdri/`, que hace de fondo en VR
  y escritorio y además ilumina la escena. En AR se mantiene solo como reflejos.

**No se encontró ningún modelo 3D de máquina de feria** (Poly Haven solo tiene props domésticos),
así que la máquina sigue siendo geometría por código, ahora con más detalle.

*(La deuda de Godot está arriba, en "Godot: congelado hasta cerrar el web".)*

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
