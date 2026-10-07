# Stick Rush en Godot

El mismo juego para el hub nativo de xrcade (Steam), con **la lógica de `src/lib` sin
reescribir**: la ejecuta GodotJS dentro del motor. Aquí solo hay escena, entrada e interfaz, sobre
el kit común de `xrcade/godot-kit/`. (Sustituye al prototipo en GDScript que había en esta carpeta,
escrito desde cero sobre el diseño antiguo de la máquina.)

**Estado: se juega entero, en plano y con visor simulado; con visor de verdad no se ha probado.**
Los palos cuelgan del aro donde los pone `buildStickLayout` con la semilla de la tanda, esperan su
turno meciéndose (`hangingSwing`), se sueltan y caen **desde el reposo, acelerando**, con la
aceleración que hace que cada dificultad dure lo mismo que en la web (`fallAcceleration`,
`hoopFallSpeed`); la física de Godot no se usa. Se cogen **colgando o cayendo, hasta que tocan el
suelo** (`canCatchStick`), y cuánto llevaban cayendo en tiempo decide el bonus de reflejos
(`stickFallProgress`, `scoring.ts`). Lo que en la web hace cada `Stick.tsx` fotograma a fotograma es
`scene/juego/tanda.ts`, y la partida es el `gameStore.ts` de la web sin React
(`scene/juego/partida.ts`): práctica (tanda o sin fin, que recarga la máquina con otra semilla), los
quince niveles con sus estrellas y el desafío con tres vidas; récord, racha sin fin, estrellas,
altura del aro y tutorial visto con el guardado del kit.

Se empieza en el **menú del visor de la web** (`XRMenu.tsx`, con las cotas de `lib/xrLayout.ts` sin
tocar una): el aro (bajar, la regla, subir) con volver a ver el tutorial, el modo con lo que pone en
juego, tanda o sin fin, la plaza o tu habitación, los trece palos en miniatura o la escalera de
niveles, las cinco fichas de velocidad, jugar y **salir en la esquina de abajo a la derecha**. Sin
letra en los botones, como en la web; en letra, los nombres de las filas y la explicación del modo.
Jugando, **el marcador de la web** (`XRHud.tsx`): una ficha por palo, la racha, la barra de puntos
con la marca del récord, las vidas o las estrellas; volver al menú (que **pregunta antes**) y
terminar la partida sin fin; la cuenta atrás con sus tres anillos; y al acabar, repetir y volver.

**La máquina** es la de `StickMachine.tsx`: el aro a rayas, la celosía con su aro de arriba,
montantes y diagonales, las bombillas y los postes arriostrados, con las piezas en mallas múltiples,
y se rehace si el aro cambia de altura (solo en el menú). **Los palos**, de madera pintada con el
relieve y la rugosidad de la web; al atraparlos se ponen verdes, crecen y se desvanecen con su onda;
el que se escapa se queda en el suelo, teñido de rojo. Alrededor, **la feria**: la plaza de noche del
HDRI de la web de fondo y de reflejos, **las piezas del kit de assets** (`public/models/kit/`: seis
puestos, ocho farolas y sus banderolas, donde las pone `feriaKit.ts`, con el color en los vértices),
las guirnaldas de bombillas, **el público** de `crowdLayout.ts` (42 siluetas en una malla múltiple
que se mece en el shader) y la noria girando. Las bombillas y el público se animan con la racha
(`fairMood.ts`). **Tu habitación** (`xrcade:scenery`) oculta la feria y deja la máquina, solo con
realidad aumentada en el visor.

En plano se coge **con el ratón**, un clic sobre el palo al apretar, como en la web; la cámara es la
de `GameCanvas.tsx` y los paneles cuelgan de ella.

