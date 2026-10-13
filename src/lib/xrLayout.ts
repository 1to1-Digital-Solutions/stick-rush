import { DIFFICULTY_ORDER, MAX_STICKS, PLAYER_OFFSET_Z, STICK_RADIUS, type Difficulty } from './gameConfig'
import { GAME_MODE_LABELS, type GameMode } from './gameMode'
import { REFERENCE_EYE_HEIGHT, isPlausibleEyeHeight } from './hoopHeight'
import { EYE_HEIGHTS, eyesAt, type PanelPose, type Point } from './panelReading'
import { MENU_DEGREES } from './menuTemplate'
import { formatText, type TextKey } from './textos'
import { isShown, type MenuRow } from './gameMenu'

/**
 * Where each thing of the immersive ui is placed, in metres. The heights are
 * measured from the floor and are those of the reference person
 * (`REFERENCE_EYE_HEIGHT`); what is kept of them when the player changes
 * is their distance to the eyes, because the whole set goes up or down with them (see
 * `xrUiRise`).
 *
 * **The −Z here is where the player is looking**, not a fixed direction of the
 * room: all of this hangs from `<XRGazeAnchor>`, which turns the set with them (see
 * `@/lib/xrAnchor`). It used to hang directly from `<XROrigin>`, whose −Z is
 * decided by the calibration of the space, and entering while looking elsewhere was
 * enough for the menu to appear behind your back.
 *
 * It lives here, and not inside the components, because the immersive session
 * tests have to point the controller at these same points: if the layout
 * moves, the tests follow it without being touched. The components only paint.
 */

export type Vec3 = [number, number, number]

/**
 * How much the whole immersive ui goes up or down to suit whoever plays,
 * in metres.
 *
 * **The problem it solves.** The hoop already stands over the player's eyes
 * (see `hoopHeight.ts`), but the panel was still nailed at 1.40 m: whoever plays
 * seated found it at forehead height, with the top row
 * —precisely the one of the hoop setting— above the comfortable line of sight.
 *
 * **The whole eye height is followed, not a fraction.** The panel does not touch the
 * floor nor has anything to do with it: it is a floating sheet that is looked at, so
 * the only thing that matters is how high its buttons end up relative to the eyes.
 * Following halfway would leave the top row above the head of whoever
 * plays seated, which is exactly the problem. And the absolute limits
 * that the hoop does carry are not needed: within the range of heights accepted
 * as a person, nothing of the ui reaches the floor.
 *
 * That said, there is nothing to spare: the scoreboard panel is drawn centred on its height and when
 * a challenge run ends it drops 24 cm, so with the shortest player its
 * edge stays one centimetre from the floor. Lowering a height here or making
 * a panel taller means going back over that number, and `xrInteraction.test.ts`
 * watches it.
 *
 * When the headset does not say how high the head is, nothing is made up: the
 * ui stays where it has always been.
 */
export function xrUiRise(eyeHeight: number | null | undefined): number {
  if (!isPlausibleEyeHeight(eyeHeight)) return 0
  return eyeHeight - REFERENCE_EYE_HEIGHT
}

/**
 * What the line that explains the chosen mode takes up.
 *
 * The panel grows **only downwards** and nothing that was already there moves. Raising the
 * rows to spread the growth does not fit here: the top one —the hoop— is already 14 cm
 * from the eyes and the comfortable ceiling is 15 (`xrInteraction.test.ts`), so nine
 * centimetres more would leave it where you have to crane your neck to see it.
 */
export const HINT_BAND = 0.1

/** Nothing goes up: the whole band is taken out at the bottom. */
export const HINT_RISE = 0

/** Where the mode line starts, by its top edge. */
export const HINT_Y = -0.395

/**
 * How wide it is allowed to be.
 *
 * Less than the panel: at the two ends of that row are exit and mute, and the sentence
 * would run over both.
 */
export const HINT_WIDTH = 0.62

/**
 * At what size each thing of the menu panel is written, in metres of letter height.
 *
 * **A single list for whoever paints and for whoever measures.** `drawNames` writes with these
 * sizes and `menu.legible.test.ts` checks that everything the canvas notes down is in it: a
 * letter written by hand, or shrunk to fit, does not go by unseen.
 *
 * The explanation of the mode was at 22 mm: at the very bottom, half a metre below the eyes and
 * measured in its row with the foreshortening, it stayed at 0.92°. At 35 mm it fits in two lines; at 36, the
 * one of the levels asks for three and runs out of the panel.
 */
export const MENU_TEXT = { title: 0.042, label: 0.032, hint: 0.035 } as const

/**
 * How the menu panel hangs from the ui: where, facing whom and at what scale.
 *
 * The buttons are declared in panel coordinates (`XR_MENU_SPOT`, the `*_OFFSET`) and this
 * pose takes them to the ui space (`onMenu`). With the scale, the whole panel grows
 * with the distance and keeps the angles: what was read and pointed at from one metre is read and
 * pointed at the same from a metre and a half.
 */
export interface MenuPose {
  readonly position: Vec3
  /** Turn around the vertical, like three's `rotation.y`. */
  readonly yaw: number
  readonly scale: number
}

