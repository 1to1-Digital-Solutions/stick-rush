# Estado de la sesión — stick-rush (handoff)

> **Cómo continuar tras reiniciar:** di a Claude «revisa `ESTADO.md` y continúa con el siguiente
> paso». Este fichero es la memoria entre sesiones: mantenlo corto, veraz y al día.

---

## 📍 DÓNDE ESTAMOS (2026-08-04)

El trabajo vivo está en **`fix/xr-mandos-y-menu-visible`** (10 commits sobre `main`):
arregla el modo inmersivo —sin ella el visor es inutilizable— y recoge las mejoras de
la tercera prueba con las gafas. Verificado ahí: lint y typecheck limpios, build OK,
**110 unitarios** (`npm test`) y **32 e2e** (`npm run test:e2e`) en verde, y
`npm audit` en **0 vulnerabilidades**.

`main` local = **371562b**, con Next 16.3.0 dentro.

⚠️ **`main` va 4 commits por delante de `origin/main`.** El remoto no tiene nada que
falte en local: para desplegar hay que **publicar**, no descargar.

Últimos hitos, en orden: primera versión jugable → tests + README → auditoría de
seguridad → menú inmersivo y agarre tras probar con las gafas → tests de XR con
emulador → historial reescrito para quitar el email personal → Next 16.3.0 → arreglo
del modo inmersivo tras la segunda prueba con el visor.

## ⏭️ SIGUIENTE PASO (lo primero al volver)

0. **Probar en el visor lo añadido el 2026-08-06.** El emulador no puede pulsar botones,
   así que nada de esto está validado en hardware. Qué mirar: (a) que la **posición del
   jugador** ya sea la buena, sin dar el paso adelante; (b) que el **tamaño** convenza
   tras el −8 %; (c) que el **selector de escenario/passthrough** funcione y el fundido
   no maree; (d) que la **cuenta atrás** dé tiempo suficiente; (e) que el destello verde
   y los palos rojos en el suelo se lean bien con las gafas; (f) que los **iconos** de
   casa y de salida se distingan de un vistazo, y si los de repetir, escenario y
   passthrough se entienden o hay que rehacerlos igual; (g) que el **sonido** se oiga
   dentro de la sesión, que acierto y fallo se distingan sin mirar y que el volumen
   (`MASTER_GAIN`, 0.28) no resulte invasivo pegado a los oídos.
   Valores a retocar: adelanto del jugador (`PLAYER_OFFSET_Z`, −0.18 m), tamaño
   (`MACHINE_RADIUS` 0.57 m y `STICK_LENGTH` 0.39 m — al cambiarlos hay que recalcular
   `DIFFICULTY_SPEEDS` para conservar los tiempos, que `gameConfig.test.ts` vigila),
   duración de la cuenta (`COUNTDOWN_SECONDS`), fundido (`FADE_SECONDS` en
   `SceneryFade`), zona muerta del anclaje (`XR_ANCHOR_DEADZONE`, 40°) y radio de agarre
   (9 cm, en `XRController`).
1. **Publicar `main`** (`git push origin main`): sin eso el deploy no lleva los últimos
   cambios.
2. **Desplegar un preview en Vercel** y probarlo desde el visor (ver "Notas para el deploy").
3. Comprobar que en AR se sigue viendo el passthrough tras los cambios de geometría.
4. ~~Limpiar las ramas del remoto antes de hacer el repo público.~~ **HECHO
   (2026-08-06).** El remoto tiene **solo `main`**, y su único email de autor es el
   `noreply`: el personal ya no está en ninguna parte publicada. Se borraron las siete de
   Dependabot y `fix/xr-escena-y-hud` (04-08), y `master` y `agent/stick-rush-v1`
   (06-08). Dependabot recreará sus ramas solo sobre el `main` nuevo. Ojo: las PR #1 y #2
   apuntan a commits huérfanos desde la reescritura del historial.
