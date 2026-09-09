import { describe, expect, it } from 'vitest'
import { GAME_MODE_HINTS, GAME_MODE_LABELS } from './gameMode'
import { DIFFICULTY_LABELS } from './gameConfig'
import { texto, traductor } from './textos'

/**
 * El diccionario del juego.
 *
 * Que las claves existan lo comprueba TypeScript —salen del propio objeto—, así
 * que aquí se mira lo que el tipo no ve: que en inglés se devuelva el original
 * sin guardarlo dos veces, que en español no quede nada sin traducir, y que las
 * etiquetas que vienen de los mapas de configuración estén en el diccionario.
 * Ese último es el que se rompe solo: se añade una dificultad y nadie se acuerda.
 */
describe('el diccionario', () => {
  it('en inglés devuelve la propia clave', () => {
    expect(texto('en', 'Back to the menu')).toBe('Back to the menu')
    expect(texto('en', 'Points')).toBe('Points')
  })

  it('en español traduce', () => {
    expect(texto('es', 'Back to the menu')).toBe('Volver al menú')
    expect(traductor('es')('Game over!')).toBe('¡Partida terminada!')
  })

  it('traduce todas las etiquetas de los mapas de configuración', () => {
    // Si un modo o una dificultad gana una entrada y no se traduce, esto cae
    // antes de que nadie vea el juego a medias en español.
    const etiquetas = [
      ...Object.values(GAME_MODE_LABELS),
      ...Object.values(GAME_MODE_HINTS),
      ...Object.values(DIFFICULTY_LABELS),
    ]
    const sinTraducir = etiquetas.filter((e) => texto('es', e) === e)
    expect(sinTraducir).toEqual([])
  })
})
