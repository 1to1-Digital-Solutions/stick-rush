# Stick Rush

Juego de navegador (y realidad mixta) en el que unos palos cuelgan de una máquina
semicircular y caen al suelo de forma escalonada y aleatoria. El jugador debe
atraparlos antes de que toquen el suelo.

- **Navegador normal:** se atrapa cada palo haciendo clic con el ratón.
- **Visor XR (VR/AR):** se atrapa apuntando con los mandos. En VR hay un entorno
  cargado; en AR solo se ve la máquina sobre el espacio real.

Al empezar, el jugador elige cuántos palos quiere (entre 5 y 13) y la dificultad
(fácil → imposible), que determina la velocidad de caída.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [drei](https://github.com/pmndrs/drei) + [three.js](https://threejs.org) para la escena 3D
- [@react-three/xr](https://github.com/pmndrs/xr) para las sesiones inmersivas (WebXR)
- Tailwind CSS v4 para la UI en DOM

## Desarrollo

```bash
npm install
npm run dev       # servidor de desarrollo en http://localhost:3000
npm run dev:https # igual, pero sobre HTTPS (necesario para probar WebXR en un visor)
npm run build     # build de producción
npm run start     # sirve el build de producción
npm run lint      # ESLint
npm run typecheck # comprobación de tipos
```

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
```

## Modo XR

Los botones de entrada a VR/AR solo aparecen si el dispositivo soporta WebXR
(`navigator.xr`). En sesión inmersiva, el sistema de punteros de `@react-three/xr`
dispara los mismos eventos de clic que el ratón, de modo que la lógica de captura
de los palos es la misma en navegador y en visor.

El `<Canvas>` con `<XR>` está **siempre montado**: el menú y el HUD son overlays
en DOM que se superponen a la escena 3D. Así, al pulsar "Entrar en VR" la sesión
arranca con la escena ya en el árbol y se ve dentro del visor. `<XROrigin>` coloca
los pies del jugador sobre el suelo y frente a la máquina, a escala humana. Como en
inmersivo no hay DOM (ni botón "Jugar"), al entrar en sesión se inicia una partida
automáticamente y, al terminarla, se reinicia para poder seguir jugando solo con el
visor; al salir de la sesión se vuelve al menú de escritorio.

### Probar en un visor Quest

WebXR exige un origen seguro, así que para abrir el juego desde el navegador del
visor por la red local hace falta HTTPS:

1. Arranca el servidor en HTTPS: `npm run dev:https`. La primera vez, Next genera y
   confía un certificado autofirmado local (no requiere dependencias extra).
2. Averigua la IP de tu PC en la red local (p. ej. `ipconfig getifaddr en0` en macOS).
   El PC y el visor deben estar en la **misma red Wi-Fi**.
3. En el navegador del Quest abre `https://<IP-del-PC>:3000`.
4. Acepta el aviso de certificado autofirmado ("avanzado" → continuar).
5. Pulsa **Entrar en VR**, concede los permisos de WebXR y apunta con los mandos a
   los palos: el gatillo de selección los atrapa igual que el clic del ratón.

> El modo escritorio sigue funcionando con `npm run dev` (HTTP): menú → Jugar y clic
> con el ratón para atrapar.
