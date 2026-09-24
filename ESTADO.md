# Estado de la sesión — stick-rush (handoff)

> **Cómo continuar tras reiniciar:** di a Claude «revisa `ESTADO.md` y continúa con el siguiente
> paso». Este fichero es la memoria entre sesiones: mantenlo corto, veraz y al día.
>
> El **backlog** (qué falta por hacer) vive en **`TODO.md`**. Aquí va el estado y el
> porqué de las decisiones; allí, la lista de tareas.

---

## 📍 Tanda del visor del 24/09 (en develop, sin versión; la última es v0.21.0)

«Está perfecto», con cuatro retoques. Hecho:

- **Un minipaso atrás**: `PLAYER_OFFSET_Z` −0,02 → **+0,08** (`lib/gameConfig.ts`). El signo
  importa: negativo es *hacia* el arco (a −0,18 se arrancaba encima de la máquina), así que el
  paso atrás es positivo. El palo del frente queda a 65 cm en horizontal (brazo: 75).
- **Máquina más alta**: `HOOP_RISE_ABOVE_EYES` 0,35 → **0,5** (`lib/hoopHeight.ts`), ya
  desacoplado de `MACHINE_HEIGHT` (escritorio sigue en 1,95). La velocidad se escala con el
  recorrido, así que la dificultad no cambia. El invariante de alcance pasa a ser «cada palo
  **cruza** el brazo al caer, ≥ 40 cm de franja» (`hoopHeight.test.ts`), no «colgado al alcance».
- **Manos en VR, montadas por la escena** (`components/xr/ManosDelJugador.tsx`, lógica en
  `lib/manos.ts`), no por el `XRStore`: lo del store solo existe en la web propia y en el salón
  el store es del salón, que no dibuja manos. Así salen igual en los dos sitios. Se colocan como
  `MandoDeVerdad` (pose de WebXR con los padres deshechos, `colocarEnElOrigen`).
  - Con mandos, un **guante** low-poly procedural en el `grip-space` (`Guante.tsx`, lógica en
    `lib/guante.ts`): 16 cajas en una `InstancedMesh`, cierra el puño con el lateral y el índice
    con el gatillo; las yemas llevan la ayuda del agarre. Ya **no** va en `StickRushController`
    (que sigue dibujando el mando y los punteros solo en la web propia).
  - Sin mandos, la **mano articulada** `generic-hand` hueso a hueso (`fillPoses`), cargada sin
    suspender desde `public/manos/generic-hand/` (190 KB; `npm run sync:xr-profiles`). Va **fuera
    de `webxr-profiles/`** porque el salón borra esa carpeta de cada juego al instalarlo
    (`xrcade/scripts/install-game-assets.ts`); `copy-assets.mjs` copia ya `manos/`. El store
    propio queda con `hand.model: false` para no pintarla dos veces.
  - **No se tocó xrcade** (opción B): encender `hand.model` en el salón cambiaba los dieciséis
    juegos, todos con `hand.model: false` a propósito, y cinco dibujan su herramienta en la mano
    desnuda (arco, pistola, pala, dos mazos).
  - e2e nuevo con **anfitrión de prueba** (`e2e/support/host*.ts(x)`, `globalSetup.ts` común con
    ocho juegos): escena en Canvas ajeno, store sin mando ni mano como el del salón. Comprueba
    guante en la mano (±12 cm), manos desnudas visibles, `.glb` pedido bajo el prefijo del juego.
- **Columna de ajustes** (regla común): el menú del visor pasa de estar de frente a 95 cm a
  **1,5 m y 55° a la izquierda**, a la altura de los ojos, de cara y escalado ×1,35
  (`XR_COLUMN`, `XR_MENU_POSE`, `onMenu` en `lib/xrLayout.ts`). Sin visor (salón en escritorio)
  sigue delante (`XR_MENU_DESK_POSE`). La zona muerta del anclaje se alarga hacia la izquierda lo
  que está apartada la columna (`leftDeadzone`, `lib/xrAnchor.ts`): si no, mirarla la hacía huir.
  El aviso de dejar la partida se queda delante.
- **Hápticos por contacto** (`lib/tactos.ts` común + `lib/haptics.ts`): atrapar = `agarre` en la
  mano que coge, ×1,8 si es in extremis (≥ 80 % de la caída). El palo que se escapa ya no vibra
  (`XRHaptics` borrado). Se conserva el toque del botón del menú (no es un contacto).