Con visor usa **la gramática XR del kit** (`@kit/runtime/xr/jugador`): la máquina se planta donde la
presta el salón, baja a los ojos de quien juega sentado y **gira por pasos con el stick de la mano
libre**. **Los palos se cogen con la mano**: al apretar el gatillo lateral de cualquiera de los dos
mandos, el palo que queda en la esfera de agarre del puño —la de la web, 9 cm
(`CONTROLLER_GRAB_RADIUS`)—; el rayo es solo para el menú. Sin `agarre.ts` en la web, el kit sujeta
mientras se aprieta, y las manos desnudas se miran con su `manoDesnuda`. De pie, el aro se planta medio metro por
encima de los ojos medidos en el menú (`XRPlayerHeight.tsx`, `hoopHeight.ts`); sentado a los ojos, el
mundo baja y el aro se queda en su cota. Vibra con la receta de la web (`pulsosDelAtrape`: el
agarre de `tactos.ts`, más fuerte in extremis) en la mano que coge. **Las ayudas** del guion de la
web (`guionDeAyudas.ts`): las huellas, el palo fantasma cayendo y el mando de verdad a su lado con el
agarre latiendo; y **el tutorial** de la web —coger un palo, y otro de los de los lados—, que se
aprende jugando, con su plazo por paso, y enciende el botón en **el mando de verdad de las dos
manos**.

Suena con los efectos de la web renderizados de su `sound.ts` tal cual (el render del kit le pasa el
contexto, `"context": true`): la nota del atrape que sube con la racha (ocho ficheros), el palo perdido, los tres
segundos de la cuenta atrás, la salida, el final (ganar, perder o terminar) y el récord, con la regla
de `useGameSound.ts` (`juego/sonido.ts`); y la música de la feria con su fundido. El idioma y los
volúmenes son los del salón, del guardado.

**El menú abre en el reto** y **el objetivo se lee de frente, bajo la máquina**
(`interfaz/cartel.ts`): el cartel de la web con lo que dice `objetivo.ts` y en el sitio de
`cartelDeLaMaquina.ts`, encima del marcador —la misión hasta el primer palo, lo que se lleva, las
vidas y los palos que quedan mientras se juega, lo que faltó al acabar—, del mismo tamaño en el
ojo que en la web; el marcador calla lo que el cartel ya dice (sin barra, sin vidas y sin la letra
del final). Al cruzar un listón el cartel cambia de color, crece y vuelve, suena (`medal-*`) y se
nota en la mano buena. En plano cuelga de la cámara, arriba en medio. **Los listones de medalla
llegan del salón nativo**: `main.ts` lee el metadato `goal` del autoload `XRcade` con el
`objetivoDe` del kit (lo mismo que su `base.objetivo()`, la prop `objetivo` de la web) y se lo pasa
a la `Partida`; con él el cartel dice los listones, celebra cada medalla y dice «no cuenta» fuera
del modo del récord. Sin salón, o si no le pone medallas, dice la misión y el récord guardado. Lo
fija `tests/partida_auto.gd`, con el metadato y sin él.

**El reto del salón** (`semilla.ts`): con `-- --reto=<semilla>`, o si el autoload `XRcade` lleva
`challenge_seed`, se entra directo en **el desafío** (el modo del récord de la cabina), sin menú ni
tutorial, con el reparto y el turno de los palos sacados de la semilla. Al acabar cada partida se
imprime `STICK-RUSH-RESULTADO {modo, puntos, reto}` y se llama a `report_result(json)` del salón.

**La partida a dos**, como en la web (`lib/duel.ts`): en el desafío, el botón de **contra quién**
—en el hueco de sin fin, con una ficha sola o dos enfrentadas, el icono de los hermanos— elige solo
o a dos pasándose el mando. A dos, cada uno juega su tanda **con la misma semilla** (los mismos palos
en el mismo orden); al acabar la primera sale delante **el aviso de pasar el mando** y el botón de
repetir empieza la tanda del otro; al acabar la segunda, quién gana —o el empate—, los puntos de los
dos y lo que lleva la pareja (`duelTally.ts`, guardado aparte), con el final que suena a ganar. El
récord del desafío no se toca, y al salón se le cuenta la partida entera una vez (`{modo: 'duel'}`).
Jugando, el marcador dice de quién es la tanda con la pareja de fichas.