/**
 * Where the settings column goes in the headset: the common rule of the hall's games
 * (`.claude/rules/xr.md`): the menu is born at `MENU_DEGREES` or less from the front and moves aside on
 * starting.
 *
 * **It used to be in front, at 95 cm**: in the middle of the hoop, right where the sticks fall. Then it went to 55°
 * to the left, outside where you look while playing, and you had to turn your head to find it.
 * It goes a metre and a half from the eyes and 30° to the left: it is seen on entering without turning, and the sticks
 * that are left between the eyes and the plate are dimmed while choosing (`stickCoversMenu`). It is only
 * painted in the menu: on starting, the panel goes away and the back button remains (`XR_QUIT_POSITION`).
 *
 * TO BE CALIBRATED WITH THE HEADSET (distance between 1.4 and 1.6).
 */
export const XR_COLUMN = { distance: 1.5, azimuth: (MENU_DEGREES * Math.PI) / 180 } as const

/**
 * How much the panel grows in the column.
 *
 * The panel was designed at 97 cm from the eyes (95 in front and 20 below), but it does not grow as much
 * as it moves away (1.5 / 0.97 = 1.55): at that size it went over a metre and a half tall. It grows what the smallest letter asks for to keep being read at a glance
 * in both languages and at the three eye heights (`menu.legible.test.ts`): the one that rules is
 * «Aro», at the very top and seen foreshortened, which with 1.31 already stays at 1.39°. TO BE CALIBRATED
 * WITH THE HEADSET.
 */
export const XR_MENU_SCALE = 1.35

/** What the menu plate takes up, in metres, before growing with the pose. */
export const MENU_PANEL: [number, number] = [1.06, 0.92 + HINT_BAND]

/**
 * The name of the cabinet (`gameName()`), at the top left of the panel, as in the other
 * games of the hall. It goes in the free strip left above the hoop row: its label, centred,
 * ends lower down (`ROW_LABEL_RISE`), so the name can reach the right edge without
 * stepping on it. `menu.legible.test.ts` measures it in both languages and with a long name.
 */
export const MENU_TITLE = {
  x: -MENU_PANEL[0] / 2 + 0.05,
  y: 0.475,
  width: MENU_PANEL[0] - 0.1,
} as const

/** The menu column in the headset: to the left, at eye height, facing the player. */
export const XR_MENU_POSE: MenuPose = {
  position: [
    -Math.sin(XR_COLUMN.azimuth) * XR_COLUMN.distance,
    REFERENCE_EYE_HEIGHT,
    -Math.cos(XR_COLUMN.azimuth) * XR_COLUMN.distance,
  ],
  yaw: XR_COLUMN.azimuth,
  scale: XR_MENU_SCALE,
}

/**
 * The menu without a headset: the xrcade hall on desktop, where the scene's ui is the
 * only one there is and you cannot turn your head to look for it. There it stays in front, where
 * it always was.
 */
export const XR_MENU_DESK_POSE: MenuPose = {
  position: [0, 1.4, -0.95],
  yaw: 0,
  scale: 1,
}

/** The pose of the menu depending on whether there is an immersive session or not. */
export function menuPoseFor(immersive: boolean): MenuPose {
  return immersive ? XR_MENU_POSE : XR_MENU_DESK_POSE
}

/**
 * **The sticks that cover the menu are dimmed while choosing.** Whoever plays is inside the hoop,
 * and the hoop surrounds everything they have in front: at whatever distance and height, between the eyes and the
 * column there are always sticks hanging (the emulator showed it: the menu was read between yellow
 * bars). Moving the column more than 90° aside would leave it behind the back, and the rule asks for the menu
 * near the front. So in the headset's menu those sticks stay almost transparent, and
 * come back whole as soon as Play is pressed: the rest of the machine is still seen hanging.
 */
export const STICK_BEHIND_MENU = 0.15

/** What a stick takes to dim or come back, at this rate per second: a quarter of a second. */
export const DIM_PER_SECOND = 4

/**
 * The margin, in degrees, on each side of the plate: the sway of the hanging stick and its thickness, and something
 * in case the head is not right where one is born.
 */
export const MENU_MARGIN_DEGREES = 6

/** Which way a point of the player's space lies, in degrees: positive to the left. */
function heading(x: number, z: number): number {
  return (Math.atan2(-x, -z) * 180) / Math.PI
}

/**
 * From which heading to which heading the menu plate takes up as seen from the eyes, in degrees (positive to the
 * left), with the margin already added.
 */
export function menuHeadings(pose: MenuPose = XR_MENU_POSE): [number, number] {
  const half = (MENU_PANEL[0] * pose.scale) / 2
  // The +X of the plate, turned `yaw` about the vertical like three's `rotation.y`.
  const dx = Math.cos(pose.yaw) * half
  const dz = -Math.sin(pose.yaw) * half
  const [x, , z] = pose.position
  const a = heading(x - dx, z - dz)
  const b = heading(x + dx, z + dz)
  return [Math.min(a, b) - MENU_MARGIN_DEGREES, Math.max(a, b) + MENU_MARGIN_DEGREES]
}

/**
 * Whether the stick that hangs from that hook is seen in front of the menu plate.
 *
 * The hook comes in the machine's coordinates (the centre of the hoop at the origin) and whoever
 * plays is `PLAYER_OFFSET_Z` behind it. Only the heading is looked at: the plate of the column
 * is more than a metre tall and covers, seen from the eyes, the whole strip the sticks hang
 * from (`xrLayout.test.ts` checks it).
 */
