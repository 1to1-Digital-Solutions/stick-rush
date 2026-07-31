'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import type { Mesh } from 'three'
import { XR_RESTART_DELAY_MS } from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'

/**
 * Marcador dentro de la escena, para sesiones inmersivas.
 *
 * El HUD normal es DOM y en inmersivo no se ve, así que el jugador se quedaba
 * sin marcador ni resultado. Este lo sustituye con geometría: una ficha por
 * palo, atrapado / perdido / pendiente.
 *
 * No usa texto a propósito: `<Text>` de drei descarga las fuentes de un CDN
 * (troika resuelve la tipografía contra jsdelivr), y el juego debe verse aunque
 * el visor esté en una red local sin salida. Cada estado se distingue por color
 * *y* por tamaño y altura, para no depender solo del color.
 *
 * Va dentro de <XROrigin>, así que sus medidas son metros vistos por el
 * jugador. Queda por delante y por debajo del aro, dentro del semicírculo, para
 * no cruzarse con los palos que caen (que lo hacen sobre el radio del aro).
 */

const TOKEN_SPACING = 0.07
const TOKEN_RADIUS = 0.026
const HUD_POSITION: [number, number, number] = [0, 0.85, -0.8]
const RESTART_SECONDS = XR_RESTART_DELAY_MS / 1000

type TokenState = 'caught' | 'missed' | 'pending'

const TOKEN_STYLE: Record<
  TokenState,
  { color: string; emissive: number; scale: number; lift: number }
> = {
  // Atrapado: verde, ficha grande y elevada.
  caught: { color: '#22c55e', emissive: 1.4, scale: 1.15, lift: 0.012 },
  // Perdido: rojo, ficha pequeña y hundida.
  missed: { color: '#dc2626', emissive: 0.25, scale: 0.7, lift: -0.012 },
  // Pendiente: gris apagado, tamaño intermedio.
  pending: { color: '#475569', emissive: 0, scale: 0.9, lift: 0 },
}

function Token({ state, x }: { state: TokenState; x: number }) {
  const style = TOKEN_STYLE[state]

  return (
    <mesh
      position={[x, style.lift, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={style.scale}
    >
      <cylinderGeometry args={[TOKEN_RADIUS, TOKEN_RADIUS, 0.014, 16]} />
      <meshStandardMaterial
        color={style.color}
        emissive={style.color}
        emissiveIntensity={style.emissive}
        metalness={0.2}
        roughness={0.5}
      />
    </mesh>
  )
}

/**
 * Barra que se vacía durante la pausa entre partidas, para que la siguiente no
 * arranque de sorpresa. Se monta al terminar, así que su reloj empieza a la vez
 * que el temporizador de XRSessionController.
 */
function RestartBar() {
  const barRef = useRef<Mesh>(null)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    elapsed.current = Math.min(elapsed.current + delta, RESTART_SECONDS)
    const remaining = 1 - elapsed.current / RESTART_SECONDS
    if (barRef.current) {
      barRef.current.scale.x = Math.max(remaining, 0.001)
    }
  })

  return (
    <mesh ref={barRef} position={[0, -0.075, 0.002]}>
      <planeGeometry args={[0.5, 0.008]} />
      <meshBasicMaterial color="#d97706" toneMapped={false} />
    </mesh>
  )
}

export function XRHud() {
  const mode = useXR((state) => state.mode)
  const { score, resolved, stickCount, gameState } = useGame()

  // Fuera de sesión inmersiva manda el HUD en DOM.
  if (mode == null) {
    return null
  }

  const width = Math.max(stickCount - 1, 0) * TOKEN_SPACING
  const tokens = Array.from({ length: stickCount }, (_, index) => {
    const state: TokenState =
      index < score ? 'caught' : index < resolved ? 'missed' : 'pending'
    return { index, state, x: index * TOKEN_SPACING - width / 2 }
  })

  return (
    <group position={HUD_POSITION}>
      {/* Panel de fondo: en AR el mundo real está detrás, sin él las fichas
          pierden contraste sobre cualquier pared. */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.16, 0.19]} />
        <meshBasicMaterial
          color="#0f1f2b"
          transparent
          opacity={0.72}
          toneMapped={false}
        />
      </mesh>

      {tokens.map((token) => (
        <Token key={token.index} state={token.state} x={token.x} />
      ))}

      {gameState === 'finished' && <RestartBar />}
    </group>
  )
}