Por qué existe y qué se midió: `xrcade/docs/salir-en-steam.md`, sección 4.

## Lo que se movió en la web

`highScore.ts` escuchaba el evento `storage` del navegador (`window`), así que el kit no dejaba
cargarlo en el motor. Lo que no toca el navegador —las claves, leer, escribir, guardar si mejora y la
racha sin fin— pasó a **`src/lib/marcas.ts`**, y `highScore.ts` lo reexporta tal cual y se queda con
la suscripción entre pestañas: la web importa lo mismo que antes, con sus gates en verde (tipos,
lint, cobertura al 100 % y los e2e). La escena importa `marcas.ts`.

## Qué hay

| Ruta | Qué es |
|---|---|
| `scene/main.ts` | La escena: la feria, la máquina, los palos, las tres formas de cogerlos (mano, ratón, jugador automático), la altura de los ojos, el sonido, lo que se siente, el reto y las capturas |
| `scene/juego/partida.ts` | La partida: el `gameStore.ts` de la web sin React (lo elegido, las fases, los contadores, las tandas sin fin, la partida a dos, la lección y su plazo, lo que se guarda y lo que se le cuenta al salón) |
| `scene/juego/tanda.ts` | Los palos de una tanda: lo que hace cada `Stick.tsx`, sin pintar |
| `scene/juego/alcance.ts` | Qué palo coge la mano (la esfera del puño) o el ratón (el rayo) |
| `scene/juego/sonido.ts` | Qué suena y cuándo (`useGameSound.ts`) |
| `scene/mundo/` | La máquina (`maquina.ts`), los palos pintados (`palos.ts`), la feria, la plaza y tu habitación (`feria.ts`) y las ayudas (`ayudas.ts`); las piezas sueltas y el escenario son del kit |
| `scene/interfaz/` | El menú, el marcador, el cartel del objetivo (`cartel.ts`), volver, terminar, el aviso, el final de cada tanda a dos (`PanelDelDuelo`), la cuenta atrás, el tutorial, los iconos de `xrIcons.ts` y el de contra quién, y dónde va cada panel con visor y en plano |
| `scene/**/*.motor.test.ts` | La partida contra el store de la web, la tanda contra `Stick.tsx` y el sonido contra `useGameSound.ts`, el mundo (y que lo del paquete es lo de la web byte a byte), y los paneles medidos con el instrumento de la web en los dos idiomas y pulsados con el ratón: corren con los tests de dominio |
| `godot-kit.json` | Para el kit: el id, el repo (`..`), los efectos (con la nota del atrape y la cuenta atrás en sus escalones) y la música |
| `games/stick-rush/` | Lo que va en el `.pck`; `tests/` se queda fuera al exportar |
| `games/stick-rush/{sfx,music,feria,texturas,hdri,mandos}/` | Los efectos renderizados (`npm run godot:sfx`), la música, las piezas del kit, la madera, la plaza y los mandos de Quest (`npm run godot:mandos`), con `CREDITS.md`. Se versionan. La plaza va comprimida para la GPU (BC6H y ASTC, 0,5 MB cada una en vez de 4) y la madera, sin pérdida y con sus mipmaps |
| `games/stick-rush/tests/partida_auto.*` | La partida automática entera (práctica, Difícil, nueve palos, uno que se escapa adrede): palos, puntos, récord, lo que suena, la máquina y la feria, y lo que se le cuenta al salón; el reto con la semilla del salón, que entra jugando, da el mismo reparto dos veces y se cuenta como reto; y la partida a dos entera (`--a-dos`): las dos tandas con la misma semilla, gana el primero (el segundo deja escapar uno más), se apunta a la pareja sin tocar el récord, al salón una vez y suena a ganar |
| `games/stick-rush/tests/menu_raton.*` | La escena de verdad con clics del ratón: velocidad, palos y aro, jugar, que un clic en un palo en la cuenta atrás no lo coge y jugando sí, que un clic al aire no coge nada, Escape, dejar la partida, el modo que pasa y salir |
| `games/stick-rush/tests/xr_mando.*` | Dos partidas con visor simulado cogiendo con las dos manos: diestro sentado en el salón y zurdo de pie. La mano de cada atrape y su pulso, la altura del mundo y del aro, el anclaje, el giro, el tutorial con el mando en las manos y las ayudas |
| `tests/run.sh` | Todo lo del motor de una vez (`npm run godot:test`) |

