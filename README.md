# Stick Rush

A browser and mixed-reality game: sticks hang from a fairground machine, drop one
after another at random intervals, and you have to catch them before they hit the
ground.

![Game in progress: the semicircular machine with sticks hanging and several already falling, score at 2 of 11](docs/partida.jpg)

The machine is a **horizontal semicircular ring** and the player stands at its
centre, so the sticks fall all around them, within arm's reach, instead of onto
their head. The whole scene is at human scale (1 unit = 1 metre).

## How to play

1. Pick how many sticks you want, **between 5 and 13**.
2. Pick the difficulty — **Fácil, Medio, Difícil, Experto or Imposible** (easy to
   impossible) — which sets the fall speed: from about 5.7 s per stick on Fácil to
   under 1 s on Imposible.
3. Press **Jugar** (play). The sticks are released one after another, with a random
   offset between them.
4. Catch what you can. The round ends once every stick is resolved (caught or
   dropped) and the score screen shows the result.

> The game's interface is in Spanish, which is the product language.

| Where | How you catch | What you see |
| --- | --- | --- |
| Desktop or mobile browser | Click or tap the stick | The machine in a town square, camera behind the player |
| XR headset, **VR** mode | Controller trigger aimed at the stick | The full environment all around |
| XR headset, **AR** mode | Controller trigger aimed at the stick | Only the machine, over your real room (passthrough) |

There is no DOM in an immersive session, so there is no "play" button either:
entering VR/AR starts a round automatically and, once it ends, chains the next one
after a pause. A 3D HUD replaces the score — one token per stick, caught / dropped /
pending — told apart by colour *and* by size and height, with no text at all (that
way no fonts have to be fetched from a CDN). Leaving the session returns to the menu.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [drei](https://github.com/pmndrs/drei) + [three.js](https://threejs.org) for the 3D scene
- [@react-three/xr](https://github.com/pmndrs/xr) for immersive sessions (WebXR)
- Tailwind CSS v4 for the DOM UI
- [Vitest](https://vitest.dev) (unit) and [Playwright](https://playwright.dev) (end-to-end)

The game **depends on no external service**: no environment variables, no database,
no third-party requests. Assets (HDRI and textures, all CC0) are served from
`public/`; see [`public/CREDITS.md`](public/CREDITS.md).

## Development

```bash
npm install
npm run dev        # dev server at http://localhost:3000
npm run dev:https  # same, over HTTPS (required to test WebXR on a headset)
npm run build      # production build
npm run start      # serve the production build
```

### Checks

```bash
npm run lint       # ESLint
npm run typecheck  # type checking
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end (Playwright; builds and starts the server)
npm run capture    # regenerates docs/partida.jpg, the screenshot in this README
```

Playwright needs its browser the first time: `npx playwright install chromium`.

The unit tests cover the logic in `src/lib` — machine geometry, stick layout and
release delays, fall times per difficulty, and the round lifecycle. The e2e tests
drive the real game in Chromium against the production build: menu, round, catching
sticks with the mouse, game over, and behaviour on a phone-sized screen.

The e2e suite is served from `127.0.0.1` rather than `localhost` on purpose:
`@react-three/xr` injects the WebXR emulator (IWER) when the hostname is exactly
`localhost`, which adds an "Enter XR" button that does not exist in the real game.

## Layout

```
src/
  app/
    layout.tsx          Root layout: fonts (Righteous + Poppins) and metadata
    page.tsx            Scene with menu/HUD as overlays driven by game state
    game/page.tsx       Direct route to the same scene
    global-error.tsx    Global error boundary
    globals.css         Design tokens and global styles
  components/
    GameProvider.tsx    Provides the game context
    ui/StartScreen.tsx  Menu overlay (sticks, difficulty, play, VR/AR)
    game/               R3F canvas (always mounted), machine, sticks, ground, HUD
    xr/                 WebXR store, VR/AR buttons and session↔game bridge
  lib/
    gameConfig.ts       Constants: difficulties, speeds, colours, geometry
    gameStore.ts        Global game state (Context API)
    stickLayout.ts      Stick layout around the ring and score token states
e2e/                    Playwright tests
docs/                   README screenshots
public/
  hdri/, textures/      CC0 assets served locally (see public/CREDITS.md)
godot/                  Desktop Godot port (frozen, see godot/README.md)
```

Game state lives in a **Context API** store (`gameStore`), with no external library.
It keeps only what the player decides — stick count, difficulty, caught, resolved and
the phase — and **derives** "round over" from the resolved sticks, so there are never
two sources of truth to keep in sync. The pure logic (where each stick hangs, when it
drops, how the score is rendered) lives in `src/lib`, outside the 3D components,
which is what makes it testable without a browser.

## XR mode

The VR/AR entry buttons only show up if the device supports WebXR (`navigator.xr`).
In an immersive session, the pointer system of `@react-three/xr` fires the same click
events as the mouse, so the catching logic is identical in browser and headset.

The `<Canvas>` with `<XR>` is **always mounted**: the menu and HUD are DOM overlays on
top of the 3D scene. That way, pressing "Entrar en VR" starts the session with the
scene already in the tree and it shows up inside the headset. `<XROrigin>` places the
player's feet at the centre of the semicircle, at 1:1 scale.

In **AR** neither the background, the ground nor the environment is drawn: the set is
the player's own room and covering it would break passthrough. The HDRI is kept only
as a reflection source, so the machine does not look flat against the real room.

### Testing on a Quest headset

WebXR requires a secure origin, so opening the game from the headset's browser over
the local network needs HTTPS:

1. Start the server over HTTPS: `npm run dev:https`. The first time, Next generates and
   trusts a local self-signed certificate (no extra dependencies needed).
2. Find your machine's IP on the local network (e.g. `ipconfig getifaddr en0` on
   macOS). The computer and the headset must be on the **same Wi-Fi network**.
3. On the Quest browser open `https://<your-ip>:3000`.
4. Accept the self-signed certificate warning ("advanced" → proceed).
5. Press **Entrar en VR** or **Entrar en AR**, grant the WebXR permissions and aim at
   the sticks with the controllers: the select trigger catches them just like a click.

> Desktop mode still works with `npm run dev` (HTTP): menu → Jugar and click with the
> mouse to catch.

If deployed to Vercel, open the **direct URL** on the headset rather than the
dashboard preview: that one is embedded in an iframe, and WebXR needs
`allow="xr-spatial-tracking"` on the parent iframe.

## Project status

`ESTADO.md` is the handoff between sessions (in Spanish): what is done, what is
verified and what comes next. XR controller interaction is implemented but **not yet
validated on real hardware**.