5. Consolidar git en local (manual): poner `develop` al día (está en el bootstrap y los
   agentes de Organízate parten de develop). Queda el worktree muerto de
   `agent/inicializar-proyecto-…` en `~/Proyectos/.organizate-worktrees/`, que **sí tiene
   ~20 ficheros en staging** (el primer scaffold del 28 de junio, superado por `main`):
   no hay nada que rescatar, pero `git worktree remove` necesitará `--force`. Ramas
   locales ya integradas que se pueden borrar: `chore/tests-y-readme`,
   `feat/xr-menu-inmersivo-y-seguridad`, `fix/xr-escena-y-hud`,
   `fix/xr-mandos-y-menu-visible`, `test/xr-emulado`.

## 🧭 Convenciones de trabajo aprendidas

- **Commits y push**: `.claude/rules/git-workflow.md` prohíbe `push` y tocar `main`. En
  la práctica el dueño del repo lo autoriza caso por caso; sin autorización explícita,
  commitear en una rama y ofrecer el comando.
- **Verificar antes de dar nada por hecho**: `npm run lint`, `npm run typecheck`,
  `npm test` y `npm run test:e2e`. La suite e2e tarda ~1 min y tiene partes sensibles al
  tiempo; si algo falla de forma intermitente, repetirla antes de "arreglar" nada.
- Hay un **backup del historial previo a la reescritura** en
  `refs/backup/main-antes-de-reescribir` (SHA `e0750ca`), por si hiciera falta.

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

## Tests (2026-08-03) — cifras al día en «DÓNDE ESTAMOS»

Ya hay runner, y forma parte de las comprobaciones antes de dar nada por terminado.

- **Unitarios — Vitest + Testing Library** (`npm test`). Cubren `src/lib`:
  geometría del aro (`machinePoint`), coherencia de las dificultades, tiempos de caída por
  nivel, reparto y retardos de los palos, estados del marcador y el ciclo completo de la
  partida en `gameStore` (incluido el caso de dos palos resolviéndose en el mismo lote).
- **Extremo a extremo — Playwright** (`npm run test:e2e`, Chromium sobre el build
  de producción). Menú, selección, teclado, partida, captura de palos con el ratón, fin de
  partida, revancha, ausencia de errores de consola, cero peticiones externas y pantalla de
  móvil. Un test aparte (`npm run capture`) regenera la captura del README.
- Para poder probar la lógica sin navegador se sacó de los componentes 3D a
  **`src/lib/stickLayout.ts`**: reparto de los palos por el aro, retardos escalonados y
  estados del marcador. `STICK_MISS_Y`, `STICK_FALL_DISTANCE` y `fallDurationSeconds()` pasan
  a `gameConfig.ts`. Los componentes solo pintan.
- Para tener enganches estables (y de paso accesibilidad): el marcador es `role="status"` con
  `aria-live` y el fin de partida `role="dialog"`.
- El e2e destapó un incumplimiento real: los botones de dificultad medían **42 px** de alto,
  por debajo del mínimo táctil de 44 px de `.claude/rules/design.md`. Corregido ahí y en los
  botones de VR/AR.
- Los e2e se sirven en `127.0.0.1` y no en `localhost` a propósito: con `localhost`,
  `@react-three/xr` inyecta el emulador IWER y aparece un botón "Enter XR" que no existe en
  el juego real.

## Corregido en la revisión (2026-07-31, rama `fix/xr-escena-y-hud`)

- **AR ya no pinta el escenario**: `SceneBackdrop` (en `GameCanvas.tsx`) omite fondo, niebla,
  suelo y `<Environment>` cuando el modo es `immersive-ar`, para que se vea el passthrough y
  solo quede la máquina. R3F crea el renderer con `alpha: true`, así que basta con no pintar.
- **Escala del jugador en XR**: `XROrigin` se agranda con `XR_PLAYER_SCALE` (2.2), de modo que
  el mundo se percibe a ~1/2.2 y el arco queda ~1.3 m sobre los ojos.
  > **Obsoleto:** `XR_PLAYER_SCALE` desapareció al pasar la escena a metros; hoy el
  > jugador va a 1:1 y el aro está a 62 cm (ver "Jugabilidad XR").
- **Soportes apoyados**: van de `GROUND_Y` al arranque del arco, en el web y en Godot
  (`main.gd`), que tenía el mismo fallo.
