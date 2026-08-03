# Stick Rush

Juego de navegador y de realidad mixta: de una máquina de feria cuelgan unos palos
que se van soltando de forma escalonada y aleatoria, y hay que atraparlos antes de
que toquen el suelo.

![Partida en curso: la máquina semicircular con los palos colgando y varios ya cayendo, y el marcador en 2 de 11](docs/partida.jpg)

La máquina es un **aro semicircular horizontal** y el jugador se planta en el
centro, así que los palos le caen alrededor, al alcance del brazo, en vez de sobre
la cabeza. Toda la escena está a escala humana (1 unidad = 1 metro).

## Cómo se juega

1. Elige cuántos palos quieres, **entre 5 y 13**.
2. Elige la dificultad —**Fácil, Medio, Difícil, Experto o Imposible**—, que fija la
   velocidad de caída: de unos 5,7 s por palo en Fácil a menos de 1 s en Imposible.
3. Pulsa **Jugar**. Los palos se sueltan uno tras otro, con un desfase aleatorio.
4. Atrapa los que puedas. La partida termina cuando todos se han resuelto (atrapados
   o caídos) y el marcador muestra el resultado.

| Dónde | Cómo se atrapa | Qué se ve |
| --- | --- | --- |
| Navegador de escritorio o móvil | Clic o toque sobre el palo | La máquina en una plaza, con la cámara detrás del jugador |
| Visor XR, modo **VR** | Gatillo del mando apuntando al palo | El escenario completo alrededor |
| Visor XR, modo **AR** | Gatillo del mando apuntando al palo | Solo la máquina, sobre tu habitación real (passthrough) |

