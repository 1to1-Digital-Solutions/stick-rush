# Stick Rush in Godot

The same game for xrcade's native hub (Steam), with **the logic of `src/lib` not
rewritten**: GodotJS runs it inside the engine. Here there is only scene, input and interface, on
top of the common kit in `xrcade/godot-kit/`. (It replaces the GDScript prototype that used to be in
this folder, written from scratch on the old design of the machine.)

**Status: it is played in full, flat and with a simulated headset; it has not been tried with a real headset.**
The sticks hang from the hoop where `buildStickLayout` puts them with the round's seed, wait their
turn swaying (`hangingSwing`), are released and fall **from rest, accelerating**, with the
acceleration that makes each difficulty last the same as on the web (`fallAcceleration`,
`hoopFallSpeed`); Godot's physics is not used. They are grabbed **hanging or falling, until they
touch the ground** (`canCatchStick`), and how long they had been falling, in time, decides the
reflex bonus (`stickFallProgress`, `scoring.ts`). What each `Stick.tsx` does frame by frame on the
web is `scene/game/round.ts`, and the run is the web's `gameStore.ts` without React
(`scene/game/run.ts`): practice (a round or endless, which reloads the machine with another seed),
the fifteen levels with their stars and the challenge with three lives; record, endless streak,
stars, hoop height and tutorial seen with the kit's save.

It starts in the **web's headset menu** (`XRMenu.tsx`, with the dimensions of `lib/xrLayout.ts`
without touching one): the hoop (lower, the ruler, raise) with watching the tutorial again, the
mode with what it puts at stake, a round or endless, the square or your room, the thirteen sticks
in miniature or the ladder of levels, the five speed tokens, play and **exit in the bottom right
corner**. No lettering on the buttons, as on the web; in lettering, the names of the rows and the
explanation of the mode. While playing, **the web's scoreboard** (`XRHud.tsx`): one token per stick,
the streak, the points bar with the record mark, the lives or the stars; back to the menu (which
**asks first**) and finishing the endless run; the countdown with its three rings; and at the end,
repeat and back.

**The machine** is the one of `StickMachine.tsx`: the striped hoop, the truss with its top ring,
uprights and diagonals, the bulbs and the braced posts, with the pieces in multimeshes, and it is
rebuilt if the hoop changes height (only in the menu). **The sticks**, of painted wood with the
relief and the roughness of the web; on being caught they turn green, grow and fade with their
ring; the one that gets away stays on the ground, tinted red. Around it, **the fairground**: the
night square of the web's HDRI as background and reflections, **the pieces of the asset kit**
(`public/models/kit/`: six stalls, eight lampposts and their banners, where `fairKit.ts` puts
them, with the colour in the vertices), the garlands of bulbs, **the crowd** of `crowdLayout.ts`
(42 silhouettes in a multimesh that sways in the shader) and the Ferris wheel turning. The bulbs
and the crowd come alive with the streak (`fairMood.ts`). **Your room** (`xrcade:scenery`) hides
the fairground and leaves the machine, only with augmented reality in the headset.

Flat, they are grabbed **with the mouse**, a click on the stick on pressing, as on the web; the
camera is the one of `GameCanvas.tsx` and the panels hang from it.

With a headset it uses **the kit's XR grammar** (`@kit/runtime/xr/player`): the machine is planted
where the hall lends it, comes down to the eyes of whoever plays seated and **turns in steps with
the stick of the free hand**. **The sticks are grabbed by hand**: on squeezing the side trigger of
either of the two controllers, the stick that is within the fist's grab sphere —the web's, 9 cm
(`CONTROLLER_GRAB_RADIUS`)—; the ray is only for the menu. With no `grab.ts` on the web, the kit
holds while it is squeezed, and bare hands are looked at with its `manoDesnuda`. Standing, the hoop is planted half a metre
above the eyes measured in the menu (`XRPlayerHeight.tsx`, `hoopHeight.ts`); seated at eye level,
the world comes down and the hoop stays at its height. It vibrates with the web's recipe
(`catchPulses`: the grab of `hapticFeedback.ts`, stronger in extremis) in the hand that grabs.
**The hints** of the web's script (`hintScript.ts`): the footprints, the ghost stick falling and
the real controller beside it with the grab throbbing; and the web's **tutorial** —grab a stick,
and another one of those on the sides—, which is learned by playing, with its deadline per step,
and lights the button on **the real controller of both hands**.

