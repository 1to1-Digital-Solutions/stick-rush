import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_MODE_HINTS, GAME_MODE_LABELS } from './gameMode'
import { DIFFICULTY_LABELS } from './gameConfig'
import { TEXT_KEYS, formatText, formatFigure, texto, translator, softTranslator } from './textos'
import { GOAL_ES } from './goal'
import { PLAYER_COUNT_HINTS, PLAYER_COUNT_LABELS, PLAYER_LABELS } from './duel'
import { MENU_ES, plural } from './menuWords'

/**
 * The dictionary of the game.
 *
 * That the keys exist is checked by TypeScript —they come from the object itself—, so
 * here what the type does not see is looked at: that in English the original is returned
 * without storing it twice, that in Spanish nothing is left untranslated, and that the
 * labels that come from the configuration maps are in the dictionary.
 * That last one is the one that breaks on its own: a difficulty is added and nobody remembers.
 */
describe('the placeholders of a phrase', () => {
  it('are filled in with what is given, and what is not given stays as it was', () => {
    expect(formatText('{player} wins', { player: 'Player 1' })).toBe('Player 1 wins')
    expect(formatText('{player}: {points}', { player: 'P' })).toBe('P: {points}')
  })
})

describe('the translator of the goal sign', () => {
  it('translates what is in the dictionary and fills in the placeholders', () => {
    const es = softTranslator('es')
    expect(es('Lives')).toBe('Vidas')
    expect(es('{medal} at {target} · you have {score}', { medal: es('Silver'), target: 3750, score: 2100 })).toBe(
      'Plata a 3750 · llevas 2100',
    )
  })

  it('in English it returns the phrase, with its placeholders filled in', () => {
    const en = softTranslator('en')
    expect(en('Lives')).toBe('Lives')
    expect(en('Your record {record}', { record: 3100 })).toBe('Your record 3100')
  })

  it('what is not in the dictionary comes out as is: the unit arrives already translated from the hall', () => {
    const es = softTranslator('es')
    expect(es('puntos en el reto')).toBe('puntos en el reto')
    // Nor what only looks like a key because it comes from higher up than the object.
    expect(es('toString')).toBe('toString')
  })

  it('the dictionary carries all the common phrases of the sign, and the ones of the game rule over them', () => {
    for (const [key, phrase] of Object.entries(GOAL_ES)) {
      expect(texto('es', key as keyof typeof GOAL_ES), key).toBe(phrase)
    }
    expect(texto('es', 'Challenge')).toBe('Reto')
  })
})

describe('the dictionary', () => {
  it('in English it returns the key itself', () => {
    expect(texto('en', 'Back to the menu')).toBe('Back to the menu')
    expect(texto('en', 'Points')).toBe('Points')
  })

  it('in Spanish it translates', () => {
    expect(texto('es', 'Back to the menu')).toBe('Volver al menú')
    expect(translator('es')('Game over!')).toBe('¡Partida terminada!')
  })

  it('says the right plural, with one and with two, in both languages', () => {
    const say = (lang: 'en' | 'es', n: number, one: string, many: string) => softTranslator(lang)(plural(n, one, many), { n, stars: n })
    expect(say('en', 1, '{stars} star', '{stars} stars')).toBe('1 star')
    expect(say('en', 2, '{stars} star', '{stars} stars')).toBe('2 stars')
    expect(say('es', 1, '{stars} star', '{stars} stars')).toBe('1 estrella')
    expect(say('es', 2, '{stars} star', '{stars} stars')).toBe('2 estrellas')
    expect(say('en', 1, '≈ {n} stick', '≈ {n} sticks')).toBe('≈ 1 stick')
    expect(say('en', 2, '≈ {n} stick', '≈ {n} sticks')).toBe('≈ 2 sticks')
    expect(say('es', 1, '≈ {n} stick', '≈ {n} sticks')).toBe('≈ 1 palo')
    expect(say('es', 2, '≈ {n} stick', '≈ {n} sticks')).toBe('≈ 2 palos')
  })

  it('translates all the labels of the configuration maps', () => {
    // If a mode or a difficulty gains an entry and it is not translated, this fails
    // before anyone sees the game half done in Spanish.
    const labels = [
      ...Object.values(GAME_MODE_LABELS),
      ...Object.values(GAME_MODE_HINTS),
      ...Object.values(DIFFICULTY_LABELS),
      ...Object.values(PLAYER_COUNT_LABELS),
      ...Object.values(PLAYER_COUNT_HINTS),
      ...PLAYER_LABELS,
    ]
    // The common ones that are said the same in both languages («Solo») do not count.
    const same = Object.entries(MENU_ES).filter(([en, es]) => en === es).map(([en]) => en)
    const untranslated = labels.filter((e) => texto('es', e) === e && !same.includes(e))
    expect(untranslated).toEqual([])
  })
})