En sesión inmersiva no hay DOM, así que no hay botón «Jugar»: al entrar en VR/AR la
partida arranca sola y, al acabar, encadena la siguiente tras una pausa. El marcador
lo sustituye un HUD 3D de fichas —una por palo, atrapado / perdido / pendiente—,
distinguidas por color *y* por tamaño y altura, sin texto (así no hace falta
descargar fuentes de ningún CDN). Al salir de la sesión se vuelve al menú.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [drei](https://github.com/pmndrs/drei) + [three.js](https://threejs.org) para la escena 3D
- [@react-three/xr](https://github.com/pmndrs/xr) para las sesiones inmersivas (WebXR)
- Tailwind CSS v4 para la UI en DOM
- [Vitest](https://vitest.dev) (unitarios) y [Playwright](https://playwright.dev) (extremo a extremo)

El juego **no depende de ningún servicio externo**: no hay variables de entorno, ni
base de datos, ni peticiones a terceros. Los assets (HDRI y texturas, todos CC0) se
sirven desde `public/`; ver [`public/CREDITS.md`](public/CREDITS.md).

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:3000
npm run dev:https  # igual, pero sobre HTTPS (necesario para probar WebXR en un visor)
npm run build      # build de producción
npm run start      # sirve el build de producción
```

### Comprobaciones

```bash
npm run lint       # ESLint
npm run typecheck  # comprobación de tipos
npm test           # unitarios (Vitest)
npm run test:e2e   # extremo a extremo (Playwright; hace build y levanta el servidor)
npm run capture    # regenera docs/partida.jpg, la captura de este README
```

La primera vez, Playwright necesita su navegador: `npx playwright install chromium`.

Los unitarios cubren la lógica de `src/lib` —geometría de la máquina, reparto y
retardos de los palos, tiempos de caída por dificultad y el ciclo de la partida—. Los
e2e recorren el juego real en Chromium sobre el build de producción: menú, partida,
captura de palos con el ratón, fin de partida y comportamiento en pantalla de móvil.

Los e2e se sirven en `127.0.0.1` a propósito: `@react-three/xr` inyecta el emulador
WebXR (IWER) cuando el hostname es exactamente `localhost`, y con él aparece un botón
«Enter XR» que no existe en el juego real.

## Estructura

```
src/
  app/
    layout.tsx          Layout raíz: fuentes (Righteous + Poppins) y metadatos
    page.tsx            Escena con menú/HUD como overlays según el estado
    game/page.tsx       Ruta directa a la misma escena
    global-error.tsx    Boundary de error global
    globals.css         Tokens de diseño y estilos globales
  components/
    GameProvider.tsx    Provee el contexto del juego
    ui/StartScreen.tsx  Menú overlay (palos, dificultad, jugar, VR/AR)
    game/               Canvas R3F (siempre montado), máquina, palos, suelo y HUD
    xr/                 Store de WebXR, botones VR/AR y puente sesión↔juego
  lib/
    gameConfig.ts       Constantes: dificultades, velocidades, colores, geometría
    gameStore.ts        Estado global del juego (Context API)
    stickLayout.ts      Reparto de los palos por el aro y estados del marcador
e2e/                    Tests de Playwright
docs/                   Capturas del README
public/
  hdri/, textures/      Assets CC0 servidos en local (ver public/CREDITS.md)
godot/                  Port a Godot para escritorio (congelado, ver godot/README.md)
```

El estado del juego vive en un **Context API** (`gameStore`), sin librería externa.
Guarda solo lo que decide el jugador —palos elegidos, dificultad, atrapados,
resueltos y la fase— y **deriva** «partida terminada» de los palos resueltos, para no
tener dos fuentes de verdad que sincronizar. La lógica pura (dónde cuelga cada palo,
cuándo se suelta, cómo se pinta el marcador) vive en `src/lib`, fuera de los
componentes 3D, que es lo que permite probarla sin navegador.

## Modo XR

Los botones de entrada a VR/AR solo aparecen si el dispositivo soporta WebXR
(`navigator.xr`). En sesión inmersiva, el sistema de punteros de `@react-three/xr`
dispara los mismos eventos de clic que el ratón, de modo que la lógica de captura
de los palos es la misma en navegador y en visor.

El `<Canvas>` con `<XR>` está **siempre montado**: el menú y el HUD son overlays
en DOM que se superponen a la escena 3D. Así, al pulsar «Entrar en VR» la sesión
arranca con la escena ya en el árbol y se ve dentro del visor. `<XROrigin>` coloca
los pies del jugador en el centro del semicírculo, a escala 1:1.

En **AR** no se dibujan ni el fondo ni el suelo ni el escenario: el decorado es la
habitación del jugador y taparla rompería el passthrough. El HDRI se mantiene solo
como fuente de reflejos, para que la máquina no se vea plana sobre la sala real.

### Probar en un visor Quest

WebXR exige un origen seguro, así que para abrir el juego desde el navegador del
visor por la red local hace falta HTTPS:

1. Arranca el servidor en HTTPS: `npm run dev:https`. La primera vez, Next genera y
   confía un certificado autofirmado local (no requiere dependencias extra).
2. Averigua la IP de tu PC en la red local (p. ej. `ipconfig getifaddr en0` en macOS).
   El PC y el visor deben estar en la **misma red Wi-Fi**.
3. En el navegador del Quest abre `https://<IP-del-PC>:3000`.
4. Acepta el aviso de certificado autofirmado («avanzado» → continuar).
5. Pulsa **Entrar en VR** o **Entrar en AR**, concede los permisos de WebXR y apunta
   con los mandos a los palos: el gatillo de selección los atrapa igual que el clic.

> El modo escritorio sigue funcionando con `npm run dev` (HTTP): menú → Jugar y clic
> con el ratón para atrapar.

Si se despliega en Vercel, abre la **URL directa** en el visor y no la vista previa
del dashboard: va embebida en un iframe, y WebXR necesita `allow="xr-spatial-tracking"`
en el iframe padre.

## Estado del proyecto

`ESTADO.md` es el handoff entre sesiones: qué está hecho, qué está verificado y qué
toca a continuación. La interacción con mandos XR está implementada pero **aún no
validada en hardware real**.
