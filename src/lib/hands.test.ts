import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  ARTICULACIONES,
  MANOS,
  colocarEnElOrigen,
  costadoDelGatillo,
  llevaLaAyuda,
  rutaDeLaMano,
} from './hands'

describe('el guante de cada mano', () => {
  it('el gatillo lateral cae hacia dentro', () => {
    expect(costadoDelGatillo('left')).toBe(1)
    expect(costadoDelGatillo('right')).toBe(-1)
  })

  it('la ayuda del agarre, desde la cuenta atrás hasta el primer palo', () => {
    expect(llevaLaAyuda('menu', 0)).toBe(false)
    expect(llevaLaAyuda('countdown', 0)).toBe(true)
    expect(llevaLaAyuda('playing', 0)).toBe(true)
    expect(llevaLaAyuda('playing', 1)).toBe(false)
    expect(llevaLaAyuda('finished', 0)).toBe(false)
  })
})

describe('la mano desnuda', () => {
  it('el modelo de las dos manos está en public, fuera de los perfiles de mando', () => {
    // Relativo a la base del juego (en el salón, su prefijo) y fuera de `webxr-profiles/`, que el
    // salón borra de cada juego al instalarlo porque sirve la suya.
    for (const mano of MANOS) {
      const ruta = rutaDeLaMano(mano)
      expect(ruta).not.toMatch(/^\//)
      expect(ruta).not.toMatch(/webxr-profiles/)
      expect(existsSync(join(process.cwd(), 'public', ruta)), ruta).toBe(true)
    }
  })

  it('las veinticinco articulaciones de WebXR, sin repetir', () => {
    expect(ARTICULACIONES).toHaveLength(25)
    expect(new Set(ARTICULACIONES).size).toBe(25)
    expect(ARTICULACIONES[0]).toBe('wrist')
    expect(ARTICULACIONES.at(-1)).toBe('pinky-finger-tip')
  })
})

describe('colocar lo que da WebXR bajo un padre movido', () => {
  const pose = new Matrix4().compose(
    new Vector3(0.3, 1.1, -0.4),
    new Quaternion().setFromEuler(new Euler(0.2, -0.7, 0.1)),
    new Vector3(1, 1, 1),
  )

  it('queda en la pose del origen aunque el padre esté bajado y girado', () => {
    // Como en la escena: el mundo bajado a la altura de quien juega y girado por el anclaje.
    const padre = new Object3D()
    padre.position.set(0, -0.35, 0.08)
    padre.rotation.set(0, 0.9, 0)
    padre.updateMatrixWorld(true)

    const hijo = new Object3D()
    hijo.matrixAutoUpdate = false
    padre.add(hijo)
    colocarEnElOrigen(hijo.matrix, padre.matrixWorld, pose, new Matrix4())
    hijo.updateMatrixWorld(true)

    const esperado = new Vector3().setFromMatrixPosition(pose)
    const obtenido = new Vector3().setFromMatrixPosition(hijo.matrixWorld)
    expect(obtenido.distanceTo(esperado)).toBeLessThan(1e-9)
    const giro = new Quaternion().setFromRotationMatrix(hijo.matrixWorld)
    expect(giro.angleTo(new Quaternion().setFromRotationMatrix(pose))).toBeLessThan(1e-6)
  })

  it('sin padre, la pose tal cual', () => {
    const destino = new Matrix4()
    colocarEnElOrigen(destino, null, pose, new Matrix4())
    expect(destino.equals(pose)).toBe(true)
  })
})
