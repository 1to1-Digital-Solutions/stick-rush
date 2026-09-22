import { beforeEach, describe, expect, it } from 'vitest'

import {
  COMPONENTE_DEL_BOTON,
  FRASES,
  FRASES_CON_LAS_MANOS,
  hitosAtrapando,
  markTutorialSeen,
  PALOS_DEL_PASO,
  PLAZO_DEL_PASO,
  saltarPaso,
  SIN_HITOS,
  TUTORIAL_BUTTONS,
  TUTORIAL_MAX_SECONDS,
  TUTORIAL_MIN_SECONDS,
  TUTORIAL_SECONDS,
  TUTORIAL_SEEN_KEY,
  TUTORIAL_SEEN_VALUE,
  TUTORIAL_STEPS,
  tutorialSeen,
  tutorialStep,
} from './tutorial'

/**
 * El guion del tutorial, probado sin navegador ni visor.
 *
 * Lo que se comprueba aquí es lo que no se ve mirando el panel: que los pasos se superan
 * **haciendo** —atrapando palos de verdad, con la cuenta que lleva la partida—, que ninguno
 * puede encerrar a nadie, y que un almacenamiento capado vuelve a enseñar la lección en vez
 * de romperse.
 */

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

describe('la lección cabe en una partida', () => {
  it('dura entre el mínimo y el máximo aunque no se atrape nada', () => {
    // `TUTORIAL_SECONDS` es el peor caso: de plazo en plazo, sin un solo palo atrapado. Al
    // estar acotado aquí, alargar un paso obliga a acortar otro.
    expect(TUTORIAL_SECONDS).toBeGreaterThanOrEqual(TUTORIAL_MIN_SECONDS)
    expect(TUTORIAL_SECONDS).toBeLessThanOrEqual(TUTORIAL_MAX_SECONDS)
  })

  it('enseña a atrapar y a buscar alrededor, en ese orden', () => {
    expect([...TUTORIAL_STEPS]).toEqual(['grab', 'around'])
  })

  it('ningún paso se escapa antes de haber podido intentarlo', () => {
    for (const step of TUTORIAL_STEPS) {
      // El plazo es una red, no un reloj: por debajo de unos segundos pasaría como un
      // parpadeo y nadie llegaría a hacer lo que pide.
      expect(PLAZO_DEL_PASO[step], step).toBeGreaterThanOrEqual(5)
    }
    // El primero espera más: antes de poder atrapar hay que esperar a que caiga un palo.
    expect(PLAZO_DEL_PASO.grab).toBeGreaterThan(PLAZO_DEL_PASO.around)
  })

  it('y cada paso pide un palo más que el anterior', () => {
    // Si el segundo se conformara con los mismos palos que el primero, se cumpliría con el
    // palo que ya cumplió el primero y nadie llegaría a girarse.
    const palos = TUTORIAL_STEPS.map((step) => PALOS_DEL_PASO[step])
    for (let i = 1; i < palos.length; i += 1) expect(palos[i]).toBeGreaterThan(palos[i - 1])
  })
})

describe('lo que se enseña con cada paso', () => {
  it('el primero pide el agarre y el segundo no pide ningún botón', () => {
    // El segundo es el mismo gesto mirando a otro lado: repetir la marca sobre el mando la
    // convertiría en decorado y taparía el palo que hay que ir a buscar.
    expect(TUTORIAL_BUTTONS.grab).toBe('agarre')
    expect(TUTORIAL_BUTTONS.around).toBeNull()
  })

  it('los botones que se nombran son los del estándar de WebXR', () => {
    // Es lo que permite encontrar la pieza dentro del modelo del mando que se tenga puesto,
    // sea cual sea: un nombre de Quest no valdría para los demás.
    for (const boton of Object.values(TUTORIAL_BUTTONS)) {
      if (boton == null) continue
      expect(COMPONENTE_DEL_BOTON[boton], boton).toMatch(/^xr-standard-/)
    }
  })

  it('hay frase para cada paso, con mando y con las manos desnudas', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(FRASES[step], step).toBeTruthy()
      expect(FRASES_CON_LAS_MANOS[step], step).toBeTruthy()
    }
  })

  it('y a quien no tiene mando no se le nombra un botón', () => {
    // Nombrarle el agarre a quien juega con las manos sería explicarle el juego al revés: ahí
    // el puntero lo mueve el pellizco.
    expect(FRASES_CON_LAS_MANOS.grab).not.toBe(FRASES.grab)
    expect(FRASES.grab.toLowerCase()).toContain('grip button')
    expect(FRASES_CON_LAS_MANOS.grab.toLowerCase()).not.toContain('button')
    // El que va de girarse se hace igual con mando o sin él.
    expect(FRASES_CON_LAS_MANOS.around).toBe(FRASES.around)
  })
})

