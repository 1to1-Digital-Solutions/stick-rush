import { describe, expect, it } from 'vitest'
import { MAX_STICKS } from './gameConfig'
import {
  GIRO_DE_ESPALDAS,
  HAZANAS,
  HAZANAS_KEY,
  SIN_HAZANAS,
  aroAlMinimo,
  conHazanas,
  contarAtrape,
  contarTanda,
  deEspaldas,
  estrenarHazanas,
  leerHazanas,
} from './hazanas'
import { HOOP_ADJUST_RANGE, HOOP_ADJUST_STEP } from './hoopHeight'

/** Un almacenamiento en memoria: el motor de Godot no tiene `localStorage` ni `vi`. */
function almacen(inicial: Record<string, string> = {}): Storage & { datos: Map<string, string> } {
  const datos = new Map(Object.entries(inicial))
  return {
    datos,
    get length() {
      return datos.size
    },
    clear: () => datos.clear(),
    getItem: (clave) => datos.get(clave) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (clave) => void datos.delete(clave),
    setItem: (clave, valor) => void datos.set(clave, valor),
  }
}

/** La cabeza en el centro mirando hacia `−z` (hacia la máquina), y el palo en el ángulo pedido. */
function paloA(grados: number, distancia = 0.65) {
  const a = (grados * Math.PI) / 180
  return {
    cabeza: { x: 0, z: 0 },
    mirada: { x: 0, z: -1 },
    palo: { x: Math.sin(a) * distancia, z: -Math.cos(a) * distancia },
  }
}

describe('deEspaldas', () => {
  it('de frente, de lado o de reojo no es de espaldas', () => {
    for (const grados of [0, 45, -60, 90, -90, 115]) expect(deEspaldas(paloA(grados))).toBe(false)
  })

  it('con el palo detrás del hombro sí, por los dos lados', () => {
    for (const grados of [125, -125, 180]) expect(deEspaldas(paloA(grados))).toBe(true)
  })

  it('el umbral es el giro de espaldas: un grado antes no, un grado después sí', () => {
    const umbral = (GIRO_DE_ESPALDAS * 180) / Math.PI
    expect(deEspaldas(paloA(umbral - 1))).toBe(false)
    expect(deEspaldas(paloA(umbral + 1))).toBe(true)
  })

  it('cuenta en el suelo: la cabeza girada con la máquina detrás, estando en cualquier sitio', () => {
    // De cara a +x, en (2, 3), con el palo a su espalda en −x.
    expect(deEspaldas({ cabeza: { x: 2, z: 3 }, mirada: { x: 5, z: 0 }, palo: { x: 1.4, z: 3.1 } })).toBe(true)
    expect(deEspaldas({ cabeza: { x: 2, z: 3 }, mirada: { x: 5, z: 0 }, palo: { x: 2.6, z: 3.1 } })).toBe(false)
  })

  it('con el palo justo encima de la cabeza, o mirando al cielo, no hay espalda que valga', () => {
    expect(deEspaldas({ cabeza: { x: 0, z: 0 }, mirada: { x: 0, z: -1 }, palo: { x: 0.01, z: 0.02 } })).toBe(false)
    expect(deEspaldas({ cabeza: { x: 0, z: 0 }, mirada: { x: 0, z: 0 }, palo: { x: 0, z: 0.6 } })).toBe(false)
  })
})

describe('contarAtrape', () => {
  it('el atrape de espaldas da SR_BEHIND_BACK', () => {
    expect(contarAtrape(SIN_HAZANAS, { espaldas: true }).logradas).toEqual([HAZANAS.deEspaldas])
  })

  it('uno de frente no da nada, y no toca la cuenta', () => {
    expect(contarAtrape(SIN_HAZANAS, { espaldas: false })).toBe(SIN_HAZANAS)
  })

  it('dos de espaldas en la misma partida son una sola hazaña', () => {
    const una = contarAtrape(SIN_HAZANAS, { espaldas: true })
    expect(contarAtrape(una, { espaldas: true })).toBe(una)
  })
})