- **HUD 3D en inmersivo** (`XRHud.tsx`): una ficha por palo (atrapado / perdido / pendiente),
  distinguidas por color *y* por tamaño y altura. Sin texto a propósito: `<Text>` de drei
  descargaría las fuentes de un CDN. Al terminar, una barra marcaba la pausa
  (`XR_RESTART_DELAY_MS`) antes de encadenar la siguiente partida.
  > **Obsoleto:** el reinicio automático y `XR_RESTART_DELAY_MS` se eliminaron el
  > 2026-08-03; ahora al terminar se elige entre repetir y volver al menú.
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
- Estética de feria: aro a rayas rojas y crema con ganchos por palo, celosía superior (aro,
  montantes y diagonales en zigzag), guirnalda de bombillas con casquillo, postes arriostrados
  con base y palos de madera amarilla, todos del mismo color. La celosía y los tirantes son
  deliberadamente redundantes: con un solo tubo la máquina parecía que se fuera a caer.
- Escenario: HDRI de **plaza de pueblo de noche** (con guirnaldas de banderines), servido desde
  `public/hdri/`. Hace de fondo, ilumina la escena y se **proyecta sobre el suelo**
  (`<Environment ground>`), de modo que la máquina se planta en el empedrado real en vez de
  sobre un plano de color con un corte visible contra el horizonte. En AR se mantiene solo como
  reflejos. El suelo propio ya no pinta nada: solo recibe la sombra de la máquina.
- Se usa el EXR de 1K (2 MB). Hay 2K disponible (~8 MB) si se quiere el fondo más nítido en el
  visor; es cambiar el archivo y `HDRI_URL`.

**No se encontró ningún modelo 3D de máquina de feria** (Poly Haven solo tiene props domésticos),
así que la máquina sigue siendo geometría por código, ahora con más detalle.

*(La deuda de Godot está arriba, en "Godot: congelado hasta cerrar el web".)*

## Jugabilidad XR tras la primera prueba en visor (2026-08-03)

Cinco cosas que salieron de probarlo con las gafas puestas, todas en
`feat/xr-menu-inmersivo-y-seguridad`:

- **Entrar en VR/AR ya no arranca una partida.** `XRSessionController` lleva al menú y
  el nuevo `XRMenu` lo dibuja con geometría: fila de 13 palos (encendidos hasta el
  elegido), cinco fichas de dificultad con barras crecientes, y botón de empezar.
  **Sin una sola letra**, igual que el HUD: `<Text>` de drei descarga las fuentes de
  un CDN y la CSP ahora lo bloquea. Piezas comunes en `XRUi.tsx`.
- **Se puede volver atrás.** Botón de salir a un lado durante la partida
  (`XRQuitButton`) y, al acabar, repetir o volver al menú. Se quitó el reinicio
  automático y con él `XR_RESTART_DELAY_MS`.
- **Los palos ya no caen en orden.** `buildStickLayout` sacaba el retardo del índice,
  así que caían de izquierda a derecha siempre. Ahora `fallOrder()` baraja
  (Fisher-Yates sembrado con `runId`) y la posición en el aro no dice nada del turno.
- **El aro baja al alcance del brazo**: radio 1.25 → **0.62 m** y altura 2.15 → 1.95 m.
  Las velocidades se recalcularon para conservar los tiempos por dificultad (el
  recorrido se acortó un 12 %), los perfiles se afinaron y la cámara de escritorio se
  reencuadró. `xrInteraction.test.ts` fija que el aro no se aleje del alcance.
- **Se coge agarrando, no apuntando.** `Stick` mira el `pointerType` del evento y
  descarta `ray`: el agarre (`grab`, esfera en el puño con el botón *squeeze*) y el
  contacto de la mano (`touch`) sí valen; el rayo se queda solo para el menú. Se
  resuelve en `pointerdown` y no en `click`, porque con el palo cayendo exigir
  pulsar-y-soltar sobre el mismo objeto hacía fallar agarres buenos.
- De regalo: los palos ya **no caen mientras estás en el menú**. Su reloj corría desde
  que se montaban, así que al empezar podían estar ya por el suelo.

## Tests de XR con emulador (2026-08-03, rama `test/xr-emulado`)

Chromium no implementa WebXR, así que hasta ahora **ningún test tocaba el modo
inmersivo**: todos entraban por el ratón, que es otro camino de código. Se inyecta
IWER (el emulador de Meta, ya presente como dependencia de `@react-three/xr`) con
`page.addInitScript` y se abren sesiones de verdad, con un Quest 3 y sus dos mandos.
El bundle se genera en `globalSetup` con esbuild y está gitignorado.