export function stickCoversMenu(hook: Vec3, pose: MenuPose = XR_MENU_POSE): boolean {
  const [x, , z] = hook
  const stickHeading = heading(x, z - PLAYER_OFFSET_Z)
  const side = (Math.atan2(STICK_RADIUS, Math.hypot(x, z - PLAYER_OFFSET_Z)) * 180) / Math.PI
  const [from, to] = menuHeadings(pose)
  return stickHeading + side >= from && stickHeading - side <= to
}

/**
 * The opacity of a stick in this frame, going towards the one it is due without jumping: nothing that
 * looks big changes brightness all at once (`.claude/rules/xr.md`).
 */
export function opacityToward(current: number, target: number, delta: number): number {
  const step = Math.max(0, delta) * DIM_PER_SECOND
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step)
}

/** Centre of the menu panel in the headset. */
export const XR_MENU_POSITION: Vec3 = XR_MENU_POSE.position
/** Scoreboard, below the menu so as not to cross the sticks. */
export const XR_HUD_POSITION: Vec3 = [0, 0.95, -0.85]

/**
 * How tall the scoreboard panel is, in metres.
 *
 * It lives here and not inside `XRHud.tsx` because **it is not only its own**: the tutorial is now
 * shown with the run in progress, so the two panels are in front of the
 * same face at the same time and the top one has to leave room for the bottom one. Written inside the
 * component, that layout could not be checked from any test.
 *
 * `run` is what it takes up while playing; `finished`, with the result and its row of buttons; and
 * `livesRow` what is added to it when it carries hearts or stars.
 */
export const XR_HUD_PANEL = { run: 0.27, finished: 0.42, livesRow: 0.06 } as const

/**
 * The goal sign (`lib/goal.ts`, `lib/machineSign.ts`): **in front, right
 * above the scoreboard**, which is the strip that was already looked at to know how the run was going.
 *
 * Below the machine and not above the hoop: the sticks hang and fall in front of the face,
 * and a sign up there would cover the fall. Here it is 27° below the gaze —it is read
 * by lowering the eyes, without moving the head— and farther than any stick (the front one falls at 65 cm
 * and this is at 85), so none ends up behind it. Its top edge stays below
 * the exit notice and the tutorial, which start at 1.21 m.
 *
 * TO BE CALIBRATED WITH THE HEADSET (the height: higher up it reads better and gets closer to the tutorial).
 */
export const XR_SIGN_POSITION: Vec3 = [0, 1.16, -0.85]

/**
 * The scoreboard when the sign above already says the points and the lives: it keeps the tokens
 * of the sticks and the streak —and, at the end, the buttons—, and its panel shrinks to what it carries.
 *
 * `height` is how tall the panel is and `centre` where its centre ends up relative to the scoreboard's spot:
 * its top edge does not go past 13.5 cm, which is what it leaves free for the sign. The tokens do not
 * move at the end (`content`): with the sign above there is no room upwards, and the buttons
 * take up what the bar and the lives left.
 */
export const XR_HUD_WITH_SIGN = {
  content: 0.04,
  run: { height: 0.15, centre: 0.06 },
  finished: { height: 0.33, centre: -0.03 },
} as const

/** How the scoreboard is laid out: how tall its panel is, where its centre goes and at what height the tokens. */
export interface HudLayout {
  readonly height: number
  readonly centre: number
  readonly content: number
}

/**
 * The layout of the scoreboard at each moment.
 *
 * @param finished with the run finished: the panel also carries the row of buttons
 * @param row with a row of lives or of stars under the bar
 * @param sign the sign above already says the points and the lives (`XR_HUD_WITH_SIGN`)
 */
export function xrHudLayout({ finished, row, sign }: { finished: boolean; row: boolean; sign: boolean }): HudLayout {
  if (sign) return { content: XR_HUD_WITH_SIGN.content, ...(finished ? XR_HUD_WITH_SIGN.finished : XR_HUD_WITH_SIGN.run) }
  return {
    height: (finished ? XR_HUD_PANEL.finished : XR_HUD_PANEL.run) + (row ? XR_HUD_PANEL.livesRow : 0),
    centre: 0,
    content: finished ? 0.1 : 0.04,
  }
}
/**
 * Button to go back to the menu during the run —it leaves the run, not the session:
 * the one to leave the headset is `XR_MENU_EXIT_OFFSET`, and that is why they carry different
 * icons—. Set to one side so as not to cross the sticks, but inside
 * the field of view: at 51° it was out of sight and could not be found.
 *
 * **Up and to the left**, above the eye line: at chest height
 * it fell right where the hand goes to grab a stick, and there it gets pressed by accident. What is
 * played goes by in front and below, so up there it is in the way of nothing. The offset to one
 * side stays as it was: farther out, looking at it makes the whole ui reposition itself
 * (`XR_ANCHOR_DEADZONE`) and the button escapes just when you go to point at it.
 */
export const XR_QUIT_POSITION: Vec3 = [-0.42, 1.62, -0.75]

/**
 * The notice for leaving the run: **in front, at eye level**.
 *
 * It is asked with the run stopped, so it takes the place where one is already looking and not
 * a corner: what is decided here is losing what has been done so far. It was the menu's place;
 * the menu has gone to the column on the left and the notice stays in front.
 */
