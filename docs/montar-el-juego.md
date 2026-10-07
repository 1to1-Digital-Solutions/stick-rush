# Montar Stick Rush dentro de otra aplicación

Stick Rush es dos cosas en el mismo repositorio:

- **El juego** (`src/game`, `src/components`, `src/lib`): un componente de React que se monta
  donde le digas. No sabe de rutas, ni de layout, ni de metadatos, ni de despliegue.
- **Su web** (`src/app`): una aplicación Next que monta ese componente a pantalla completa. Se
  despliega sola y es la forma de desarrollar el juego y de probarlo con el visor.

Este documento es el contrato de lo primero: lo que hay que hacer para montar el juego desde
fuera. Es lo que consume [xrcade](https://github.com/1to1-Digital-Solutions/xrcade), que lo carga
DENTRO de sí mismo en vez de enlazarlo: un `<iframe>` a otro dominio rompe la sesión inmersiva al
entrar y al volver.

## 1. Instalar una versión fija

El juego se consume por **tag del repositorio**, no copiando código. Actualizarlo en el salón es
subir esa versión y volver a instalar:

```bash
npm install "github:1to1-Digital-Solutions/stick-rush#v0.2.0"
```

El tag `vX.Y.Z` acompaña a la `version` de `package.json`. Sin tag (`#main`) también funciona,
pero entonces el juego cambia bajo los pies de quien lo monta.

Mientras el repositorio sea privado, quien instale necesita acceso de lectura: `npm install`
desde git usa las credenciales de git de la máquina, así que en un CI que no las tenga la
instalación falla al clonar. Las salidas son tres y **está sin decidir cuál se toma**: dar al
runner un token de lectura desde su almacén de secretos (`git config --global
url."https://$TOKEN@github.com/".insteadOf "https://github.com/"`, nunca escrito en el
repositorio), hacer público el repositorio, o publicar el paquete en un registry. En local, con
la cuenta de la organización configurada, funciona sin tocar nada.

React, three y las tres librerías de `@react-three/*` son **peer dependencies**: las pone la
aplicación anfitriona y así solo hay una copia de cada una en la página. Dos copias de React
rompen los hooks, y dos de three, la escena.

## 2. Transpilar el paquete

El paquete se publica en TypeScript sin compilar, así que su código lo compila el bundler de la
aplicación anfitriona junto con el suyo. En Next:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ['stick-rush'],
}
```

## 3. Copiar los ficheros estáticos

El HDRI del escenario, las texturas de la madera, los modelos del recinto (`models/`) y los
perfiles de mando de WebXR son 3 MB que el navegador pide por HTTP durante la partida: no viajan
en el código. Hay que servirlos desde la aplicación anfitriona.

```bash
npx stick-rush-assets public/juegos/stick-rush
```

Ese comando es idempotente: se vuelve a ejecutar tras subir la versión y deja los ficheros de la
nueva. Conviene dejarlo en un script de `package.json` para que no se olvide.

**Los perfiles de mando no son opcionales.** `@react-three/xr` los descarga por defecto de un CDN;
si no llegan, se traga el error y **no registra el mando**: en el visor eso es quedarse sin mandos
y sin poder pulsar nada. Por eso los sirve el juego.

**Las manos las dibuja el juego, no el anfitrión.** El guante sobre el mando y la mano articulada
de las manos desnudas los monta la escena, así que salen aunque el store del anfitrión no dibuje
manos (el del salón no las dibuja). La mano articulada es `manos/generic-hand/{left,right}.glb`,
que va **fuera** de `webxr-profiles/`: un anfitrión que sirva sus propios perfiles y borre los del
juego no se la lleva por delante.

## 4. Montar el juego

Hay **dos formas**, y la diferencia es de quién es la sesión inmersiva.

### Como escena, dentro de un Canvas que ya existe

Es lo que hace el salón de xrcade, y es la forma buena cuando el anfitrión también es 3D. El
juego se pinta dentro del `<Canvas>` y de la sesión del anfitrión, así que **entrar en el juego
y volver no tocan la sesión**: con el visor puesto se pasa de un juego al salón sin quitárselo.

```tsx
'use client'

import { Canvas } from '@react-three/fiber'
import { XR, XROrigin } from '@react-three/xr'
import { StickRushScene } from 'stick-rush'