- **Mando junto al gesto**: no aplica tal cual (stick-rush no tiene `Ayudas.tsx`); la ayuda del
  agarre va en la mano dibujada.

**Pendiente de visor:**

| Qué mirar con las gafas | Dónde se toca |
|---|---|
| ¿El paso atrás es el justo? ¿Se llega al palo del frente? | `PLAYER_OFFSET_Z` (`gameConfig.ts`) |
| ¿Máquina a buena altura? ¿Cuelgan por encima de la cara? | `HOOP_RISE_ABOVE_EYES` (`hoopHeight.ts`) |
| Columna: distancia, ángulo, tamaño; ¿estorban los palos que cuelgan delante de ella? | `XR_COLUMN`, `XR_MENU_SCALE` (`xrLayout.ts`) |
| ¿Se lee el guante como mano? ¿Se ve cerrarse? Posición sobre el mando real. **En el salón va sin mando dibujado debajo** (el del juego es del store propio): ¿se entiende así? | `PALMA`, `NUDILLOS`, `PULGAR` (`Guante.tsx`); `REPOSO`, `VELOCIDAD_DE_CIERRE` (`guante.ts`) |
| Manos desnudas, en la web y en el salón: ¿el modelo encaja con la mano real? | `ManosDelJugador.tsx` (`ManoDesnuda`) |
| ¿Se nota el atrape? ¿Y el in extremis distinto? | `IN_EXTREMIS`, `IN_EXTREMIS_BOOST` (`haptics.ts`); recetas en `tactos.ts` (común) |

**En el salón, con manos desnudas no se atrapa**: el salón tiene `hand.grabPointer: false` a
propósito, y el agarre de stick-rush es ese puntero. Se ve la mano pero no coge. Es decisión
del salón (no se tocó); si se quiere, es activarlo ahí mirando los otros dieciséis.

Ojo con la columna: los palos cuelgan del aro entre quien juega y el panel (a 55° hay 3–4 con
13 palos), y su mitad de arriba se ve entre barrotes. Ya pasaba de frente. Si molesta, la regla
deja ir más allá, nunca más cerca.

## v0.7.2 (2026-09-07): los tests dicen ahora cuánto código ejecutan

- **La suite mide su propia cobertura** (`npm run coverage`, y un paso más en CI). Se mide
  **el dominio** (`src/lib`), que es lo único que se puede probar sin un navegador con WebGL;
  la escena se prueba de extremo a extremo.
- **Está al 100 %, y el mínimo es 100**: lo que se añada sin probar rompe el build. Las pocas
  ramas que ningún test puede alcanzar —guardas que solo actuarían si cambiara el código de
  al lado— llevan `v8 ignore` con el motivo escrito al lado, no un número más bajo.
- Para llegar ahí se escribieron tests de lo que no probaba nadie: el almacenamiento cuando el
  navegador no deja guardar, el motor de sonido contra un `AudioContext` de mentira, el panel
  del visor y el estado de la partida con relojes falsos.
- El informe HTML queda en `coverage/`, que no se commitea.

## Dónde estábamos el 2026-09-06 (superado: hoy va por v0.21.0)

**El juego está publicado y montado en el salón de xrcade.** Los tags `v0.2.0` a `v0.5.0`
existen y están en `origin`; xrcade tiene que pasar a **`v0.6.0`**.

**`v0.6.0` (2026-09-06): la feria responde al jugador.** Había noria y casetas pero nadie
dentro: ahora hay **público** —42 siluetas (cuerpo y cabeza fundidos en una geometría, una
familia instanciada con `createInstances` = **una llamada de dibujo**), en un anillo entre las
guirnaldas y las casetas, mirando a la máquina (`lib/crowdLayout.ts`, `components/game/Crowd.tsx`)—
que se mece más alto y más deprisa con la racha. Y las **bombillas** de casetas y guirnaldas
suben de brillo con la racha (1,6 → 3,2, saturando) y a partir de **5 palos seguidos palpitan**
hacia el blanco, más rápido cuanto mayor la racha (`lib/fairMood.ts`, `BulbMood` en
`FairPieces.tsx`): se toca el material de la familia entera, así que cuesta lo mismo con cien
bombillas que con mil. La racha llega al recinto por un **ref** (`FairMood.tsx`) y no por props:
el decorado no se vuelve a renderizar por nada que pase en la partida. Con
`prefers-reduced-motion` el público se queda quieto y las bombillas no palpitan (el brillo sí
sube, que eso no se mueve). La escena pasa de 29 a **30 llamadas en el menú**; el desglose vive
en `e2e/recinto.spec.ts`. **Nada de esto está probado con las gafas.**

