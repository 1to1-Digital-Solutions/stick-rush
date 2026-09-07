import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getTutorialSeen,
  parseTutorialSeen,
  readTutorialSeen,
  saveTutorialSeen,
  TUTORIAL_MAX_SECONDS,
  TUTORIAL_MIN_SECONDS,
  TUTORIAL_SECONDS,
  TUTORIAL_SEEN_KEY,
  TUTORIAL_STEPS,
  tutorialFrameAt,
  writeTutorialSeen,
} from './tutorial'

/** Almacenamiento de mentira, con lo justo que usa el tutorial. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(TUTORIAL_SEEN_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as unknown as Storage
}

/** El que tienen los navegadores en modo privado: lanza en vez de fallar. */
function blockedStorage(): Storage {
  return {
    getItem: () => {
      throw new DOMException('bloqueado', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('cuota agotada', 'QuotaExceededError')
    },
  } as unknown as Storage
}

describe('el tutorial es corto', () => {
  it('dura entre cinco y diez segundos', () => {
    // Es el criterio de la tarea, no una preferencia: por debajo no da tiempo a
    // entender los tres tramos y por encima estorba a quien quiere jugar. Al
    // estar aquí, alargar un paso obliga a acortar otro.
    expect(TUTORIAL_SECONDS).toBeGreaterThanOrEqual(TUTORIAL_MIN_SECONDS)
    expect(TUTORIAL_SECONDS).toBeLessThanOrEqual(TUTORIAL_MAX_SECONDS)
  })

  it('enseña el agarre, cuántos palos caen y en qué nivel', () => {
    expect(TUTORIAL_STEPS.map((step) => step.key)).toEqual([
      'grab',
      'sticks',
      'level',
    ])
  })

  it('ningún tramo se queda sin tiempo en pantalla', () => {
    for (const step of TUTORIAL_STEPS) {
      // Menos de un segundo pasa como un parpadeo: se vería el cambio, no lo
      // que enseña.
      expect(step.seconds).toBeGreaterThanOrEqual(1)
    }
  })

  it('el gesto es lo que más tiempo ocupa', () => {
    // Es el único tramo que enseña algo que no se puede deducir: los otros dos
    // recuerdan lo que el jugador acaba de elegir en el menú.
    const [grab, ...rest] = TUTORIAL_STEPS
    expect(grab.key).toBe('grab')
    for (const step of rest) {
      expect(grab.seconds).toBeGreaterThan(step.seconds)
    }
  })
})

describe('qué se enseña en cada momento', () => {
  it('arranca por el gesto de agarrar, desde el primer instante', () => {
    const frame = tutorialFrameAt(0)
    expect(frame.step).toBe('grab')
    expect(frame.stepProgress).toBe(0)
    expect(frame.progress).toBe(0)
    expect(frame.done).toBe(false)
  })

  it('recorre los tramos en orden, cada uno en su ventana', () => {
    let start = 0
    for (const step of TUTORIAL_STEPS) {
      // Justo al entrar, a la mitad y a un pelo de acabar: los tres momentos
      // tienen que caer en el mismo tramo.
      expect(tutorialFrameAt(start).step).toBe(step.key)
      expect(tutorialFrameAt(start + step.seconds / 2).step).toBe(step.key)
      expect(tutorialFrameAt(start + step.seconds - 0.01).step).toBe(step.key)
      start += step.seconds
    }
  })

  it('el progreso del tramo va de cero a uno', () => {
    const [first] = TUTORIAL_STEPS
    expect(tutorialFrameAt(first.seconds / 2).stepProgress).toBeCloseTo(0.5)
    // El último instante del tramo, todavía dentro de él.
    expect(tutorialFrameAt(first.seconds - 0.001).stepProgress).toBeCloseTo(1, 2)
  })

  it('el progreso total crece hasta llenarse', () => {
    expect(tutorialFrameAt(TUTORIAL_SECONDS / 2).progress).toBeCloseTo(0.5)
    expect(tutorialFrameAt(TUTORIAL_SECONDS).progress).toBe(1)
  })

  it('al agotarse el tiempo no queda nada que enseñar', () => {
    const frame = tutorialFrameAt(TUTORIAL_SECONDS)
    expect(frame.step).toBeNull()
    expect(frame.done).toBe(true)
    // Y sigue terminado por mucho que el reloj corra: si un fotograma llega
    // tarde, el tutorial no vuelve a empezar.
    expect(tutorialFrameAt(TUTORIAL_SECONDS + 30).done).toBe(true)
  })

  it('un reloj imposible no revive el tutorial', () => {
    // El reloj lo lleva la escena fotograma a fotograma; si algo lo corrompe,
    // el tutorial se da por visto en vez de quedarse dando vueltas delante del
    // jugador.
    expect(tutorialFrameAt(Number.NaN).done).toBe(true)
    expect(tutorialFrameAt(Number.POSITIVE_INFINITY).done).toBe(true)
    // Un tiempo negativo es el principio, no el final.
    expect(tutorialFrameAt(-1).step).toBe('grab')
  })
})

describe('solo la primera vez', () => {
  it('un navegador sin nada guardado no lo ha visto', () => {
    expect(readTutorialSeen(fakeStorage())).toBe(false)
  })

  it('lo guardado por el juego cuenta como visto', () => {
    const storage = fakeStorage()
    writeTutorialSeen(storage)
    expect(readTutorialSeen(storage)).toBe(true)
  })

  it('cualquier otra cosa cuenta como no visto', () => {
    // Es entrada externa: ante la duda se enseña, que cuesta unos segundos
    // saltables, en vez de dar por sabido algo que quizá nadie ha visto.
    expect(parseTutorialSeen(null)).toBe(false)
    expect(parseTutorialSeen('')).toBe(false)
    expect(parseTutorialSeen('0')).toBe(false)
    expect(parseTutorialSeen('true')).toBe(false)
    expect(parseTutorialSeen('sí')).toBe(false)
  })

  it('sin almacenamiento se enseña, y guardar no rompe nada', () => {
    expect(readTutorialSeen(null)).toBe(false)
    expect(() => writeTutorialSeen(null)).not.toThrow()
  })

  it('un almacenamiento bloqueado no impide jugar', () => {
    // En modo privado `localStorage` existe pero lanza al tocarlo: el tutorial
    // volverá a salir, y es saltable.
    expect(readTutorialSeen(blockedStorage())).toBe(false)
    expect(() => writeTutorialSeen(blockedStorage())).not.toThrow()
  })
})

describe('lo que ve el juego', () => {
  // Aquí sí se usa el `localStorage` de jsdom, que es lo que el juego consulta.
  beforeEach(() => {
    localStorage.clear()
  })

  it('la primera visita no lo ha visto; después sí', () => {
    expect(getTutorialSeen()).toBe(false)

    saveTutorialSeen()
    expect(getTutorialSeen()).toBe(true)
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe('1')
  })

  it('guardarlo dos veces no escribe dos veces distinto', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    saveTutorialSeen()
    saveTutorialSeen()
    expect(setItem).toHaveBeenCalledTimes(2)
    expect(getTutorialSeen()).toBe(true)
    setItem.mockRestore()
  })
})

