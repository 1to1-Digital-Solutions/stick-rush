import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import { XR, XROrigin, createXRStore } from '@react-three/xr'
import { Vector3, type Object3D } from 'three'

import { StickRushScene } from '../../src/game/StickRushScene'
import type { HostAnchor } from '../../src/lib/hostAnchor'
import type { Objetivo } from '../../src/lib/objetivo'
import type { Resultado } from '../../src/lib/semilla'

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

/**
 * Montar la escena solo cuando se pida, **como en el salón**: allí se elige cabina con el visor
 * ya puesto, así que la escena nace dentro de una sesión abierta.
 */
const aLaCarta = mount.dataset.cabina === 'a-la-carta'

/** El reto del salón, si la página lo trae: la semilla, como la pasaría el arco de cabinas. */
const reto = mount.dataset.reto == null ? undefined : { semilla: Number(mount.dataset.reto) }

/** Dónde plantar el mundo, si la página lo trae: el anclaje que presta el salón. */
const anchor = mount.dataset.anchor == null ? undefined : (JSON.parse(mount.dataset.anchor) as HostAnchor)

/** Los listones de medalla del juego, si la página los trae: lo que el salón pasa en `objetivo`. */
const objetivo = mount.dataset.objetivo == null ? undefined : (JSON.parse(mount.dataset.objetivo) as Objetivo)

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
      /** Monta la escena, como al elegir cabina. Solo hace algo con `data-cabina`. */
      entrarEnLaCabina: () => void
      /** Desmonta la escena, como al volver al salón. */
      salirDeLaCabina: () => void
      /** Lo que la escena ha contado al acabar cada partida (`onTerminar`), en orden. */
      terminadas: Resultado[]
      /** Deja de pintar ese objeto, o lo vuelve a pintar: para medir lo que cuesta. `false` si no está. */
      esconder: (nombre: string, oculto: boolean) => boolean
      /** Apunta la cámara del anfitrión a ese punto de la escena (fuera de la sesión inmersiva). */
      mirar: (x: number, y: number, z: number) => void
    }
  }
}

let escena: Object3D | null = null
let camara: Object3D | null = null
let entrar = () => {}
let salir = () => {}

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
  entrarEnLaCabina: () => entrar(),
  salirDeLaCabina: () => salir(),
  terminadas: [],
  esconder(nombre, oculto) {
    const objeto = escena?.getObjectByName(nombre)
    if (objeto == null) return false
    objeto.visible = !oculto
    return true
  },
  mirar(x, y, z) {
    camara?.lookAt(x, y, z)
  },
}

/** Deja la escena a mano de `buscar`. */
function Sonda() {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    escena = scene
    camara = camera
    return () => {
      escena = null
      camara = null
    }
  }, [scene, camera])
  return null
}

/** La cabina: la escena, montada cuando toca. */
function Cabina() {
  const [dentro, setDentro] = useState(!aLaCarta)
  useEffect(() => {
    entrar = () => setDentro(true)
    salir = () => setDentro(false)
    return () => {
      entrar = () => {}
      salir = () => {}
    }
  }, [])

  if (!dentro) return null
  // Volver es cosa del anfitrión, y aquí no hay a dónde.
  return (
    <StickRushScene
      assetsBase={assetsBase}
      anchor={anchor}
      onExit={() => {}}
      reto={reto}
      objetivo={objetivo}
      onTerminar={(resultado) => window.__stickRushHost.terminadas.push(resultado)}
    />
  )
}

function Host() {
  return (
    <Canvas camera={{ position: [0, 1.6, 0.6], fov: 55, near: 0.05, far: 60 }}>
      <XR store={store}>
        <XROrigin position={[0, 0, 0]} />
        <Sonda />
        <Cabina />
      </XR>
    </Canvas>
  )
}

createRoot(mount).render(<Host />)