export const XR_CONFIRM_POSITION: Vec3 = [0, 1.4, -0.89]
export const XR_CONFIRM_SIZE: [number, number] = [0.78, 0.38]

/**
 * The end of a two-player round —the notice to pass the controller, or who wins—: **in the place of the exit
 * notice**, in front and in view, above the final scoreboard. With the run finished nothing
 * is asked, so the two never coincide; and the scoreboard, with its buttons to play and to
 * go back to the menu, is still below, where it is pressed.
 */
export const XR_DUEL_POSITION: Vec3 = XR_CONFIRM_POSITION
export const XR_DUEL_SIZE: [number, number] = [0.9, 0.26]
/** At what size it is written, in metres of letter height (`duel.legible.test.ts`). */
export const DUEL_TEXT = { title: 0.045, body: 0.034 } as const

/**
 * At what size the notice is written, in metres of letter height (`exit.legible.test.ts`).
 */
export const CONFIRM_TEXT = { title: 0.05, body: 0.034, button: 0.034 } as const

/**
 * Its two buttons, in the notice's own coordinates.
 *
 * «Seguir jugando» did not fit in 32 cm with the letter of `CONFIRM_TEXT` and shrank: the button measures what
 * its label asks for in Spanish.
 */
export const CONFIRM_BOXES = {
  /** Keep playing goes on the right and bigger: it is the answer that loses nothing. */
  stay: { position: [0.17, -0.1, 0.02] as Vec3, size: [0.34, 0.11, 0.04] as Vec3 },
  leave: { position: [-0.19, -0.1, 0.02] as Vec3, size: [0.28, 0.11, 0.04] as Vec3 },
}
/**
 * Turn of that button so that its plate faces the player.
 *
 * It is the only element set to one side, so it is the only one that needs
 * to turn: edge-on, a flat button narrows and its icon sinks into its own
 * plate. It is derived from the position instead of being fixed by eye, so that when the
 * button moves the turn follows it.
 */
export const XR_QUIT_YAW = Math.atan2(
  -XR_QUIT_POSITION[0],
  -XR_QUIT_POSITION[2],
)
/**
 * Button to leave the headset, **in the bottom right corner of the menu panel**.
 *
 * That corner is the same in the thirteen games and the why is in `lib/exitCorner.ts`: the
 * drawing had already been unified —the back arrow— but the place had not, and with the headset on
 * that is felt as having to look for it in each cabinet. Here it was at the left end of
 * the row, so the two ends were swapped: the distance between them, which is what
 * avoids pressing one for the other with an unsteady hand, does not change.
 */
export const XR_MENU_EXIT_OFFSET: Vec3 = [0.42, -0.37 + HINT_RISE, 0]
/**
 * The «Más opciones» button, in the corner opposite the one to leave the headset. It was the place of the
 * mute one, which the hall replaced with its volumes: the two settings of the bottom row end up one
 * at each end, with the start one in the middle, because in the headset you point freehand and a neighbour a
 * few centimetres away gets pressed by mistake. It carries its name written in two lines
 * (`drawNames`), measured in `menu.legible.test.ts`.
 */
export const XR_MENU_OPTIONS_OFFSET: Vec3 = [-0.42, -0.37, 0]
/** How wide its name is written: what its plate measures. */
export const OPTIONS_WIDTH = 0.15
/**
 * Settings row, the first under the hoop one: on the left what is played
 * (practice, levels or challenge) and on the right what is seen around. **The menu
 * starts with the mode**: it is what decides whether there is anything else to ask —only
 * practice asks sticks and speed, which come out below— or whether you can already hit
 * start. They go at the two ends and not together in the centre for the same reason as the
 * buttons of the bottom row: in the headset you point freehand and a neighbour a few
 * centimetres away gets pressed by mistake.
 */
const SETTINGS_ROW_Y = 0.168 + HINT_RISE
/**
 * Mode switch: it cycles through practice, levels and challenge, and shows what
 * each one puts at stake (nothing, stars, hearts).
 */
export const XR_MODE_TOGGLE_OFFSET: Vec3 = [-0.26, SETTINGS_ROW_Y, 0]
/**
 * Round or endless, in the middle of the settings row and only in practice. It fits
 * between the other two because their hit boxes do not get to touch.
 */
export const XR_ENDLESS_TOGGLE_OFFSET: Vec3 = [0, SETTINGS_ROW_Y, 0]
/**
 * Against whom —alone, or two players passing the controller—, **in the same gap** and only in the challenge:
 * endless belongs to practice and against whom to the challenge (`duel.ts`), so the two are never seen together, and
 * they share the hit box (`XR_MENU_HIT.endless`).
 */
export const XR_PLAYERS_TOGGLE_OFFSET: Vec3 = XR_ENDLESS_TOGGLE_OFFSET
/** Scenery or passthrough picker. */
export const XR_SCENERY_PICKER_OFFSET: Vec3 = [0.245, SETTINGS_ROW_Y, 0]
/**
 * Button to finish the endless run, to one side like the one to go back to the menu
 * but at the opposite end: they are the two ways out of the run and one on each
 * side they are not confused. Turned towards the player for the same reason as that one.
 */