Cubierto: que aparezcan las entradas a VR/AR, que **entrar en VR lleve al menú y no
arranque partida sola**, que los palos no se suelten en el menú, y que salir de la
sesión devuelva al menú (lo que de paso prueba que la app reconoce el modo).

**Lo que NO se pudo cubrir, y por qué:** mover los mandos y pulsar sus botones. El
emulador entrega sesión, dos `inputSources` y ~125 fps, pero los punteros de
`@react-three/xr` no emiten eventos sobre los objetos de la escena. Se descartó por
diagnóstico: no es la orientación del rayo (falla igual con agarre y con contacto
directo), ni la posición (barrido 2D de todo el plano del jugador sin un solo hover),
ni el frameloop, ni la detección de modo. Queda como línea abierta si alguien quiere
retomarla.

> **Aviso (2026-08-05):** este párrafo se convirtió en una coartada. Durante semanas
> tapó un fallo real —los mandos **no se registraban**, así que no había punteros que
> pudieran emitir nada— que se veía en la consola con solo entrar en sesión. Se
> reintentó el test tras arreglarlo y sigue sin enganchar, así que la limitación de
> IWER es real; pero ahora hay un e2e que vigila la consola dentro de la sesión
> (`la sesión monta mandos e interfaz sin ensuciar la consola`) para que un fallo así
> no vuelva a esconderse detrás de "es el emulador".

Como contrapartida, la **regla** de interacción sí está cubierta por unitarios:
`src/lib/xrInteraction.ts` decide qué puntero puede coger un palo (el rayo no; el
agarre, el contacto y el ratón sí) y eso se testea sin navegador. El layout de la
interfaz inmersiva vive en `src/lib/xrLayout.ts`, compartido por componentes y tests.

## Tercera prueba en visor (2026-08-06, misma rama)

El modo inmersivo **funciona**: se ven los mandos y el menú se maneja. De esa
prueba salieron seis mejoras, todas dentro de la rama:

- **El jugador estaba echado hacia atrás** (había que dar un paso al empezar). El aro
  es un *semi*círculo, así que su masa cae hacia −Z; ahora el jugador se planta en
  `PLAYER_POSITION`, 18 cm por delante del centro.
- **Máquina y palos un 8 % más pequeños**, con las velocidades recalculadas para
  conservar los tiempos de caída. La altura del aro no se toca: la manda la estatura.
- **Puntuación** (`src/lib/scoring.ts`): base por palo × dificultad × racha × reflejos.
  El tope de racha existe para que 13 palos en Fácil no batan a una partida perfecta
  en Imposible.
- **Cuenta atrás de 3 s** como fase propia, durante la cual los palos **no se dejan
  coger** (si no, se vaciaba el aro a clics antes de empezar).
- **Acierto en verde con onda, fallo en rojo en el suelo.**
- **Escenario o passthrough se elige dentro del visor**, con fundido. Se entra siempre
  en `immersive-ar` cuando se puede, porque WebXR no deja cambiar de tipo de sesión
  sin reabrirla. La entrada del menú es ahora un solo botón.

## Sonido (2026-08-10, rama `agent/sonido-al-atrapar-al-perder-y-en-351461`)

Con el visor puesto era lo que más se echaba de menos: el marcador está a un
lado y no se puede mirar mientras caen los palos, así que atrapar y fallar solo
se notaban si dabas la vuelta a la cabeza.

- **Sintetizado, no grabado.** `src/lib/sound.ts` describe cada sonido como
  voces de oscilador (forma de onda, frecuencias, duración, volumen) y
  `createSoundEngine` las programa con la Web Audio API. Así no hay ficheros que
  servir, no hace falta abrir `media-src` en la CSP y no hay CDN de por medio.
  La receta es un dato puro, de modo que se prueba sin navegador.
- **Qué suena**: acierto con un timbre que sube un semitono por palo de racha
  (con tope, o una racha larga acabaría chillando), fallo grave y descendente
  que dura el doble, un tic por segundo de cuenta atrás —subiendo conforme se
  acerca la salida— y un remate más largo al empezar a caer los palos.