**`v0.5.0` (2026-09-06): tres modos.** Además de práctica y desafío, **Niveles**: una
escalera propia de 15 niveles (`levels.ts`: 5/9/13 palos por cada velocidad), sin vidas,
puntuados con estrellas (60/80/100 % atrapados) y con el desbloqueo y las estrellas guardados
entre visitas (`progress.ts`, `createStoredPreference` en `storage.ts`). Y la práctica gana
**Sin fin**: como los palos se crean de golpe, funciona por **tandas** (`stickSeed` cambia con
cada tanda y la máquina se recarga; `waveScore/waveResolved` cuentan la tanda, `score/resolved`
la partida); la termina el jugador («Terminar», o el botón verde a la derecha en el visor) y lo
que se guarda es la **mejor racha**. En el visor el interruptor de modo recorre los tres, la
fila de palos se convierte en la escalera en Niveles, y hay un interruptor de tanda/sin fin en
medio de la fila de ajustes. El desafío sigue igual: el modo heroico con vidas. **Nada de esto
está probado con las gafas.**

`develop` = `origin/develop`; `main` va **31 commits por detrás** y es lo que despliega Vercel.
Publicar a `main` (`git merge --ff-only develop && git push origin main`) es una decisión tuya
tras la sesión con el visor.

Verificado hoy: lint y typecheck limpios, **538 unitarios** y **77 e2e** en verde,
`npm audit` sin vulnerabilidades. El detalle de cada tanda —qué se probó con las gafas, qué se
decidió y por qué— vive en **`docs/historial.md`**, que solo se lee si la pregunta es «por qué
está esto así».

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
   (`MASTER_GAIN`, 0.28) no resulte invasivo pegado a los oídos; (h) que los tres
   **golpes de vibración** se distingan sin mirar y no acaben molestando (las tres
   recetas, en `src/lib/haptics.ts`): el del acierto con el brazo en movimiento y sin
   que una racha larga lo vuelva un zumbido (`CATCH_PULSE`, 0.7 y 45 ms); el del
   fallo, que sale por los dos mandos y tiene que leerse como otra cosa y no como un
   acierto flojo (`MISS_PULSE`, 0.35 y 140 ms); y el de los botones del menú, que con
   trece palos son trece pulsaciones seguidas (`PRESS_PULSE`, 0.25 y 18 ms);
   (i) que la **marca del récord**
   sobre la barra de puntuación se distinga del relleno con las gafas puestas, y que
   al batirlo se note que la barra cambia (`ScoreBar` en `src/components/xr/XRHud.tsx`);
   (j) que el **recinto de feria** nuevo no se coma los fotogramas en el visor, que las
   casetas no agobien a 6.4 m y que la noria girando en la periferia no maree. El coste de
   dibujo ya está medido y descarta el recinto, así que el guion de qué mirar y qué
   constante tocar en cada caso está en "Validar el recinto en el visor"; radios y
   distancias, en `src/lib/sceneryLayout.ts`.
   (k) que el **botón de compartir** de la pantalla de fin funcione con las gafas
   puestas: si el visor abre la hoja del sistema, que se pueda usar sin quitárselas;
   si no, que el avión de papel pase a marca de verificación (texto copiado) y que al
   quitarse el visor el resultado esté de verdad en el portapapeles. El aspa roja
   significa que el navegador del visor no deja ni compartir ni copiar: si sale, hay
   que decidir qué se hace en su lugar. El emulador no puede pulsar botones 3D, así
   que esto **solo se valida en hardware** (`ShareButton` en
   `src/components/xr/XRHud.tsx`).
   (l) que el **botón de empezar** ya enseñe un triángulo de reproducir —hasta ahora se
   veía de canto— y que se lea a esa distancia con los 3,2 cm de radio que tiene el
   dibujo; y que la **interfaz a la altura de los ojos** caiga bien de pie y sentado: que
   el panel no se cruce con la máquina si juega alguien alto, que el marcador no quede
   demasiado bajo jugando sentado en el suelo, y que la fila del ajuste del aro siga
   cómoda de mirar (ver "Menú inmersivo: el triángulo y su altura"; `xrUiRise` en
   `src/lib/xrLayout.ts` es lo que hay que retocar si el conjunto queda alto o bajo).
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
5. ~~Consolidar git en local.~~ **HECHO (2026-08-06).** Solo quedan `main` y `develop`,
   las dos en el mismo commit y sin worktrees sueltos. Se borraron las seis ramas ya
   integradas y el worktree muerto de `agent/inicializar-proyecto-…` (693 MB; sus 22
   ficheros en staging eran el scaffold del 28 de junio, con Zustand, que el proyecto
   descartó). Antes de forzar cada borrado se comprobó que la rama no tuviera ni un
   fichero fuera de `main`; en el caso de `fix/xr-mandos-y-menu-visible` se verificó
   además que su árbol fuera **idéntico** al del merge de la PR #10.

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
- **La versión de Node se fija en `.nvmrc` (hoy 24.19.0) y el CI la lee de ahí**
  (`node-version-file`, no `node-version`). El formato del `package-lock.json` cambia
  entre versiones de npm: con el CI en Node 22 (npm 10) un `npm install` reescribía unas
  220 líneas del lock, generado con npm 11. El patch va fijado a propósito —dejarlo en
  `24` a secas volvería a dejar la versión de npm al azar—, así que subirlo es un cambio
  manual: al hacerlo, comprobar que `npm install` sigue dejando el lock intacto.
