'use client'

import { GROUND_Y } from '@/lib/gameConfig'

/**
 * Suelo de la escena. No pinta nada: el suelo visible es el empedrado de la
 * plaza del HDRI, proyectado por <Environment ground>. Este plano solo existe
 * para recibir la sombra de la máquina, que es lo que la asienta en el sitio en
 * vez de dejarla flotando sobre la foto.
 *
 * Está en y=GROUND_Y, la cota a la que un palo se considera perdido.
 */
export function Ground() {
  return (
    <mesh position={[0, GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <shadowMaterial opacity={0.45} />
    </mesh>
  )
}