It sounds with the web's effects rendered from its `sound.ts` as it is (the kit's render passes it
the context, `"context": true`): the note of the catch that rises with the streak (eight files), the missed stick, the three
seconds of the countdown, the start, the end (winning, losing or finishing) and the record, with
the rule of `useGameSound.ts` (`game/sound.ts`); and the fairground music with its fade. The
language and the volumes are the hall's, from the save.

**The menu opens on the challenge** and **the goal is read straight ahead, under the machine**
(`ui/sign.ts`): the web's sign with what `goal.ts` says and in the place of `machineSign.ts`, above
the scoreboard —the mission until the first stick, the score so far, the lives and the sticks left
while playing, what was missing at the end—, the same size in the eye as on the web; the
scoreboard keeps quiet about what the sign already says (no bar, no lives and no lettering of the
end). On crossing a threshold the sign changes colour, grows and comes back, sounds (`medal-*`)
and is felt in the dominant hand. Flat, it hangs from the camera, top centre. **The medal
thresholds come from the native hall**: `main.ts` reads the `goal` metadata of the `XRcade`
autoload with the kit's `goalFrom` (the same as its `base.objetivo()`, the `goal` prop of the web)
and passes it to the `Run`; with it the sign says the thresholds, celebrates each medal and says
«no cuenta» outside the record's mode. Without a hall, or if it sets no medals, it says the
mission and the saved record. `tests/auto_run.gd` pins it, with the metadata and without it.

**The hall's challenge** (`seed.ts`): with `-- --reto=<seed>`, or if the `XRcade` autoload carries
`challenge_seed`, it goes straight into **the challenge** (the record mode of the cabinet), with no
menu and no tutorial, with the layout and the turn of the sticks drawn from the seed. At the end of
each run `STICK-RUSH-RESULTADO {mode, points, challenge}` is printed and the hall's
`report_result(json)` is called.

**The two-player run**, as on the web (`lib/duel.ts`): in the challenge, the **against whom**
button —in the slot of endless, with a single token or two facing each other, the siblings' icon—
chooses solo or two players passing the controller. With two, each one plays their round **with the
same seed** (the same sticks in the same order); when the first one ends, **the notice to pass the
controller** comes up in front and the repeat button starts the other's round; when the second one
ends, who wins —or the tie—, the points of both and the pair's tally (`duelTally.ts`, saved
separately), with the ending that sounds like winning. The challenge's record is not touched, and
the hall is told about the whole run once (`{mode: 'duel'}`). While playing, the scoreboard says
whose round it is with the pair of tokens.

Why it exists and what was measured: `xrcade/docs/salir-en-steam.md`, section 4.

## What was moved on the web

`highScore.ts` listened to the browser's `storage` event (`window`), so the kit would not let it
be loaded in the engine. What does not touch the browser —the keys, reading, writing, saving if it
improves and the endless streak— moved to **`src/lib/bests.ts`**, and `highScore.ts` re-exports it
as it is and keeps the subscription between tabs: the web imports the same as before, with its
gates green (types, lint, 100 % coverage and the e2e). The scene imports `bests.ts`.

## What there is

