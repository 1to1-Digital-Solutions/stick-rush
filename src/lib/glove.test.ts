import { describe, expect, it } from 'vitest'
import {
  CERRADA,
  DOBLEZ_MAXIMO,
  REPOSO,
  acercarPostura,
  angulosDelDedo,
  cuantoAprieta,
  posturaDelGuante,
} from './glove'

describe('lo que se lee del mando', () => {
  it('el valor analógico si lo hay, acotado', () => {
    expect(cuantoAprieta({ state: 'touched', button: 0.4 })).toBe(0.4)
    expect(cuantoAprieta({ state: 'pressed', button: 1.3 })).toBe(1)
    expect(cuantoAprieta({ state: 'default', button: -0.2 })).toBe(0)
  })

  it('sin valor analógico, apretado o no', () => {
    expect(cuantoAprieta({ state: 'pressed' })).toBe(1)
    expect(cuantoAprieta({ state: 'touched' })).toBe(0)
    expect(cuantoAprieta({ state: 'pressed', button: Number.NaN })).toBe(1)
  })

  it('un botón que el mando no tiene no se aprieta', () => {
    expect(cuantoAprieta(undefined)).toBe(0)
  })
})

describe('la postura del guante', () => {
  it('suelto, rodea el mango sin apretar: ni abierto del todo ni puño', () => {
    const suelta = posturaDelGuante({ agarre: 0, gatillo: 0 })
    expect(suelta.dedos).toBe(REPOSO)
    expect(suelta.indice).toBe(REPOSO)
    expect(suelta.dedos).toBeGreaterThan(0)
    expect(suelta.dedos).toBeLessThan(CERRADA)
  })

  it('el gatillo lateral cierra el puño, índice incluido', () => {
    const puno = posturaDelGuante({ agarre: 1, gatillo: 0 })
    expect(puno.dedos).toBe(1)
    expect(puno.dedos).toBeGreaterThanOrEqual(CERRADA)
    expect(puno.indice).toBeGreaterThan(REPOSO)
    expect(puno.pulgar).toBeGreaterThan(REPOSO)
    expect(puno.pulgar).toBeLessThan(1)
  })

  it('el gatillo de delante solo mueve el índice', () => {
    const indice = posturaDelGuante({ agarre: 0, gatillo: 1 })
    expect(indice.indice).toBe(1)
    expect(indice.dedos).toBe(REPOSO)
  })

  it('una lectura rota no dobla la mano del revés', () => {
    const rota = posturaDelGuante({ agarre: Number.NaN, gatillo: -3 })
    expect(rota).toEqual(posturaDelGuante({ agarre: 0, gatillo: 0 }))
  })
})

describe('la mano se cierra, no salta', () => {
  const abierta = posturaDelGuante({ agarre: 0, gatillo: 0 })
  const puno = posturaDelGuante({ agarre: 1, gatillo: 1 })

  it('un fotograma recorre solo parte del camino', () => {
    const paso = acercarPostura(abierta, puno, 1 / 90)
    expect(paso.dedos).toBeGreaterThan(abierta.dedos)
    expect(paso.dedos).toBeLessThan(puno.dedos)
    expect(paso.indice).toBeLessThan(puno.indice)
    expect(paso.pulgar).toBeLessThan(puno.pulgar)
  })

  it('y en un par de décimas está cerrada: se ve cerrarse al atrapar', () => {
    let mano = abierta
    for (let i = 0; i < 18; i++) mano = acercarPostura(mano, puno, 1 / 90)
    expect(mano.dedos).toBeGreaterThan(CERRADA)
  })

  it('un delta imposible no mueve nada', () => {
    expect(acercarPostura(abierta, puno, Number.NaN)).toEqual(abierta)
    expect(acercarPostura(abierta, puno, -1)).toEqual(abierta)
  })
})

describe('los dedos', () => {
  it('se doblan en proporción al cierre, hasta rodear el mango', () => {
    expect(angulosDelDedo(0)).toEqual([0, 0, 0])
    expect(angulosDelDedo(1)).toEqual([...DOBLEZ_MAXIMO])
    expect(angulosDelDedo(2)).toEqual([...DOBLEZ_MAXIMO])
    const total = DOBLEZ_MAXIMO.reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(Math.PI)
    expect(total).toBeLessThan(Math.PI * 1.5)
  })
})