describe('contarTanda', () => {
  it('los trece de una tanda sin que se escape ninguno dan SR_CLEAN_SWEEP', () => {
    const cuenta = contarTanda(SIN_HAZANAS, { palos: MAX_STICKS, atrapados: MAX_STICKS, ajusteDelAro: 0 })
    expect(cuenta.logradas).toEqual([HAZANAS.tandaLimpia])
  })

  it('doce de trece no: uno escapado basta para perderla', () => {
    expect(contarTanda(SIN_HAZANAS, { palos: MAX_STICKS, atrapados: MAX_STICKS - 1, ajusteDelAro: 0 })).toBe(SIN_HAZANAS)
  })

  it('una tanda limpia de menos palos no es la máquina llena', () => {
    expect(contarTanda(SIN_HAZANAS, { palos: MAX_STICKS - 1, atrapados: MAX_STICKS - 1, ajusteDelAro: 0 })).toBe(SIN_HAZANAS)
  })

  it('con el aro al mínimo, una tanda entera sin escaparse ninguno da SR_LOW_HOOP, sea de los que sea', () => {
    const cuenta = contarTanda(SIN_HAZANAS, { palos: 5, atrapados: 5, ajusteDelAro: -HOOP_ADJUST_RANGE })
    expect(cuenta.logradas).toEqual([HAZANAS.aroAlMinimo])
  })

  it('con el aro un paso por encima del mínimo no, ni con el mínimo y uno escapado', () => {
    const unPasoArriba = -HOOP_ADJUST_RANGE + HOOP_ADJUST_STEP
    expect(contarTanda(SIN_HAZANAS, { palos: 5, atrapados: 5, ajusteDelAro: unPasoArriba })).toBe(SIN_HAZANAS)
    expect(contarTanda(SIN_HAZANAS, { palos: 5, atrapados: 4, ajusteDelAro: -HOOP_ADJUST_RANGE })).toBe(SIN_HAZANAS)
  })

  it('la máquina llena con el aro al mínimo da las dos, una sola vez cada una', () => {
    const tanda = { palos: MAX_STICKS, atrapados: MAX_STICKS, ajusteDelAro: -HOOP_ADJUST_RANGE }
    const una = contarTanda(SIN_HAZANAS, tanda)
    expect(una.logradas).toEqual([HAZANAS.tandaLimpia, HAZANAS.aroAlMinimo])
    expect(contarTanda(una, tanda)).toBe(una)
  })

  it('una tanda sin palos no cuenta', () => {
    expect(contarTanda(SIN_HAZANAS, { palos: 0, atrapados: 0, ajusteDelAro: -HOOP_ADJUST_RANGE })).toBe(SIN_HAZANAS)
  })

  it('el mínimo admite el redondeo de sumar pasos de 5 cm', () => {
    const sumado = [1, 2, 3, 4].reduce((ajuste) => ajuste - HOOP_ADJUST_STEP, 0)
    expect(aroAlMinimo(sumado)).toBe(true)
    expect(aroAlMinimo(0)).toBe(false)
  })
})

describe('lo guardado', () => {
  it('se estrena una vez: se guarda y la segunda partida ya no la cuenta', () => {
    const storage = almacen()
    expect(estrenarHazanas([HAZANAS.deEspaldas], storage)).toEqual([HAZANAS.deEspaldas])
    expect(JSON.parse(storage.datos.get(HAZANAS_KEY)!)).toEqual([HAZANAS.deEspaldas])
    expect(estrenarHazanas([HAZANAS.deEspaldas], storage)).toEqual([])
    expect(leerHazanas(storage)).toEqual([HAZANAS.deEspaldas])
  })

  it('suma a lo que ya había sin repetir, y sin nada nuevo no escribe', () => {
    const storage = almacen({ [HAZANAS_KEY]: JSON.stringify([HAZANAS.tandaLimpia]) })
    expect(estrenarHazanas([HAZANAS.tandaLimpia, HAZANAS.aroAlMinimo], storage)).toEqual([HAZANAS.aroAlMinimo])
    expect(leerHazanas(storage)).toEqual([HAZANAS.tandaLimpia, HAZANAS.aroAlMinimo])
    const antes = storage.datos.get(HAZANAS_KEY)
    expect(estrenarHazanas([HAZANAS.aroAlMinimo], storage)).toEqual([])
    expect(storage.datos.get(HAZANAS_KEY)).toBe(antes)
  })

  it('lo que no es una hazaña de este juego no se estrena ni se lee', () => {
    const storage = almacen({ [HAZANAS_KEY]: JSON.stringify(['GH_SHUTOUT', HAZANAS.deEspaldas]) })
    expect(leerHazanas(storage)).toEqual([HAZANAS.deEspaldas])
    expect(estrenarHazanas(['GH_SHUTOUT'], storage)).toEqual([])
  })

  it('lo ilegible o lo que no es una lista cuenta como nada', () => {
    expect(leerHazanas(almacen({ [HAZANAS_KEY]: '{roto' }))).toEqual([])
    expect(leerHazanas(almacen({ [HAZANAS_KEY]: '"SR_LOW_HOOP"' }))).toEqual([])
    expect(leerHazanas(almacen())).toEqual([])
  })

  it('sin almacenamiento todas parecen nuevas, y no se rompe nada', () => {
    expect(leerHazanas(null)).toEqual([])
    expect(estrenarHazanas([HAZANAS.deEspaldas], null)).toEqual([HAZANAS.deEspaldas])
  })

  it('con la escritura prohibida se dan igual y se vuelven a dar la próxima vez', () => {
    const storage = almacen()
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(estrenarHazanas([HAZANAS.aroAlMinimo], storage)).toEqual([HAZANAS.aroAlMinimo])
    expect(estrenarHazanas([HAZANAS.aroAlMinimo], storage)).toEqual([HAZANAS.aroAlMinimo])
  })
})

describe('conHazanas', () => {
  const resultado = { modo: 'practice', puntos: 120, reto: false }

  it('con alguna estrenada, el resultado la lleva', () => {
    expect(conHazanas(resultado, [HAZANAS.tandaLimpia])).toEqual({ ...resultado, hazanas: [HAZANAS.tandaLimpia] })
  })

  it('sin ninguna, el resultado es el de siempre, sin el campo', () => {
    expect(conHazanas(resultado, [])).toBe(resultado)
    expect('hazanas' in conHazanas(resultado, [])).toBe(false)
  })
})