| Path | What it is |
|---|---|
| `scene/main.ts` | The scene: the fairground, the machine, the sticks, the three ways of grabbing them (hand, mouse, automatic player), the eye height, the sound, what is felt, the challenge and the screenshots |
| `scene/game/run.ts` | The run: the web's `gameStore.ts` without React (what is chosen, the phases, the counters, the endless rounds, the two-player run, the lesson and its deadline, what is saved and what the hall is told) |
| `scene/game/round.ts` | The sticks of a round: what each `Stick.tsx` does, without painting |
| `scene/game/reach.ts` | Which stick the hand grabs (the fist's sphere) or the mouse (the ray) |
| `scene/game/sound.ts` | What sounds and when (`useGameSound.ts`) |
| `scene/world/` | The machine (`machine.ts`), the painted sticks (`sticks.ts`), the fairground, the square and your room (`fairground.ts`) and the hints (`hints.ts`); the loose pieces and the scenery are the kit's |
| `scene/ui/` | The menu, the scoreboard, the goal sign (`sign.ts`), back, finish, the notice, the end of each two-player round (`DuelPanel`), the countdown, the tutorial, the icons of `xrIcons.ts` and the against-whom one, and where each panel goes with a headset and flat |
| `scene/**/*.engine.test.ts` | The run against the web's store, the round against `Stick.tsx` and the sound against `useGameSound.ts`, the world (and that what is in the package is the web's byte for byte), and the panels measured with the web's instrument in both languages and pressed with the mouse: they run with the domain tests |
| `godot-kit.json` | For the kit: the id, the repo (`..`), **the kit's version** (`kit`, an xrcade tag), the effects (with the note of the catch and the countdown in their steps) and the music |
| `games/stick-rush/` | What goes in the `.pck`; `tests/` stays out on export |
| `games/stick-rush/{sfx,music,feria,texturas,hdri,mandos}/` | The rendered effects (`npm run godot:sfx`), the music, the pieces of the kit, the wood, the square and the Quest controllers (`npm run godot:controllers`), with `CREDITS.md`. They are versioned. The square goes compressed for the GPU (BC6H and ASTC, 0.5 MB each instead of 4) and the wood, lossless and with its mipmaps |
| `games/stick-rush/tests/auto_run.*` | The whole automatic run (practice, Hard, nine sticks, one that gets away on purpose): sticks, points, record, what sounds, the machine and the fairground, and what the hall is told; the challenge with the hall's seed, which goes in playing, gives the same layout twice and is counted as a challenge; and the whole two-player run (`--two-players`): the two rounds with the same seed, the first one wins (the second lets one more get away), it is added to the pair's tally without touching the record, to the hall once and it sounds like winning |
| `games/stick-rush/tests/menu_mouse.*` | The real scene with mouse clicks: speed, sticks and hoop, play, that a click on a stick during the countdown does not grab it and while playing it does, that a click in the air grabs nothing, Escape, leaving the run, the mode that passes through and exit |
| `games/stick-rush/tests/xr_controller.*` | Two runs with a simulated headset grabbing with both hands: right-handed seated in the hall and left-handed standing. The hand of each catch and its pulse, the height of the world and of the hoop, the anchor, the turn, the tutorial with the controller in the hands and the hints |
| `tests/run.sh` | Everything of the engine at once (`npm run godot:test`) |

**Which tests go into the engine** is decided by the kit from the import graph: 36 of the 54 files
of `src/lib`, plus the kit's and the port's: **867 tests**. `npm run godot:build -- --list-tests`
says why the other 18 do not go in (those that use `vi`, those that touch `window` or read the
disk).

## How it is used

It needs the Godot 4.7.1 editor **built with GodotJS** (`xrcade/scripts/godotjs/`), in
`$GODOT`, and the xrcade repo alongside (`../xrcade`). From this folder:

```sh
(cd .. && GODOT=$GODOT npm run godot:test)     # everything of the engine, at once
(cd .. && npm run godot:build -- --tests)      # scene and tests → games/stick-rush/
$GODOT --headless --editor --generate-types --path .   # typings/ to check types
../node_modules/.bin/tsc -p tsconfig.json
$GODOT --headless --path . --import

# The effects, from the web's sound.ts (Chromium), and the controllers, from public/webxr-profiles/
(cd .. && npm run godot:sfx)
(cd .. && npm run godot:controllers)

# An automatic run: it prints STICK-RUSH-RESULT with what has happened and the cost per frame
$GODOT --headless --xr-mode off --fixed-fps 72 --path . -- --autoplay

# The challenge with a seed
$GODOT --xr-mode off --path . -- --reto=4242

# Playing flat with the mouse (click on a stick to grab it, Escape to ask or exit);
# `--lang=es|en`, `--tutorial` and `--ayudas` show them flat, `--room` shows your room
$GODOT --xr-mode off --path .

# With any user argument (or from a test scene) it is saved separately, in
# user://pruebas-de-la-escena/ and from scratch (the kit's `isolateSave`): nothing touches the save of whoever plays.
# Flat screenshots: the menu, mid-run, the end, the tutorial and the hints (from one side)
$GODOT --xr-mode off --resolution 1280x720 --path . -- --shot-menu=/tmp/menu.png --lang=es
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 60 --path . -- --autoplay --shot=/tmp/partida.png
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 60 --path . -- --autoplay --shot-menu=/tmp/final.png
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --shot-tutorial=/tmp/tutorial.png --lang=es
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --shot-hints=/tmp/ayudas.png
# Two players (`--two-players`: the challenge and two players chosen): the menu, the notice to pass the
# controller after the automatic player's first round, and who wins when the second one ends
$GODOT --xr-mode off --resolution 1280x720 --path . -- --two-players --shot-menu=/tmp/a-dos.png --lang=es
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --autoplay --two-players --shot-menu=/tmp/pasa.png
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --autoplay --two-players --shot-duel=/tmp/gana.png

# What would be seen with the headset, without a headset: the fake head acts as the camera and the
# automatic player grabs with the hands. `--menu` stays in the menu, `--mirar=<degrees>` turns the
# head to the left (the column is at 30°) and `--look-down=<degrees>` lowers the gaze (the scoreboard)
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --visor-simulado --menu --mirar=30 --shot-menu=/tmp/columna.png
$GODOT --xr-mode off --resolution 1280x720 --fixed-fps 72 --path . -- --visor-simulado --look-down=25 --shot=/tmp/visor.png

# The .pck for the hub (run the build first)
GODOT=$GODOT ../../xrcade/scripts/pack-game.sh "$PWD" stick-rush
```

