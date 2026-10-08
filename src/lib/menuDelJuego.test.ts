import { describe, expect, it } from 'vitest'
import {
  MODOS_DEL_MENU,
  botonDeOpciones,
  filasALaVista,
  filasDelModo,
  papelDeLaFila,
  seVe,
  siguienteModo,
} from './menuDelJuego'

/**
 * Las filas del menú de Stick Rush en la plantilla común: lo que pliega «Más opciones» es lo
 * mismo en el visor, en la portada y en Godot, porque los tres preguntan aquí.
 */
describe('la fila del modo empieza por el reto', () => {
  it('el reto, el que da medalla, primero; el interruptor lo recorre en ese orden y vuelve', () => {
    expect(MODOS_DEL_MENU).toEqual(['challenge', 'practice', 'levels'])
    expect(siguienteModo('challenge')).toBe('practice')
    expect(siguienteModo('practice')).toBe('levels')
    expect(siguienteModo('levels')).toBe('challenge')
  })
})

describe('las filas de cada modo', () => {
  it('el modo, quién juega y lo demás, cada uno con su papel', () => {
    expect(filasDelModo('challenge', 'visor')).toEqual(['mode', 'players', 'hoop', 'around'])
    expect(filasDelModo('practice', 'visor')).toEqual(['mode', 'endless', 'sticks', 'speed', 'hoop', 'around'])
    expect(filasDelModo('levels', 'portada')).toEqual(['mode', 'levels'])
    expect(['mode', 'levels'].map((f) => papelDeLaFila(f as 'mode'))).toEqual(['modo', 'modo'])
    expect(papelDeLaFila('players')).toBe('jugadores')
    expect(papelDeLaFila('hoop')).toBe('otra')
  })

  it('al abrir, plegado: solo lo del modo y quién juega', () => {
    expect(filasALaVista('practice', 'visor', false)).toEqual({ filas: ['mode'], plegadas: 5 })
    expect(filasALaVista('practice', 'portada', true)).toEqual({ filas: ['mode', 'endless', 'sticks', 'speed'], plegadas: 0 })
    expect(seVe('levels', 'levels', 'visor', false)).toBe(true)
    expect(seVe('hoop', 'levels', 'visor', false)).toBe(false)
  })

  it('el reto es una partida fija: lo demás no se enseña aunque se pida, y no hay botón', () => {
    expect(filasALaVista('challenge', 'visor', true)).toEqual({ filas: ['mode', 'players'], plegadas: 0 })
    expect(botonDeOpciones('challenge', 'visor', false)).toBeNull()
    expect(botonDeOpciones('challenge', 'visor', true)).toBeNull()
  })

  it('el botón dice «Más opciones» plegado y «Menos opciones» desplegado; sin nada que plegar, no está', () => {
    expect(botonDeOpciones('practice', 'portada', false)).toBe('More options')
    expect(botonDeOpciones('practice', 'portada', true)).toBe('Fewer options')
    expect(botonDeOpciones('levels', 'visor', false)).toBe('More options')
    expect(botonDeOpciones('levels', 'portada', false)).toBeNull()
  })
})