- `build` fija `NODE_ENV=production` en el script porque el entorno exporta
  `NODE_ENV=development`, que rompía la prerenderización de `/_global-error`.
- **Un palo se coge hasta que toca el suelo, colgando incluido** (decidido el
  2026-08-10). Adelantarse al palo es jugar, no hacer trampa: la ventana se abre
  al arrancar la partida y se cierra cuando el palo se resuelve. Lo que se
  cierra es el otro extremo: un palo ya resuelto no vuelve a contar (el perdido
  se queda tirado, pero es decorado) y con la partida parada —cuenta atrás
  incluida— no se coge nada. Que 13 palos en Fácil se puedan vaciar del aro es
  aceptado a cambio de dos contrapesos que ya existen: la cuenta atrás y el
  bonus por reflejos, que paga el doble por cogerlo arriba. La regla vive en
  `canCatchStick` (`src/lib/xrInteraction.ts`) y la fijan unitarios; el e2e "un
  palo que todavía cuelga del aro se puede atrapar" comprueba que el juego la
  cumple de verdad, con un clic sobre un palo sin soltar. El cursor
  de escritorio la sigue también cuando la ventana se abre o se cierra sola bajo
  un puntero quieto (acabar la cuenta atrás, el palo que toca el suelo): un
  `useEffect` en `Stick` la revisa, porque sin mover el ratón no llega ningún
  `pointerover` nuevo.

## Hecho hasta ahora

- **La interfaz de dentro de la escena ya se ve cuando lo monta el salón.** Se escondía siempre
  que no había sesión de WebXR, porque en la web propia manda el DOM y sus botones cazarían los
  clics del ratón por delante del juego. Pero el salón de xrcade **no pone DOM**: montado ahí y
  sin visor, el juego se veía entero y no había forma de empezar la partida. Ahora lo decide
  `hasDomUi` —lo pasa quien monta la escena, no lo adivina el juego—, como en los juegos nuevos.

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

Desde esa primera versión han entrado, tanda a tanda: el rediseño de la máquina a escala
humana con el aro horizontal, la jugabilidad XR con agarre por cierre de mano y menú
inmersivo, puntuación con cuenta atrás, sonido y vibración, modo práctica y modo desafío,
el recinto de feria como escenario VR con la máquina instanciada, el tutorial de la primera
vez, la altura del aro por jugador, compartir el resultado, el récord y el silencio
recordados, y la separación del juego de su web para que xrcade lo monte como escena. El
porqué y lo que quedó por comprobar de cada una está en `docs/historial.md`.

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

## Caveats y notas

