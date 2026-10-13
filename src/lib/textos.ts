/**
 * What the game says, in Spanish.
 *
 * **The key is the English text itself.** There are no invented ids
 * (`hud.points`) for two reasons. The first is that it reads: in the component
 * it says `t('Back to the menu')`, and whoever passes by knows what is drawn without going
 * to look for the dictionary. The second is that TypeScript watches it on its own: `TextKey`
 * comes from the keys of this object, so changing the phrase in the component
 * and forgetting about here **does not compile**, instead of leaving an orphan key that
 * is only noticed when someone puts the game in Spanish.
 *
 * English is not stored twice: if the language is English, `texto` returns the
 * key. This file only has the translation.
 *
 * **What does NOT go in here.** The comments, the identifiers and the programmer
 * errors stay in English because they are for whoever maintains the repo. The
 * storage keys are never touched either: translating them would erase the
 * records of whoever plays.
 *
 * The language is chosen by whoever plays just once, in xrcade's menu, and it gets
 * here through the hall's cookie (see `settings.ts`).
 */

import type { Lang } from './settings'
import { GOAL_ES, type Translate } from './goal'
import { MENU_ES } from './menuWords'

const ES = {
  // The goal sign, common to all the games of the hall. First, so that what the
  // game already said on its own does not clash.
  ...GOAL_ES,
  // The hall's common buttons and states (`menuWords.ts`), said the same in all the games.
  ...MENU_ES,
  'Catch {sticks} sticks. Drop three and out': 'Atrapa {sticks} palos. Tres al suelo y fuera',
  // What the bronze is worth in sticks, the first time (the sign's `asCount`).
  '≈ {n} stick': '≈ {n} palo',
  '≈ {n} sticks': '≈ {n} palos',

  // What the tab says and what is read when the link is shared
  'Catch the sticks falling from the machine before they hit the ground. Play in the browser or in mixed reality (VR/AR).':
    'Atrapa los palos que caen de la máquina antes de que toquen el suelo. Juega en el navegador o en realidad mixta (VR/AR).',

  // Menu
  'Catch the sticks before they hit the ground.': 'Atrapa los palos antes de que toquen el suelo.',
  // The mode row in the headset: the name of the row and the chosen mode, which its switch only draws.
  'Mode: {mode}': 'Modo: {mode}',
  'Number of sticks': 'Número de palos',
  Difficulty: 'Dificultad',
  Length: 'Longitud',
  Level: 'Nivel',
  'Best endless streak': 'Mejor racha sin fin',
  'Best score in': 'Mejor marca en',
  'sticks on': 'palos en',
  Medium: 'Media',
  Expert: 'Experta',
  Impossible: 'Imposible',

  // Modes
  Practice: 'Práctica',
  Levels: 'Niveles',
  // Each mode says first whether it counts for a medal. Short on purpose: in the headset's panel
  // two lines of some 27 letters fit, and a third one overflows (`menu.legible.test.ts`).
  'No medal. Every stick drops, missing costs nothing.': 'Sin medalla. Caen todos y fallar no cuesta nada.',
  'No medal. One level at a time, each unlocks the next.': 'Sin medalla. Cada nivel superado abre el siguiente.',
  'Counts for a medal. Three lives, one per stick lost.': 'Cuenta para medalla. Tres vidas, una por palo perdido.',
  Set: 'Tanda',
  Endless: 'Sin fin',
  'The sticks you picked, and that is it.': 'Los palos elegidos y se acaba.',
  'It reloads until you say stop.': 'Se recarga hasta que tú digas.',

  // For two
  'Your three lives against your record.': 'Tus tres vidas contra tu récord.',
  'Pass the controller: same sticks, most points wins.':
    'Pasaos el mando: mismos palos, gana quien más saque.',
  'Player 1': 'Jugador 1',
  'Player 2': 'Jugador 2',
  '{player}: {points} points': '{player}: {points} puntos',
  'Pass the controller to {player}.': 'Pásale el mando a {player}.',
  '{player}, your turn': '{player}, te toca',
  '{player} wins': 'Gana {player}',
  "It's a tie": 'Empate',
  'Duels won: {one}–{two} · tied: {ties}': 'Ganadas: {one}–{two} · empates: {ties}',

  // Difficulties
  Easy: 'Fácil',
  Hard: 'Difícil',

  // Scoreboard
  Points: 'Puntos',
  Lives: 'Vidas',
  'Best streak': 'Mejor racha',
  'End run': 'Terminar',
  // Tutorial of the headset. One phrase per step **and per gesture**: with a controller the
  // grip button is named; with bare hands, the pinch, which is what moves
  // that same pointer when there is no button to squeeze.
  //
  // Short on purpose: what teaches the gesture is the drawing beside it, and the phrase that
  // also explained that the hand closes on top took up four lines in English and left
  // no room for the drawing. `tutorial.legible.test.ts` measures it.
  'Hold the grip button on a stick, do not point at it':
    'Mantén el botón de agarre sobre un palo, no lo apuntes',
  'Pinch your fingers on a stick, do not point at it':
    'Junta los dedos sobre un palo, no lo apuntes',
  'They fall all around you: turn and catch another one':
    'Caen por todos lados: gírate y atrapa otro',
  Next: 'Siguiente',
  Hoop: 'Aro',
  Sticks: 'Palos',
  Speed: 'Velocidad',
  Around: 'Alrededor',
  'Leave the game?': '¿Dejar la partida?',
  'You lose what you have got so far.': 'Pierdes lo que llevas.',
  'Keep playing': 'Seguir jugando',
  Leave: 'Salir',
  Menu: 'Menú',

  // Summary
  'Game over!': '¡Partida terminada!',
  'Challenge cleared!': '¡Reto superado!',
  'You are out of lives': 'Te has quedado sin vidas',
  'New record!': '¡Nuevo récord!',
  'Best streak!': '¡Mejor racha!',
  'Your record:': 'Tu récord:',
  'Your best streak:': 'Tu mejor racha:',
  'You caught': 'Has atrapado',
  of: 'de',
  'sticks.': 'palos.',
  'sticks, endless.': 'palos sin fin.',
  '{stars} star': '{stars} estrella',
  '{stars} stars': '{stars} estrellas',
  'Level {level} cleared!': '¡Nivel {level} superado!',
  'Level {level} not cleared': 'Nivel {level} sin superar',
  'Level {level} unlocked': 'Nivel {level} desbloqueado',
  'of {max} possible': 'de {max} posibles',
  // The scoreboard in the corner and what the screen reader announces.
  'Streak ×{streak}': 'Racha ×{streak}',
  '{score} / {total} sticks': '{score} / {total} palos',
  '{score} sticks · set {set} / {total}': '{score} palos · tanda {set} / {total}',
  'Level {level} · ': 'Nivel {level} · ',
  '{points} points. ': '{points} puntos. ',
  'Level {level}. ': 'Nivel {level}. ',
  'Lives {lives} of {total}. ': 'Vidas {lives} de {total}. ',
  'Caught {score} of {total}': 'Atrapados {score} de {total}',
  'Caught {score}, endless, set {set}': 'Atrapados {score}, sin fin, tanda {set}',
  'Starting in {seconds}': 'Empieza en {seconds}',

  // Headset
  'Enter the headset': 'Entrar en el visor',
  'Inside you choose between the scene and your room': 'Dentro eliges entre escenario y tu habitación',
  'Your headset only supports virtual reality': 'Tu visor solo admite realidad virtual',
  'Skip tutorial': 'Saltar tutorial',
  'Loading scene…': 'Cargando escena…',

  // When something breaks
  'Something went wrong': 'Algo ha fallado',
  'Something unexpected happened. Try again.': 'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
  Code: 'Código',
  'Try again': 'Reintentar',
} as const