describe('los hitos salen de lo que lleva atrapado la partida', () => {
  it('sin atrapar nada no hay ninguno hecho', () => {
    expect(hitosAtrapando(0)).toEqual(SIN_HITOS)
  })

  it('el primer palo da el primer paso, y el segundo da el segundo', () => {
    expect(hitosAtrapando(1)).toEqual({ grab: true, around: false })
    expect(hitosAtrapando(2)).toEqual({ grab: true, around: true })
  })

  it('no se deshacen: más palos no quitan lo hecho', () => {
    expect(hitosAtrapando(37)).toEqual({ grab: true, around: true })
  })

  it('una cuenta rota se cuenta como cero en vez de encallar el panel', () => {
    // Un `NaN` colado aquí dejaría los dos pasos sin cumplir para siempre y el panel puesto
    // hasta agotar los dos plazos.
    expect(hitosAtrapando(Number.NaN)).toEqual(SIN_HITOS)
    expect(hitosAtrapando(Number.POSITIVE_INFINITY)).toEqual(SIN_HITOS)
    expect(hitosAtrapando(1.9)).toEqual({ grab: true, around: false })
  })
})

describe('qué paso toca enseñar', () => {
  it('el primero que no esté hecho', () => {
    expect(tutorialStep(SIN_HITOS, 0)).toBe('grab')
    expect(tutorialStep(hitosAtrapando(1), 0)).toBe('around')
  })

  it('y nada cuando ya están todos', () => {
    expect(tutorialStep(hitosAtrapando(2), 0)).toBeNull()
  })

  it('los dados por pasados no vuelven, aunque no se hayan hecho', () => {
    expect(tutorialStep(SIN_HITOS, 1)).toBe('around')
    expect(tutorialStep(SIN_HITOS, 2)).toBeNull()
  })

  it('una cuenta de saltados por debajo de cero no revive pasos', () => {
    expect(tutorialStep(SIN_HITOS, -3)).toBe('grab')
  })
})

describe('dar un paso por pasado', () => {
  it('apunta su posición, no uno más de los que iban', () => {
    // Con un hito ya cumplido por delante, sumar uno a la cuenta puede dejar el mismo paso en
    // pantalla: ni el botón de siguiente ni el plazo harían nada.
    expect(saltarPaso(0, 'around')).toBe(2)
    expect(tutorialStep(SIN_HITOS, saltarPaso(0, 'around'))).toBeNull()
  })

  it('y nunca retrocede', () => {
    expect(saltarPaso(2, 'grab')).toBe(2)
  })

  it('saltar el primero deja el segundo en pantalla', () => {
    expect(tutorialStep(SIN_HITOS, saltarPaso(0, 'grab'))).toBe('around')
  })
})

describe('recordar que ya se ha visto', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('solo el valor exacto cuenta como visto', () => {
    expect(tutorialSeen(fakeStorage(TUTORIAL_SEEN_VALUE))).toBe(true)
    expect(tutorialSeen(fakeStorage())).toBe(false)
  })

  it('quien vio la lección vieja la vuelve a ver', () => {
    // Lo guardado es la versión de la lección: la 1 era la demostración por reloj y no se
    // hizo jugando, así que quien la vio no ha hecho esta.
    expect(TUTORIAL_SEEN_VALUE).not.toBe('1')
    expect(tutorialSeen(fakeStorage('1'))).toBe(false)
  })

  it('cualquier cosa editada a mano la vuelve a enseñar', () => {
    // Es entrada externa: se elige el lado seguro, que es enseñarla de más.
    expect(tutorialSeen(fakeStorage('sí'))).toBe(false)
  })

  it('sin almacenamiento, y con el almacenamiento capado, se enseña otra vez', () => {
    expect(tutorialSeen(null)).toBe(false)
    expect(tutorialSeen(blockedStorage())).toBe(false)
  })

  it('deja constancia, y luego se lee', () => {
    const storage = fakeStorage()
    expect(markTutorialSeen(storage)).toBe(true)
    expect(storage.getItem(TUTORIAL_SEEN_KEY)).toBe(TUTORIAL_SEEN_VALUE)
    expect(tutorialSeen(storage)).toBe(true)
  })

  it('y no poder guardarlo no es un error: se verá también la próxima vez', () => {
    expect(markTutorialSeen(null)).toBe(false)
    expect(markTutorialSeen(blockedStorage())).toBe(false)
  })

  it('sin decir en cuál, usa el del navegador', () => {
    // Es el camino de verdad: el juego llama a las dos sin argumento.
    expect(tutorialSeen()).toBe(false)
    expect(markTutorialSeen()).toBe(true)
    expect(window.localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe(TUTORIAL_SEEN_VALUE)
    expect(tutorialSeen()).toBe(true)
  })

  it('la clave lleva el prefijo del juego, para no chocar con nada del mismo origen', () => {
    expect(TUTORIAL_SEEN_KEY).toMatch(/^stick-rush:/)
  })
})
