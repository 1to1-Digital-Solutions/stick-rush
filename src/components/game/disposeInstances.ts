'use client'

import { useLayoutEffect, useRef } from 'react'
import type { InstancedMesh, Material, Mesh, Object3D } from 'three'

/**
 * A `ref` for a drei `<Instances>` that, on unmounting, disposes of its matrices and its
 * colours from the GPU.
 *
 * **The leak.** drei puts the matrices and the colours of the copies as attributes of its own
 * (`<instancedBufferAttribute attach="instanceMatrix">` and `attach="instanceColor"`). On
 * unmounting, fiber **detaches** those attributes —it gives the mesh back the ones it came with,
 * which were never uploaded— and only afterwards calls `dispose()`. three then disposes of the
 * attributes the mesh has on at that moment, which are not the uploaded ones: the two buffers of
 * each `<Instances>` stay in the GPU. That is nine families in the fairground, eighteen buffers
 * per visit, and three's counter does not see them because they belong to no geometry. Not even
 * the hall reaches them: its clean-up looks at the scene, and they are no longer there.
 *
 * **The fix.** The component that mounts the `<Instances>` is its parent, and on removing a
 * React tree the clean-up of the layout effects runs from top to bottom **before** removing its
 * nodes: from here the mesh still carries its attributes, and `dispose()` disposes of the right
 * ones. The second `dispose()`, fiber's, no longer finds anything to dispose of. If the mesh were
 * painted again —the double mount of strict mode—, three uploads them again.
 */
export function useDisposeInstances() {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(
    () => () => {
      mesh.current?.dispose()
    },
    [],
  )
  return mesh
}

/**
 * A `ref` for a group whose meshes fiber does not dispose of on unmounting: on leaving, the
 * geometry and the material of each one are disposed of by hand.
 *
 * **The leak.** On unmounting, fiber calls the `dispose()` of the object it removes, and a mesh
 * does not have one: its geometry and material are disposed of only if they were mounted as its
 * children in JSX. The projected ground of `<Environment ground>` is a three `GroundedSkybox` that
 * comes with its own —an icosahedron of 17 340 vertices—, so each visit left in the GPU a geometry
 * and its three buffers, half a megabyte, and the next one uploaded another.
 *
 * As in `useDisposeInstances`, the clean-up of the parent's layout effect runs before
 * removing its nodes: from here the mesh still hangs from the group.
 */
export function useDisposeMeshes() {
  const group = useRef<Object3D>(null)
  useLayoutEffect(
    () => () => {
      group.current?.traverse((object) => {
        const mesh = object as Mesh
        if (mesh.isMesh !== true) return
        mesh.geometry.dispose()
        for (const material of ([] as Material[]).concat(mesh.material)) material.dispose()
      })
    },
    [],
  )
  return group
}