export const XR_END_RUN_POSITION: Vec3 = [0.42, 1.15, -0.75]
export const XR_END_RUN_YAW = Math.atan2(
  -XR_END_RUN_POSITION[0],
  -XR_END_RUN_POSITION[2],
)
/**
 * Row of the hoop height setting, at the very top of the panel. It goes alone and
 * above the rest because it is the only thing touched **while looking at the machine**: with the
 * column on the left, the hoop goes by in front of the panel, to the right of what
 * is looked at, so on pressing it is seen going up or down.
 */
//
// Half a centimetre higher than it was, what it has left before leaving the comfortable
// height (`xrInteraction.test.ts`): it is what lets the mode row go up under it without
// the name of «Alrededor» —wide in Spanish— getting into the music button.
const HOOP_ROW_Y = 0.345 + HINT_RISE
/** Button to lower the hoop, to the left of its indicator. */
export const XR_HOOP_DOWN_OFFSET: Vec3 = [-0.13, HOOP_ROW_Y, 0]
/** Button to raise the hoop, to the right of its indicator. */
export const XR_HOOP_UP_OFFSET: Vec3 = [0.13, HOOP_ROW_Y, 0]
/** Ruler between the two buttons: where the hoop is within its travel. */
export const XR_HOOP_GAUGE_OFFSET: Vec3 = [0, HOOP_ROW_Y, 0]
/**
 * Button to see the tutorial again, in the top corner of the panel. It goes
 * far from the start one on purpose: it is an emergency exit for whoever does not
 * remember how the sticks are grabbed, not a step of the normal path.
 */
export const XR_MENU_TUTORIAL_OFFSET: Vec3 = [-0.4, HOOP_ROW_Y, 0]
/**
 * Background music switch, in the corner opposite the tutorial.
 *
 * At the top and not next to the mute one, which is where the likeness
 * between the two would ask for it: the bottom row is taken by exit, start and mute, and what
 * was left free between them is fifteen centimetres —in the headset you point
 * freehand and there the neighbour gets pressed—. Up here the two corners are the two
 * things that are touched once and forgotten.
 */
export const XR_MENU_MUSIC_OFFSET: Vec3 = [0.4, HOOP_ROW_Y, 0]

/**
 * Countdown: in front and at eye height, which is where the player
 * is looking right after pressing «start».
 */
export const XR_COUNTDOWN_POSITION: Vec3 = [0, 1.5, -0.9]

/**
 * What the tutorial panel measures, in metres.
 *
 * The fleet's measurements, so that the panel is the same in the fifteen: it carries a counter,
 * a sentence, the drawn gesture and two buttons, and the sentence takes **three lines in Spanish where
 * it takes two in English**.
 */
export const TUTORIAL_PANEL = { width: 0.78, height: 0.62 } as const

/**
 * At what size each thing of that panel is written, in metres of letter height.
 *
 * A single list for whoever paints and for whoever measures (`tutorial.legible.test.ts`), like
 * `MENU_TEXT`: a letter written by hand, or shrunk to fit, does not go by unseen.
 */
export const TUTORIAL_TEXT = { counter: 0.03, phrase: 0.042, button: 0.032 } as const

/** What each of its two buttons measures: wide enough for «Saltar tutorial». */
export const TUTORIAL_BUTTON = { width: 0.33, height: 0.09 } as const

/**
 * Tutorial: in front, **above the scoreboard**.
 *
 * It no longer takes over from the menu —now you learn by playing, with the sticks falling—, so
 * it shares the screen with the headset's scoreboard (`XR_HUD_POSITION`) instead of replacing it. Hence
 * it goes up: in the menu's place, its bottom edge got into the top edge of the
 * scoreboard and the result was reading one thing on top of the other. It is watched by
 * `xrInteraction.test.ts`.
 */
export const XR_TUTORIAL_POSITION: Vec3 = [0, 1.52, -0.95]
/** Height of the row of buttons inside the panel, measured from its centre. */
const TUTORIAL_BUTTON_Y = -TUTORIAL_PANEL.height / 2 + 0.08
/**
 * Button to skip the tutorial, at the bottom left of its panel.
 *
 * Set apart from what is being taught, but inside the same panel: it has to be seen from
 * the first second without competing with the lesson. And at the opposite end from the next one:
 * in the headset you point freehand and a neighbour a few centimetres away gets pressed by mistake.
 */
export const XR_TUTORIAL_SKIP_OFFSET: Vec3 = [-0.19, TUTORIAL_BUTTON_Y, 0]
/** Button to go on to the next step, at the other end of that row. */
export const XR_TUTORIAL_NEXT_OFFSET: Vec3 = [0.19, TUTORIAL_BUTTON_Y, 0]

/** Spacing between the sticks of the count picker. */
export const XR_STICK_PICKER_SPACING = 0.055
/**
 * Spacing between the cells of the level picker, which takes the row of
 * the sticks in the Levels mode: fifteen cells in the width of thirteen sticks.
 */
export const XR_LEVEL_PICKER_SPACING = 0.047
/** Spacing between the difficulty tokens. */
export const XR_DIFFICULTY_SPACING = 0.17

/**
 * Height of the stick picker inside the panel —and of the levels one, which takes its row—, under
 * the mode row: what is asked comes out **after** choosing what is played, and only in
 * practice (`picksSetup`).
 *
 * The heights of the four rows are cut to the millimetre, and it is not a whim: the hoop cannot
 * go up any more, start cannot go down, and in between three rows just fit with their name on top
 * without any name touching a button nor any box stepping on the one of the next row. It is watched by
 * `xrLayout.test.ts` («the menu starts with the mode») and `menu.legible.test.ts`.
 *
 * The name of each row and its buttons come from the same height. The sticks were painted three
 * centimetres below theirs and the speed tokens two, so the name of the mode,
 * which went below, was covered by the chosen token.
 */
