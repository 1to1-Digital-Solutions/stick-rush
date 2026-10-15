import { describe, expect, it } from 'vitest'
import {
  MENU_MODES,
  optionsButton,
  visibleRows,
  modeRows,
  rowRole,
  isShown,
  nextMode,
} from './gameMenu'

/**
 * The rows of Stick Rush's menu in the common template: what «Más opciones» folds is the same
 * in the headset, on the front page and in Godot, because the three ask here.
 */
describe('the mode row starts with the challenge', () => {
  it('the challenge, the one that gives a medal, first; the switch goes through them in that order and comes back', () => {
    expect(MENU_MODES).toEqual(['challenge', 'practice', 'levels'])
    expect(nextMode('challenge')).toBe('practice')
    expect(nextMode('practice')).toBe('levels')
    expect(nextMode('levels')).toBe('challenge')
  })
})

describe('the rows of each mode', () => {
  it('the mode, who plays and the rest, each with its role', () => {
    expect(modeRows('challenge', 'headset')).toEqual(['mode', 'players', 'hoop', 'around'])
    expect(modeRows('practice', 'headset')).toEqual(['mode', 'endless', 'sticks', 'speed', 'hoop', 'around'])
    expect(modeRows('levels', 'page')).toEqual(['mode', 'levels'])
    expect(['mode', 'levels'].map((row) => rowRole(row as 'mode'))).toEqual(['mode', 'mode'])
    expect(rowRole('players')).toBe('players')
    expect(rowRole('hoop')).toBe('other')
  })

  it('on opening, folded: only what belongs to the mode and who plays', () => {
    expect(visibleRows('practice', 'headset', false)).toEqual({ rows: ['mode'], folded: 5 })
    expect(visibleRows('practice', 'page', true)).toEqual({ rows: ['mode', 'endless', 'sticks', 'speed'], folded: 0 })
    expect(isShown('levels', 'levels', 'headset', false)).toBe(true)
    expect(isShown('hoop', 'levels', 'headset', false)).toBe(false)
  })

  it('the challenge is a fixed run: the rest is not shown even when asked for, and there is no button', () => {
    expect(visibleRows('challenge', 'headset', true)).toEqual({ rows: ['mode', 'players'], folded: 0 })
    expect(optionsButton('challenge', 'headset', false)).toBeNull()
    expect(optionsButton('challenge', 'headset', true)).toBeNull()
  })

  it('the button says «Más opciones» folded and «Menos opciones» unfolded; with nothing to fold, it is not there', () => {
    expect(optionsButton('practice', 'page', false)).toBe('More options')
    expect(optionsButton('practice', 'page', true)).toBe('Fewer options')
    expect(optionsButton('levels', 'headset', false)).toBe('More options')
    expect(optionsButton('levels', 'page', false)).toBeNull()
  })
})
