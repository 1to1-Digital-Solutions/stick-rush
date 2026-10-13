# Mounting Stick Rush inside another application

Stick Rush is two things in the same repository:

- **The game** (`src/game`, `src/components`, `src/lib`): a React component that mounts wherever
  you tell it to. It knows nothing about routes, layout, metadata or deployment.
- **Its website** (`src/app`): a Next application that mounts that component full screen. It is
  deployed on its own and is the way to develop the game and to try it with the headset.

This document is the contract of the first: what has to be done to mount the game from outside.
It is what [xrcade](https://github.com/1to1-Digital-Solutions/xrcade) consumes, which loads it
INSIDE itself instead of linking to it: an `<iframe>` to another domain breaks the immersive
session on the way in and on the way back.

## 1. Install a fixed version

The game is consumed by **repository tag**, not by copying code. Updating it in the hall is
bumping that version and installing again:

```bash
npm install "github:1to1-Digital-Solutions/stick-rush#v0.2.0"
```

The tag `vX.Y.Z` goes with the `version` of `package.json`. Without a tag (`#main`) it works too,
but then the game changes under the feet of whoever mounts it.

While the repository is private, whoever installs it needs read access: `npm install` from git
uses the machine's git credentials, so in a CI that does not have them the install fails when
cloning. There are three ways out and **which one is taken is undecided**: give the runner a read
token from its secret store (`git config --global
url."https://$TOKEN@github.com/".insteadOf "https://github.com/"`, never written in the
repository), make the repository public, or publish the package to a registry. Locally, with the
organisation's account configured, it works without touching anything.

React, three and the three `@react-three/*` libraries are **peer dependencies**: the host
application provides them, so there is only one copy of each on the page. Two copies of React
break the hooks, and two of three break the scene.

## 2. Transpile the package

The package is published as uncompiled TypeScript, so its code is compiled by the host
application's bundler together with its own. In Next:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ['stick-rush'],
}
```

## 3. Copy the static files

The HDRI of the scenery, the wood textures, the models of the fairground (`models/`), the
background music, the hands and the WebXR controller profiles are about 5 MB that the browser
requests over HTTP during the run: they do not travel in the code. They have to be served from
the host application.

```bash
npx stick-rush-assets public/juegos/stick-rush
```

That command is idempotent: it is run again after bumping the version and leaves the files of
the new one. It is worth keeping it in a `package.json` script so that it is not forgotten.

**The controller profiles are not optional.** `@react-three/xr` downloads them from a CDN by
default; if they do not arrive, it swallows the error and **does not register the controller**:
in the headset that means no controllers and nothing that can be pressed. That is why the game
serves them.

**The hands are drawn by the game, not by the host.** The glove over the controller and the
articulated hand of bare hands are mounted by the scene, so they show even if the host's store
draws no hands (the hall's does not). The articulated hand is
`manos/generic-hand/{left,right}.glb`, which lives **outside** `webxr-profiles/`: a host that
serves its own profiles and deletes the game's does not take it away.

## 4. Mount the game

There are **two ways**, and the difference is whose immersive session it is.

### As a scene, inside a Canvas that already exists

It is what the xrcade hall does, and it is the right way when the host is 3D too. The game is
drawn inside the host's `<Canvas>` and session, so **entering the game and coming back do not
touch the session**: with the headset on, the player goes from a game to the hall without taking
it off.

```tsx
'use client'

import { Canvas } from '@react-three/fiber'
import { XR, XROrigin } from '@react-three/xr'
import { StickRushScene } from 'stick-rush'