export function Salon({ store, onExit }) {
  return (
    <Canvas>
      <XR store={store}>
        {/* El jugador es del anfitrión: el juego coloca su mundo alrededor. */}
        <XROrigin position={[0, 0, 0]} />
        <StickRushScene assetsBase="/juegos/stick-rush/" onExit={onExit} />
      </XR>
    </Canvas>
  )
}
```

Lo que la escena **no** hace, y por qué:

- **No crea Canvas ni `XRStore`, ni abre o cierra la sesión.** WebXR da una sesión por documento
  y va atada al Canvas que la abrió: quien es dueño del Canvas es dueño de la sesión.
- **No pone `<XROrigin>`.** El sitio del jugador lo decide el anfitrión. El juego coloca su
  mundo alrededor de donde esté, corriendo el decorado en vez de mover al jugador.
- **No pinta DOM.** Dentro de un Canvas solo caben objetos de three. El menú y el marcador en 2D
  se quedan en la web del juego; dentro del visor sus equivalentes son geometría y sí van.

`onExit` es obligatorio: es cómo el juego devuelve al jugador desde su interfaz inmersiva —el
botón de salir de su menú— sin decidir a dónde. Un anfitrión que no tenga a dónde devolverle
puede pasar el cierre de su propia sesión, que es lo que hace la web del juego.

#### El reto con semilla y el aviso de fin de partida

Tres props más, las tres opcionales: sin ellas, el juego arranca en el menú —con el reto elegido—
y sortea como siempre. Los tipos `Reto` y `Resultado` están en `src/lib/semilla.ts` y `Objetivo`
en `src/lib/objetivo.ts` (el paquete lo exporta), que son los mismos ficheros en todos los juegos
del salón.

| Prop | Qué es |
| --- | --- |
| `reto` | `{ semilla }`: jugar un reto concreto del salón (el reto del día, «reta mi puntuación»). |
| `onTerminar` | `({ modo, puntos, reto }) => void`: el aviso de que ha acabado una partida con puntuación. |
| `objetivo` | `{ medallas: { bronce, plata, oro }, mejorEs, unidad, record, modo }`: los listones de medalla del juego y la marca de quien juega. |

**Con `reto`**, la escena entra **directamente en una partida del desafío** (`challenge`), que
es el modo del récord de la cabina (`stick-rush:best-points:challenge`), con su cuenta atrás y
**sin lección**, aunque no se haya visto nunca. El desafío va siempre fijo —**Medio y los trece
palos** (`CHALLENGE_SETUP` en `lib/gameMode.ts`)— porque los
puntos escalan con la dificultad y con los palos: con los dos a elegir, dos récords del desafío
no serían la misma partida. **Todo el azar de la partida sale de la semilla**: el turno en que
cae cada palo y lo que titubea antes de soltarse (`buildStickLayout`, `lib/stickLayout.ts`), con
la semilla de la tanda `semillaDe(semilla, tanda)`. Misma semilla, mismos palos cayendo en el
mismo orden y al mismo tiempo; lo que cambia de una persona a otra es solo cuándo los coge. El
reto se lee al montar: para otro, se vuelve a montar la escena. Sin `reto`, cada partida estrena
una semilla al azar.

**`onTerminar`** se llama **una vez** al acabar cada partida, en cualquier modo, con `modo` tal
como lo llama el juego (`practice`, `levels`, `challenge`; la práctica sin fin es `practice`),
`puntos` los de esa partida aunque no sean récord, y `reto: true` solo si era la partida del
`reto`. Se llama desde el mismo sitio que guarda el récord, que el juego sigue guardando en
`localStorage`. **Dejar la partida a medias no la cuenta** (la pregunta de dejarla, o salir con
`onExit`). La práctica sin fin sí: su final es que quien juega diga basta, y trae resumen. Tras
el reto la pantalla final es la de siempre, y jugar otra vez ya no es el reto.

**Con `objetivo`**, el **cartel del objetivo** —de frente, encima del marcador y por debajo de
donde caen los palos (`XR_CARTEL_POSITION`)— dice qué hay que superar: durante la cuenta atrás y
hasta que se resuelve el primer palo, la misión y los tres listones; jugando, el listón que falta,
lo que se lleva, las vidas y los palos que quedan; al acabar, lo que faltó para la siguiente
medalla. `modo` es el modo del que salen las medallas (`challenge`): en cualquier otro, y a dos,
el cartel dice mientras se juega que la partida no cuenta para medalla. Sin la prop, en el reto
dice la misión y el récord guardado en este navegador. `unidad` llega ya en el idioma de quien
juega. Lo que el cartel ya dice —los puntos y las vidas— el marcador de debajo lo calla.

`<StickRush>` y `mountStickRush` aceptan `reto` y `onTerminar`; `objetivo` es de la escena.

### Como aplicación, con su propio Canvas

Para una página que sea el juego y nada más. Abre su propia sesión, así que **no** se puede
montar dentro de otro Canvas: en un documento solo cabe una sesión inmersiva.

Como componente, si la aplicación anfitriona es de React:

```tsx
'use client'

import { StickRush } from 'stick-rush'
import 'stick-rush/styles.css'

export function Sala() {
  // El juego llena su contenedor: dale una altura.
  return (
    <div className="h-dvh w-full">
      <StickRush assetsBase="/juegos/stick-rush/" />
    </div>
  )
}
```

O con la función de montaje, si no la hay:

```ts
import { mountStickRush } from 'stick-rush'
import 'stick-rush/styles.css'

