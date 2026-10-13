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
  PIECES,
  anchorAtBase,
  placements,
  scaleFor,
  piecePath,
  type Placement,
  type Piece,
} from '../../lib/fairKit'
import { ignoreRaycast } from './FairPieces'

/**
 * The stalls, the lampposts and the banners of the venue, with the pieces of the xrcade kit.
 *
 * Each piece of the kit is a mesh with one material and the colour in the vertices, so it is
 * painted as **one `InstancedMesh` per type**: the six stalls in one draw call, the eight
 * lampposts in another. What costs in the headset are the calls, not the triangles. Where
 * each one goes is decided by `lib/fairKit.ts`.
 *
 * **Out of reach of the rays**, like the rest of the venue (`ignoreRaycast`): an
 * `InstancedMesh` that answers the ray tests it against every copy on every movement of the
 * controller, and the decor is not grabbed.
 *
 * **No shadow**, like the rest of the venue: the light that lights it is the HDRI's, and the
 * spotlight that casts shadow is the machine's.
 */
export function FairKit() {
  // The three at once: requested one by one, each `useGLTF` would suspend until the previous
  // one arrived and they would download in a row. No Draco and no Meshopt: the pieces use
  // neither and both need WebAssembly, which the hall's security policy does not let compile.
  const models = useGLTF(
    PIECES.map((piece) => assetUrl(piecePath(piece))),
    false,
    false,
  )
  const byPiece = useMemo(() => {
    const all = placements()
    return PIECES.map((piece) => all.filter((c) => c.piece === piece))
  }, [])

  // They arrive after the prewarm of the scene (`PrewarmShaders`), which found them not loaded:
  // they are warmed here, on mounting. Without this, with «tu habitación» chosen the venue is
  // hidden and its shader would be compiled on showing it, which is a hitch with the headset on.
  // With `compile` and not `compileAsync`: nobody awaits the promise, and its `isReady()` polling
  // blows up if a material is unmounted meanwhile (`PrewarmShaders.tsx` tells it).
  const group = useRef<Group>(null)
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  useLayoutEffect(() => {
    if (group.current != null) gl.compile(group.current, camera, scene)
  }, [gl, camera, scene])

  return (
    <group ref={group}>
      {PIECES.map((piece, index) => (
        <Pieces
          key={piece}
          pieceMesh={meshOf(models[index].scene, piece)}
          piecePlacements={byPiece[index]}
        />
      ))}
    </group>
  )
}

/**
 * The only mesh of a piece of the kit.
 *
 * It is looked for by walking the scene and not by name: the name is the node's in the Kenney
 * pack and the kit does not promise to keep it. It does promise one mesh per piece; if something
 * else arrives, better an error that says which than a venue with no stalls without knowing why.
 */
function meshOf(scene: Object3D, piece: Piece): Mesh {
  let mesh: Mesh | null = null
  scene.traverse((object) => {
    if (mesh == null && (object as Mesh).isMesh) mesh = object as Mesh
  })
  if (mesh == null) throw new Error(`The kit piece ${piece} brings no mesh`)
  return mesh
}

/** All the copies of a piece, in a single draw call. */
function Pieces({ pieceMesh, piecePlacements }: { pieceMesh: Mesh; piecePlacements: Placement[] }) {
  const instances = useRef<InstancedMesh>(null)
  // The geometry and the material of the model as they are: the material brings `vertexColors`,
  // which is what paints the colour the kit stored in the vertices.
  const geometry = pieceMesh.geometry as BufferGeometry
  const material = pieceMesh.material as Material

  // Before the first frame with them: without matrices, the copies would all come out piled up
  // at the origin, on top of the machine, for one frame.
  useLayoutEffect(() => {
    const mesh = instances.current
    if (mesh == null) return
    geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox!
    const anchor = new Matrix4().makeTranslation(
      ...anchorAtBase({ min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] }),
    )
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    piecePlacements.forEach((placement, index) => {
      const scale = scaleFor(placement.height, max.y - min.y)
      rotation.setFromEuler(new Euler(0, placement.turn, 0))
      matrix
        .compose(
          new Vector3(...placement.position),
          rotation,
          new Vector3(scale, scale, scale),
        )
        // First the anchor: the piece is centred on its base and then scaled, turned and placed.
        .multiply(anchor)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    // The sphere that decides whether it is painted or discarded for being out of view: it has
    // to be rebuilt with the copies already in place, or the piece's one at the origin would stay.
    mesh.computeBoundingSphere()
  }, [geometry, piecePlacements])

  return (
    <instancedMesh
      ref={instances}
      args={[geometry, material, piecePlacements.length]}
      raycast={ignoreRaycast}
    />
  )
}