- **El cableado es `useGameSound`** (en `components/game/`), montado una vez en
  `GameScene`: escucha el estado del juego en vez de engancharse a los
  componentes, así vale igual para el ratón y para los mandos del visor.
- El navegador no deja sonar hasta que el jugador interactúa, así que el
  `AudioContext` se crea con el primer clic o tecla. En el visor ese gesto es el
  botón de entrar en la sesión, que todavía es DOM.
- **Con el contexto suspendido el juego calla a propósito** (quitarse el visor a
  media partida, o que el sistema le quite el foco al navegador): ahí el reloj
  del audio se para y todo lo que se programe se amontonaría en el mismo
  instante, para sonar de golpe y a todo volumen al volver. En su lugar se pide
  el audio de vuelta y se pierde ese sonido. Al probar con las gafas: si al
  ponérselas otra vez el primer palo no suena y el siguiente sí, es esto y está
  bien.
- **Se puede silenciar** desde los dos menús (ver abajo).

## Silencio (rama `agent/poder-silenciar-el-juego-menu-de-7fbe05`)

El sonido no se podía ni bajar ni quitar, y en el visor va pegado a los oídos.

- La preferencia es una bandera del store (`muted`, como `scenery`) y **no se
  guarda entre visitas**: la auditoría dejó el juego sin storage y persistirla
  es una decisión aparte, no un efecto colateral de esta tarea. Sí sobrevive a
  la partida y a volver al menú.
- **En silencio no se toca la Web Audio API**: ni contexto, ni nodos, ni
  permiso de reproducción. `useGameSound` crea el contexto solo cuando hay
  gesto del jugador *y* el sonido está activo; al silenciar a media partida, la
  limpieza del efecto cierra el que hubiera abierto.
- Para eso, el gesto que desbloquea el audio pasó de `pointerdown` a **`click`**
  (y «ya hubo gesto» de ref a estado). El primer clic de la página puede ser el
  propio botón de silenciar: con `pointerdown` el gesto y la orden de callar
  llegan en eventos distintos, así que el juego abría un contexto para cerrarlo
  en el render siguiente. Escuchando el mismo evento que activa el botón, React
  ve las dos cosas en el mismo render. El teclado sigue cubierto: activar un
  botón con Enter dispara su clic. Lo vigila un unitario que pulsa un botón de
  verdad (`useGameSound.test.tsx`), no dos llamadas al store en el mismo lote —
  eso pasaba en verde con el fallo puesto.
- Quitar el silencio devuelve el sonido **sin esperar otro clic**: el propio
  botón es el gesto que exige el navegador.
- En escritorio, botón bajo el CTA con `aria-pressed` y altavoz tachado (el
  e2e de móvil ya vigila los 44 px). En el visor, botón en la esquina del panel
  del menú, simétrico al de salir, con la silueta de `xrIcons.ts`: altavoz con
  ondas o con un aspa. El aspa ocupa el sitio de las ondas en vez de cruzar el
  altavoz —tacharlo con el mismo relleno se ve como una mancha, no como un
  tachón—. `xrIcons.test.ts` fija esa forma.
- **Sin validar en hardware**: falta ver si el botón se distingue del de salir
  con las gafas puestas, y si con `MASTER_GAIN` a 0.28 hace falta además un
  control de volumen intermedio.

## Iconos del menú inmersivo (rama `agent/mejorar-los-iconos-del-menu-3d`)

De la tercera prueba salió que la flecha de «volver» no se leía como una flecha, y que
volver al menú y salir del visor compartían icono haciendo cosas distintas.

- Los iconos se apilaban con primitivas (un prisma triangular junto a una caja) y a un
  metro de distancia eso se ve como **dos objetos**, no como una figura. Ahora la forma es
  un **contorno cerrado** en `src/lib/xrIcons.ts` del que sale un `ShapeGeometry`.
- **Casa** para volver al menú (fin de partida y botón apartado durante la partida) y
  **puerta con flecha saliendo** para cerrar la sesión (esquina del menú). La flecha
  suelta desaparece: no queda ningún botón que signifique solo «atrás».
