# History of stick-rush — round by round

> This is the long memory: what was done in each round, what was tested with the goggles on and
> why what was decided was decided. **It is only read if the question is "why is this the way
> it is"**; to work today, `ESTADO.md` is enough. The sections are just as they were written
> at the time, with their date or their branch, in the order in which they were added.

### What was in ESTADO.md until 2026-09-27

> **How to continue after a restart:** tell Claude "check `ESTADO.md` and continue with the next
> step". This file is the memory between sessions: keep it short, truthful and up to date.
>
> The **backlog** (what is left to do) lives in **`TODO.md`**. Here go the state and the
> why of the decisions; there, the list of tasks.

---

#### 📍 Headset round of 24/09 (on develop, no version; the latest is v0.21.0)

"It's perfect", with four touch-ups. Done:

- **A tiny step back**: `PLAYER_OFFSET_Z` −0.02 → **+0.08** (`lib/gameConfig.ts`). The sign
  matters: negative is *towards* the arc (at −0.18 you started on top of the machine), so the
  step back is positive. The front stick ends up 65 cm away horizontally (arm: 75).
- **Higher machine**: `HOOP_RISE_ABOVE_EYES` 0.35 → **0.5** (`lib/hoopHeight.ts`), now
  decoupled from `MACHINE_HEIGHT` (desktop stays at 1.95). The speed is scaled with the
  travel, so the difficulty does not change. The reach invariant becomes "every stick
  **crosses** the arm as it falls, ≥ 40 cm of band" (`hoopHeight.test.ts`), not "hanging within
  reach".