export function Hall({ store, onExit }) {
  return (
    <Canvas>
      <XR store={store}>
        {/* The player belongs to the host: the game places its world around them. */}
        <XROrigin position={[0, 0, 0]} />
        <StickRushScene assetsBase="/juegos/stick-rush/" onExit={onExit} />
      </XR>
    </Canvas>
  )
}
```

What the scene does **not** do, and why:

- **It creates neither a Canvas nor an `XRStore`, and it does not open or close the session.**
  WebXR gives one session per document and it is tied to the Canvas that opened it: whoever owns
  the Canvas owns the session.
- **It does not add an `<XROrigin>`.** Where the player stands is the host's decision. The game
  places its world around wherever they are, shifting the set instead of moving the player.
- **It draws no DOM.** Only three objects fit inside a Canvas. The 2D menu and scoreboard stay in
  the game's website; inside the headset their equivalents are geometry and they do come along.

`onExit` is mandatory: it is how the game hands the player back from its immersive interface —the
exit button of its menu— without deciding where to. A host with nowhere to send them back to can
pass the closing of its own session, which is what the game's website does.

#### The seeded challenge and the end-of-run notice

Four more props, all optional: without them, the game starts in the menu —with the challenge
chosen— and draws its randomness as usual. The types `Challenge` and `GameResult` are in
`src/lib/seed.ts` and `Goal` is in `src/lib/goal.ts` (the package exports it), which are the same
files in every game of the hall.

| Prop | What it is |
| --- | --- |
| `challenge` | `{ seed }`: play a specific challenge of the hall (the daily challenge, "beat my score"). |
| `onFinish` | `({ mode, points, challenge, feats? }) => void`: the notice that a run with a score has ended. |
| `goal` | `{ medals: { bronze, silver, gold }, better, unit, record, mode }`: the medal thresholds of the game and the best of whoever plays. |
| `name` | The `name` of the catalogue manifest: what the game is called in its menu. Without it, "Stick Rush", the one in `package.json`. |

**With `challenge`**, the scene goes **straight into a run of the challenge mode** (`challenge`),
which is the mode of the cabinet's record (`stick-rush:best-points:challenge`), with its
countdown and **without the lesson**, even if it has never been seen. The challenge is always
fixed —**Medium and the thirteen sticks** (`CHALLENGE_SETUP` in `lib/gameMode.ts`)— because the
points scale with the difficulty and with the sticks: with both left to choose, two records of
the challenge would not be the same run. **All the randomness of the run comes from the seed**:
the turn in which each stick falls and how long it hesitates before letting go
(`buildStickLayout`, `lib/stickLayout.ts`), with the seed of the round `deriveSeed(seed, round)`.
Same seed, same sticks falling in the same order and at the same time; what changes from one
person to another is only when they catch them. The challenge is read on mount: for another one,
the scene is mounted again. Without `challenge`, each run uses a fresh random seed.

**`onFinish`** is called **once** at the end of each run, in any mode, with `mode` as the game
calls it (`practice`, `levels`, `challenge`; endless practice is `practice`), `points` those of
that run even if they are not a record, and `challenge: true` only if it was the run of the
`challenge` prop. `feats`, when present, lists the feats earned for the first time in that run
(their Steam API names). It is called from the same place that saves the record, which the game
keeps saving in `localStorage`. **Leaving the run halfway does not count it** (the question about
leaving it, or exiting with `onExit`). Endless practice does: it ends when whoever plays says
enough, and it has a summary. After the challenge the final screen is the usual one, and playing
again is no longer the challenge.

**With `goal`**, the **goal sign** —facing the player, above the scoreboard and below where the
sticks fall (`XR_SIGN_POSITION`)— says what has to be beaten: during the countdown and until
the first stick is resolved, the mission and the three thresholds; while playing, the threshold
still to reach, what has been scored, the lives and the sticks left; at the end, what was missing
for the next medal. `mode` is the mode the medals come from (`challenge`): in any other, and with
two players, the sign says while playing that the run does not count for a medal. Without the
prop, in the challenge it says the mission and the record saved in this browser. `unit` arrives
already in the language of whoever plays. What the sign already says —the points and the lives—
the scoreboard below leaves out.

`<StickRush>` and `mountStickRush` accept `challenge` and `onFinish`; `goal` and `name` belong to
the scene.

### As an application, with its own Canvas

For a page that is the game and nothing else. It opens its own session, so it can **not** be
mounted inside another Canvas: a document only fits one immersive session.

As a component, if the host application is a React one:

```tsx
'use client'

import { StickRush } from 'stick-rush'
import 'stick-rush/styles.css'

export function Room() {
  // The game fills its container: give it a height.
  return (
    <div className="h-dvh w-full">
      <StickRush assetsBase="/juegos/stick-rush/" />
    </div>
  )
}
```

Or with the mount function, if it is not:

```ts
import { mountStickRush } from 'stick-rush'
import 'stick-rush/styles.css'

