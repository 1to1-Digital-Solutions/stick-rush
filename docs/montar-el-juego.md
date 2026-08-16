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

El HDRI del escenario, las texturas de la madera y los perfiles de mando de WebXR son 3 MB que el
navegador pide por HTTP durante la partida: no viajan en el código. Hay que servirlos desde la
aplicación anfitriona.

```bash
npx stick-rush-assets public/juegos/stick-rush
```

Ese comando es idempotente: se vuelve a ejecutar tras subir la versión y deja los ficheros de la
nueva. Conviene dejarlo en un script de `package.json` para que no se olvide.

**Los perfiles de mando no son opcionales.** `@react-three/xr` los descarga por defecto de un CDN;
si no llegan, se traga el error y **no registra el mando**: en el visor eso es quedarse sin mandos
y sin poder pulsar nada. Por eso los sirve el juego.

## 4. Montar el juego

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
| `StickRush`                    | El juego como componente de React.                                                    |
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