- La silueta es comprobable sin navegador (`xrIcons.test.ts`, 15 casos): que el tejado
  corone el cuerpo, que la puerta caiga dentro de la fachada, que la punta de la flecha sea
  más ancha que el asta, que ningún contorno se cruce consigo mismo y que todos ocupen el
  mismo cuadro y centrados, para que a igual `size` y `position` se vean del mismo tamaño y
  en el mismo sitio de su placa.
- Siguen **sin validar en hardware** `XRRepeatIcon`, `XRSceneIcon` y `XRPassthroughIcon`,
  que se dejaron como estaban a falta de saber si se entienden con las gafas puestas.

En la revisión de la rama apareció la causa de fondo de que el icono anterior «no se
leyera como una flecha», que no era solo la forma:

- El **botón de volver al menú se comía su propio icono**. Está apartado a un lado
  y su placa giraba para encarar al jugador, pero el dibujo no giraba con ella: el borde
  izquierdo de la placa se adelantaba por delante del icono y lo cortaba en diagonal
  desde ese lado, justo donde caía la punta de la flecha. Ahora el giro cuelga del botón
  (`rotation` de `XRPressable`), así que placa, icono, halo de foco y zona sensible se
  mueven juntos, y sale de `XR_QUIT_YAW` —derivado de la posición— en vez de un `π/7`
  puesto a ojo, que además se quedaba 3° corto. `xrInteraction.test.ts` vigila que la
  placa siga encarando al jugador si alguien mueve el botón.
- **Un solo tamaño para las siluetas** (`ICON_SIZE`, 5,6 cm): iban a 0.024 y 0.026 y la
  casa se veía claramente más pequeña que el aro de repetir a su lado en la pantalla de
  fin de partida.

## Segunda prueba en visor (2026-08-05, rama `fix/xr-mandos-y-menu-visible`)

Con las gafas puestas el modo inmersivo era **inutilizable**: no se veían los mandos,
no se podía seleccionar nivel ni nada, y el botón de volver no aparecía. Dos fallos
independientes, los dos arreglados en esa rama:

1. **Los mandos no llegaban a registrarse.** `@react-three/xr` necesita el *perfil* del
   mando (qué botón es cuál) y lo descarga de `cdn.jsdelivr.net`. La CSP lo bloquea;
   `createXRControllerState` resuelve esa carga en una promesa cuyo rechazo se traga un
   `.catch(console.error)`, así que **nunca se llama a `addController`** y sin estado de
   mando no se monta ni el rayo ni el puntero de agarre. Los mandos no existían para la
   app. Ahora los 42 perfiles se sirven desde `public/webxr-profiles/` (528 KB de JSON;
   los `.glb`, 100 MB, no hacen falta) vía `baseAssetPath`, y `npm run sync:xr-profiles`
   los regenera.
2. **La interfaz aparecía a la espalda.** Menú, marcador y botón de salir colgaban de
   `<XROrigin>` con Z negativo fijo, pero el −Z del origen lo decide la calibración de
   la sala, no hacia dónde mire el jugador. Ahora cuelgan de `<XRGazeAnchor>`, que gira
   con él y le acompaña si camina, con una zona muerta de 40° para que se pueda apuntar
   sin que el objetivo huya. La aritmética está en `src/lib/xrAnchor.ts`, probada sin
   navegador.

Además: mando dibujado con geometría propia (sin descargas) con el gatillo de agarre
latiendo en ámbar hasta el primer palo atrapado y en verde mientras se aprieta; botones
que se resuelven en `pointerdown` y no en `click` (apuntando a pulso, el rayo se salía
entre pulsar y soltar) y con halo de foco visible; y salida del visor desde el menú.

**Sigue sin validarse en hardware**: el emulador no puede pulsar botones (ver el aviso
en "Tests de XR con emulador"), así que hay que probarlo con las gafas.

## Auditoría de seguridad y prueba en visor (2026-08-03)

Auditoría completa antes de hacer el repo público: **sin secretos en el historial**
(revisado `--all`, contenido además de nombres), sin XSS, sin red, sin storage, sin
source maps y sin rutas locales en el bundle. La app es 100 % estática: ni middleware,
ni Server Actions, ni API routes, ni `next/image`.

Corregido en `feat/xr-menu-inmersivo-y-seguridad`:

- **Cabeceras** en `next.config.ts`. La importante es `connect-src 'self'`: en el
  bundle hay CDNs cableados por librerías (mandos de @react-three/xr en jsDelivr,
  HDRI de preset de drei en raw.githack, fuentes de troika). Ahora el "funciona sin
  internet" lo impone el navegador. `xr-spatial-tracking=(self)` es obligatorio: sin
  él WebXR no arranca.
- **Modelos de mando y mano desactivados** (`xrStore`).
  > **Corregido (2026-08-05):** aquí se dijo que eso *era la descarga real a jsDelivr*.
  > Era **falso**, y costó caro: `model: false` solo quita el modelo `.glb`; el
  > **perfil** del mando se seguía descargando, la CSP lo bloqueaba y eso dejaba el
  > visor sin mandos. Ver "Segunda prueba en visor". La ruta **sí** se puede redirigir
  > desde `createXRStore`: acepta `XRControllerLayoutLoaderOptions`, y `baseAssetPath`
  > es justo lo que ahora apunta a `public/webxr-profiles/`.
- `LICENSE` MIT, CI (lint/tipos/unitarios/e2e), Dependabot, y `maximumScale: 1` fuera.

**Pendiente y no resuelto:**

- ~~`npm audit` con 5 high por `next@16.2.12`~~ **RESUELTO (2026-08-04)**: salió
  `next@16.3.0` y con él desaparecen los avisos que arrastraba `sharp`/libvips. `npm
  audit fix` (sin `--force`, sin salirse de los rangos declarados) cerró además `postcss`
  y `brace-expansion` en dependencias de desarrollo. **0 vulnerabilidades.**
- ~~El email personal en el historial~~ **RESUELTO (2026-08-03)**: se reescribieron los
  28 commits que lo llevaban con `git filter-branch --env-filter`, cambiándolo por
  `100352899+cpl121@users.noreply.github.com`. El árbol quedó **idéntico** (mismo hash
  de árbol antes y después: solo cambiaron metadatos de autor) y se hizo `push --force`
  sobre `main`. `git config user.email` ya apunta al noreply para que no vuelva a
  colarse. **Cerrado del todo el 2026-08-06**: se borraron también las ramas del remoto
  que lo conservaban, así que hoy `origin` solo tiene `main` y ningún commit publicado
  lleva el email personal.
- `.claude/` y `.organizate/install-state.json` se publicarán y dejan ver el tooling
  interno. Sin secretos, pero es una decisión.

## Pendiente / próximos pasos

- Validar y pulir la interacción XR con mandos en hardware real.
- Posibles mejoras: animación de "vibración" de los palos colgando,
  temporizador/puntuación por tiempo, escenario VR más elaborado.
- **Decidir si un palo debe poder atraparse mientras aún cuelga.** Hoy `Stick.handleCatch`
  acepta los estados `hanging` y `falling`, así que se puede vaciar el aro a clics nada más
  empezar, sin esperar a que caiga nada. Puede ser deliberado (premia la puntería), pero con
  13 palos en Fácil convierte la partida en trivial. Si se cierra a `falling`, hay que ajustar
  el e2e "atrapar un palo suma en el marcador", que hoy se apoya en los palos colgados.
  Mitigado a medias desde la cuenta atrás: durante esos tres segundos ya no se puede coger
  nada, y el bonus por reflejos premia cogerlos arriba, no esperarlos abajo.
- **Nada de worktrees anidados dentro del repo.** Además de los avisos de "multiple
  lockfiles" al compilar, si el worktree llega a tener un `.next/` compilado el `npm run
  lint` lo recorre entero: los `globalIgnores` de `eslint.config.mjs` son relativos
  (`.next/**`) y no alcanzan `.claude/worktrees/*/.next/**`. Salían >13.000 problemas,
  ninguno del proyecto. Se resolvió eliminando el worktree, no tocando la config.

## Caveats y notas

- El Canvas R3F se carga con `dynamic(..., { ssr: false })`; depende de WebGL/`window`.
- El `GameProvider` se monta a nivel de página (no en el root layout) para no
  arrastrar contexto cliente a la página interna `/_global-error`.
- El puerto 3000 puede estar ocupado por otro proceso del sistema; usar `PORT=...`
  para `npm run start` si hace falta.