const room = document.getElementById('room')
if (room) {
  const game = mountStickRush(room, { assetsBase: '/juegos/stick-rush/' })

  // When leaving the game:
  game.unmount()
}
```

Removing the game —with `unmount()` or by unmounting the component— **closes the immersive
session if there was one**. It has to be that way: WebXR gives one session per document and the
one the game opens is tied to its Canvas, so leaving it alive after removing the game leaves the
player looking at a frozen scene and the host application unable to open its own.

The whole public surface is this:

| Name                           | What it is                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `StickRushScene`               | The game as a **scene**, inside someone else's Canvas and session. Props: `assetsBase`, `anchor`, `onExit`, `challenge`, `onFinish`, `goal`, `name`. |
| `StickRush`                    | The game as an application, with its own Canvas and its own session.                  |
| `mountStickRush(element, …)`   | The same on a DOM element. Returns `{ unmount() }`, which also closes the session.    |
| `assetsBase`                   | Where the files of step 3 hang from. By default, the root of the site.                |
| `stick-rush/styles.css`        | The colours, the typography and the animations of the game.                           |

`assetsBase` is one per page: mounting two games at once with different bases would not work,
which WebXR does not allow either (one immersive session per document).

## 5. Generate the Tailwind classes

The game's screens (the menu and the scoreboard) are written with Tailwind v4 classes. The CSS of
the previous step brings what is the game's own —its colours, its typography and its animations—
but not the utilities: Tailwind generates those by scanning the code, and by default it does not
look inside `node_modules`. It has to be told:

```css
@import "tailwindcss";
@source "../node_modules/stick-rush/src";
```

If the host application does not use Tailwind, this is the point that has to be solved another
way (for example, with a separately compiled sheet); without it, the game shows unstyled.

Everything the game draws hangs from a container with the class `.stick-rush`, and its colour
variables are defined there and not in `:root`, so they do not change the look of whatever is
around. The two fonts are taken from `--font-heading` and `--font-body` if the host application
defines them, and otherwise from the system.

## What the game needs from its environment

- **HTTPS.** WebXR does not start without it (except on `localhost`).
- **Permissions.** `xr-spatial-tracking` and the sensors. If the game goes inside an `<iframe>`,
  in its `allow` too.
- **CSP.** The game calls no external domain, so `connect-src 'self'` is enough if the files of
  step 3 are served from the same origin. `worker-src blob:` and `img-src blob:` are needed by
  three.js.
- **`localStorage`.** It keeps the records, the level progress, the duel tally, the feats already
  earned, the hoop height and whether the tutorial has been seen, with keys under `stick-rush:`.
  If there is none (private mode), the game works the same and remembers nothing.
- **The hall's settings, from the same `localStorage`.** The language, the volume, the scenery
  and the **good hand** (`xrcade:hand`, `right` or `left`; `right` if there is nothing or there
  is rubbish) are not the game's: they are chosen in the hall and the game reads them
  (`src/lib/settings.ts`, `useHand()` in `settingsClient.ts`), learning of a change without
  reloading. Here sticks are caught with either hand, so the menu asks for none and there is no
  key of its own to delete: the hall's hand only decides on which side the controller shown by
  the visual hints appears.
- **A gesture from the player before the sound**, which is a browser rule. The game already
  waits for it.

## Publishing a new version

1. Bump `version` in `package.json` following semver. The surface it versions is the one in this
   document: changing it is a major change.
2. Commit and integrate into `main`. Tagging before integrating leaves the tag on a commit that
   is later not in `main`.
3. Tag that commit of `main` and **publish** the tag together with the branch: while it is not on
   the remote, whoever installs by tag does not find it, and pushing only the tag leaves its
   commit outside the published `main`.

   ```bash
   git show <commit of main>:package.json | grep '"version"'   # must be the one of step 1
   git tag -a vX.Y.Z <commit of main> -m "vX.Y.Z"
   git push origin main vX.Y.Z
   ```

4. In whoever consumes it: `npm install "github:1to1-Digital-Solutions/stick-rush#vX.Y.Z"` and
   `npx stick-rush-assets <destination>`.
