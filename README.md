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
npm run dev      # servidor de desarrollo en http://localhost:3000
npm run build    # build de producción
npm run start    # sirve el build de producción
npm run lint     # ESLint
npm run typecheck # comprobación de tipos
```

## Estructura

```
src/
  app/
    layout.tsx          Layout raíz: fuentes (Righteous + Poppins) y metadatos
    page.tsx            Menú o escena según el estado del juego
    game/page.tsx       Ruta directa a la escena de juego
    global-error.tsx    Boundary de error global
    globals.css         Tokens de diseño y estilos globales
  components/
    GameProvider.tsx    Provee el contexto del juego
    ui/StartScreen.tsx  Pantalla de inicio (palos, dificultad, jugar, VR/AR)
    game/               Canvas R3F, máquina, palos, suelo y HUD
    xr/                 Store de WebXR y botones de entrada VR/AR
  lib/
    gameConfig.ts       Constantes: dificultades, velocidades, colores, geometría
    gameStore.ts        Estado global del juego (Context API)
```

## Modo XR

Los botones de entrada a VR/AR solo aparecen si el dispositivo soporta WebXR
(`navigator.xr`). En sesión inmersiva, el sistema de punteros de `@react-three/xr`
dispara los mismos eventos de clic que el ratón, de modo que la lógica de captura
de los palos es la misma en navegador y en visor.