const sala = document.getElementById('sala')
if (sala) {
  const juego = mountStickRush(sala, { assetsBase: '/juegos/stick-rush/' })

  // Al salir del juego:
  juego.unmount()
}
```

Quitar el juego —con `unmount()` o desmontando el componente— **cierra la sesión inmersiva si
la había**. Tiene que ser así: WebXR da una sesión por documento y la que abre el juego está
atada a su Canvas, de modo que dejarla viva después de quitarlo deja al jugador mirando una
escena congelada y a la aplicación anfitriona sin poder abrir la suya.

Toda la superficie pública es esa:

| Nombre                         | Qué es                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `StickRushScene`               | El juego como **escena**, dentro del Canvas y la sesión de otro. Props: `assetsBase`, `anchor`, `onExit`, `reto`, `onTerminar`, `objetivo`. |
| `StickRush`                    | El juego como aplicación, con su propio Canvas y su propia sesión.                    |
| `mountStickRush(elemento, …)`  | Lo mismo sobre un elemento del DOM. Devuelve `{ unmount() }`, que además cierra la sesión. |
| `assetsBase`                   | De dónde cuelgan los ficheros del paso 3. Por defecto, la raíz del sitio.              |
| `stick-rush/styles.css`        | Los colores, la tipografía y las animaciones del juego.                                |

`assetsBase` es una por página: montar dos juegos a la vez con bases distintas no funcionaría,
cosa que WebXR tampoco permite (una sesión inmersiva por documento).

## 5. Generar las clases de Tailwind

Las pantallas del juego (el menú y el marcador) están escritas con clases de Tailwind v4. El CSS
del paso anterior trae lo propio del juego —sus colores, su tipografía y sus animaciones— pero no
las utilidades: esas las genera Tailwind escaneando el código, y por defecto no mira dentro de
`node_modules`. Hay que decírselo:

```css
@import "tailwindcss";
@source "../node_modules/stick-rush/src";
```

Si la aplicación anfitriona no usa Tailwind, este es el punto que hay que resolver de otra forma
(por ejemplo, con una hoja compilada aparte); sin él, el juego se ve sin maquetar.

Todo lo que el juego pinta cuelga de un contenedor con la clase `.stick-rush`, y sus variables de
color están definidas ahí y no en `:root`, así que no le cambian el aspecto a lo que haya
alrededor. Las dos fuentes se toman de `--font-heading` y `--font-body` si la aplicación anfitriona
las define, y si no, del sistema.

## Lo que el juego necesita del entorno

- **HTTPS.** WebXR no arranca sin él (salvo en `localhost`).
- **Permisos.** `xr-spatial-tracking` y los sensores. Si el juego va dentro de un `<iframe>`,
  también en su `allow`.
- **CSP.** El juego no llama a ningún dominio externo, así que le vale `connect-src 'self'` si los
  ficheros del paso 3 se sirven desde el mismo origen. `worker-src blob:` e `img-src blob:` sí los
  necesita three.js.
- **`localStorage`.** Guarda el récord, la altura del aro, el silencio y si ya se vio el tutorial,
  con claves bajo `stick-rush:`. Si no lo hay (modo privado), el juego funciona igual y no recuerda
  nada.
- **Los ajustes del salón, del mismo `localStorage`.** El idioma, el volumen, el escenario y la
  **mano buena** (`xrcade:hand`, `right` o `left`; `right` si no hay nada o hay basura) no son del
  juego: se eligen en el salón y el juego los lee (`src/lib/ajustes.ts`, `useHand()` en
  `ajustesCliente.ts`), enterándose de un cambio sin recargar. Aquí se atrapa con cualquiera de
  las dos manos, así que el menú no pregunta ninguna y no hay clave propia que borrar: la mano
  del salón solo decide de qué lado sale el mando que enseñan las ayudas visuales.
- **Un gesto del jugador antes del sonido**, que es de los navegadores. El juego ya lo espera.

## Publicar una versión nueva

1. Sube `version` en `package.json` siguiendo semver. La superficie que versiona es la de este
   documento: cambiarla es un cambio mayor.
2. Commitea e integra en `main`. Etiquetar antes de integrar deja el tag en un commit que
   luego no está en `main`.
3. Etiqueta ese commit de `main` y **publica** el tag junto con la rama: mientras no esté en el
   remoto, quien instale por tag no lo encuentra, y empujar solo el tag deja su commit fuera de
   la `main` publicada.

   ```bash
   git show <commit de main>:package.json | grep '"version"'   # que sea la del paso 1
   git tag -a vX.Y.Z <commit de main> -m "vX.Y.Z"
   git push origin main vX.Y.Z
   ```

4. En quien lo consuma: `npm install "github:1to1-Digital-Solutions/stick-rush#vX.Y.Z"` y
   `npx stick-rush-assets <destino>`.
