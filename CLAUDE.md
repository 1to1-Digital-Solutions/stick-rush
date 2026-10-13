# CLAUDE.md — stick-rush

**What it is:** A web application to run in the browsers of mixed-reality headsets. The game is a take on the Falling Sticks Game, the typical game where some sticks drop to the ground at random and the player has to try to catch them. To explain it: the sticks hang from a semicircular machine. On opening the application the player decides how many sticks they want, between 5 and 13, and also picks the difficulty (easy, medium, hard, expert, impossible), which changes the speed at which the sticks fall to the ground. They have to fall staggered and at random.
If the application is played from a regular browser (without a headset), the sticks are "caught" by clicking with the mouse. But if it is played from an XR headset, the idea is to be able to choose VR or AR mode. In VR mode there is a loaded scenery. In AR, there is only the machine and the player. The sticks are grabbed with the XR controllers.
The app is to be built with next.js and libraries such as drei, react three fiber and WebXR.

**How it is built:** follow the rules in `.claude/rules/` (architecture, security, design, git) in
every change. Read the repo's context first, make the smallest focused change, reuse before
creating and verify (typecheck/lint/build/tests) before calling anything done.

**Status and next step:** see **`ESTADO.md`** — that file is the handoff between sessions and
says what to do now, short on purpose. The **backlog** (everything that is missing, done and
pending) is in **`TODO.md`**. The history round by round —what was tried with the headset and why
each thing was decided— lives in **`docs/historial.md`** and **is only read if the question is
"why is this like this"**: reading it whole at the start costs more than it gives.

**Firm decisions:**
- (Document here the stack and product decisions that are not renegotiated: language, framework,
  database, deployment, etc.)
- Manual commits: do not commit unless asked.

> Base installed with the Organízate suite. The common rules live in `.claude/rules/`. The provenance of what was
> installed is in `.organizate/install-state.json`.