- **Hands in VR, mounted by the scene** (`components/xr/PlayerHands.tsx`, logic in
  `lib/hands.ts`), not by the `XRStore`: the store's ones only exist on the game's own website,
  and in the hall the store belongs to the hall, which does not draw hands. This way they come
  out the same in both places. They are placed like `RealController` (WebXR pose with the parents
  undone, `placeAtOrigin`).
  - With controllers, a procedural low-poly **glove** in the `grip-space` (`Glove.tsx`, logic in
    `lib/glove.ts`): 16 boxes in an `InstancedMesh`, it closes the fist with the side button and
    the index finger with the trigger; the fingertips carry the grip hint. It is **no longer**
    in `StickRushController` (which still draws the controller and the pointers only on the
    game's own website).
  - Without controllers, the `generic-hand` **articulated hand** bone by bone (`fillPoses`),
    loaded without suspending from `public/manos/generic-hand/` (190 KB;
    `npm run sync:xr-profiles`). It goes **outside `webxr-profiles/`** because the hall deletes
    that folder of each game when installing it (`xrcade/scripts/install-game-assets.ts`);
    `copy-assets.mjs` now copies `manos/`. The game's own store is left with `hand.model: false`
    so as not to paint it twice.
  - **xrcade was not touched** (option B): turning on `hand.model` in the hall changed the
    sixteen games, all with `hand.model: false` on purpose, and five draw their tool in the bare
    hand (bow, pistol, paddle, two mallets).
  - New e2e with a **test host** (`e2e/support/host*.ts(x)`, `globalSetup.ts` shared with
    eight games): scene in someone else's Canvas, store with no controller or hand like the
    hall's. It checks glove in the hand (±12 cm), bare hands visible, `.glb` requested under the
    game's prefix.
- **Settings column** (common rule): the headset menu goes from facing you at 95 cm to
  **1.5 m and 55° to the left**, at eye height, facing you and scaled ×1.35
  (`XR_COLUMN`, `XR_MENU_POSE`, `onMenu` in `lib/xrLayout.ts`). Without a headset (hall on
  desktop) it stays in front (`XR_MENU_DESK_POSE`). The dead zone of the anchor is lengthened to
  the left by as much as the column is set aside (`leftDeadzone`, `lib/xrAnchor.ts`): otherwise,
  looking at it made it run away. The notice about leaving the run stays in front.
- **Haptics by contact** (the common `lib/hapticFeedback.ts` + `lib/haptics.ts`): catching = `grab` in
  the hand that grabs, ×1.8 if it is in extremis (≥ 80 % of the fall). The stick that gets away
  no longer vibrates (`XRHaptics` deleted). The tap of the menu button is kept (it is not a
  contact).
- **Controller next to the gesture**: does not apply as is (stick-rush has no `Hints.tsx`); the
  grip hint goes on the drawn hand.

**Pending in the headset:**

| What to look at with the goggles | Where to touch |
|---|---|
| Is the step back just right? Can the front stick be reached? | `PLAYER_OFFSET_Z` (`gameConfig.ts`) |
| Machine at a good height? Do they hang above the face? | `HOOP_RISE_ABOVE_EYES` (`hoopHeight.ts`) |
| Column: distance, angle, size; do the sticks hanging in front of it get in the way? | `XR_COLUMN`, `XR_MENU_SCALE` (`xrLayout.ts`) |
| Does the glove read as a hand? Can it be seen closing? Position over the real controller. **In the hall it goes with no drawn controller underneath** (the game's one belongs to its own store): is it understood like that? | `PALM`, `KNUCKLES`, `THUMB` (`Glove.tsx`); `REST`, `CLOSING_SPEED` (`glove.ts`) |
| Bare hands, on the web and in the hall: does the model fit the real hand? | `PlayerHands.tsx` (`BareHand`) |
| Is the catch felt? And the in extremis one, differently? | `IN_EXTREMIS`, `IN_EXTREMIS_BOOST` (`haptics.ts`); recipes in `hapticFeedback.ts` (common) |

**In the hall, with bare hands nothing is caught**: the hall has `hand.grabPointer: false` on
purpose, and stick-rush's grip is that pointer. The hand is seen but does not grab. It is the
hall's decision (it was not touched); if wanted, it means enabling it there while looking at the
other sixteen.

Mind the column: the sticks hang from the hoop between whoever plays and the panel (at 55° there
are 3–4 with 13 sticks), and its top half is seen between bars. It already happened when facing
it. If it bothers, the rule allows going further away, never closer.

#### v0.7.2 (2026-09-07): the tests now say how much code they run

- **The suite measures its own coverage** (`npm run coverage`, and one more step in CI).
  **The domain** (`src/lib`) is measured, which is the only thing that can be tested without a
  browser with WebGL; the scene is tested end to end.
- **It is at 100 %, and the minimum is 100**: whatever is added untested breaks the build. The
  few branches that no test can reach —guards that would only act if the neighbouring code
  changed— carry `v8 ignore` with the reason written next to it, not a lower number.
- To get there, tests were written for what nobody tested: the storage when the
  browser does not let it save, the sound engine against a fake `AudioContext`, the headset
  panel and the state of the run with fake clocks.
- The HTML report is left in `coverage/`, which is not committed.

#### Where we were on 2026-09-06 (superseded: today it is at v0.21.0)

**The game is published and mounted in the xrcade hall.** The tags `v0.2.0` to `v0.5.0`
exist and are on `origin`; xrcade has to move to **`v0.6.0`**.

**`v0.6.0` (2026-09-06): the fairground responds to the player.** There was a Ferris wheel and
stalls but nobody inside: now there is a **crowd** —42 silhouettes (body and head merged into
one geometry, one family instanced with `createInstances` = **one draw call**), in a ring
between the garlands and the stalls, looking at the machine (`lib/crowdLayout.ts`,
`components/game/Crowd.tsx`)— that sways higher and faster with the streak. And the **bulbs** of
stalls and garlands rise in brightness with the streak (1.6 → 3.2, saturating) and from **5
sticks in a row they throb** towards white, faster the longer the streak (`lib/fairMood.ts`,
`BulbMood` in `FairPieces.tsx`): the material of the whole family is touched, so it costs the
same with a hundred bulbs as with a thousand. The streak reaches the fairground through a
**ref** (`FairMood.tsx`) and not through props: the set is not rendered again by anything that
happens in the run. With `prefers-reduced-motion` the crowd stays still and the bulbs do not
throb (the brightness does rise, since that does not move). The scene goes from 29 to **30 calls
in the menu**; the breakdown lives in `e2e/fairground.spec.ts`. **None of this has been tested
with the goggles.**

**`v0.5.0` (2026-09-06): three modes.** Besides practice and challenge, **Levels**: a
ladder of its own with 15 levels (`levels.ts`: 5/9/13 sticks for each speed), with no lives,
scored with stars (60/80/100 % caught) and with the unlocking and the stars saved
between visits (`progress.ts`, `createStoredPreference` in `storage.ts`). And practice gains
**Endless**: since the sticks are created all at once, it works by **rounds** (`stickSeed`
changes with each round and the machine reloads; `waveScore/waveResolved` count the round,
`score/resolved` the run); the player ends it («Terminar», or the green button on the right in
the headset) and what is saved is the **best streak**. In the headset the mode switch cycles
through the three, the row of sticks becomes the ladder in Levels, and there is a round/endless
switch in the middle of the settings row. The challenge stays the same: the heroic mode with
lives. **None of this has been tested with the goggles.**

`develop` = `origin/develop`; `main` is **31 commits behind** and is what Vercel deploys.
Publishing to `main` (`git merge --ff-only develop && git push origin main`) is a decision of
yours after the session with the headset.

Verified today: lint and typecheck clean, **538 unit tests** and **77 e2e** green,
`npm audit` with no vulnerabilities. The detail of each round —what was tested with the goggles,
what was decided and why— lives in **`docs/historial.md`**, which is only read if the question
is "why is this the way it is".

#### ⏭️ NEXT STEP (the first thing on coming back)

0. **Test in the headset what was added on 2026-08-06.** The emulator cannot press buttons,
   so none of this is validated on hardware. What to look at: (a) that the **position of the
   player** is now the right one, without taking the step forward; (b) that the **size** is
   convincing after the −8 %; (c) that the **scenery/passthrough selector** works and the fade
   does not cause dizziness; (d) that the **countdown** gives enough time; (e) that the green
   flash and the red sticks on the floor read well with the goggles; (f) that the **icons** for
   home and for exit can be told apart at a glance, and whether those for repeat, scenery and
   passthrough are understood or have to be redone as well; (g) that the **sound** is heard
   inside the session, that hit and miss can be told apart without looking and that the volume
   (`MASTER_GAIN`, 0.28) is not intrusive right against the ears; (h) that the three
   **vibration hits** can be told apart without looking and do not end up being a nuisance (the
   three recipes, in `src/lib/haptics.ts`): the one for the hit with the arm moving and without
   a long streak turning it into a buzz (`CATCH_PULSE`, 0.7 and 45 ms); the one for the
   miss, which comes out through both controllers and has to read as something else and not as a
   weak hit (`MISS_PULSE`, 0.35 and 140 ms); and the one for the menu buttons, which with
   thirteen sticks are thirteen presses in a row (`PRESS_PULSE`, 0.25 and 18 ms);
   (i) that the **record mark**
   on the score bar can be told apart from the fill with the goggles on, and that
   on beating it you notice the bar changing (`ScoreBar` in `src/components/xr/XRHud.tsx`);
   (j) that the new **fairground** does not eat the frames in the headset, that the
   stalls are not oppressive at 6.4 m and that the Ferris wheel turning in the periphery does
   not cause dizziness. The draw cost is already measured and rules out the fairground, so the
   script of what to look at and which constant to touch in each case is in "Validating the
   fairground in the headset"; radii and distances, in `src/lib/sceneryLayout.ts`.
   (k) that the **share button** of the end screen works with the goggles
   on: if the headset opens the system sheet, that it can be used without taking them off;
   if not, that the paper plane turns into a check mark (text copied) and that on
   taking off the headset the result really is on the clipboard. The red cross
   means that the headset's browser allows neither sharing nor copying: if it shows up, a
   decision is needed on what to do instead. The emulator cannot press 3D buttons, so
   this **is only validated on hardware** (`ShareButton` in
   `src/components/xr/XRHud.tsx`).
   (l) that the **start button** now shows a play triangle —until now it was seen
   edge-on— and that it reads at that distance with the 3.2 cm radius the drawing
   has; and that the **UI at eye height** falls well standing and seated: that
   the panel does not cross the machine if someone tall plays, that the scoreboard does not end
   up too low playing seated on the floor, and that the row of the hoop adjustment stays
   comfortable to look at (see "Immersive menu: the triangle and its height"; `xrUiRise` in
   `src/lib/xrLayout.ts` is what has to be retouched if the whole ends up high or low).
   Values to retouch: forward offset of the player (`PLAYER_OFFSET_Z`, −0.18 m), size
   (`MACHINE_RADIUS` 0.57 m and `STICK_LENGTH` 0.39 m — on changing them `DIFFICULTY_SPEEDS` has
   to be recalculated to keep the times, which `gameConfig.test.ts` watches),
   duration of the count (`COUNTDOWN_SECONDS`), fade (`FADE_SECONDS` in
   `SceneryFade`), dead zone of the anchor (`XR_ANCHOR_DEADZONE`, 40°) and grab radius
   (9 cm, in `XRController`).
1. **Publish `main`** (`git push origin main`): without that the deploy does not carry the
   latest changes.
2. **Deploy a preview on Vercel** and test it from the headset (see "Notes for the deploy").
3. Check that in AR the passthrough is still seen after the geometry changes.
4. ~~Clean up the remote's branches before making the repo public.~~ **DONE
   (2026-08-06).** The remote has **only `main`**, and its only author email is the
   `noreply` one: the personal one is no longer in any published place. The seven Dependabot
   ones and `fix/xr-escena-y-hud` were deleted (04-08), and `master` and `agent/stick-rush-v1`
   (06-08). Dependabot will recreate its branches by itself on the new `main`. Note: PRs #1 and
   #2 point to orphan commits since the rewrite of the history.
5. ~~Consolidate git locally.~~ **DONE (2026-08-06).** Only `main` and `develop` are left,
   both on the same commit and with no stray worktrees. The six branches already
   integrated were deleted, and so was the dead worktree of `agent/inicializar-proyecto-…`
   (693 MB; its 22 staged files were the scaffold of 28 June, with Zustand, which the project
   discarded). Before forcing each deletion it was checked that the branch did not have a single
   file outside `main`; in the case of `fix/xr-mandos-y-menu-visible` it was also verified
   that its tree was **identical** to that of the merge of PR #10.

#### 🧭 Working conventions learned

- **Commits and push**: `.claude/rules/git-workflow.md` forbids `push` and touching `main`. In
  practice the owner of the repo authorises it case by case; without explicit authorisation,
  commit on a branch and offer the command.
- **Verify before taking anything for granted**: `npm run lint`, `npm run typecheck`,
  `npm test` and `npm run test:e2e`. The e2e suite takes ~1 min and has time-sensitive
  parts; if something fails intermittently, run it again before "fixing" anything.
- There is a **backup of the history prior to the rewrite** in
  `refs/backup/main-antes-de-reescribir` (SHA `e0750ca`), in case it were needed.

#### 🔒 Godot: frozen until the web is closed

**Decision (2026-07-31): `godot/` is not touched while iterating on the web.** First the
web is left the way it must end up (gameplay, look, XR) and only then is the final result ported
to Godot, in one go. Porting each iteration along the way would be wasted work.

Pending for that moment (not before):

- [ ] Replicate in Godot the redesign of the web: **horizontal** hoop around the player, human
      scale (metres), speeds in m/s, fairground look and yellow sticks. Today `godot/`
      keeps the vertical arc and the old units. Detail in `godot/README.md`.
- [ ] Decide what happens with a missed stick: on the web it stays stuck in the floor, in Godot
      it disappears.
- [ ] Open the project in Godot 4.3+ for the first time (it was written without running it,
      there is no Godot on this machine) and review the editor's warnings.

#### What stick-rush is

- A web game (Next.js + React Three Fiber) of sticks that hang from a semicircular
  machine and fall in a staggered way; the player catches them with a click (browser)
  or with the controllers (XR VR/AR). They select the number of sticks (5–13) and difficulty.

#### Firm decisions

- Stack: Next.js 16 (App Router) + React 19 + TypeScript; R3F + drei + three +
  `@react-three/xr`; Tailwind v4. Global state with the **Context API** (no Zustand/Redux).
- `npm` as the package manager (the pnpm that the scaffold generated was discarded).
- **The Node version is pinned in `.nvmrc` (today 24.19.0) and the CI reads it from there**
  (`node-version-file`, not `node-version`). The format of `package-lock.json` changes
  between npm versions: with the CI on Node 22 (npm 10) an `npm install` rewrote some
  220 lines of the lock, generated with npm 11. The patch is pinned on purpose —leaving it at
  a bare `24` would again leave the npm version to chance—, so bumping it is a manual
  change: when doing so, check that `npm install` still leaves the lock intact.
- `build` sets `NODE_ENV=production` in the script because the environment exports
  `NODE_ENV=development`, which broke the prerendering of `/_global-error`.
- **A stick can be grabbed until it touches the floor, hanging included** (decided on
  2026-08-10). Getting ahead of the stick is playing, not cheating: the window opens
  when the run starts and closes when the stick is resolved. What is
  closed is the other end: a stick already resolved does not count again (the missed one
  stays lying there, but it is set dressing) and with the run stopped —countdown
  included— nothing can be grabbed. That 13 sticks on Easy can be emptied from the hoop is
  accepted in exchange for two counterweights that already exist: the countdown and the
  reflex bonus, which pays double for grabbing it up high. The rule lives in
  `canCatchStick` (`src/lib/xrInteraction.ts`) and unit tests pin it; the e2e "a stick
  that still hangs from the hoop can be caught" checks that the game really
  complies with it, with a click on a stick not yet released. The desktop
  cursor follows it too when the window opens or closes by itself under
  a still pointer (the countdown ending, the stick that touches the floor): a
  `useEffect` in `Stick` reviews it, because without moving the mouse no new
  `pointerover` arrives.

#### Done so far

- **The in-scene UI is now seen when the hall mounts it.** It was always hidden
  when there was no WebXR session, because on the game's own website the DOM rules and its
  buttons would catch the mouse clicks ahead of the game. But the xrcade hall **puts no DOM**:
  mounted there and without a headset, the game was seen whole and there was no way to start the
  run. Now `hasDomUi` decides it —whoever mounts the scene passes it, the game does not guess
  it—, as in the new games.

- Base of the Organízate suite installed (`.claude/rules/`, `.claude/agents/`, `CLAUDE.md`).
- Next.js project initialised and installed (R3F, drei, xr, three).
- First playable version of the game:
  - `StartScreen` (selection of sticks and difficulty, CTA, VR/AR buttons if supported).
  - 3D scene: `StickMachine` (arc with TubeGeometry), `Stick` (fall + catch + glow),
    `Ground` (plane + grid), `HUD` (scoreboard and end screen).
  - Game context (`gameStore`) and config (`gameConfig`).
  - `global-error.tsx` with its own UI.
- Verified: `npm run lint` (0 problems), `npm run typecheck` (0 errors),
  `npm run build` (OK, routes `/`, `/game`, `/_not-found` prerendered),
  `npm run start` serves `/` and `/game` with HTTP 200.

Since that first version, round by round, the following have come in: the redesign of the
machine at human scale with the horizontal hoop, the XR gameplay with grabbing by closing the
hand and an immersive menu, score with countdown, sound and vibration, practice mode and
challenge mode, the fairground as VR scenery with the machine instanced, the first-time
tutorial, the hoop height per player, sharing the result, the record and the mute
remembered, and the separation of the game from its website so that xrcade mounts it as a scene.
The why and what was left to check for each one is in `docs/historial.md`.

#### Notes for the deploy on Vercel

- **Nothing needs to be configured**: there are no environment variables, no database, no
  requests to third parties. `npm run build` (with its `NODE_ENV=production`) works as is.
- **The WebXR emulator will not appear**: `@react-three/xr` injects IWER only when the hostname
  is exactly `localhost` (hence the "Enter XR" button and the "Multiple instances of
  Three.js" warning locally). Checked by serving on `127.0.0.1`: both disappear.
- **Deployment protection**: if the preview has Vercel Authentication enabled, the
  headset's browser will have to log in to Vercel to open it. It is best to disable it for
  that preview or to use a production domain.
- **Open the direct URL in the headset**, not embedded in an iframe (the preview of the Vercel
  dashboard is one): WebXR needs `allow="xr-spatial-tracking"` on the parent iframe.
- HTTPS with a valid certificate, so in the headset there are no certificate warnings to accept
  as with `npm run dev:https`.

#### Caveats and notes

*(The list of pending tasks is in **`TODO.md`**. Only the traps of the
environment are left here: they are not tasks, they are things to trip over.)*

- **Publishing a new version** goes by tag on `develop` (`v0.2.0`, `v0.3.0` and `v0.4.0` are
  already there): the procedure and the check that the `version` matches the tag are in
  "Publishing a new version" of `docs/mounting-the-game.md`. xrcade bumps it with
  `npm run game:update`.
- **xrcade installs this private repo** with the machine's git credentials; its CI uses an
  organisation token (`XRCADE_GAMES_TOKEN`). Decided and written in xrcade.
- **Test the mounting for real from xrcade**, with the headset on: that the immersive
  session, the controllers and the audio keep working inside another application, which is a
  different context from the one here and cannot be validated in this repo.
- Validate and polish the XR interaction with controllers on real hardware.
- **Test the hoop height in the headset** (see "Hoop height per player"): that standing
  it stays where it was, that seated it goes down by itself and nothing has to be touched, that
  the ±20 cm of `HOOP_ADJUST_RANGE` are enough to accommodate it and leave no stick far away,
  and that the top row of the panel does not force you to crane your neck (it is 10 cm above the
  eyes, and the limit of the test is 15).
- ~~**The immersive menu is still at a fixed height** (`XR_MENU_POSITION`, 1.40 m).~~ **DONE**:
  the whole UI now hangs from the player's eyes, see "Immersive menu: the
  triangle and its height". It remains to be tested with the goggles.
- **Test the first-time tutorial in the headset** (see "First-time
  tutorial"): that the controller of the demonstration reads at 95 cm and is recognised as the
  one held in the hand, that two grip cycles are enough to understand the gesture, that 13
  sticks in a row can be counted at a glance, and that the 7.4 s do not feel long (the script is
  in `TUTORIAL_STEPS`: splitting it differently touches no component). While at it, look at the
  two overlaps noted in that section —the handle over the progress bar and the bars of
  «Imposible» spilling out of the chip— and the button to bring it back, which is the only
  miniature controller of the menu and nobody has yet seen whether it is understood.
- Possible improvements: ~~"vibration" animation of the hanging sticks~~ (done, see
  "Swaying of the sticks"), timer/score by time, ~~a more elaborate VR
  scenery~~ (done, see "VR scenery: fairground").
- ~~**Decide whether a stick should be catchable while it still hangs.**~~ **DECIDED
  (2026-08-10): yes, it can be grabbed until it touches the floor.** See "Firm decisions". The
  behaviour does not change; what changes is that the rule stopped being written twice
  inside `Stick.tsx` (catch and cursor) and moved to `canCatchStick`, with unit tests that
  hold it. The e2e "catching a stick adds to the scoreboard" stays as it is: it relies on the
  hanging sticks, which are still catchable on purpose, although it does not require it (the
  sweep works just as well for one that is falling). A new one requires it, "a stick that still
  hangs from the hoop can be caught": if some day the window is closed to `falling`, it is the
  one that goes red.
- **No worktrees nested inside the repo.** Besides the "multiple
  lockfiles" warnings when compiling, if the worktree ever has a compiled `.next/`, `npm run
  lint` walks all of it: the `globalIgnores` of `eslint.config.mjs` are relative
  (`.next/**`) and do not reach `.claude/worktrees/*/.next/**`. More than 13,000 problems came
  out, none of them the project's. It was solved by removing the worktree, not by touching the
  config.
- The R3F Canvas is loaded with `dynamic(..., { ssr: false })`; it depends on WebGL/`window`.
- The `GameProvider` is mounted at page level (not in the root layout) so as not to
  drag client context into the internal page `/_global-error`.
- Port 3000 may be taken by another process of the system; use `PORT=...`
  for `npm run start` if needed.

## Tests (2026-08-03) — up-to-date figures in "WHERE WE ARE"

There is now a runner, and it is part of the checks before considering anything finished.

- **Unit — Vitest + Testing Library** (`npm test`). They cover `src/lib`:
  geometry of the hoop (`machinePoint`), consistency of the difficulties, fall times per
  level, layout and delays of the sticks, states of the scoreboard and the complete cycle of the
  run in `gameStore` (including the case of two sticks being resolved in the same batch).
- **End to end — Playwright** (`npm run test:e2e`, Chromium on the production
  build). Menu, selection, keyboard, run, catching sticks with the mouse, end of
  run, rematch, absence of console errors, zero external requests and mobile
  screen. A separate test (`npm run capture`) regenerates the README screenshot.
- To be able to test the logic without a browser, it was taken out of the 3D components into
  **`src/lib/stickLayout.ts`**: layout of the sticks around the hoop, staggered delays and
  states of the scoreboard. `STICK_MISS_Y`, `STICK_FALL_DISTANCE` and `fallDurationSeconds()`
  move to `gameConfig.ts`. The components only paint.
- To have stable hooks (and accessibility while at it): the scoreboard is `role="status"` with
  `aria-live` and the end of the run `role="dialog"`.
- The e2e uncovered a real breach: the difficulty buttons measured **42 px** in height,
  below the 44 px touch minimum of `.claude/rules/design.md`. Fixed there and in the
  VR/AR buttons.
- The e2e are served on `127.0.0.1` and not on `localhost` on purpose: with `localhost`,
  `@react-three/xr` injects the IWER emulator and an "Enter XR" button appears that does not
  exist in the real game.

## Fixed in the review (2026-07-31, branch `fix/xr-escena-y-hud`)

- **AR no longer paints the scenery**: `SceneBackdrop` (in `GameCanvas.tsx`) omits background,
  fog, floor and `<Environment>` when the mode is `immersive-ar`, so that the passthrough is
  seen and only the machine is left. R3F creates the renderer with `alpha: true`, so not
  painting is enough.
- **Scale of the player in XR**: `XROrigin` is enlarged with `XR_PLAYER_SCALE` (2.2), so that
  the world is perceived at ~1/2.2 and the arc ends up ~1.3 m above the eyes.
  > **Obsolete:** `XR_PLAYER_SCALE` disappeared when the scene moved to metres; today the
  > player is at 1:1 and the hoop is at 62 cm (see "XR gameplay").
- **Supports resting on the floor**: they go from `GROUND_Y` to the start of the arc, on the
  web and in Godot (`main.gd`), which had the same bug.
- **3D HUD in immersive** (`XRHud.tsx`): one chip per stick (caught / missed / pending),
  told apart by colour *and* by size and height. With no text on purpose: drei's `<Text>`
  would download the fonts from a CDN. On finishing, a bar marked the pause
  (`XR_RESTART_DELAY_MS`) before chaining the next run.
  > **Obsolete:** the automatic restart and `XR_RESTART_DELAY_MS` were removed on
  > 2026-08-03; now on finishing you choose between repeating and going back to the menu.
- **Double resolution of a stick**: `Stick.tsx` uses a guard ref (two XR controllers on the
  same stick, or a catch right as it touches the floor, no longer add up twice) and gives the
  cursor back on unmounting.
- **Critical bug found while fixing the above**: `XRSessionController` did
  `resetGame()` with `mode == null && gameState === 'playing'`, and on desktop `mode` is always
  null → on pressing "Jugar" the run cancelled itself and went back to the menu. **Desktop
  mode was broken.** Now it is remembered whether there was an immersive session before going
  back to the menu.
- `gameStore` exposes `resolved` (resolved sticks) and derives `finished` instead of storing it,
  removing the mutable ref and the risk of losing simultaneous resolutions.

## Verified in the browser (2026-07-31)

End-to-end test on the production build with headless Chromium (Playwright, installed
outside the repo; the script lives in the session's scratchpad, it has not been added as a
dependency): menu → choose 9 sticks and Easy → Jugar → clicks on the sticks → end of run.

- The scene renders: ~1,000 draw calls/s, canvas sized, sticks falling staggered.
- They are caught with a click (scoreboard 0/9 → 1/9) and the run closes by itself when all are
  resolved.
- **Zero requests to external domains.**
- Clean console except for a deprecated `THREE.Clock` warning, which comes from inside the
  libraries, not from the project's code.

Mind the environment: if it is tested in a tab that Chrome has in the background
(`document.visibilityState === 'hidden'`), `requestAnimationFrame` does not run and R3F neither
sizes the canvas nor paints. The blank canvas there does not indicate a bug of the app.

## Redesign of the machine (2026-07-31)

The machine was a **vertical** arc with the player in front: in XR the middle sticks fell
on their head. Now it is a **horizontal** hoop (semicircle in the XZ plane) and the player
stands in the centre, so the sticks fall around them, within arm's reach.

- The whole scene moves to **human scale (1 unit = 1 metre)**: hoop of 1.25 m radius at 2.15 m
  of height, 42 cm sticks, floor at y=0. With that, the hack of enlarging the player in
  XR (`XR_PLAYER_SCALE`) disappears: now they are at 1:1.
- The speeds per difficulty were recalculated to m/s to keep the fall times
  (Easy ~5.7 s, Impossible ~0.7 s) over the new travel of 1.6 m.
- Fairground look: hoop with red and cream stripes with hooks per stick, upper lattice (hoop,
  uprights and zigzag diagonals), garland of bulbs with socket, braced posts
  with a base and sticks of yellow wood, all of the same colour. The lattice and the stays are
  deliberately redundant: with a single tube the machine looked as if it were going to fall.
- Scenery: HDRI of a **village square at night** (with garlands of pennants), served from
  `public/hdri/`. It acts as the background, lights the scene and is **projected onto the
  floor** (`<Environment ground>`), so that the machine stands on the real cobblestones instead
  of on a plane of colour with a visible cut against the horizon. In AR it is kept only as
  reflections. The scene's own floor no longer paints anything: it only receives the machine's
  shadow.
- The 1K EXR is used (2 MB). There is a 2K one available (~8 MB) if a sharper background is
  wanted in the headset; it means changing the file and `HDRI_PATH`.

**No 3D model of a fairground machine was found** (Poly Haven only has household props),
so the machine is still geometry by code, now with more detail.

*(The Godot debt is above, in "Godot: frozen until the web is closed".)*

## XR gameplay after the first headset test (2026-08-03)

Five things that came out of testing it with the goggles on, all in
`feat/xr-menu-inmersivo-y-seguridad`:

- **Entering VR/AR no longer starts a run.** `XRSessionController` leads to the menu and
  the new `XRMenu` draws it with geometry: a row of 13 sticks (lit up to the
  chosen one), five difficulty chips with growing bars, and a start button.
  **Without a single letter**, like the HUD: drei's `<Text>` downloads the fonts from
  a CDN and the CSP now blocks it. Common parts in `XRUi.tsx`.
- **You can go back.** Exit button to one side during the run
  (`XRQuitButton`) and, on finishing, repeat or go back to the menu. The automatic
  restart was removed and with it `XR_RESTART_DELAY_MS`.
- **The sticks no longer fall in order.** `buildStickLayout` took the delay from the index,
  so they always fell from left to right. Now `fallOrder()` shuffles
  (Fisher-Yates seeded with `runId`) and the position on the hoop says nothing about the turn.
- **The hoop comes down within arm's reach**: radius 1.25 → **0.62 m** and height 2.15 → 1.95 m.
  The speeds were recalculated to keep the times per difficulty (the
  travel got 12 % shorter), the profiles were thinned and the desktop camera was
  reframed. `xrInteraction.test.ts` pins that the hoop does not move out of reach.
- **You catch by grabbing, not by pointing.** `Stick` looks at the `pointerType` of the event
  and discards `ray`: the grab (`grab`, a sphere in the fist with the *squeeze* button) and the
  contact of the hand (`touch`) do count; the ray is left only for the menu. It is
  resolved on `pointerdown` and not on `click`, because with the stick falling, demanding
  press-and-release on the same object made good grabs fail.
- As a bonus: the sticks **no longer fall while you are in the menu**. Their clock ran from
  the moment they were mounted, so on starting they could already be on the floor.

## XR tests with an emulator (2026-08-03, branch `test/xr-emulado`)

Chromium does not implement WebXR, so until now **no test touched the immersive
mode**: they all came in through the mouse, which is another code path. IWER is
injected (Meta's emulator, already present as a dependency of `@react-three/xr`) with
`page.addInitScript` and real sessions are opened, with a Quest 3 and its two controllers.
The bundle is generated in `globalSetup` with esbuild and is gitignored.

Covered: that the entries to VR/AR appear, that **entering VR leads to the menu and does not
start a run on its own**, that the sticks are not released in the menu, and that leaving the
session returns to the menu (which in passing proves that the app recognises the mode).

**What could NOT be covered, and why:** moving the controllers and pressing their buttons. The
emulator delivers a session, two `inputSources` and ~125 fps, but the pointers of
`@react-three/xr` do not emit events on the objects of the scene. It was ruled out by
diagnosis: it is not the orientation of the ray (it fails just the same with grab and with
direct contact), nor the position (2D sweep of the whole plane of the player without a single
hover), nor the frameloop, nor the mode detection. **Retried on closing v2 and it is still the
same**, so it stops being treated as pending work: it is a limitation of the tool, not something
that is left to do.

What covers that risk by another route, so that it is not left hanging:
`src/lib/xrInteraction.ts` and its tests check the GEOMETRY —that the buttons fall inside the
field of view, that they face the player, that the hoop stays within arm's reach—, which is half
of the failure that a press test would catch. The other half, that the event really arrives,
cannot be tested without a headset and is validated by the hardware session.

> **Warning (2026-08-05):** this paragraph turned into an alibi. For weeks
> it hid a real bug —the controllers **were not being registered**, so there were no pointers
> that could emit anything— which was visible in the console just by entering a session. The
> test was retried after fixing it and it still does not hook, so the limitation of
> IWER is real; but now there is an e2e that watches the console inside the session
> (`la sesión monta mandos e interfaz sin ensuciar la consola`) so that a bug like that
> does not hide again behind "it's the emulator".

In return, the interaction **rule** is indeed covered by unit tests:
`src/lib/xrInteraction.ts` decides which pointer can grab a stick (the ray cannot; the
grab, the contact and the mouse can) and that is tested without a browser. The layout of the
immersive UI lives in `src/lib/xrLayout.ts`, shared by components and tests.

## Third headset test (2026-08-06, same branch)

The immersive mode **works**: the controllers are seen and the menu can be operated. Six
improvements came out of that test, all within the branch:

- **The player was set too far back** (you had to take a step on starting). The hoop
  is a *semi*circle, so its mass falls towards −Z; now the player stands at
  `PLAYER_POSITION`, 18 cm ahead of the centre.
- **Machine and sticks 8 % smaller**, with the speeds recalculated to
  keep the fall times. The hoop height is not touched: stature rules it.
- **Score** (`src/lib/scoring.ts`): base per stick × difficulty × streak × reflexes.
  The streak cap exists so that 13 sticks on Easy do not beat a perfect run
  on Impossible.
- **3 s countdown** as a phase of its own, during which the sticks **cannot be
  grabbed** (otherwise, the hoop was emptied with clicks before starting).
- **Hit in green with a ripple, miss in red on the floor.**
- **Scenery or passthrough is chosen inside the headset**, with a fade. It always enters
  in `immersive-ar` when possible, because WebXR does not let the session type be changed
  without reopening it. The entry of the menu is now a single button.

## Sound (2026-08-10, branch `agent/sonido-al-atrapar-al-perder-y-en-351461`)

With the headset on it was what was missed the most: the scoreboard is to one
side and cannot be looked at while the sticks fall, so catching and missing were only
noticed if you turned your head.

- **Synthesised, not recorded.** `src/lib/sound.ts` describes each sound as
  oscillator voices (waveform, frequencies, duration, volume) and
  `createSoundEngine` schedules them with the Web Audio API. This way there are no files to
  serve, there is no need to open `media-src` in the CSP and there is no CDN in between.
  The recipe is pure data, so it is tested without a browser.
- **What sounds**: hit with a timbre that rises a semitone per stick of streak
  (with a cap, or a long streak would end up shrieking), a low, descending miss
  that lasts twice as long, a tick per second of countdown —rising as the
  start gets closer— and a longer flourish when the sticks start to fall.
- **The wiring is `useGameSound`** (in `components/game/`), mounted once in
  `GameScene`: it listens to the state of the game instead of hooking into the
  components, so it works just the same for the mouse and for the headset's controllers.
- The browser does not allow sound until the player interacts, so the
  `AudioContext` is created with the first click —activating a button with the keyboard
  fires one, so the keyboard counts too; see "Mute" further down—. In the
  headset that gesture is the button to enter the session, which is still DOM.
- **With the context suspended the game stays quiet on purpose** (taking off the headset
  mid-run, or the system taking the focus away from the browser): there the audio
  clock stops and everything scheduled would pile up at the same
  instant, to sound all at once and at full volume on coming back. Instead, the audio is
  asked back and that sound is lost. When testing with the goggles: if on
  putting them on again the first stick does not sound and the next one does, it is this and it
  is fine.
- **It can be muted** from both menus (see below).

## Mute (branch `agent/poder-silenciar-el-juego-menu-de-7fbe05`)

The sound could neither be turned down nor off, and in the headset it sits right against the
ears.

- The preference was a flag of the store (`muted`, like `scenery`) that **was not
  saved between visits**: the audit left the game without storage and persisting it
  was a separate decision, not a side effect of that task.
  > **Decided later**, in the task that asked to decide it: it is saved. See
  > "The mute is remembered" further down.
- **When muted, the Web Audio API is not touched**: no context, no nodes, no
  playback permission. `useGameSound` creates the context only when there is a
  gesture from the player *and* the sound is on; on muting mid-run, the
  cleanup of the effect closes the one it may have opened.
- For that, the gesture that unlocks the audio went from `pointerdown` to **`click`**
  (and "there has already been a gesture" from ref to state). The first click on the page may be
  the mute button itself: with `pointerdown` the gesture and the order to be quiet
  arrive in different events, so the game opened a context only to close it
  on the next render. Listening to the same event that activates the button, React
  sees both things in the same render. The keyboard is still covered: activating a
  button with Enter fires its click. A unit test that presses a real button watches it
  (`useGameSound.test.tsx`), not two calls to the store in the same batch —
  that passed green with the bug in place.
- Unmuting brings the sound back **without waiting for another click**: the
  button itself is the gesture the browser demands.
- On desktop, a button under the CTA with `aria-pressed` and a crossed-out speaker (the
  mobile e2e already watches the 44 px). In the headset, a button in the corner of the menu
  panel, symmetrical to the exit one, with the silhouette from `xrIcons.ts`: a speaker with
  waves or with a cross. The cross takes the place of the waves instead of crossing the
  speaker —crossing it out with the same fill looks like a blot, not like a
  strike-through—. `xrIcons.test.ts` pins that shape.
- **Not validated on hardware**: it remains to be seen whether the button can be told apart
  from the exit one with the goggles on, and whether with `MASTER_GAIN` at 0.28 an intermediate
  volume control is needed as well.

## Swaying of the sticks (branch `agent/balanceo-de-los-palos-colgando-p-2b20f4`)

Until the first one fell nothing moved: with the headset on the machine
looked frozen while options were being chosen and during the three seconds of
countdown.

- The hanging sticks sway. The recipe is pure data (`src/lib/stickSwing.ts`,
  `hangingSwing`): about 3° of amplitude at 0.55 Hz, with a second, shorter axis
  at another rhythm so that they trace a slow ellipse instead of going like
  windscreen wipers. Each stick carries its phase (`swingPhase`, from `buildStickLayout`),
  which also tunes its frequency: without it the thirteen would move as a block,
  which looks more mechanical than stillness.
- **The swing also runs with the run stopped.** `Stick` carries a clock
  separate from the one that manages the fall delay, because the menu and the
  countdown are precisely the moment when it is needed. It touches neither when a
  stick is released nor from what height: it is rotation of the group around the hook.
- On being released the stick straightens in ~0.25 s (`SWING_RELEASE_DECAY`): one that
  falls while tilting is hard to follow with the hand.
- **`prefers-reduced-motion` is respected** (`useReducedMotion`, the equivalent
  for the 3D scene of what `globals.css` already did with the animations of the
  menu). Whoever enables it sees the machine still, as before this branch: also
  on opening it, because each stick's swing is born already switched off (if it is born at 1,
  the stick appears tilted and straightens in a quarter of a second, which is
  exactly the movement that preference asks not to have). The e2e covers
  the case of enabling it with the game open; the start-up does not, because the
  straightening lasts less than the HDRI takes to paint.
- The e2e of the menu look at the real scene: they move the opaque panel of the menu aside,
  wait for the HDRI to be painted and compare two captures of the canvas
  600 ms apart. With normal motion they have to differ; with reduced motion,
  be identical. That pair is what makes the check reliable: if the capture
  were blind, the first one would go red.
- **Not validated on hardware**: it remains to be seen with the goggles whether three degrees
  are noticed just enough or whether `SWING_AMPLITUDE` should be raised, and that the hoop does
  not look restless with 13 sticks swaying at once.

## Best score (branch `agent/guardar-la-mejor-puntuacion-entr-8926aa`)

Every run started from zero and the previous one left no trace: there was nothing to
beat.

- **The audit's "zero storage" is broken, on purpose and with the OK
  of the owner of the repo.** The only thing the game writes in the browser is an
  integer in `localStorage` (`stick-rush:best-points`): no identifiers, no
  cookies and nothing that leaves the machine. The mute and the scenery are still
  not persisted; the decision was to save only the record.
- **A single global record**, not one per difficulty nor per number of sticks. The
  score already scales with both things (see `scoring.ts`), so beating it
  pushes you to go up a level. The trade-off: with 5 sticks on Easy the record is
  unreachable, and that shows —in the headset the mark stays stuck to the end of
  the bar—.
- **The record is not React state**: it lives in `src/lib/highScore.ts` and the store
  subscribes with `useSyncExternalStore`. It is not a whim: the React
  19 linter (`react-hooks/set-state-in-effect`) forbids the `useEffect` that reads the
  storage on mounting and does `setState`, and rightly so —cascade of renders and
  hydration mismatch—. With an external store, the server returns 0
  (`getServerBestPoints`) and the browser its value, without React complaining.
- **It is saved when the run ends, not stick by stick.** If the record rose with
  every hit, at the end it would always be equal to the score and there would be no way
  of knowing whether it has been beaten. For that `startGame` freezes the best to beat
  (`recordToBeat`) and `isRecord` is derived from comparing with it.
- **«¡Nuevo récord!» only if it really was saved** (review): `isRecord` also requires
  that what was saved be **exactly** that score. Without the condition,
  with the storage blocked the best to beat stayed at zero for
  ever and every run with points was announced as a record, one that on going back
  to the menu was not there. And with "at least" instead of equality the same
  deception remained between two tabs: the best is frozen on starting, so if the other
  tab saves something better while you play, the run exceeds the frozen
  best without reaching the saved one. It costs one frame of delay —the notice
  appears after saving—, which the entry animation covers.
- **Where it is seen**: a pill under the tagline of the menu (only if there is a record), and
  at the end of the run «¡Nuevo récord!» or «Tu récord: N». In the headset there is no text,
  so it is a **golden mark on the score bar**, on the scale of
  that run; on beating it the bar turns golden and the mark grows.
- **Without storage there is no record, but you play just the same**: in private mode
  `localStorage` throws on being touched instead of returning `null`, so all the
  access is wrapped. An e2e that really blocks `localStorage` covers it.
- **Two tabs see the same record** (review): the subscription also listens to
  the `storage` event, which is how the browser signals that another tab has
  written. Without it, the one in the menu would keep showing the previous
  best even though the storage is the only source of truth.
- **Not validated on hardware**: it remains to be seen whether the record mark can be told
  apart from the fill of the bar with the goggles on.

## Practice mode and challenge mode (branch `agent/modo-practica-y-modo-desafio-243a75`)

A run was a single loose throw: you chose a difficulty, N sticks fell and that was it.
The reason to put the goggles back on was missing.

- **Two modes**: *Practice* is the usual game (all the sticks fall, missing
  costs nothing) and *Challenge* is played with **three lives**: each stick that touches the
  floor costs one, and the run ends on running out of them —even if sticks are still
  hanging— or on resolving them all, which is clearing the challenge.
- **Lives and not rounds that go up in difficulty**, which was the other option the
  task raised. The difficulty is already chosen by the player and is the lever with
  which the score scales; if the challenge raised it on its own,
  choosing it in the menu would stop meaning anything and two "Experto" runs would not
  be the same thing. With lives, the mode changes only **how** the run **ends**
  and the difficulty still means what it meant.
- **Three fixed lives**, scaled neither with the sticks nor with the difficulty: the deal
  has to be understood before starting (three misses and out) and grading it is what
  the other two options are already for. With 13 sticks on Impossible, three lives
  is the challenge; with 5 on Easy, a formality.
- **Where it lives**: `src/lib/gameMode.ts` —pure functions: how many lives are left and
  how the run ends (`cleared` / `failed`)—, tested without a browser like
  `scoring.ts`. The store derives the misses from the counters it already had
  (`resolved - score`) instead of carrying a third one to keep in step.
- **One record per mode** (`stick-rush:best-points` and `…:challenge`). A challenge
  is cut short on running out of lives, so with the same sticks and difficulty it can never
  score more than the equivalent practice: with a common best, the mode with
  something at stake would be the only one that would never beat it. The practice key is the
  one that was already there, so a previous record is not lost. There is still nothing else
  in the browser.
- **The mode is only changed between runs.** A test uncovered it: with the summary
  on screen —where the score is still alive— changing mode sent those
  points to the record of the other one, one that had not been played. Today no menu is seen in
  that phase, but the rule belongs to the game and not to wherever the button is.
- **Where it is seen**: in the desktop menu, two cards with what each mode
  puts at stake (infinity or three hearts) and a line on what it means; during
  the run, the hearts on the scoreboard (filled the ones left, outlined
  the spent ones) and inside the `aria-label` that was already announced, so as not to set up a
  second notice; at the end, the title says whether the challenge was cleared or whether you
  ran out of lives, and the summary adds **how many lives it ended with** next to the
  score (they are the two pieces of data that are shared).
- **In the headset**, without letters like everything immersive: the menu carries a
  switch with three hearts —lit, the challenge; unlit, practice—
  and the scoreboard paints the lives under the score bar, shrinking and
  switching off the spent one. The silhouette of the heart is in `xrIcons.ts` with its tests
  (two lobes at the top, tip at the bottom, and the same frame as the other icons).
- **Not validated on hardware**: it remains to be seen whether the hearts switch of the menu
  is understood with the goggles on without having read about it anywhere, and whether the
  lives on the scoreboard can be told apart at a metre while the sticks fall.

## VR scenery: fairground (branch `agent/escenario-vr-mas-elaborado-que-e-ebc93a`)

The scenery was **only the HDRI**: a photo of a square at night wrapping the scene and
projected on the floor. From afar it works, but a photo has no parallax, so in the
headset it gives itself away as soon as the player moves their head, and the machine was left
standing in the middle of nowhere. Now there is geometry around and the photo is left as sky
and as light.

- **What there is**: six stalls in a circle at 6.4 m looking at the player (striped awning with
  bulbs, counter, prizes on the shelf and a sign), eight posts at 4.6 m with garlands
  of bulbs hanging between them, and a **Ferris wheel 11 m in diameter** at 13 m, which turns
  one revolution every ~85 s with the gondolas hanging plumb.
- **Where it lives**: `src/lib/sceneryLayout.ts` decides *where* each thing goes (rings,
  catenary of the garlands, measurements of the Ferris wheel) and is tested on its own, without
  a browser; `Fairground.tsx`, `FairStall.tsx` and `FerrisWheel.tsx` only paint. The colours are
  with those of the machine in `gameConfig.ts`, and they are the same on purpose: the fairground
  has to look like the place the machine came out of.
- **The 285 parts are drawn instanced**: three drei `<Instances>` —planks, posts and
  bulbs— plus the two rings of the Ferris wheel. In the headset what is paid for is the calls,
  not the triangles. The instance limits are the exact count of parts, added up bit by
  bit, because drei stops painting whatever is left over **without warning**
  (`FairPieces.tsx`).
  What it costs exactly is not repeated here: it lives in the breakdown of `MENU_DRAW_CALLS`
  (`e2e/fairground.spec.ts`), which is the one that measures it. The figure was written in four
  places and had already started to age in some before others.
- **The set is neither touched nor aimed at**: each part has its raycast disabled. Otherwise,
  every movement of the mouse —and every frame with the controllers pointing— would cast a ray
  against the 285 parts for nothing.
- **In passthrough none of this is painted**: it hangs from the same block as the floor and the
  background in `SceneBackdrop`, so the scenery/AR switch turns it on and off
  with its fade, without touching anything else.
- **What the tests watch** (`sceneryLayout.test.ts`, 17): that the set does not invade the
  3 m free around the player, that the garlands hang above the machine
  —if they come down to the hoop, the player finds bulbs where they look for sticks—, that the
  gondolas of the Ferris wheel do not drag along the floor and that each stall faces the player.
  Checked that they really fail: bringing the stalls closer, sinking the garland, lowering the
  Ferris wheel or removing the half turn of the rotation put tests in red.
- **No new assets and no new dependencies**: everything is geometry by code, like the
  machine. The HDRI is still the same file.
- **Not validated on hardware**: it remains to be seen in the headset whether the frames hold
  with the fairground in place and whether the Ferris wheel turning in the periphery bothers.
  With `prefers-reduced-motion` it stays stopped. The script of the test and what could already
  be measured without goggles are in "Validating the fairground in the headset".

## Instancing the machine (branch `agent/instanciar-los-tubos-de-la-maquina`)

It has a section of its own because it is a code change with a new file, not a footnote to
the validation of the fairground —which is where it was told before, and is about something
else.

- **From 85 draw calls to 5.** The machine took 85 of the ~110 of the scene: 69
  loose tubes (`Strut`, a 10-sided cylinder of which arcs, lattice,
  uprights, braces and legs are made) and 16 the bulbs of its garland. In the headset that is
  paid **per eye**: it was ~170 per frame to draw something that fits in five.
- **Where it lives**: `src/components/game/MachinePieces.tsx`, with the same recipe as
  `FairPieces.tsx` — families of instances, limits declared by count and `raycast`
  disabled on what is not touched.
- **Three families of tubes and not one.** They share geometry but not material, and an
  `<Instances>` has a single material: the hoop of the sticks is matt because it is painted
  wood, the posts are polished metal and the lattice is in between. Unifying them was cheaper
  **and changed how the machine looks**, which is the only thing this optimisation could not
  touch. Three instead of 69 is already 96%.
- **The bulbs bake their measurements** into the geometry instead of scaling: they are all
  the same, and the socket is a **conical** cylinder — a scaling stretches it, but does not make
  it conical.
- **The sticks and their hooks stay loose**, on purpose: they are grabbed with the hand, and an
  instance cannot be aimed at or moved on its own.
- **What watches it**: `MENU_DRAW_CALL_BUDGET` in `e2e/fairground.spec.ts`. The ceiling was
  lowered from 120 to 45 when this came in — with 120, the machine could go back to drawing each
  tube loose and the test would stay green. A guard with the threshold where it was before the
  fix guards nothing.

## Validating the fairground in the headset (branch `agent/validar-en-el-visor-el-recinto-d-94e952`)

The validation belongs to the goggles and **is still pending**: nobody has put them on yet with
the fairground in front. What is done is measuring the part that does *not* need a headset, so
that the real test is short and knows where to look.

- **The scene costs 29 draw calls per frame in the menu**, and the fairground is a
  small portion of them. Measured on the production build in Chromium; the menu is the
  comparable state because the scene always starts with the five sticks of `MIN_STICKS`
  hanging. What each part takes —and how much the total rises with more sticks— is broken down
  in the comment of `MENU_DRAW_CALLS` (`e2e/fairground.spec.ts`), which is the one that measures
  it: the count lives there and that is where it has to be updated if the cost changes.
- **The 285 parts are all painted**: the `instanceCount` values that reach WebGL are 120 planks,
  55 posts and 110 bulbs, exactly what `FAIR_PIECES` declares. That was the real risk
  of this part —drei silently stops painting whatever goes past the limit— and it is ruled out.
- **The expensive thing was the machine, and it is now instanced.** When this was measured it
  cost 85 of the ~110 calls of that time: 69 loose tubes (`Strut`, the 10-sided cylinder of
  which arcs, lattice, uprights, braces and legs are made) and 16 the bulbs of its
  garland; in the headset that is paid **per eye**, so it was ~170 per frame. Now it goes
  with the same recipe as the fairground (`MachinePieces.tsx`): three families of tubes —three
  and not one, because they share geometry but not material— and two for the bulbs, and that
  saving is what leaves the scene at 29. What is left loose are the sticks with their hooks and
  the bases of the posts, on purpose: a stick is grabbed with the hand and an instance cannot be
  aimed at or moved on its own. **There is no longer a big cut waiting**, so if on hardware
  there are stutters the cause will have to be sought elsewhere; trimming the fairground is
  still the last thing to touch.
- **The measurement repeats itself** (`e2e/fairground.spec.ts`), with no counters in the game's
  code: an `addInitScript` wraps `drawElements` and `drawElementsInstanced` of the prototype of
  `WebGL2RenderingContext`, and a `requestAnimationFrame` registered before the scene's one
  closes each frame. It watches the two things that matter: that the three families arrive
  whole at WebGL —drei's silent trimming— and that the median of the menu stays at the
  29 that the scene measures, with four calls of margin on each side (`MENU_DRAW_CALLS` and
  `MENU_DRAW_CALL_MARGIN`). It pins the figure and not just a ceiling: this way a change of cost
  comes out in red —and with it, the notice to redo the breakdown— instead of slipping through
  as long as it fits underneath. The margin absorbs one stick more or fewer hanging; being left
  without the fairground or without the machine is five calls at once, and stopping instancing
  would return the scene to the ~110 of before. The fps of a desktop say nothing about the
  headset —here they go to the cap of the screen—, but the calls do: they are what is paid the
  same in both places. The sample no longer starts as soon as the canvas has a size: that only
  says that R3F paints, and the machine arrives afterwards with its textures, so on a cold start
  the 30 frames were closed before —they measured 6, and on that no measurement checks
  anything—. Now it waits for the scene to draw its eight instanced families (three of the
  fairground, five of the machine) and only then does it count.

**What to look at with the goggles on, and which constant it touches in each case** (all in
`src/lib/sceneryLayout.ts`):

- Is it smooth when turning the head or is there a stutter? If there is, the fairground is the
  last suspect: together with the machine it weighs less than the hanging sticks (breakdown in
  the comment of `MENU_DRAW_CALLS`, in `e2e/fairground.spec.ts`), so measure before
  trimming it.
- Are the stalls oppressive at 6.4 m, or does the fairground look empty? → `STALL_RING_RADIUS`,
  with `SCENERY_CLEARANCE` (3 m) as a floor that the tests do not let you step on.
- Does the Ferris wheel cause dizziness or distract while the sticks fall? → `WHEEL_SPEED`
  (0.074 rad/s, one revolution every ~85 s). If it ends up covered by a stall or too close to
  the edge of the view, `WHEEL_CENTER`.
- Do the bulbs of the garlands fall where the sticks are looked for, or do they dazzle? →
  `GARLAND_RING_RADIUS`, `GARLAND_POST_HEIGHT` and `GARLAND_SAG`.

On moving any of those constants `sceneryLayout.test.ts` has to be run again: it pins the
limits that make the fairground playable (3 m free around the player, garlands above
the machine, gondolas that do not drag and stalls facing the player) and they **are not
relaxed** to accommodate a new value. If an adjustment breaks them, the adjustment goes too far.

## Icons of the immersive menu (branch `agent/mejorar-los-iconos-del-menu-3d`)

The third test showed that the "back" arrow did not read as an arrow, and that
going back to the menu and exiting the headset shared an icon while doing different things.

- The icons were stacked from primitives (a triangular prism next to a box) and at one
  metre away that looks like **two objects**, not like one figure. Now the shape is
  a **closed outline** in `src/lib/xrIcons.ts` from which a `ShapeGeometry` comes out.
- **House** for going back to the menu (end of the run and the button set aside during the run)
  and **door with an arrow coming out** for closing the session (corner of the menu). The loose
  arrow disappears: no button is left that means only "back".
- The silhouette can be checked without a browser (`xrIcons.test.ts`, 15 cases): that the roof
  crowns the body, that the door falls inside the façade, that the tip of the arrow is
  wider than the shaft, that no outline crosses itself and that they all occupy the
  same frame and centred, so that at the same `size` and `position` they look the same size and
  in the same place on their plate.
- `XRRepeatIcon`, `XRSceneIcon` and `XRPassthroughIcon` are still **not validated on
  hardware**; they were left as they were for lack of knowing whether they are understood with
  the goggles on.

In the review of the branch, the underlying cause of the previous icon "not
reading as an arrow" turned up, which was not only the shape:

- The **back-to-the-menu button ate its own icon**. It is set aside to one side
  and its plate rotated to face the player, but the drawing did not rotate with it: the left
  edge of the plate came forward in front of the icon and cut it diagonally
  from that side, right where the tip of the arrow fell. Now the rotation hangs from the button
  (`rotation` of `XRPressable`), so plate, icon, focus halo and sensitive area
  move together, and it comes from `XR_QUIT_YAW` —derived from the position— instead of a `π/7`
  set by eye, which was also 3° short. `xrInteraction.test.ts` watches that the
  plate keeps facing the player if someone moves the button.
- **A single size for the silhouettes** (`ICON_SIZE`, 5.6 cm): they were at 0.024 and 0.026 and
  the house looked clearly smaller than the repeat ring next to it on the end-of-run
  screen.

## Hoop height per player (branch `agent/ajustar-la-altura-del-aro-a-quie-cd744e`)

`MACHINE_HEIGHT` (1.95 m) was designed for a standing person of average stature.
Standing it works well; seated, or being shorter, the same hoop ends up above the head and the
sticks pass outside the arm: the game becomes unplayable without anything failing.

- **The height comes from the headset.** The hoop is set 35 cm above the eyes
  (`HOOP_RISE_ABOVE_EYES`, the ratio with which the machine was designed), reading the height
  of the camera **only while the immersive menu is in front**: with the sticks falling, a
  hoop that chased the head would rise on standing on tiptoe just when the player
  works out where the hand is going to be. Smoothed measurement with a 2 cm threshold, so that
  it does not tremble with breathing or repaint the machine on every frame (`XRPlayerHeight`).
- **The figure is only valid with the floor in place.** The session's `enabledFeatures` is
  looked at (`hasFloorReference`): in a `local` space the head is born at zero and its height
  is not measured from the floor. That list is optional in the specification and there are
  browsers that do not publish it; since `local-floor` is requested as **required** on opening
  the session, when it is missing it is taken as good instead of giving up on measuring (with
  `useXRSessionFeatureEnabled` those headsets were left without the automatic part of the
  feature). If even so the space were not a floor one, the height would be born next to zero and
  the stature filter would discard it. When there is no figure nothing is made up —the hoop
  stays at the usual height— and the manual adjustment is what covers it, which is exactly the
  case of playing seated with the space calibrated
  standing.
- **Manual adjustment in the top row of the immersive menu**, ±20 cm in steps of 5. The
  range is not a round number: the arm rules it (the sticks are at ~60 cm
  horizontally and the comfortable reach is 75, so ~26 vertical cm are left over). The buttons
  go dark on reaching the limit and a ruler shows how much is left; the real answer is the
  hoop itself, which is above the panel and can be seen going up and down. Without a letter,
  like the rest of the menu.
- **It is remembered in `localStorage`** (`stick-rush:hoop-adjust`), next to the record. What is
  read is clamped just as if it came from the menu: editing it from the browser's tools
  cannot hang the hoop from the ceiling. The menu panel grew from 0.74 to 0.82 in height so that
  the new row was not left floating.
- **The difficulty does not change with stature**: raising the hoop lengthens the travel, so
  the fall speed is scaled with it (`hoopFallSpeed`) and each difficulty lasts the same
  for everyone. The times that `gameConfig.test.ts` watches still hold.
- **Missed sticks stay on the floor even if the hoop moves** (seen in review).
  Moving the hoop changes the anchor of each stick, and R3F rewrites the position of the
  group with it: on going back to the menu after a run and touching the arrow, the red sticks
  lying on the floor rose up to the new hoop and stayed hanging there until the next
  run. `Stick` gives them back their height when the anchor changes.
- The whole calculation is pure and lives in `src/lib/hoopHeight.ts`, with 27 unit tests: high
  and low height, absurd values (0, negatives, `NaN`, 50 m), no figure from the headset, the two
  limits, that the hoop never ends up inside the floor or above the head, that **no stick
  leaves the arm wherever it is put** (including the two extremes of stature that are
  accepted, which is where the absolute limit can trim), and the persistence (corrupt,
  blocked, absent). The four mutations tried —removing the clamp, ignoring the type of
  space, not correcting the speed and doubling the range— put the suite in red. The wiring
  of the store (steps, limits, saving, the headset measurement and its withdrawal on closing the
  session) goes separately, in `gameStore.test.tsx`.
- **Not validated on hardware**, like everything operated by buttons in the headset: the
  emulator does not propagate its pointers. The e2e covers the start-up with a saved correction
  that is not even a number (`'un palmo más arriba'`), which is what would really bring the
  scene down: without the guard of `parseHoopAdjustment` the `NaN` reaches the geometry of the
  hoop.

## First-time tutorial (branch `agent/tutorial-de-5-10-segundos-al-emp-949757`)

With the goggles on, whoever arrived new did not know that the sticks are grabbed nor
with which button: the immersive menu is operated by **pointing** with the ray, so the
first thing they learned was exactly what is no use for playing.

- **A phase of the run, not a screen.** `startGame` puts `gameState:
  'tutorial'` before the countdown, and on finishing chains with the whole of it (the
  three seconds are for getting into position; spending them watching the demonstration
  wastes them). The sticks stay hanging and still, as in the countdown.
- **The game decides it, not the button**: with goggles (`immersive` in the store, which
  `XRSessionController` keeps up to date) and without having seen it. Inside the session
  you can also start from the overlay with the keyboard, and the same has to
  happen that way. `startGame({ tutorial })` forces the decision: the button
  to watch it again uses it.
- **7.4 s in three stretches** (`src/lib/tutorial.ts`, a pure script tested without a
  browser): the trigger that grabs —marked on the same controller the player
  has in the hand, with a stick falling onto it and the flash of the hit—,
  how many sticks are going to fall (they appear one by one, they are counted) and at what level
  (the bars of the menu, enlarged). The total is **bounded between 5 and 10 s** by a
  test: lengthening one stretch forces shortening another.
- **Without a single letter**, like everything immersive: the CSP blocks the fonts of
  drei's `<Text>`. Each thing is said with the geometry that already means that in the
  game, and the movement is what turns the drawing into an instruction.
- **Skippable from the first frame**: a button in its place on the panel (two
  triangles and a stop, like any player) plus a bar of how much is
  left, so that it is seen that it lasts seconds. Skipping it also counts as seen:
  the player has already decided. Leaving it halfway by going back to the menu does not.
- **It is remembered in `localStorage`** (`stick-rush:tutorial-seen`), next to the record
  and the hoop height. Without storage it comes up again, which is preferable to taking
  as known something that perhaps nobody has seen.
- **It can be brought back** from the top corner of the immersive menu, with the
  miniature controller and its trigger marked: it is literally what it is going to teach.
  The drawing of the controller was taken out to `XRControllerModel.tsx` so that it is the same
  in the hand, in the demonstration and on that button.
- **On desktop it does not exist**: there the start screen explains it with text,
  which is read sooner than the demonstration lasts. The DOM mirror of the skip
  button is indeed mounted under the session (it is what lets it be skipped with the keyboard,
  and what the e2e press, because the emulator does not propagate the controllers' pointers).
- **Not validated on hardware**: it remains to be seen with the goggles whether the controller
  of the demonstration reads at that distance, whether two grip cycles are enough to
  understand the gesture and whether 13 sticks in a row can be counted at a glance.
- **With reduced motion the trigger stays marked, not pressed**
  (review): taking the press as done turned the trigger green, and the green of the
  confirmation takes over from the amber mark and switches off its ripple (`SqueezeButton`). In
  the only still image seen by whoever asks not to see movement, that erased exactly what
  signals which button grabs.
- **Two overlaps that are only seen with the goggles** (measured on the constants, without
  a headset): the handle of the demonstration controller comes down to y ≈ −0.286 of the panel
  and the progress bar is at −0.26, so it crosses in front of the central ~6 cm
  of its 34; and in «Imposible» the tallest bar of the level sticks out some
  3.5 cm above the chip (`XRDifficultyBars` at `scale={2.4}` from
  y = −0.075, with the chip 0.24 in height). Neither breaks anything; they are left
  untouched because correcting them blind is swapping one number for another.

## Sharing the result (branch `agent/compartir-el-resultado-al-acabar-3646d4`)

The record stayed in the device's `localStorage` and did not leave it: half
the fun of a score game is showing the best, and nobody sees a headset's one.

- **Sharing is sending a text, not publishing a ranking.** No server, no other people's
  bests and no online table: that would ask for a database and this game neither has one nor
  is going to have one. The only thing that leaves the browser is the line the player hands to
  the system, and only when they press.
- **The text is a pure function** (`buildShareText`, in `src/lib/shareResult.ts`), like
  `scoring.ts` or `gameMode.ts`: it is the only thing of the game read by someone who has not
  played, so its shape is pinned with unit tests (each difficulty, with and without lives, with
  no previous record, and a corrupt score that cannot come out as `NaN`) instead of looking at
  it in the browser. Four lines at most, because it ends up in a message: mode and level,
  points and sticks —and the lives only in challenge, which is where they mean something—, the
  best if there is something to tell about it, and the link to the game.
- **System sheet if there is one; if not, clipboard** (`shareOrCopy`, same file). The
  plan B is not a courtesy: inside an immersive session the sheet may not open —there is
  nowhere to paint it, or the browser does not count a controller's trigger as a gesture—, and
  there a button that does nothing is worse than having no button. It receives the browser as a
  parameter, so the four paths are tested without one.
- **Cancelling is not an error and does not copy behind your back**: whoever closes the sheet
  has decided not to share, and leaving the text on their clipboard would be doing the opposite
  of what they have just asked. Only `AbortError` counts as a cancellation; any other rejection
  falls to the clipboard.
- **Where it is seen**: on desktop, a button under the CTA of the end screen with a live
  region that confirms («¡Compartido!», «Resultado copiado al portapapeles») and warns when
  the browser allows neither of the two things. In the headset, a third button between repeat
  and back to the menu, without letters like everything immersive: a paper plane that turns into
  a check mark or into a cross, changing drawing *and* colour. Inside the session there is no
  system notice to tell it, so the plate itself tells it.
- **The notice dies with its run**: the result is saved next to the `runId` that
  produced it, so the "copied" of one run does not stay on screen when the
  next one ends, announcing something nobody has done.
- **Not validated on hardware**, like everything that is pressed in the headset: see point (k)
  of "NEXT STEP". The emulator delivers a session but its pointers do not press the objects of
  the scene, so the e2e covers the three possible desktop browsers (with a sheet,
  clipboard only, and neither of the two) and the decision that makes the button work in the
  headset —when the sheet does not start, it copies— is held by unit tests.

## Immersive menu: the triangle and its height (branch `agent/pulir-el-menu-inmersivo-el-trian-f18a3a`)

Two fixes to the same panel, together because moving its height changes where each part is
looked at from, and separating them forced reviewing the same thing twice with the goggles on.

- **The "start" triangle was seen edge-on.** `XRPlayIcon` composed two quarter
  turns (`[π/2, 0, −π/2]`) and that composition left the axis of the prism pointing at +X, so
  only the thickness of the play symbol was seen: a one-centimetre sliver on the
  most pressed button of the session. Now the rotation comes from `XR_TRIANGLE_ROTATION`
  (`src/lib/xrIcons.ts`) —facing the player and with the tip to the right, like any
  play button— and from there also come the arrows for raising and lowering the hoop, which
  were already fine but repeated the sum by hand.
- **The drawing is placed by its centre** (`XR_TRIANGLE_CENTER`): the tip comes out at one
  radius from the axis and the opposite side stays at half, so a triangle placed by its axis
  looks shifted. With this, at the same `position`, triangles and silhouettes fall in the same
  place on their plate. And the size of the start one goes down from 0.05 to 0.032: that
  measurement is the radius of the prism, and face-on it gives a 5.5 cm drawing that before,
  edge-on, was not seen.
- **While at it, the button to skip the tutorial**: it stacks two `XRPlayIcon`, so it showed two
  slivers and a stop. Now the two triangles read, and its recentring goes from −0.55 to
  −0.2 times `size`, which is what the whole drawing asks for.
- **The UI hangs from the player's eyes, not from the floor.** The hoop already adapted (see
  "Hoop height per player") but the panel was still nailed at 1.40 m, and with it the
  scoreboard, the countdown and the back button: whoever plays seated found it at
  forehead height, with the row of the hoop adjustment above the line of sight.
  Now `xrUiRise` (`src/lib/xrLayout.ts`) turns the headset's measurement into how much the whole
  goes up or down, and `XRGazeAnchor` applies it, which is the only node that already placed the
  UI.
- **The whole eye height is followed, not a fraction.** The panel is looked at, not stepped on:
  the only thing that matters is at what height its buttons end up relative to the eyes.
  Halfway, the top row would be left above the head of whoever plays seated, which was the
  problem. The absolute limits of the hoop are not needed: within the range of statures that
  is accepted as a person, nothing of the UI reaches the floor. But there is no room to spare:
  the panels are drawn centred on their height and the scoreboard one, at the end of a
  challenge run, goes down 24 cm, so with the eyes at 90 cm its edge is left **one centimetre**
  from the floor. Lowering a height or making a panel taller forces looking at that number.
- **It is measured in the menu and stays still**, because the figure is the same one the hoop
  uses (`XRPlayerHeight` only measures with the menu in front): with the sticks falling, a
  scoreboard that chased the head would move just when the player works out where the hand is
  going to be.
- **What the tests watch**: the orientation of the three triangles is checked on the
  real geometry of three (`xrIcons.test.ts`) —axis towards the player, tip where its
  name says and drawing centred—, and the three mutations tried (going back to the rotation that
  left the prism edge-on, sending the tip to the left and removing the recentring) put tests in
  red.
  The block of heights of `xrInteraction.test.ts` stops being absolute (0.85–1.75 m) and moves
  on to measuring the distance to the eyes for the four test statures, plus a new fence:
  with the shortest player, not even the bottom edge of the tallest panel reaches the floor.
  Following halfway, not following, or removing the filter of impossible measurements also put
  tests in red.
- **Not validated on hardware**, like everything that is pressed in the headset: the emulator
  does not propagate its pointers. It remains to be seen with the goggles that the triangle
  reads as "start", that the panel falls at a good height standing and seated, and that it does
  not cross the machine on going up with a tall player. And one that appears with this change:
  the measurement stays alive while in the menu (`XRPlayerHeight` reports every 2 cm), and now
  it moves **the buttons being aimed at**, not just the hoop. Leaning forward to see the panel
  better lowers it along with you. If it bothers when aiming, what has to be touched is when
  measuring stops, not `xrUiRise`.

## Vibration in the rest of the game (branch `agent/rematar-el-feedback-del-juego-vi-d6d6ce`)

Vibration only came on catching a stick. The two things the controller
can tell and no other signal reaches with the goggles on were missing: that a stick has got
away and that a menu button has responded.

- **The miss, long and soft; the hit, short and sharp.** They are told apart by both
  things at once (`MISS_PULSE`, 0.35 and 140 ms, against the 0.7 and 45 ms of the hit):
  with only one, and the arm moving, they would feel the same and the vibration would say
  less than the sound, which does tell them apart.
- **The miss comes out through both controllers.** There is no pointer event from which to get
  a hand —the stick touches the floor by itself—, so `pulseAllHaptics` goes through the
  `inputSources` of the session. Not knowing in which hand it would have been felt is part
  of what it means. That is also why it is softer: nobody caused it.
- **Where it hooks in**: `XRHaptics`, a bridge inside `<XR>` that looks at the
  counters of the store, as `useGameSound` does with the sound. It does not go in the store
  because the store is the game —common to the mouse and the headset— and this only exists with
  goggles. Two sticks missed in the same batch give one hit, just as they sound once.
- **The buttons of the immersive menu give a tap** on being activated (`PRESS_PULSE`, 0.25 and
  18 ms, the most discreet of the three: choosing thirteen sticks is thirteen presses). It goes
  in `XRPressable`, so they all have it —menu, scoreboard and end of run— and only
  when the button is really activated: one that is off, or a press that falls inside the
  debounce, confirm nothing. The hit is given **before** the action, because there are
  buttons that close the session or change the whole scene.
- **The mute does not silence the vibration**: it is precisely what keeps signalling with the
  sound off.
- **Not validated on hardware**, like everything that is pressed in the headset: the emulator
  does not propagate its pointers. See point (h) of "NEXT STEP".

## The mute is remembered (same branch)

Until now the mute lasted as long as the tab lasted: on reloading, the game
sounded again. In the headset that means switching it off again every time you
put the goggles on, to undo something you had already decided.

- **The "no storage" is broken on purpose**, which is what the task asked to decide, and
  as it was already opened before for the record, the hoop height and the tutorial. The key is
  `stick-rush:muted` and the argument is the same as that of the hoop height: it is a
  preference about how you play, not a piece of data of the run.
- **Only the mute is written.** Going back to sound deletes the key instead of saving
  a zero: the default start is with sound, so the browser only stores
  something while the player departs from it. And only the exact value counts as
  mute: what is read is external input, and the safe side is to sound.
- **It is not React state**, for the same reason as the record (see "Best score"): the
  mute button is indeed prerendered —it is on the start screen— and the server
  does not see the storage, so reading it in an effect on mounting would mismatch the
  hydration. With `useSyncExternalStore` the server returns "with sound" and the
  browser its value, without React complaining. An e2e watches it and also looks at the
  console: a hydration error is not seen on the button, it is seen there.
- **Without storage the button keeps working** (`inMemory` in
  `mutePreference.ts`). It is not an ornament: if the preference lived only in what is
  saved, in private mode pressing "Silenciar" would change nothing —what is saved does not
  change, so the read would always return the same— and the game would keep sounding
  however much it was pressed. It is lost on reloading, not during the visit. A
  unit test and an e2e that really blocks `localStorage` cover it.
- **Two tabs see the same thing**: the `storage` event is listened to, like the record.
- **The scenery (`scenery`) is left unsaved**, and not out of laziness: saving
  `passthrough` and then entering an `immersive-vr` session —a headset without
  passthrough— would leave the player staring at nothing, because the set is not painted and
  there is no real room behind. Persisting it first asks for a fallback to `scene` when the
  session gives no passthrough. It is left as a follow-up task.

## The game, separated from its website (branch `agent/separar-el-juego-de-su-web-para--04e755`)

Stick Rush was a whole Next app. That was enough to deploy on its own and test it with the
goggles, but it prevented xrcade from loading it **inside** itself: the hub could only
link it in an iframe to another domain, and in VR that breaks the immersive session on entering
and on coming back. Now the repository is two things: **the game** (`src/game`,
`src/components`, `src/lib`), a component that is mounted wherever it is told, and **its
website** (`src/app`), a thin wrapper that mounts it full screen and keeps being deployed the
same.

- **The public surface is minimal**: `StickRush` (component), `mountStickRush`
  (DOM element), `assetsBase` and `stick-rush/styles.css`. Nothing else. The whole contract
  —installation, `transpilePackages`, static files, Tailwind and what the game expects from
  whoever mounts it— is in `docs/mounting-the-game.md`, which is what the twin task of xrcade
  will respect.
- **It is consumed by tag of the repository**, not by registry: `npm install
  "github:1to1-Digital-Solutions/stick-rush#v0.2.0"`. Updating the game in the hall is
  bumping that version. There is no need to publish on npm or to have registry credentials, and
  the `package.json` is still `private`.
- **React, three and `@react-three/*` moved to `peerDependencies`** (and stay in
  `devDependencies` for the development here). It is what avoids two copies of React on the
  page of whoever mounts it, which break the hooks. If some day the deployment installed without
  `devDependencies`, the build would fall over: it already happened with Tailwind and
  TypeScript, so it is not a new risk, but it is worth knowing.
- **The 3 MB of `public/` do not travel in the code.** The HDRI, the textures and the controller
  profiles are copied with `npx stick-rush-assets <destino>` and the game is told where with
  `assetsBase`. That is why the paths are kept relative (`lib/assets.ts`) and are resolved on
  requesting each resource: the WebXR store, which needs its own, came to be created **on
  requesting it** and not on importing the module, which was before anyone could say where they
  are.
- **Out with `next/dynamic`**, which tied the game to Next. The Canvas is loaded with React's
  `lazy` and waits for the browser with a `useSyncExternalStore` that returns `false` on the
  server: it is the equivalent of `ssr: false` without depending on the framework, and without
  mismatching the hydration.
- **The game's styles were separated into `src/game/styles.css`** and hang from `.stick-rush`
  instead of `:root`: mounted inside another application, some global variables called
  `--color-primary` would change the look of whatever had them set. The fonts are
  taken from `--font-heading`/`--font-body` with a system fallback; on its own website the
  layout still sets them with `next/font`.
- **Unmounting the game closes the immersive session** (`endXrSession`, in `xr/xrStore.ts`,
  called from `StickRush`). It came out of the review: the store lives outside the React tree
  and `<XR>` closes nothing on unmounting, so the hub that removed the game with the headset
  on left alive a session tied to a Canvas that no longer exists —frozen scene, and without
  being able to open another, because WebXR gives one session per document—. On its own website
  the same happened on navigating between `/` and `/game`.
- **What was NOT done, on purpose**: there is no `onExit` nor any "back to the hub" button.
  Without the twin task decided, it would be making up UI and leaving unused code. The hub can
  unmount the game whenever it wants with `unmount()`.

## Second headset test (2026-08-05, branch `fix/xr-mandos-y-menu-visible`)

With the goggles on the immersive mode was **unusable**: the controllers were not seen,
neither a level nor anything else could be selected, and the back button did not appear. Two
independent bugs, both fixed in that branch:

1. **The controllers never got registered.** `@react-three/xr` needs the *profile* of the
   controller (which button is which) and downloads it from `cdn.jsdelivr.net`. The CSP blocks
   it; `createXRControllerState` resolves that load in a promise whose rejection is swallowed by
   a `.catch(console.error)`, so **`addController` is never called** and without controller
   state neither the ray nor the grab pointer is mounted. The controllers did not exist for the
   app. Now the 42 profiles are served from `public/webxr-profiles/` (528 KB of JSON;
   the `.glb` files, 100 MB, are not needed) via `baseAssetPath`, and
   `npm run sync:xr-profiles` regenerates them.
2. **The UI appeared behind your back.** Menu, scoreboard and exit button hung from
   `<XROrigin>` with a fixed negative Z, but the −Z of the origin is decided by the calibration
   of the room, not by where the player looks. Now they hang from `<XRGazeAnchor>`, which turns
   with them and goes along if they walk, with a dead zone of 40° so that you can aim
   without the target running away. The arithmetic is in `src/lib/xrAnchor.ts`, tested without
   a browser.

In addition: controller drawn with its own geometry (no downloads) with the grip trigger
pulsing in amber until the first stick caught and in green while it is squeezed; buttons
that are resolved on `pointerdown` and not on `click` (aiming freehand, the ray slipped off
between pressing and releasing) and with a visible focus halo; and exit from the headset from
the menu.

**It is still not validated on hardware**: the emulator cannot press buttons (see the warning
in "XR tests with an emulator"), so it has to be tested with the goggles.

## Security audit and headset test (2026-08-03)

Complete audit before making the repo public: **no secrets in the history**
(reviewed with `--all`, content as well as names), no XSS, no network, no storage[^1], no
source maps and no local paths in the bundle. The app is 100 % static: no middleware,
no Server Actions, no API routes, no `next/image`.

[^1]: **No longer true**: the game writes five keys in `localStorage`, each
one decided on its own in the task that introduced it: the best score,
which is two —one per mode— (see "Best score"), the correction of the hoop
height ("Hoop height per player"), whether the headset tutorial has already been seen
("First-time tutorial") and whether you play muted ("The mute is
remembered") and the scenery/passthrough ("The scenery is remembered"). All are
local preferences —numbers and flags— and there are still no identifiers,
cookies or anything that leaves the browser. What stays only in memory is the game
mode.

Fixed in `feat/xr-menu-inmersivo-y-seguridad`:

- **Headers** in `next.config.ts`. The important one is `connect-src 'self'`: in the
  bundle there are CDNs hard-wired by libraries (controllers of @react-three/xr on jsDelivr,
  drei's preset HDRI on raw.githack, troika's fonts). Now the "works without
  internet" is enforced by the browser. `xr-spatial-tracking=(self)` is mandatory: without
  it WebXR does not start.
- **Controller and hand models disabled** (`xrStore`).
  > **Corrected (2026-08-05):** here it was said that this *was the real download from
  > jsDelivr*. It was **false**, and it cost dearly: `model: false` only removes the `.glb`
  > model; the **profile** of the controller kept being downloaded, the CSP blocked it and that
  > left the headset without controllers. See "Second headset test". The path **can** be
  > redirected from `createXRStore`: it accepts `XRControllerLayoutLoaderOptions`, and
  > `baseAssetPath` is exactly what now points to `public/webxr-profiles/`.
- MIT `LICENSE`, CI (lint/types/unit/e2e), Dependabot, and `maximumScale: 1` out.

**Pending and not resolved:**

- ~~`npm audit` with 5 high because of `next@16.2.12`~~ **RESOLVED (2026-08-04)**:
  `next@16.3.0` came out and with it the warnings that `sharp`/libvips dragged along disappear.
  `npm audit fix` (without `--force`, without leaving the declared ranges) also closed `postcss`
  and `brace-expansion` in development dependencies. **0 vulnerabilities.**
- ~~The personal email in the history~~ **RESOLVED (2026-08-03)**: the
  28 commits that carried it were rewritten with `git filter-branch --env-filter`, changing it
  to `100352899+cpl121@users.noreply.github.com`. The tree was left **identical** (same tree
  hash before and after: only author metadata changed) and a `push --force` was done
  on `main`. `git config user.email` already points to the noreply so that it does not slip in
  again. **Closed completely on 2026-08-06**: the branches of the remote
  that kept it were deleted too, so today `origin` only has `main` and no published commit
  carries the personal email.
- `.claude/` and `.organizate/install-state.json` will be published and reveal the internal
  tooling. No secrets, but it is a decision.

## The menu opens on the challenge and the goal sign (2026-10-05)

From the headset (web): "when I go in to play I am not clear what the mission is". What was decided and why:

- **It opens on the challenge, always** (`DEFAULT_GAME_MODE`), and the mode is called **«Reto»**
  in Spanish («Challenge» is still the key). Before, it opened on practice so as not to debut
  with lives; now Jugar without touching anything has to be the run that gives a medal. Each
  mode says first whether it counts for a medal, in two-line sentences: a third line spills out
  of the headset panel.
- **The common sign** (`goal.ts`, `GoalSign.tsx`, copied from basketball) goes
  **above the scoreboard**, at 1.16 m (`XR_SIGN_POSITION`): 27° below the gaze, further away
  than any stick and below the tutorial and the exit notice, which start at 1.21 m. Above the
  hoop it would cover the fall. The scoreboard keeps quiet about what the sign says (points bar
  and lives) and shrinks (`XR_HUD_WITH_SIGN`); at the end it does not rise, because the sign is
  up there.
- **The mission was shortened**: «Atrapa los 13 palos. Tres al suelo y se acaba» came out at
  0.82° (0.69° in English) because the sign writes one line and shrinks it. «Atrapa 13 palos.
  Tres al suelo y fuera» stays at one degree. It is shown in the countdown **and until the first
  stick is resolved**: three seconds were not enough to read it.
- **What does not count** (practice, levels, two players) is said quietly by the sign only
  inside the hall and only while playing: at the end, the final panel takes that place.
- **The crossed threshold**: colour and pulse of the sign, two notes (`medal`) after the catch
  and a tap on the good hand 90 ms later (`pulse()` does not queue and the catch already
  vibrates).
- On the web without a headset the mission comes out at the top in DOM until the first stick,
  and the highlighted button of the end is «Otra» (before there was only «Volver al menú»).
- **The emulator of the e2e** had been broken since `iwer` went up to 2.4: without
  `forceInstall` it steps aside for Chromium's `navigator.xr` and no session test could enter
  the headset.
- The e2e of the Godot menu no longer presses the mode button twice: without a window the engine
  runs faster than the clock and the second tap fell inside the double touch (300 ms).