export const XR_STICK_ROW_Y = -0.014 + HINT_RISE
/** Height of the difficulty picker inside the panel: the last question before starting. */
export const XR_DIFFICULTY_ROW_Y = -0.17 + HINT_RISE
/**
 * How tall the hit box of each token of those two rows is. Declared here and not in
 * the component so that the layout test checks that they do not get into the neighbouring
 * rows: an invisible box that steps on its neighbour is a button that does not respond.
 */
export const XR_ROW_HIT_HEIGHT = { sticks: 0.16, difficulty: 0.15 } as const
const STICK_PICKER_Y = XR_STICK_ROW_Y
const DIFFICULTY_Y = XR_DIFFICULTY_ROW_Y
/**
 * Where the start button goes inside the panel.
 *
 * This declaration says it and **not the component**: it had it written by hand in both
 * places with three centimetres of difference, and it only went unnoticed because its hit
 * box is bigger than it.
 *
 * And **it goes down six centimetres**. Its box is 6 cm taller than the button that is seen, and at
 * the top it got into the settings row: the last two centimetres of the mode
 * switch and the edge of «Sin fin» were inside the start box, so pointing at them
 * did nothing. It is what was reported from the headset as «invisible objects that block
 * menu options», and now between the two rows there is exactly what their half boxes add up to.
 */
export const XR_MENU_PLAY_OFFSET: Vec3 = [0, -0.32, 0]

/** What its hit box measures. */
export const XR_MENU_PLAY_HIT: Vec3 = [0.36, 0.13, 0.06]

/**
 * What the hit box of each fixed button of the menu takes up, in metres.
 *
 * It was written inside the component, button by button, and a box is **invisible**:
 * bigger than its button it eats the neighbour and whoever plays sees an option that does not respond
 * —what was reported from the headset as «there is something covering the menu»—. Declared here they
 * can be compared with each other, which is what `xrLayout.test.ts` does.
 */
export const XR_MENU_HIT: Record<string, Vec3> = {
  exit: [0.16, 0.13, 0.06],
  options: [0.16, 0.13, 0.06],
  tutorial: [0.14, 0.12, 0.06],
  music: [0.14, 0.12, 0.06],
  hoopDown: [0.13, 0.1, 0.06],
  hoopUp: [0.13, 0.1, 0.06],
  mode: [0.2, 0.13, 0.06],
  endless: [0.16, 0.13, 0.06],
  scenery: [0.14, 0.12, 0.06],
  play: [0.36, 0.13, 0.06],
}

/** Where each of those buttons goes. Same name, same order. */
export const XR_MENU_SPOT: Record<keyof typeof XR_MENU_HIT, Vec3> = {
  exit: XR_MENU_EXIT_OFFSET,
  options: XR_MENU_OPTIONS_OFFSET,
  tutorial: XR_MENU_TUTORIAL_OFFSET,
  music: XR_MENU_MUSIC_OFFSET,
  hoopDown: XR_HOOP_DOWN_OFFSET,
  hoopUp: XR_HOOP_UP_OFFSET,
  mode: XR_MODE_TOGGLE_OFFSET,
  endless: XR_ENDLESS_TOGGLE_OFFSET,
  scenery: XR_SCENERY_PICKER_OFFSET,
  play: XR_MENU_PLAY_OFFSET,
}

/**
 * How much the name of a row goes up above its buttons, in metres.
 *
 * The rows are sticks, coloured tokens and icons, and an icon says **what happens** but not **what
 * the row is about**: five tokens in a line are not read as «speed» until someone says
 * so. The panel grew to make room for them, since taking it from the buttons is taking it from
 * what is hard to point at.
 */
export const ROW_LABEL_RISE = 0.095

/**
 * What each row is called and what it is centred over, in panel coordinates.
 *
 * The settings one carries three different things, so it carries three names, each over its
 * own. In English, which is the key they are translated with.
 */
export const MENU_LABELS = [
  { text: 'Hoop', x: 0, y: HOOP_ROW_Y },
  { text: 'Sticks', x: 0, y: STICK_PICKER_Y },
  { text: 'Speed', x: 0, y: DIFFICULTY_Y },
  { text: 'Mode', x: -0.26, y: SETTINGS_ROW_Y },
  { text: 'Players', x: 0, y: SETTINGS_ROW_Y },
  { text: 'Around', x: 0.245, y: SETTINGS_ROW_Y },
] as const

/** The row of each label: the sticks one and the speed one also name the ladder of the levels. */
const LABEL_ROWS: Record<(typeof MENU_LABELS)[number]['text'], readonly MenuRow[]> = {
  Hoop: ['hoop'],
  Sticks: ['sticks', 'levels'],
  Speed: ['speed', 'levels'],
  Mode: ['mode'],
  Players: ['players'],
  Around: ['around'],
}

/**
 * The row names that are shown with each mode: those of the rows in view
 * (`gameMenu.ts`). **Only practice asks** sticks and speed; in Levels the row of the
 * sticks is the ladder and the speed is seen switched off, the level's one; the challenge is fixed
 * (`CHALLENGE_SETUP`) and its rows are not seen, so neither are their names: a label over a gap
 * reads as a missing option. What is folded behind «Más opciones», neither.
 */
