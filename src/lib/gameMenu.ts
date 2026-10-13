import { picksPlayers } from './duel'
import { GAME_MODE_ORDER, picksSetup, type GameMode } from './gameMode'
import { MENU_EN } from './menuWords'
import { challengeFirst, foldRows, type FoldedRows, type RowRole } from './menuTemplate'

/**
 * The rows of Stick Rush's menu according to the common template (`menuTemplate.ts`): which rows
 * each mode has, which role each one has and which ones stay behind «Más opciones».
 *
 * The three menus use it —the headset's panel (`XRMenu.tsx`), the web's front page
 * (`StartScreen.tsx`) and the one of the Godot port (`godot/scene/ui/menu.ts`)—, so that the three
 * fold the same.
 *
 * - **Mode**: the mode switch and, in the levels, the ladder with the level's speed, which is
 *   what makes the chosen mode concrete.
 * - **Players**: alone or two, only in the challenge (`picksPlayers`).
 * - **The rest**: the round or endless, the sticks and the speed of practice, and in the headset
 *   the height of the hoop and what is seen around. The challenge is a fixed run: with it chosen,
 *   the rest is not shown and there is no button to ask for it.
 *
 * With nothing from the browser nor from the engine: it is ported to Godot as is.
 */

/**
 * The modes in the order of the «Modo» row: the challenge, the one that gives a medal, first. The
 * headset's switch goes through them in this order and the front page lays them out like this;
 * `GAME_MODE_ORDER`, from the gentlest to the most demanding, stays for the rest.
 */
export const MENU_MODES: readonly GameMode[] = challengeFirst(GAME_MODE_ORDER, (mode) => mode === 'challenge')

/** The mode that follows that one when the headset's switch is pressed: from the last, back to the first. */
export function nextMode(mode: GameMode): GameMode {
  return MENU_MODES[(MENU_MODES.indexOf(mode) + 1) % MENU_MODES.length]
}

/** A row of the menu: `levels` is the ladder of the levels with its speed, which is not chosen. */
export type MenuRow = 'mode' | 'levels' | 'players' | 'endless' | 'sticks' | 'speed' | 'hoop' | 'around'

/** Where the menu is drawn: the headset also carries the hoop and what is around. */
export type MenuKind = 'headset' | 'page'

/** The role of each row in the template. */
export function rowRole(row: MenuRow): RowRole {
  if (row === 'mode' || row === 'levels') return 'mode'
  return row === 'players' ? 'players' : 'other'
}

/** The rows the menu has with that mode chosen, all of them, in the order of the template. */
export function modeRows(mode: GameMode, where: MenuKind): MenuRow[] {
  const rows: MenuRow[] = ['mode']
  if (mode === 'levels') rows.push('levels')
  if (picksPlayers(mode)) rows.push('players')
  if (picksSetup(mode)) rows.push('endless', 'sticks', 'speed')
  if (where === 'headset') rows.push('hoop', 'around')
  return rows
}

/** What is shown of the menu: the rows in view and how many stay folded. */
export function visibleRows(mode: GameMode, where: MenuKind, moreOptions: boolean): FoldedRows<MenuRow> {
  return foldRows(modeRows(mode, where), rowRole, { moreOptions, inChallenge: mode === 'challenge' })
}

/**
 * What the fold button says, or `null` if there is none: «Más opciones» with something folded,
 * «Menos opciones» with everything in view if there is something to fold again, and nothing in the
 * challenge.
 */
export function optionsButton(
  mode: GameMode,
  where: MenuKind,
  moreOptions: boolean,
): typeof MENU_EN.moreOptions | typeof MENU_EN.fewerOptions | null {
  const foldable = visibleRows(mode, where, false).folded > 0
  if (!foldable) return null
  return moreOptions ? MENU_EN.fewerOptions : MENU_EN.moreOptions
}

/** Whether that row is seen with that mode and that fold. */
export function isShown(row: MenuRow, mode: GameMode, where: MenuKind, moreOptions: boolean): boolean {
  return visibleRows(mode, where, moreOptions).rows.includes(row)
}
