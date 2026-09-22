import { describe, expect, it } from 'vitest'
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER } from './gameConfig'
import { CHALLENGE_LIVES } from './gameMode'
import { SHARE_TITLE, type ShareResultInput, buildShareText } from './shareResult'

/**
 * El texto de compartir es lo único del juego que lee alguien que no ha jugado:
 * si dice mal la dificultad, se olvida las vidas o se deja el enlace, no hay
 * pantalla donde se note. Por eso se arma en una función pura y se comprueba
 * aquí, entera, en vez de mirarla en el navegador.
 */

const GAME_URL = 'https://stick-rush.example/'

/**
 * Una partida de práctica corriente, sobre la que varían los demás casos. La
 * puntuación pasa de las cuatro cifras a propósito: es lo que prueba que los miles se
 * agrupan.
 */
const PRACTICE: ShareResultInput = {
  points: 12400,
  score: 4,
  stickCount: 5,
  difficulty: 'easy',
  gameMode: 'practice',
  lives: null,
  bestPoints: 0,
  isRecord: false,
  url: GAME_URL,
}

/** El mismo resultado, jugado como desafío y acabado con una vida. */
const CHALLENGE: ShareResultInput = {
  ...PRACTICE,
  gameMode: 'challenge',
  lives: 1,
}

describe('lo que cuenta el texto', () => {
  it('dice el juego, el modo y la dificultad en la primera línea', () => {
    const [first] = buildShareText(PRACTICE).split('\n')
    expect(first).toBe(`${SHARE_TITLE} — Practice on Easy`)
  })

  it('dice la puntuación y los palos atrapados', () => {
    // Los miles se agrupan a la inglesa, como el resto de este texto: va entero en
    // inglés —el modo, la dificultad y las palabras—, así que una cifra a la española
    // aquí dentro sería lo único fuera de sitio. El formato lo pone `formatoDeCifra`
    // (ver `textos.ts`), no el navegador: este texto se arma igual dentro del visor que
    // fuera de él.
    expect(buildShareText(PRACTICE)).toContain('12,400 points · 4 of 5 sticks')
  })

  it('acaba con el enlace al juego', () => {
    const lines = buildShareText(PRACTICE).split('\n')
    expect(lines.at(-1)).toBe(GAME_URL)
    // Una sola vez: repetido, los mensajes lo enseñan dos veces.
    expect(buildShareText(PRACTICE).split(GAME_URL)).toHaveLength(2)
  })

  it('nombra cada dificultad como la nombra el juego', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const [first] = buildShareText({ ...PRACTICE, difficulty }).split('\n')
      expect(first).toBe(
        `${SHARE_TITLE} — Practice on ${DIFFICULTY_LABELS[difficulty]}`,
      )
    }
  })

  it('es corto: cuatro líneas como mucho y ninguna vacía', () => {
    // Acaba en un mensaje, así que se lee de un vistazo o no se lee. El caso
    // más largo posible: desafío, con récord que contar y enlace.
    const lines = buildShareText({
      ...CHALLENGE,
      difficulty: 'impossible',
      points: 999999,
      bestPoints: 999999,
      isRecord: true,
    }).split('\n')
    expect(lines.length).toBeLessThanOrEqual(4)
    for (const line of lines) expect(line.trim()).not.toBe('')
  })
})

describe('las vidas, solo donde significan algo', () => {
  it('el desafío cuenta con cuántas vidas se acabó', () => {
    expect(buildShareText(CHALLENGE)).toContain(
      `1 of ${CHALLENGE_LIVES} lives`,
    )
  })

  it('un desafío perdido dice que se acabó sin vidas', () => {
    expect(buildShareText({ ...CHALLENGE, lives: 0 })).toContain(
      `0 of ${CHALLENGE_LIVES} lives`,
    )
  })

  it('la práctica no habla de vidas', () => {
    // No hay nada que perder: decir "sin vidas" sonaría a haber fracasado.
    expect(buildShareText(PRACTICE)).not.toMatch(/vida/i)
  })

  it('sin el dato de las vidas se calla en vez de inventárselo', () => {
    expect(buildShareText({ ...CHALLENGE, lives: null })).not.toMatch(/vida/i)
  })
})

describe('la marca', () => {
  it('sin récord previo no menciona ninguno', () => {
    // La primera partida del navegador: no hay marca que enseñar, y un
    // "récord: 0" contaría como logro no haber jugado nunca.
    expect(buildShareText(PRACTICE)).not.toMatch(/record/i)
  })

  it('anuncia el récord recién batido', () => {
    const text = buildShareText({
      ...PRACTICE,
      bestPoints: PRACTICE.points,
      isRecord: true,
    })
    expect(text).toContain('New record!')
    expect(text).not.toContain('My record')
  })

  it('con récord sin batir enseña la marca que había', () => {
    const text = buildShareText({ ...PRACTICE, bestPoints: 99999 })
    expect(text).toContain('My record: 99,999')
    expect(text).not.toContain('New record!')
  })
})

describe('cifras imposibles', () => {
  it('una puntuación corrupta se cuenta como cero, no como NaN', () => {
    // El récord sale del almacenamiento, que cualquiera puede editar: un NaN
    // en el texto que se comparte sería el fallo a la vista de todos.
    expect(buildShareText({ ...PRACTICE, points: Number.NaN })).toContain(
      '0 points',
    )
    expect(buildShareText({ ...PRACTICE, points: -50 })).toContain('0 points')
  })
})
