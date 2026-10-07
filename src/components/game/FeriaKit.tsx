'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Group,
  type InstancedMesh,
  type Material,
  type Mesh,
  type Object3D,
} from 'three'
import { assetUrl } from '../../lib/assets'
import {
  PIEZAS,
  anclaEnLaBase,
  colocaciones,
  escalaPara,
  rutaDePieza,
  type Colocacion,
  type Pieza,
} from '../../lib/feriaKit'
import { ignoreRaycast } from './FairPieces'

/**
 * Los puestos, las farolas y las banderolas del recinto, con las piezas del kit de xrcade.
 *
 * Cada pieza del kit es una malla con un material y el color en los vértices, así que se pinta
 * como **un `InstancedMesh` por tipo**: los seis puestos en una llamada de dibujo, las ocho
 * farolas en otra. Lo que cuesta en el visor son las llamadas, no los triángulos. Dónde va
 * cada una lo decide `lib/feriaKit.ts`.
 *
 * **Fuera del alcance de los rayos**, como el resto del recinto (`ignoreRaycast`): un
 * `InstancedMesh` que responde al rayo lo prueba contra cada copia en cada movimiento del
 * mando, y el decorado no se coge.
 *
 * **Sin sombra**, como el resto del recinto: la luz que lo alumbra es la del HDRI, y el foco
 * que da sombra es el de la máquina.
 */
export function FeriaKit() {
  // Las tres de una vez: pedidas una a una, cada `useGLTF` suspendería hasta que llegara la
  // anterior y se bajarían en fila. Sin Draco ni Meshopt: las piezas no usan ninguno y los dos
  // necesitan WebAssembly, que la política de seguridad del salón no deja compilar.
  const modelos = useGLTF(
    PIEZAS.map((pieza) => assetUrl(rutaDePieza(pieza))),
    false,
    false,
  )
  const porPieza = useMemo(() => {
    const todas = colocaciones()
    return PIEZAS.map((pieza) => todas.filter((c) => c.pieza === pieza))
  }, [])

  // Llegan después del precalentado de la escena (`Calentar`), que las encontró sin cargar: se
  // calientan aquí, al montarse. Sin esto, con «tu habitación» elegida el recinto está oculto
  // y su shader se compilaría al enseñarlo, que es un tirón con el visor puesto.
  // Con `compile` y no `compileAsync`: nadie espera la promesa, y su sondeo de `isReady()` revienta
  // si un material se desmonta entretanto (lo cuenta `Calentar.tsx`).
  const grupo = useRef<Group>(null)
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  useLayoutEffect(() => {
    if (grupo.current != null) gl.compile(grupo.current, camera, scene)
  }, [gl, camera, scene])

  return (
    <group ref={grupo}>
      {PIEZAS.map((pieza, indice) => (
        <Piezas
          key={pieza}
          malla={mallaDe(modelos[indice].scene, pieza)}
          colocaciones={porPieza[indice]}
        />
      ))}
    </group>
  )
}

/**
 * La única malla de una pieza del kit.
 *
 * Se busca recorriendo la escena y no por nombre: el nombre es el del nodo en el pack de
 * Kenney y el kit no promete conservarlo. Sí promete una malla por pieza; si llega otra cosa,
 * mejor un error que diga cuál que un recinto sin puestos sin saber por qué.
 */
function mallaDe(escena: Object3D, pieza: Pieza): Mesh {
  let malla: Mesh | null = null
  escena.traverse((objeto) => {
    if (malla == null && (objeto as Mesh).isMesh) malla = objeto as Mesh
  })
  if (malla == null) throw new Error(`La pieza del kit ${pieza} no trae ninguna malla`)
  return malla
}

/** Todas las copias de una pieza, en una sola llamada de dibujo. */
function Piezas({ malla, colocaciones }: { malla: Mesh; colocaciones: Colocacion[] }) {
  const instancias = useRef<InstancedMesh>(null)
  // La geometría y el material del modelo tal cual: el material trae `vertexColors`, que es
  // lo que pinta el color que el kit guardó en los vértices.
  const geometria = malla.geometry as BufferGeometry
  const material = malla.material as Material

  // Antes del primer fotograma con ellas: sin matrices, las copias saldrían todas amontonadas
  // en el origen, encima de la máquina, durante un fotograma.
  useLayoutEffect(() => {
    const mesh = instancias.current
    if (mesh == null) return
    geometria.computeBoundingBox()
    const { min, max } = geometria.boundingBox!
    const ancla = new Matrix4().makeTranslation(
      ...anclaEnLaBase({ min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] }),
    )
    const matriz = new Matrix4()
    const giro = new Quaternion()
    colocaciones.forEach((colocacion, indice) => {
      const escala = escalaPara(colocacion.altura, max.y - min.y)
      giro.setFromEuler(new Euler(0, colocacion.giro, 0))
      matriz
        .compose(
          new Vector3(...colocacion.posicion),
          giro,
          new Vector3(escala, escala, escala),
        )
        // Primero el ancla: la pieza se centra en su base y luego se escala, gira y coloca.
        .multiply(ancla)
      mesh.setMatrixAt(indice, matriz)
    })
    mesh.instanceMatrix.needsUpdate = true
    // La esfera que decide si se pinta o se descarta por estar fuera de la vista: hay que
    // rehacerla con las copias ya en su sitio, o se quedaría la de la pieza en el origen.
    mesh.computeBoundingSphere()
  }, [geometria, colocaciones])

  return (
    <instancedMesh
      ref={instancias}
      args={[geometria, material, colocaciones.length]}
      raycast={ignoreRaycast}
    />
  )
}
