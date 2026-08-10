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
3. Press **Jugar** (play). A three-second countdown runs first — the sticks hang
   there in plain sight but nothing can be taken yet — and then they drop one at a
   time in **random order**, with a random gap between them: where a stick hangs
   says nothing about when it falls.
4. Catch what you can. A stick can be taken any time between the start of the round
   and the moment it hits the ground, **including while it still hangs from the
   ring** — getting ahead of a stick is playing, not cheating, and catching one up
   there is worth double what rescuing it just above the floor is (reflex bonus).
   Once it lands it stays on the floor, red, as a tally of what got away; it cannot
   be picked back up. The round ends once every stick is resolved (caught or
   dropped) and the score screen shows the result.

> The game's interface is in Spanish, which is the product language.

| Where | How you catch | What you see |
| --- | --- | --- |
| Desktop or mobile browser | Click or tap the stick | The machine in a town square, camera behind the player |
| XR headset, **VR** mode | **Grab it with your hand** (squeeze button) | The full environment all around |
| XR headset, **AR** mode | **Grab it with your hand** (squeeze button) | Only the machine, over your real room (passthrough) |

In a headset you do **not** catch sticks by pointing at them. The ring sits within
arm's reach and you close your hand around a stick as it falls: the grab pointer is
a sphere attached to your fist, triggered by the squeeze button. The aiming ray is
still there, but only to operate the menu — pointing at a stick does nothing.

There is no DOM in an immersive session, so the menu is built out of geometry and
shown in front of you when you enter VR/AR: a row of sticks to pick how many you
want, five tiles with growing bars for the difficulty, and a play button. **Not a
single letter** — `<Text>` would pull fonts from a CDN, and the game has to run on a
headset with no internet access, so every control is drawn as the thing it means.
A back button is always within reach during a round, and when it ends you choose
between replaying and going back to the menu.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [drei](https://github.com/pmndrs/drei) + [three.js](https://threejs.org) for the 3D scene
- [@react-three/xr](https://github.com/pmndrs/xr) for immersive sessions (WebXR)
- Tailwind CSS v4 for the DOM UI
- [Vitest](https://vitest.dev) (unit) and [Playwright](https://playwright.dev) (end-to-end)

The game **depends on no external service**: no environment variables, no database,
no third-party requests. Assets (HDRI and textures, all CC0) are served from
`public/`; see [`public/CREDITS.md`](public/CREDITS.md).

Sound is **synthesised** with the Web Audio API rather than played back from audio
files — a handful of oscillators, so there is nothing to download and no
`media-src` to open up in the CSP. Catching a stick rings a short chime that goes
up a semitone per stick in your streak, losing one drops a low buzz, and each
second of the countdown ticks, rising as the start approaches. It only starts
after your first click — pressing Enter on a button counts, since that fires one
too: browsers refuse to play audio before that.
Both menus — the desktop one and the immersive one — can mute it, and while
muted the game never touches the Web Audio API at all. The choice is not
persisted: the game uses no storage.

In a headset, catching a stick also **buzzes the controller that caught it**
(WebXR haptics): a short, firm pulse played through
`XRInputSource.gamepad.hapticActuators`, so there is nothing to download here
either. It is the one cue that still reaches you while you are looking at
another stick with the sound muted, and it lands on the hand that did the catch.
Bare hands and the desktop mouse have no actuator, so they simply do not
vibrate.

It is a fully static site — no middleware, no Server Actions, no API routes. Security
headers (CSP, `Permissions-Policy`, HSTS and friends) are declared in
`next.config.ts`; `connect-src 'self'` is what enforces the "no external requests"
promise, and `xr-spatial-tracking=(self)` is what keeps WebXR working. Both are
covered by tests in `e2e/seguridad.spec.ts`.

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
    game/               R3F canvas (always mounted), machine, sticks, ground, HUD, sound wiring
    xr/                 WebXR store, VR/AR buttons, immersive menu, 3D HUD
  lib/
    gameConfig.ts       Constants: difficulties, speeds, colours, geometry
    gameStore.ts        Global game state (Context API)
    stickLayout.ts      Stick layout, shuffled fall order and score token states
    stickSwing.ts       Idle sway of the hanging sticks
    sound.ts            Synthesised game sounds (Web Audio, no files)
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

`@react-three/xr` registers two pointers per controller and the game treats them
differently: the **grab** pointer (a sphere on your fist, fired by the squeeze
button) is what catches sticks, while the **ray** only drives the menu. `Stick`
decides that by looking at the event's pointer type, so a stray ray can never catch
anything. The mouse keeps working untouched, which is how you play on desktop.

Controller and hand models are disabled on purpose: `@react-three/xr` downloads them
from `cdn.jsdelivr.net`, and the game must work on a headset with no route to the
internet — the CSP blocks it anyway. You orient yourself with the grab cursor and the
ray, which are local geometry.

The `<Canvas>` with `<XR>` is **always mounted**: the desktop menu and HUD are DOM
overlays on top of the 3D scene. That way, pressing "Entrar en VR" starts the session
with the scene already in the tree and it shows up inside the headset. `<XROrigin>`
places the player's feet at the centre of the semicircle, at 1:1 scale, with the ring
just above head height and within arm's reach.

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
5. Press **Entrar en VR** or **Entrar en AR** and grant the WebXR permissions. Pick
   your options in the floating menu, press play, and **squeeze** the grip button
   with your hand around a stick to catch it.

> Desktop mode still works with `npm run dev` (HTTP): menu → Jugar and click with the
> mouse to catch.

If deployed to Vercel, open the **direct URL** on the headset rather than the
dashboard preview: that one is embedded in an iframe, and WebXR needs
`allow="xr-spatial-tracking"` on the parent iframe.

## Project status

`ESTADO.md` is the handoff between sessions (in Spanish): what is done, what is
verified and what comes next. XR controller interaction is implemented but **not yet
validated on real hardware**.