**Qué tests entran en el motor** lo decide el kit por el grafo de imports: 31 de los 48 ficheros de
`src/lib`, más los del kit y los del port: **830 tests**. `npm run godot:build -- --list-tests` dice
por qué no entran los otros 17 (los que usan `vi`, los que tocan `window` o leen el disco).

## Cómo se usa

Hace falta el editor de Godot 4.7.1 **compilado con GodotJS** (`xrcade/scripts/godotjs/`), en
`$GODOT`, y el repo de xrcade al lado (`../xrcade`). Desde esta carpeta:

```sh
(cd .. && GODOT=$GODOT npm run godot:test)     # todo lo del motor, de una vez
(cd .. && npm run godot:build -- --tests)      # escena y tests → games/stick-rush/
$GODOT --headless --editor --generate-types --path .   # typings/ para comprobar tipos
../node_modules/.bin/tsc -p tsconfig.json
$GODOT --headless --path . --import

# Los efectos, del sound.ts de la web (Chromium), y los mandos, de public/webxr-profiles/
(cd .. && npm run godot:sfx)
(cd .. && npm run godot:mandos)

# Una partida automática: imprime STICK-RUSH-RESULT con lo que ha pasado y el coste por fotograma
$GODOT --headless --xr-mode off --fixed-fps 72 --path . -- --autoplay

# El reto con una semilla
$GODOT --xr-mode off --path . -- --reto=4242

# Jugar en plano con el ratón (clic en un palo para cogerlo, Escape para preguntar o salir);
# `--lang=es|en`, `--tutorial` y `--ayudas` los enseñan en plano, `--habitacion` enseña tu habitación
$GODOT --xr-mode off --path .

# Con cualquier argumento de usuario (o desde una escena de test) se guarda aparte, en
# user://pruebas-de-la-escena/ y de cero (`aislarElGuardado` del kit): nada toca el guardado de quien juega.
# Capturas en plano: el menú, a mitad de partida, el final, el tutorial y las ayudas (desde un lado)
$GODOT --xr-mode off --resolution 1280x720 --path . -- --shot-menu=/tmp/menu.png --lang=es
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 60 --path . -- --autoplay --shot=/tmp/partida.png
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 60 --path . -- --autoplay --shot-menu=/tmp/final.png
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --shot-tutorial=/tmp/tutorial.png --lang=es
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --shot-ayudas=/tmp/ayudas.png
# A dos (`--a-dos`: el desafío y a dos elegidos): el menú, el aviso de pasar el mando tras la primera
# tanda del jugador automático, y quién gana al acabar la segunda
$GODOT --xr-mode off --resolution 1280x720 --path . -- --a-dos --shot-menu=/tmp/a-dos.png --lang=es
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --autoplay --a-dos --shot-menu=/tmp/pasa.png
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --autoplay --a-dos --shot-duelo=/tmp/gana.png

# Lo que se vería con el visor, sin visor: la cabeza de mentira hace de cámara y el jugador
# automático coge con las manos. `--menu` se queda en el menú, `--mirar=<grados>` gira la cabeza a
# la izquierda (la columna está a 55°) y `--bajar=<grados>` baja la vista (el marcador)
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --visor-simulado --menu --mirar=55 --shot-menu=/tmp/columna.png
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --visor-simulado --bajar=25 --shot=/tmp/visor.png

# El .pck para el hub (ejecuta antes el build)
GODOT=$GODOT ../../xrcade/scripts/pack-game.sh "$PWD" stick-rush
```