export function menuLabelsFor(mode: GameMode, moreOptions = false): readonly (typeof MENU_LABELS)[number][] {
  return MENU_LABELS.filter(({ text }) => LABEL_ROWS[text].some((row) => isShown(row, mode, 'headset', moreOptions)))
}

/**
 * What is written in a menu label. The one of the mode row says «Modo» and **which** one is
 * chosen —«Modo: Reto»—: its switch draws it with hearts or stars, and a drawing does not say
 * what the one that counts for a medal is called. The others, what they are.
 */
export function menuLabelText(
  text: (typeof MENU_LABELS)[number]['text'],
  mode: GameMode,
  t: (key: TextKey) => string,
): string {
  return text === 'Mode' ? formatText(t('Mode: {mode}'), { mode: t(GAME_MODE_LABELS[mode]) }) : t(text)
}

function offset([x, y, z]: Vec3, dx: number, dy: number): Vec3 {
  return [x + dx, y + dy, z]
}

/**
 * Where a point of the menu panel, given in panel coordinates, falls in the ui
 * space: scaled and turned as three does with the panel's group.
 */
export function onMenu(dx: number, dy: number, pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [x, y, z] = pose.position
  const cos = Math.cos(pose.yaw)
  const sin = Math.sin(pose.yaw)
  return [x + dx * pose.scale * cos, y + dy * pose.scale, z - dx * pose.scale * sin]
}

/** Button to go back to the menu during the run. */
export function xrQuitButtonPosition(): Vec3 {
  return XR_QUIT_POSITION
}

/** Button to leave the headset, inside the menu panel. */
export function xrMenuExitPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MENU_EXIT_OFFSET
  return onMenu(dx, dy, pose)
}

/** «Más opciones» button, inside the menu panel. */
export function xrMenuOptionsPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MENU_OPTIONS_OFFSET
  return onMenu(dx, dy, pose)
}

/** Mode switch (practice, levels or challenge), inside the menu panel. */
export function xrModeTogglePosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MODE_TOGGLE_OFFSET
  return onMenu(dx, dy, pose)
}

/** Round or endless switch, inside the menu panel. */
export function xrEndlessTogglePosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_ENDLESS_TOGGLE_OFFSET
  return onMenu(dx, dy, pose)
}

/** Cell of the level `level` (1-based) of the level picker. */
export function xrLevelOptionPosition(
  level: number,
  levelCount: number,
  pose: MenuPose = XR_MENU_POSE,
): Vec3 {
  const width = (levelCount - 1) * XR_LEVEL_PICKER_SPACING
  return onMenu((level - 1) * XR_LEVEL_PICKER_SPACING - width / 2, STICK_PICKER_Y, pose)
}
/** Scenery or passthrough picker, inside the menu panel. */
export function xrSceneryPickerPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_SCENERY_PICKER_OFFSET
  return onMenu(dx, dy, pose)
}

/** Button to lower the hoop, inside the menu panel. */
export function xrHoopDownPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_HOOP_DOWN_OFFSET
  return onMenu(dx, dy, pose)
}

/** Button to raise the hoop, inside the menu panel. */
export function xrHoopUpPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_HOOP_UP_OFFSET
  return onMenu(dx, dy, pose)
}

/** Button to see the tutorial again, inside the menu panel. */
export function xrMenuTutorialPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MENU_TUTORIAL_OFFSET
  return onMenu(dx, dy, pose)
}

/** Button to skip the tutorial, inside its panel. */
export function xrTutorialSkipPosition(): Vec3 {
  const [dx, dy] = XR_TUTORIAL_SKIP_OFFSET
  return offset(XR_TUTORIAL_POSITION, dx, dy)
}

/** Button to go on to the next step, inside the tutorial panel. */
export function xrTutorialNextPosition(): Vec3 {
  const [dx, dy] = XR_TUTORIAL_NEXT_OFFSET
  return offset(XR_TUTORIAL_POSITION, dx, dy)
}

/** Button to start a run. */
export function xrPlayButtonPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MENU_PLAY_OFFSET
  return onMenu(dx, dy, pose)
}

/**
 * Position of the stick `index` (0-based) of the count picker. The picker
 * shows the `MAX_STICKS` possible ones and you choose by touching up to which one you want.
 */
export function xrStickOptionPosition(index: number, pose: MenuPose = XR_MENU_POSE): Vec3 {
  const width = (MAX_STICKS - 1) * XR_STICK_PICKER_SPACING
  return onMenu(index * XR_STICK_PICKER_SPACING - width / 2, STICK_PICKER_Y, pose)
}

/** Position of the token of a difficulty. */
export function xrDifficultyOptionPosition(
  difficulty: Difficulty,
  pose: MenuPose = XR_MENU_POSE,
): Vec3 {
  const index = DIFFICULTY_ORDER.indexOf(difficulty)
  const width = (DIFFICULTY_ORDER.length - 1) * XR_DIFFICULTY_SPACING
  return onMenu(index * XR_DIFFICULTY_SPACING - width / 2, DIFFICULTY_Y, pose)
}

