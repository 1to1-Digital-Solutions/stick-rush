'use client'

import dynamic from 'next/dynamic'
import { HUD } from './HUD'

// El Canvas de R3F depende de WebGL/window, así que se carga solo en cliente.
const GameCanvas = dynamic(
  () => import('./GameCanvas').then((mod) => mod.GameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-background)]">
        <p className="animate-pulse text-sm uppercase tracking-[0.3em] text-white/40">
          Cargando escena…
        </p>
      </div>
    ),
  },
)

/** Escena de juego: Canvas 3D + HUD en DOM. */
export function GameScene() {
  return (
    <div className="relative h-dvh w-full">
      <GameCanvas />
      <HUD />
    </div>
  )
}