/** Each phrase the game knows how to say, written as it is said in English. */
export type TextKey = keyof typeof ES

/**
 * All the keys of the dictionary, to be able to go through them.
 *
 * The key **is the phrase in English**, so this list is also the list of everything the
 * game says. It serves to check that none is left that nobody says any more.
 */
export const TEXT_KEYS = Object.keys(ES) as TextKey[]

/**
 * A phrase in the requested language.
 *
 * In English it returns the key, which is already the phrase: storing the original
 * twice would be having two places to change it and one to forget about.
 */
export function texto(lang: Lang, key: TextKey): string {
  return lang === 'es' ? ES[key] : key
}

/**
 * The translator of a language, so as not to repeat it on each line.
 *
 * It is requested once at the top of the component —`const t = translator(useLang())`— and
 * used as `t('Back to the menu')`.
 */
export function translator(lang: Lang) {
  return (key: TextKey) => texto(lang, key)
}

/**
 * The translator the goal sign asks for (`goal.ts`): it accepts any phrase and fills in
 * its placeholders.
 *
 * What is not in the dictionary comes out as is: the unit of the record arrives from the hall
 * already in the language of whoever plays, and a bare figure is not translated.
 */
export function softTranslator(lang: Lang): Translate {
  return (phrase, values) => {
    const said = lang === 'es' && Object.prototype.hasOwnProperty.call(ES, phrase) ? ES[phrase as TextKey] : phrase
    return values === undefined ? said : formatText(said, values)
  }
}

/**
 * Fills in the placeholders of a phrase.
 *
 * The phrases with a placeholder carry `{something}` and are not split into pieces to
 * concatenate them: the order of the words changes from one language to another, and
 * concatenating forces Spanish to fake English syntax.
 */
export function formatText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  )
}

/**
 * A figure with the thousands separated, without `Intl`.
 *
 * The scoreboard cannot ask the engine for the format: the one that will run this logic outside
 * the browser does not carry the language tables inside —QuickJS-ng does not ship `Intl` and the
 * V8 of GodotJS is compiled without ICU—, so there `toLocaleString` either blows up or returns the
 * bare number, with no separators. And the score is the first thing that is looked at. Here there
 * is only arithmetic and concatenation, which work the same in all the engines.
 *
 * With the language, the separator and from how many digits it is grouped change, which is the
 * rule of the RAE and of CLDR and the same as the goal sign's (in `goal.ts`) and the hall's
 * cabinet's: English, with a comma from four digits on («2,100»); Spanish, with a dot and **from
 * five on** («2100», «12.400»). That way the scoreboard and the sign beside it write the same
 * best the same way. A figure that is not a number —a record edited by hand in the storage— counts
 * as zero, which is better than showing «NaN» to whoever is playing.
 */
export function formatFigure(n: number, lang: Lang): string {
  if (!Number.isFinite(n)) return '0'

  const { separator, from } = lang === 'es' ? { separator: '.', from: 5 } : { separator: ',', from: 4 }
  const rounded = Math.round(n)
  let rest = String(Math.abs(rounded))
  let thousands = ''
  // It is decided once, with the whole figure: either all of it is grouped or it is not grouped.
  const grouped = rest.length >= from
  while (grouped && rest.length > 3) {
    thousands = `${separator}${rest.slice(-3)}${thousands}`
    rest = rest.slice(0, -3)
  }

  return `${rounded < 0 ? '-' : ''}${rest}${thousands}`
}