/**
 * How much the world shifts, in metres, to leave it within reach of whoever plays.
 *
 * **The problem.** The heights of the scene were chosen with a person standing
 * in front. Seated —on a chair, on a sofa, in a wheelchair— the whole
 * world ends up a hand's breadth above where the arm reaches, and nothing fails:
 * it simply cannot be played. Whoever is shorter than that person has the
 * same happen on a small scale, and has no way to level it either.
 *
 * **It is the same correction already made to the ui**, applied to the
 * scenery: it comes out negative for whoever has their eyes below the reference,
 * so the world goes down to them. And the scenery is shifted, not the player: the
 * origin belongs to whoever mounts the scene —in the hall there is an arc of cabinets
 * standing there— and two origins in the same session step on each other.
 *
 * **It changes no score.** The whole scene is shifted, with the goal
 * inside, while the hand stays where the hand is: the height of the goal
 * relative to the arm is the same one the standing person it was drawn for
 * had. And whoever plays standing notices nothing, because there the correction is zero.
 *
 * Whoever plays asks for it from the arcade's settings and it is not guessed: lowering the
 * world without anyone having said so would move the floor under the feet of whoever
 * is standing.
 *
 * @param eyeHeight  the eye height the headset has measured, or `null`
 * @param atEyeLevel whether the world has been asked for at eye height
 */
export function worldRise(
  eyeHeight: number | null | undefined,
  atEyeLevel: boolean,
): number {
  if (!atEyeLevel) return 0
  return xrUiRise(eyeHeight)
}

/**
 * How much the height has to change, and for how long, to measure it again.
 *
 * What hangs from this measurement is placed on entering and **stays still**. One
 * that chased the head would go up on standing on tiptoe and down on
 * crouching, just when you are aiming. But sitting down in the middle of a run does
 * have to be noticed, and that is a big and sustained change, not a movement of
 * play.
 */
export const RETAKE_DELTA = 0.15
export const RETAKE_SECONDS = 1

/** What is remembered of the height between frames. */
export interface HeightTracker {
  /** The height being used right now, or `null` while there is no good one. */
  held: number | null
  /** The filtered measurement, which is what is compared with the one in use. */
  smoothed: number | null
  /** How long the measurement has been far from the one in use, in seconds. */
  drift: number
}

/** A tracking just started: with nothing measured yet. */
export function startTracking(): HeightTracker {
  return { held: null, smoothed: null, drift: 0 }
}

/**
 * Advances the tracking with this frame's measurement.
 *
 * @param measured  the height of the head, or `null` if there is no good data
 * @param ratio     how much the filter approaches the measurement in this frame, from 0 to 1
 * @param delta     seconds of this frame
 */
export function trackHeight(
  state: HeightTracker,
  measured: number | null,
  ratio: number,
  delta: number,
): HeightTracker {
  if (!isPlausibleEyeHeight(measured)) return state

  const smoothed =
    state.smoothed == null ? measured : state.smoothed + (measured - state.smoothed) * ratio
  // The first good measurement is used as is: entering the session and seeing the world
  // at eye height is what has to happen, not a scene rising
  // slowly from wherever.
  if (state.held == null) return { held: smoothed, smoothed, drift: 0 }

  const far = Math.abs(smoothed - state.held) > RETAKE_DELTA
  const drift = far ? state.drift + Math.max(0, delta) : 0
  if (drift > RETAKE_SECONDS) return { held: smoothed, smoothed, drift: 0 }
  return { held: state.held, smoothed, drift }
}

/**
 * How much the ui goes up **on top of what the world has already moved**.
 *
 * The ui hangs from the world, and the world may already have gone down to the eyes
 * of whoever plays (see `worldRise`). Adding the ui's correction then
 * would lower it twice: the menu would end up at knee height precisely for
 * whoever can least crouch to look for it.
 *
 * Put another way: when the whole world comes to you, the ui is already
 * where it has to be and needs no correction of its own.
 */
export function xrUiRiseOverWorld(
  eyeHeight: number | null | undefined,
  atEyeLevel: boolean,
): number {
  return xrUiRise(eyeHeight) - worldRise(eyeHeight, atEyeLevel)
}

/**
 * Where a ui panel is read from: with the eyes at each height of `EYE_HEIGHTS` and with the
 * hall's play height standing or at eye height.
 *
 * Everything hangs from `XRGazeAnchor`, so the panel ends up in front of the eyes, at the height the
 * world (`worldRise`) and the ui on top of it (`xrUiRiseOverWorld`) rise to. It is what the
 * `*.legible.test.ts` use to measure each letter where it really ends up. `yaw` is the turn of the panel
 * when it is not facing front, like the menu column.
 */
export function xrPanelViews(position: Vec3, yaw = 0): { where: string; pose: PanelPose; eyes: Point }[] {
  return EYE_HEIGHTS.flatMap((eyeHeight) =>
    [false, true].map((atEyeLevel) => ({
      where: `eyes at ${eyeHeight} m${atEyeLevel ? ', world at their height' : ''}`,
      pose: {
        position: [
          position[0],
          position[1] + worldRise(eyeHeight, atEyeLevel) + xrUiRiseOverWorld(eyeHeight, atEyeLevel),
          position[2],
        ] as const,
        ...(yaw === 0 ? {} : { rotation: [0, yaw, 0] as const }),
      },
      eyes: eyesAt(eyeHeight),
    })),
  )
}