*(La lista de tareas pendientes está en **`TODO.md`**. Aquí solo quedan las trampas del
entorno: no son tareas, son cosas con las que tropezar.)*

- **Publicar una versión nueva** va por tag sobre `develop` (`v0.2.0`, `v0.3.0` y `v0.4.0` ya
  están): el procedimiento y la comprobación de que la `version` coincide con el tag están en
  «Publicar una versión nueva» de `docs/montar-el-juego.md`. xrcade lo sube con
  `npm run game:update`.
- **xrcade instala este repo privado** con las credenciales de git de la máquina; su CI usa un
  token de organización (`XRCADE_GAMES_TOKEN`). Decidido y escrito en xrcade.
- **Probar el montaje de verdad desde xrcade**, con el visor puesto: que la sesión
  inmersiva, los mandos y el audio sigan funcionando dentro de otra aplicación, que es un
  contexto distinto del de aquí y no se puede validar en este repo.
- Validar y pulir la interacción XR con mandos en hardware real.
- **Probar en el visor la altura del aro** (ver "Altura del aro por jugador"): que de pie
  quede donde estaba, que sentado baje solo y no haya que tocar nada, que los ±20 cm de
  `HOOP_ADJUST_RANGE` basten para acomodarlo y no dejen ningún palo lejos, y que la fila
  de arriba del panel no obligue a estirar el cuello (queda 10 cm por encima de los ojos,
  y el límite del test son 15).
- ~~**El menú inmersivo sigue a altura fija** (`XR_MENU_POSITION`, 1.40 m).~~ **HECHO**:
  la interfaz entera cuelga ahora de los ojos del jugador, ver "Menú inmersivo: el
  triángulo y su altura". Falta probarlo con las gafas.
- **Probar en el visor el tutorial de la primera vez** (ver "Tutorial de la primera
  vez"): que el mando de la demostración se lea a 95 cm y se reconozca como el que se
  tiene en la mano, que dos ciclos de agarre basten para entender el gesto, que 13 palos
  en fila se cuenten de un vistazo, y que los 7,4 s no se hagan largos (el guion está en
  `TUTORIAL_STEPS`: repartir distinto no toca ningún componente). Mirar de paso los dos
  solapes anotados en esa sección —el mango sobre la barra de progreso y las barras de
  «Imposible» saliéndose de la ficha— y el botón de recuperarlo, que es el único mando en
  miniatura del menú y nadie ha visto todavía si se entiende.
- Posibles mejoras: ~~animación de "vibración" de los palos colgando~~ (hecha, ver
  "Balanceo de los palos"), temporizador/puntuación por tiempo, ~~escenario VR más
  elaborado~~ (hecho, ver "Escenario VR: recinto de feria").
- ~~**Decidir si un palo debe poder atraparse mientras aún cuelga.**~~ **DECIDIDO
  (2026-08-10): sí, se coge hasta que toca el suelo.** Ver "Decisiones firmes". El
  comportamiento no cambia; lo que cambia es que la regla dejó de estar escrita dos veces
  dentro de `Stick.tsx` (captura y cursor) y pasó a `canCatchStick`, con unitarios que la
  sujetan. El e2e "atrapar un palo suma en el marcador" se queda como está: se apoya en los
  palos colgados, que siguen siendo atrapables a propósito, aunque no lo exige (el barrido
  vale igual para uno que cae). Lo exige uno nuevo, "un palo que todavía cuelga del aro se
  puede atrapar": si algún día la ventana se cierra a `falling`, es el que se pone rojo.
- **Nada de worktrees anidados dentro del repo.** Además de los avisos de "multiple
  lockfiles" al compilar, si el worktree llega a tener un `.next/` compilado el `npm run
  lint` lo recorre entero: los `globalIgnores` de `eslint.config.mjs` son relativos
  (`.next/**`) y no alcanzan `.claude/worktrees/*/.next/**`. Salían >13.000 problemas,
  ninguno del proyecto. Se resolvió eliminando el worktree, no tocando la config.
- El Canvas R3F se carga con `dynamic(..., { ssr: false })`; depende de WebGL/`window`.
- El `GameProvider` se monta a nivel de página (no en el root layout) para no
  arrastrar contexto cliente a la página interna `/_global-error`.
- El puerto 3000 puede estar ocupado por otro proceso del sistema; usar `PORT=...`
  para `npm run start` si hace falta.
