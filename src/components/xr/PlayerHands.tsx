'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGetXRSpaceMatrix, useXR, useXRInputSourceState } from '@react-three/xr'
import { Group, Matrix4, SkinnedMesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as clonarEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { assetUrl } from '../../lib/assets'
import { useGame } from '../../lib/gameStore'
import { cuantoAprieta } from '../../lib/glove'
import {
  ARTICULACIONES,
  MANOS,
  colocarEnElOrigen,
  costadoDelGatillo,
  llevaLaAyuda,
  rutaDeLaMano,
  type Mano,
} from '../../lib/hands'
import { NO_RAYCAST } from '../raycast'
import { Guante } from './Glove'

/**
 * Las manos de quien juega: el guante con mandos y la mano articulada sin ellos.
 *
 * **Las monta la escena, no el store.** Lo que cuelga del `XRStore` (su `controller`, su
 * `hand.model`) solo existe en la web propia: dentro del salón de xrcade el store es del salón,
 * que no dibuja manos, y ahí es donde más se juega. Montadas aquí salen igual en los dos sitios,
 * y quien juega ve dónde tiene las manos al ir a por un palo, que es para lo que están.
 *
 * Cada pieza se coloca como `MandoDeVerdad`: la pose que da WebXR, en el espacio del origen,
 * con lo que pongan los padres deshecho (`colocarEnElOrigen`), así que da igual de dónde
 * cuelguen. Se nombran (`guante-left`, `mano-desnuda-right`…) para poder buscarlas desde fuera.
 */
export function ManosDelJugador() {
  return (
    <>
      {MANOS.map((mano) => (
        <GuanteEnLaMano key={`guante-${mano}`} mano={mano} />
      ))}
      {MANOS.map((mano) => (
        <ManoDesnuda key={`mano-${mano}`} mano={mano} />
      ))}
    </>
  )
}

/** Se reaprovechan en cada fotograma: una matriz nueva por frame es basura que recoger. */
const POSE = new Matrix4()
const AUXILIAR = new Matrix4()

/** Pone el grupo en la pose del origen, deshaciendo a sus padres. */
function colocar(grupo: Object3D, pose: Matrix4): void {
  const padre = grupo.parent
  padre?.updateWorldMatrix(true, false)
  colocarEnElOrigen(grupo.matrix, padre?.matrixWorld ?? null, pose, AUXILIAR)
}

/**
 * El guante sobre el mando de esa mano, en el espacio del puño (`grip-space`), que es donde
 * `Guante` tiene medido el mango.
 */
function GuanteEnLaMano({ mano }: { mano: Mano }) {
  const mando = useXRInputSourceState('controller', mano)
  const grupo = useRef<Group>(null)
  const { gameState, score } = useGame()
  const situar = useGetXRSpaceMatrix(mando?.inputSource.gripSpace)

  // Antes que nadie (prioridad negativa, como la propia librería y `MandoDeVerdad`): el guante
  // tiene que estar puesto cuando `Guante` copie sus piezas y se pinte el fotograma.
  useFrame((_estado, _delta, frame) => {
    const nodo = grupo.current
    if (nodo == null) return
    const puesto = situar?.(POSE, frame) ?? false
    nodo.visible = puesto
    if (puesto) colocar(nodo, POSE)
  }, -100)

  if (mando == null) return null

  return (
    <group ref={grupo} name={`guante-${mano}`} matrixAutoUpdate={false} visible={false}>
      <Guante
        side={costadoDelGatillo(mano)}
        highlight={llevaLaAyuda(gameState, score)}
        leer={() => ({
          agarre: cuantoAprieta(mando.gamepad['xr-standard-squeeze']),
          gatillo: cuantoAprieta(mando.gamepad['xr-standard-trigger']),
        })}
      />
    </group>
  )
}

/** Uno para las dos manos: cada `.glb` se pide una vez por sesión y como mucho. */
const cargador = new GLTFLoader()

/**
 * La mano articulada, hueso a hueso: lo mismo que hace `XRHandModel` de la librería, pero sin
 * depender del store que la monte.
 *
 * **Cargada a mano y no con `useLoader`**, que suspende: un `.glb` que falle dejaría una
 * pantalla de error encima del juego, y aquí lo que toca es no dibujar la mano y seguir.
 */
function ManoDesnuda({ mano }: { mano: Mano }) {
  const estado = useXRInputSourceState('hand', mano)
  const origen = useXR((xr) => xr.originReferenceSpace)
  const grupo = useRef<Group>(null)
  const modelo = useModeloDeLaMano(estado == null ? null : assetUrl(rutaDeLaMano(mano)))

  const huesos = useMemo(
    () =>
      modelo == null
        ? null
        : ARTICULACIONES.map((nombre) => {
            const hueso = modelo.getObjectByName(nombre)
            if (hueso != null) hueso.matrixAutoUpdate = false
            return hueso
          }),
    [modelo],
  )
  const poses = useMemo(() => new Float32Array(ARTICULACIONES.length * 16), [])

  useFrame((_estado, _delta, frame) => {
    const nodo = grupo.current
    const hand = estado?.inputSource.hand
    if (nodo == null || huesos == null || hand == null || origen == null || frame == null) return
    // `fillPoses` dice si el visor sigue la mano en este fotograma: si no, no se enseña una
    // mano congelada donde estuvo.
    const puesta = frame.fillPoses?.(hand.values(), origen, poses) ?? false
    nodo.visible = puesta
    if (!puesta) return
    colocar(nodo, POSE.identity())
    for (let i = 0; i < huesos.length; i++) huesos[i]?.matrix.fromArray(poses, i * 16)
  }, -100)

  if (modelo == null) return null

  return (
    <group ref={grupo} name={`mano-desnuda-${mano}`} matrixAutoUpdate={false} visible={false}>
      <primitive object={modelo} />
    </group>
  )
}

/** El modelo ya clonado, o `null` mientras no lo haya (o si no se pudo cargar). */
function useModeloDeLaMano(ruta: string | null): Object3D | null {
  const [cargado, setCargado] = useState<{ ruta: string; modelo: Object3D } | null>(null)

  useEffect(() => {
    if (ruta == null) return
    let vivo = true
    cargador
      .loadAsync(ruta)
      .then((gltf) => {
        if (!vivo) return
        const modelo = clonarEsqueleto(gltf.scene)
        modelo.traverse((parte) => {
          // Invisible al rayo: el puntero nace en esta misma mano y se lo comería.
          parte.raycast = NO_RAYCAST
          // Los huesos se mueven fuera de la caja con la que se cargó: sin esto, la mano
          // desaparece en cuanto el visor cree que se ha salido del encuadre.
          if (parte instanceof SkinnedMesh) parte.frustumCulled = false
        })
        setCargado({ ruta, modelo })
      })
      // Sin modelo no hay mano que dibujar, y el juego sigue: el agarre no depende de verla.
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [ruta])

  if (cargado == null || cargado.ruta !== ruta) return null
  return cargado.modelo
}