Stick Rush está en el catálogo del hub de visor (`targets.godot` en
`xrcade/registry/games/stick-rush.json`): `npm run godot:test` de xrcade lo empaqueta desde aquí y
comprueba que el hub lo monta, le cede la pantalla y vuelve al salón.

## Lo que se sabe y lo que falta

- **Coste por fotograma** (escena entera: la partida, la tanda, los palos pintados, la feria, las
  ayudas, el sonido y la interfaz), partidas automáticas a 72 fps en macOS (M5 Pro, sin ventana):
  **~145–160 µs de media jugando** en plano (~320 µs de pico) y **~255 µs** con visor simulado (suma
  la gramática XR, las ayudas, el tutorial y los mandos en las manos). El marcador y el menú solo se
  reescriben cuando cambian, y los palos solo tocan el motor si se han movido. Con las piezas y el
  escenario del kit, ~115 µs jugando en plano y ~170 µs con visor simulado (medido con el mismo
  guardado antes y después: igual).
- **Diferencias con la web, a propósito**: los paneles son opacos (translúcidos, en Godot se
  transparentan mucho más) y no dan sombra, y como en la web nada de la máquina ni de la feria da
  sombra (las piezas del kit no la dan si no se pide); en plano los paneles cuelgan de la cámara (en la web los
  sustituye el DOM); el menú no lleva los interruptores de sonido y música (son los volúmenes del
  salón) ni el final el de compartir (en el visor no hay portapapeles); **el final lleva letra** —cómo
  ha acabado y los puntos, con las frases de `HUD.tsx`—, que la web del visor no puede escribir; la
  interfaz se queda donde se plantó el mundo en vez de seguir la mirada (`XRGazeAnchor`); las huellas
  van dos milímetros por encima del suelo, porque Godot no tiene `polygonOffset` para lo translúcido;
  y la plaza del HDRI va de fondo, sin proyectarla sobre el suelo (`ground` de drei).
- **No está**: el guante y la mano articulada dibujados (`ManosDelJugador.tsx`; con mandos se ve el
  mando de verdad solo durante el tutorial), coger con la mano desnuda (Stick Rush no tiene
  `pellizco.ts`, y el salón también lo tiene apagado), la cortina al cambiar de escenario
  (`SceneryFade`), el precalentado de shaders (`Calentar`) y `prefers-reduced-motion` (Godot no lo
  da: los palos se mecen y el público baila siempre). La luz se ha llevado de las intensidades de
  three a las de Godot con una escala por luz (`ENERGIA_POR_UNIDAD` de `feria.ts`), puesta a ojo sobre
  las capturas del port: falta compararla lado a lado con la web.
- **Lo que solo puede decir el visor**, además de lo de `salir-en-steam.md` 4.2 y 4.3:
  1. **Coger con la mano**: que la esfera de agarre de 9 cm en el `grip` de OpenXR caiga donde se
     cierra la mano, y que apretar el gatillo lateral sobre un palo que cae lo coja como en la web.
  2. **La altura del aro**: medio metro sobre los ojos medidos en el menú, de pie; sentado a los
     ojos, en su cota con el mundo bajado. Que los palos crucen el alcance del brazo en los dos.
  3. **Lo que se siente**: el agarre en la mano que coge, y el in extremis más fuerte.
  4. **La columna a la izquierda** (55°, 1,5 m, ×1,35) con los palos cruzando por delante, y el
     marcador bajo el aro: que se leen con la letra del motor.
  5. **El tutorial** por encima del marcador y el mando de verdad en las dos manos, y **las ayudas**:
     las huellas, el palo fantasma y el mando junto a él.
  6. **La plaza del HDRI de fondo sin proyectar** sobre el suelo, la luz de la feria y el público
     meciéndose en el shader a 72 fps en el Frame.
  7. **Sentado**: que el giro de 30° con el stick de la mano libre deje ver la máquina entera.
