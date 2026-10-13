# Status — Stick Rush

> **How to continue:** "read `ESTADO.md` and go on with the next step". Only what is needed to
> work today is here; what is closed, in `docs/historial.md`. It is updated with **`/estado`**.
> The backlog (what is missing) lives in `TODO.md`.

---

## ⏭️ Next step

**Try it with the headset.** The latest version is **v0.24.0** (the sticks fall from rest and
accelerate). In `develop`, without a version yet: the **whole port to Godot** on the common kit
(`godot/`, `npm run godot:*`), the **two-player duel** passing the controller, the **three feats**
for the Steam achievements and following the hall's fine height.

What to look at with the goggles, and where it is changed:

| What to look at | Where it is changed |
|---|---|
| Is the step back the right one? Can the front stick be reached? | `PLAYER_OFFSET_Z` (`src/lib/gameConfig.ts`) |
| Machine at a good height? Do they hang above the face? | `HOOP_RISE_ABOVE_EYES` (`src/lib/hoopHeight.ts`) |
| Settings column (30° to the left, 1.5 m; it used to be at 55°): is it seen on entering without turning? In the menu, the sticks in front and on that side are dimmed and come back on pressing Play: does it read clean and does the machine still look whole? Web and Godot | `STICK_BEHIND_MENU`, `stickCoversMenu`, `XR_COLUMN` (`src/lib/xrLayout.ts`) |
| Menu of the common template: «Modo: Reto», «Jugadores» and the rest behind «Más opciones» (bottom left). With the challenge neither the hoop nor «Alrededor» is shown: is adjusting the hoop while seated missed? | `gameMenu.ts`, `XR_MENU_OPTIONS_OFFSET` |
| The cabinet's name at the top left of the menu (it used to be only on the web front page): is it read without looking for it, without getting in the way of «Aro»? Web and Godot | `MENU_TITLE` (`src/lib/xrLayout.ts`) |
| **The warm-up** (`src/lib/warmup.ts`): in the first run with the headset, in the challenge and with the lesson in front, lost sticks take no lives; on closing it, the challenge starts from zero with «Ahora cuenta para medalla» on the sign. Is it understood? Web and Godot | `inWarmup`, `signRun` |
| The labels under the final buttons (Otra partida / Compartir / Menú): are they read without getting in the way? | `FINAL_LABELS` (`XRHud.tsx`; Godot, `scoreboard.ts`) |
| Does the glove read as a hand and is it seen closing? In the hall it goes without a controller underneath | `src/components/xr/Glove.tsx`, `src/lib/glove.ts` |
| Bare hands, on the web and in the hall | `src/components/xr/PlayerHands.tsx` |
| Are the catch and the in extremis felt as different? | `src/lib/haptics.ts`, `src/lib/hapticFeedback.ts` |
| Does the accelerating fall read as a fall? | `fallAcceleration` (`src/lib/gameConfig.ts`) |
| **Pending in the headset — the goal sign** (above the scoreboard, 27° below the gaze; the menu opens on the challenge): is the mission understood in the first three seconds? is it read without looking for it? does it bother while playing? | `XR_SIGN_POSITION` (`src/lib/xrLayout.ts`), `CHALLENGE_MISSION` (`src/lib/machineSign.ts`) |
| Sign: the font (the mission comes out at 1°); the scoreboard without bar or lives, are they missed? | `SIGN_FONT` (`GoalSign.tsx`), `XR_HUD_WITH_SIGN`; in Godot, `SIGN` (`godot/scene/ui/sign.ts`) |
| Sign: the crossed threshold (colour, pulse, two notes and a tap on the good hand after the catch), is it noticed without distracting? | `medalVoices` (`src/lib/sound.ts`), `THRESHOLD_DELAY`, `thresholdHaptic` |

What only the headset can say about the Godot port is in "What is known and what is missing" of
`godot/README.md`. The common list for every game: `organizate/docs/pendiente-de-visor.md`.

Afterwards: cut a version of what is in `develop` (procedure in "Publishing a new version" of
`docs/mounting-the-game.md`) and have xrcade bump it with `npm run game:update`.

## 🚧 What blocks or waits

1. **Nothing has been tried with the goggles** for several rounds: everything in the table above
   and the Godot port, which has only been played flat and with a simulated headset.
2. **In the hall, nothing is caught with bare hands**: the hall sets `hand.grabPointer: false` on
   purpose and stick-rush's grab is that pointer. Turning it on is the hall's decision, looking
   at the other sixteen games.
3. **`main` is 31 commits behind `develop`.** Publishing to `main` is the user's, after trying
   it with the headset.
4. **Does the repo go public?** No blocker from personal data; whether `.claude/` and
   `.organizate/install-state.json` are shown is still to be decided (`TODO.md`, «Producto»).
5. **`TODO.md` is behind**: it still marks Godot as "frozen" and it is already ported.

## ▶️ How to start

```
npm run dev            # http://localhost:3000 (or the machine's IP)
npm run dev:https      # for the headset, against this machine's IP
npm run lint && npm run typecheck && npm test
npm run coverage       # domain (src/lib) at 100 %; the minimum is 100
npm run test:e2e       # Playwright on the build; port E2E_PORT (3100 by default)
```

- **Godot**: the 4.7.1 editor with GodotJS in `$GODOT` and `../xrcade` next to this repo.
  `GODOT=$GODOT npm run godot:test` (everything in the engine), `npm run godot:build -- --tests`,
  `godot:sfx` and `godot:controllers`. Detail in `godot/README.md`, "How it is used".
- The e2e suite takes ~1 min and has time-sensitive parts: if something fails intermittently,
  run it again before "fixing" anything.
- `build` sets `NODE_ENV=production` because the environment exports `development`, which
  breaks the prerendering of `/_global-error`.
- Node is pinned in `.nvmrc` and CI reads it from there; bumping it is done by hand, checking
  that `npm install` leaves the lock intact.
- The IWER emulator only shows up with the exact hostname `localhost`.
- No nested worktrees inside the repo: `npm run lint` walks their `.next/`.

## 📌 Rules that apply and cannot be deduced from the repo

- **A stick can be caught until it touches the ground, hanging included.** The rule lives in
  `canCatchStick` (`src/lib/xrInteraction.ts`) and is pinned by unit tests and an e2e.
- **There is a single logic**: Godot runs `src/lib` with GodotJS; it is not rewritten in the port.
- Manual commits; no `push` and no touching `main` without explicit permission.
- There is a backup of the history before the rewrite in `refs/backup/main-antes-de-reescribir`.

## 🗺️ Where the rest is

| For… | Look at |
|---|---|
| Why something is the way it is | `docs/historial.md` (not read at the start) |
| What is missing (backlog) | `TODO.md` |
| The Godot port, and what is missing in it | `godot/README.md` |
| Mounting the game in the hall and publishing a version | `docs/mounting-the-game.md` |
| Common rules | `.claude/rules/` |