/** Where the code of the game lives, to read it whole. */
const SRC = join(import.meta.dirname, '..')

/** All the code of the game in a single text, except the dictionary itself and the tests. */
function sourceCode(folder = ''): string {
  return readdirSync(join(SRC, folder), { withFileTypes: true })
    .map((entry) => {
      const path = join(folder, entry.name)
      if (entry.isDirectory()) return sourceCode(path)
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return ''
      if (entry.name === 'textos.ts') return ''
      return readFileSync(join(SRC, path), 'utf8')
    })
    .join('\n')
}

describe('the dictionary does not pile up', () => {
  it('nor is it missing any of the ones that are said', () => {
    // The reverse of the other one, and the one that was missing: that one catches a declared
    // key nobody uses any more —annoying but harmless—, and this one a key that **is used and is
    // not declared**, which is the one that shows. In batting, `t('Fastest')` returned
    // `undefined` and the challenge's scoreboard drew a row with its figure and no name, only in Spanish.
    const source = sourceCode()
    const used = [...source.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1])
    const missing = [...new Set(used)].filter(
      (key) => !(TEXT_KEYS as readonly string[]).includes(key),
    )

    expect(missing).toEqual([])
  })

  it('does not keep phrases that nobody says any more', () => {
    // A phrase changes in the component and the old one stays here translated forever:
    // it breaks nothing, and that is why nobody ever removes it. The other twelve already watch it; this one did not.
    const source = sourceCode()
    const orphans = TEXT_KEYS.filter((key) => !source.includes(key))

    expect(orphans).toEqual([])
  })
})

/**
 * The figures that are shown.
 *
 * It is tested with numbers and not with `toLocaleString` in front because it is exactly the
 * opposite of what is wanted: the format has to come out of here, which is the only thing the
 * headset's engine and the one of the port to Godot run the same.
 */
describe('the figures the game shows', () => {
  it('separates the thousands with a dot in Spanish and with a comma in English', () => {
    expect(formatFigure(1000, 'en')).toBe('1,000')
    expect(formatFigure(12400, 'es')).toBe('12.400')
    expect(formatFigure(12400, 'en')).toBe('12,400')
    expect(formatFigure(1234567, 'es')).toBe('1.234.567')
    expect(formatFigure(1234567, 'en')).toBe('1,234,567')
  })

  it('in Spanish it groups from five digits on, like the goal sign and the cabinet of the hall', () => {
    // The rule of the RAE and of CLDR: «2100», not «2.100». English does group from four on.
    expect(formatFigure(1000, 'es')).toBe('1000')
    expect(formatFigure(2100, 'es')).toBe('2100')
    expect(formatFigure(9999, 'es')).toBe('9999')
    expect(formatFigure(9999.6, 'es')).toBe('10.000')
    expect(formatFigure(10000, 'es')).toBe('10.000')
    expect(formatFigure(2100, 'en')).toBe('2,100')
  })

  it('leaves as is what does not reach a thousand', () => {
    expect(formatFigure(0, 'es')).toBe('0')
    expect(formatFigure(0, 'en')).toBe('0')
    expect(formatFigure(7, 'es')).toBe('7')
    expect(formatFigure(7, 'en')).toBe('7')
    expect(formatFigure(999, 'es')).toBe('999')
    expect(formatFigure(999, 'en')).toBe('999')
  })

  it('keeps the sign of what goes in negative', () => {
    expect(formatFigure(-7, 'es')).toBe('-7')
    expect(formatFigure(-7, 'en')).toBe('-7')
    expect(formatFigure(-1234, 'es')).toBe('-1234')
    expect(formatFigure(-12345, 'es')).toBe('-12.345')
    expect(formatFigure(-1234, 'en')).toBe('-1,234')
    // Less than half a point below zero is zero, and not «-0».
    expect(formatFigure(-0.4, 'es')).toBe('0')
    expect(formatFigure(-0.4, 'en')).toBe('0')
  })

  it('counts as zero what is not a number', () => {
    // The record comes from the storage, which anyone can edit by hand.
    expect(formatFigure(Number.NaN, 'es')).toBe('0')
    expect(formatFigure(Number.POSITIVE_INFINITY, 'en')).toBe('0')
  })
})