**The kit's version is pinned** in `godot-kit.json` (`"kit": "v0.22.0"`). Day-to-day work does not
look at it: `npm run godot:build`, `godot:test` and `pack-game.sh --local` use the checkout
alongside (`../xrcade/godot-kit`). The `.pck` that goes to the hall does: xrcade's
`npm run game:pack` takes the kit from that tag and not from the checkout, and `hub:build` and
`godot:quest` do not carry it if it came out with another one. To use something new from the kit,
`kit` is raised to an xrcade tag that brings it before publishing the game
(`xrcade/docs/anadir-un-juego.md`, «La versión del kit»).

Stick Rush is in the catalogue of the headset hub (`targets.godot` in
`xrcade/registry/games/stick-rush.json`): xrcade's `npm run godot:test` packs it from here and
checks that the hub mounts it, hands it the screen and goes back to the hall.

## What is known and what is missing

- **Cost per frame** (whole scene: the run, the round, the painted sticks, the fairground, the
  hints, the sound and the interface), automatic runs at 72 fps on macOS (M5 Pro, windowless):
  **~145–160 µs on average while playing** flat (~320 µs peak) and **~255 µs** with a simulated
  headset (it adds the XR grammar, the hints, the tutorial and the controllers in the hands). The
  scoreboard and the menu are only rewritten when they change, and the sticks only touch the engine
  if they have moved. With the kit's pieces and scenery, ~115 µs playing flat and ~170 µs with a
  simulated headset (measured with the same save before and after: the same).
- **Differences from the web, on purpose**: the panels are opaque (translucent ones, in Godot, show
  through much more) and cast no shadow, and as on the web nothing of the machine or of the
  fairground casts a shadow (the kit's pieces do not cast one unless asked); flat, the panels hang from the camera (on the web the
  DOM replaces them); the menu does not carry the sound and music switches (they are the hall's
  volumes) nor the end the share one (in the headset there is no clipboard); **the end carries
  lettering** —how it has ended and the points, with the phrases of `HUD.tsx`—, which the headset's
  web cannot write; the interface stays where the world was planted instead of following the gaze
  (`XRGazeAnchor`); the footprints go two millimetres above the ground, because Godot has no
  `polygonOffset` for translucent things; and the HDRI's square goes as background, without
  projecting it onto the ground (drei's `ground`).
- **Not there**: the drawn glove and articulated hand (`PlayerHands.tsx`; with controllers the
  real controller is seen only during the tutorial), grabbing with the bare hand (Stick Rush has
  no `pinch.ts`, and the hall also has it turned off), the curtain on changing scenery
  (`SceneryFade`), the shader prewarming (`PrewarmShaders`) and `prefers-reduced-motion` (Godot
  does not give it: the sticks always sway and the crowd always dances). The light has been taken
  from the intensities of three to those of Godot with one scale per light (`ENERGY_PER_UNIT` of `fairground.ts`), set by eye on
  the screenshots of the port: it is still to be compared side by side with the web.
- **What only the headset can tell**, besides what is in `salir-en-steam.md` 4.2 and 4.3:
  1. **Grabbing by hand**: that the 9 cm grab sphere at OpenXR's `grip` falls where the hand
     closes, and that squeezing the side trigger on a falling stick grabs it as on the web.
  2. **The hoop's height**: half a metre above the eyes measured in the menu, standing; seated at
     eye level, at its height with the world lowered. That the sticks cross the arm's reach in both.
  3. **What is felt**: the grab in the hand that grabs, and the in extremis one stronger.
  4. **The column on the left** (30°, 1.5 m, ×1.35) with the sticks crossing in front, and the
     scoreboard under the hoop: that they are read with the engine's lettering.
  5. **The tutorial** above the scoreboard and the real controller in both hands, and **the
     hints**: the footprints, the ghost stick and the controller beside it.
  6. **The HDRI's square as background without projecting** onto the ground, the light of the
     fairground and the crowd swaying in the shader at 72 fps on the Frame.
  7. **Seated**: that the 30° turn with the stick of the free hand lets the whole machine be seen.
