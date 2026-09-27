'use client'

import { useLayoutEffect, useRef } from 'react'
import type { InstancedMesh } from 'three'

/**
 * Un `ref` para un `<Instances>` de drei que, al desmontarse, suelta de la GPU sus matrices y
 * sus colores.
 *
 * **La fuga.** drei pone las matrices y los colores de las copias como atributos propios
 * (`<instancedBufferAttribute attach="instanceMatrix">` y `attach="instanceColor"`). Al
 * desmontar, fiber **desengancha** esos atributos —devuelve al mesh los que traía de fábrica,
 * que nunca se subieron— y solo después llama a `dispose()`. three suelta entonces los atributos
 * que el mesh tiene puestos en ese momento, que no son los subidos: los dos búferes de cada
 * `<Instances>` se quedan en la GPU. Son nueve familias en la feria, dieciocho búferes por
 * visita, y el contador de three no los ve porque no son de ninguna geometría. Ni el salón los
 * alcanza: su limpieza mira la escena, y ahí ya no están.
 *
 * **El arreglo.** El componente que monta el `<Instances>` es su padre, y al quitar un árbol
 * React corre la limpieza de los efectos de maquetación de arriba abajo **antes** de quitar sus
 * nodos: desde aquí el mesh todavía lleva sus atributos, y `dispose()` suelta los buenos. El
 * segundo `dispose()`, el de fiber, ya no encuentra nada que soltar. Si el mesh se volviera a
 * pintar —el doble montaje del modo estricto—, three los sube otra vez.
 */
export function useSoltarInstancias() {
  const malla = useRef<InstancedMesh>(null)
  useLayoutEffect(
    () => () => {
      malla.current?.dispose()
    },
    [],
  )
  return malla
}
