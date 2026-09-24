import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import { XR, XROrigin, createXRStore } from '@react-three/xr'
import { Vector3, type Object3D } from 'three'

import { StickRushScene } from '../../src/game/StickRushScene'

/**
 * El anfitrión de prueba: monta `<StickRushScene>` dentro de un Canvas y una sesión que no son
 * suyos, como hace el salón de xrcade.
 *
 * Es el sitio de la suite que ejercita el contrato de montaje: la web del juego monta
 * `<StickRush>`, que trae su propio Canvas, su propio store y su propio mando dibujado. Aquí no
 * hay nada de eso —el store es del anfitrión y, como el del salón, **no dibuja ni mandos ni
 * manos**—, así que lo que se vea en la mano lo ha puesto la escena.
 */
const mount = document.getElementById('juego')
if (mount == null) {
  throw new Error('El anfitrión de prueba no tiene dónde montar el juego')
}
const assetsBase = mount.dataset.assetsBase ?? '/'

const store = createXRStore({
  // Lo que el contrato pide cablear al anfitrión: los perfiles de mando bajo su propio prefijo.
  baseAssetPath: new URL(`${assetsBase}webxr-profiles/`, window.location.origin).href,
  // Como el salón (`xrcade/src/components/salon/salonStore.ts`): sin modelo de mando ni de mano.
  controller: { model: false },
  hand: { model: false },
})

/** Lo que se puede saber de un objeto de la escena desde fuera del Canvas. */
export interface ObjetoDeLaEscena {
  /** Si se pinta: él y todos sus padres visibles. */
  visible: boolean
  /** Dónde está, en el espacio de la escena. */
  x: number
  y: number
  z: number
}

declare global {
  interface Window {
    __stickRushHost: {
      enterVR: () => Promise<void>
      /** Busca por nombre; `null` si no está montado. */
      buscar: (nombre: string) => ObjetoDeLaEscena | null
    }
  }
}

let escena: Object3D | null = null

window.__stickRushHost = {
  async enterVR() {
    await store.enterVR()
  },
  buscar(nombre) {
    const objeto = escena?.getObjectByName(nombre)
    if (objeto == null) return null
    let visible = true
    for (let nodo: Object3D | null = objeto; nodo != null; nodo = nodo.parent) {
      visible &&= nodo.visible
    }
    objeto.updateWorldMatrix(true, false)
    const { x, y, z } = new Vector3().setFromMatrixPosition(objeto.matrixWorld)
    return { visible, x, y, z }
  },
}

/** Deja la escena a mano de `buscar`. */
function Sonda() {
  const scene = useThree((state) => state.scene)
  useEffect(() => {
    escena = scene
    return () => {
      escena = null
    }
  }, [scene])
  return null
}

function Host() {
  return (
    <Canvas camera={{ position: [0, 1.6, 0.6], fov: 55, near: 0.05, far: 60 }}>
      <XR store={store}>
        <XROrigin position={[0, 0, 0]} />
        <Sonda />
        {/* Volver es cosa del anfitrión, y aquí no hay a dónde. */}
        <StickRushScene assetsBase={assetsBase} onExit={() => {}} />
      </XR>
    </Canvas>
  )
}

createRoot(mount).render(<Host />)
