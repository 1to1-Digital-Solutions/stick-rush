'use client'

import {
  FAIR_COUNTER_COLOR,
  FAIR_PRIZE_COLORS,
  FAIR_SIGN_COLORS,
  FAIR_WOOD_COLOR,
  MACHINE_STRIPE_COLORS,
  MACHINE_TRUSS_COLOR,
} from '@/lib/gameConfig'
import { STALL_SIZE, type RingSlot } from '@/lib/sceneryLayout'
import { Board, Bulb, Pole } from './FairPieces'

/**
 * Una caseta de feria: trasera, laterales, mostrador, toldo a rayas con su
 * hilera de bombillas y un cartel arriba.
 *
 * Se monta mirando a +Z y el anillo la gira hacia el jugador (ver
 * `ringSlots`), así que aquí todo son medidas locales en metros.
 */

const { width, height, depth } = STALL_SIZE

/** Mostrador a la altura de la cintura, como el de un puesto de tiro. */
const COUNTER_HEIGHT = 0.95
/** Vuelo del toldo por delante del mostrador. */
const AWNING_DEPTH = 0.9
/** Caída del toldo hacia fuera, en radianes. */
const AWNING_TILT = 0.32
const AWNING_STRIPES = 8
/** Bombillas colgadas del borde del toldo. */
const AWNING_BULBS = 5
const BULB_RADIUS = 0.045

/**
 * Toldo: franjas alternas rojas y crema, las mismas de la máquina, colgando
 * hacia fuera desde el frente de la caseta. Las bombillas van en el mismo grupo
 * inclinado, así que siguen el borde sin más cuentas.
 */
function StallAwning() {
  const stripeWidth = width / AWNING_STRIPES

  return (
    <group position={[0, height - 0.08, depth / 2]} rotation={[AWNING_TILT, 0, 0]}>
      {Array.from({ length: AWNING_STRIPES }, (_, index) => (
        <Board
          key={`stripe-${index}`}
          position={[
            (index + 0.5) * stripeWidth - width / 2,
            0,
            AWNING_DEPTH / 2,
          ]}
          scale={[stripeWidth, 0.05, AWNING_DEPTH]}
          color={MACHINE_STRIPE_COLORS[index % MACHINE_STRIPE_COLORS.length]}
        />
      ))}

      {Array.from({ length: AWNING_BULBS }, (_, index) => (
        <Bulb
          key={`bulb-${index}`}
          position={[
            ((index + 0.5) / AWNING_BULBS - 0.5) * width,
            -0.09,
            AWNING_DEPTH - 0.06,
          ]}
          scale={BULB_RADIUS}
        />
      ))}
    </group>
  )
}

/**
 * Balda de premios al fondo de la caseta. Sin ella el hueco entre el mostrador
 * y la trasera se ve vacío, que es lo que hace que un puesto parezca una caja.
 */
function StallPrizes() {
  return (
    <group position={[0, COUNTER_HEIGHT + 0.36, -depth / 2 + 0.22]}>
      <Board
        position={[0, -0.06, 0]}
        scale={[width - 0.3, 0.05, 0.3]}
        color={FAIR_COUNTER_COLOR}
      />
      {FAIR_PRIZE_COLORS.map((color, index) => (
        <Board
          key={`prize-${index}`}
          position={[
            ((index + 0.5) / FAIR_PRIZE_COLORS.length - 0.5) * (width - 0.5),
            0.1,
            0,
          ]}
          scale={[0.26, 0.28, 0.22]}
          color={color}
        />
      ))}
    </group>
  )
}

export function FairStall({ slot, index }: { slot: RingSlot; index: number }) {
  return (
    <group position={slot.position} rotation={[0, slot.rotationY, 0]}>
      {/* Cajón del fondo y paredes */}
      <Board
        position={[0, height / 2, -depth / 2]}
        scale={[width, height, 0.09]}
        color={FAIR_WOOD_COLOR}
      />
      {[-1, 1].map((side) => (
        <Board
          key={`side-${side}`}
          position={[(side * width) / 2, height / 2, 0]}
          scale={[0.09, height, depth]}
          color={FAIR_WOOD_COLOR}
        />
      ))}

      {/* Mostrador: el cajón y su tablero, que vuela un palmo por los lados */}
      <Board
        position={[0, COUNTER_HEIGHT / 2, depth / 2 - 0.28]}
        scale={[width - 0.2, COUNTER_HEIGHT, 0.5]}
        color={FAIR_WOOD_COLOR}
      />
      <Board
        position={[0, COUNTER_HEIGHT + 0.04, depth / 2 - 0.26]}
        scale={[width + 0.16, 0.08, 0.62]}
        color={FAIR_COUNTER_COLOR}
      />

      {/* Postes de las esquinas delanteras, que sostienen el toldo */}
      {[-1, 1].map((side) => (
        <Pole
          key={`post-${side}`}
          position={[(side * (width - 0.12)) / 2, height / 2, depth / 2 - 0.04]}
          scale={[0.09, height, 0.09]}
          color={MACHINE_TRUSS_COLOR}
        />
      ))}

      <StallPrizes />
      <StallAwning />

      {/* Cartel sobre el toldo, apoyado en la trasera */}
      <Board
        position={[0, height + 0.24, -depth / 2 + 0.1]}
        scale={[width * 0.72, 0.44, 0.07]}
        color={FAIR_SIGN_COLORS[index % FAIR_SIGN_COLORS.length]}
      />
    </group>
  )
}
