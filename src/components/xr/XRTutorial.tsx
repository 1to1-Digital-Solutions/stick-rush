'use client'

import { type RefObject, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import {
  DIFFICULTY_COLORS,
  STICK_CAUGHT_COLOR,
  STICK_COLOR,
} from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { type TutorialStepKey, tutorialFrameAt } from '../../lib/tutorial'
import {
  XR_TUTORIAL_POSITION,
  XR_TUTORIAL_PROGRESS_OFFSET,
  XR_TUTORIAL_SKIP_OFFSET,
} from '../../lib/xrLayout'
import { useReducedMotion } from '../game/useReducedMotion'
import { ControllerModel } from './XRControllerModel'
import {
  PANEL_COLOR,
  XRDifficultyBars,
  XRPanel,
  XRPressable,
  XRSkipIcon,
} from './XRUi'

/**
 * Tutorial de unos segundos, dentro del visor y solo la primera vez.
 *
 * Con las gafas puestas, quien llega nuevo no sabe que los palos se agarran ni
 * con qué botón: el menú se maneja apuntando con el rayo, así que lo primero
 * que aprende es justo lo que no sirve para jugar. Esto se interpone entre
 * «empezar» y la cuenta atrás y enseña tres cosas: el gatillo que agarra
 * —marcado sobre el mando de verdad, el mismo que tiene en la mano—, cuántos
 * palos van a caer y en qué nivel.
 *
 * **Sin una sola letra**, como el resto de la interfaz inmersiva: `<Text>` de
 * drei descarga las fuentes de un CDN que la CSP bloquea. Cada cosa se dice con
 * la geometría que ya significa eso en el juego —el mando, los palos, las
 * barras del nivel— y con movimiento, que es lo que convierte un dibujo en una
 * instrucción.
 *
 * El guion (qué se enseña y cuánto dura) vive en `@/lib/tutorial`, probado sin
 * navegador. Aquí solo se pinta.
 */

/** Medidas del panel, en metros. Más bajo que el del menú: cabe menos cosa. */
const PANEL_WIDTH = 1.06
const PANEL_HEIGHT = 0.62

/** Ancho del carril de progreso. */
const PROGRESS_WIDTH = 0.34

/**
 * Cuánto dura un ciclo completo de la demostración del agarre, en segundos: el
 * palo baja, se agarra y vuelve a empezar. El tramo dura para dos ciclos, que
 * es lo que hace falta para que se lea como un gesto y no como una casualidad.
 */
const GRAB_CYCLE = 1.7
/** En qué punto del ciclo se cierra la mano sobre el palo. */
const GRAB_AT = 0.62

/** De dónde sale el palo de la demostración y dónde lo espera la mano. */
const DEMO_STICK_TOP = 0.24
const DEMO_STICK_CATCH = 0.03

/**
 * El mando de la demostración con un palo cayéndole encima.
 *
 * El palo baja, la mano se cierra —el gatillo se pone verde, igual que cuando
 * el jugador lo aprieta de verdad— y el palo se deshace en un destello, que es
 * exactamente lo que se ve al atrapar uno en la partida.
 */
function GrabDemo({
  elapsed,
  reducedMotion,
}: {
  elapsed: RefObject<number>
  reducedMotion: boolean
}) {
  const stickRef = useRef<Group>(null)
  const stickMaterialRef = useRef<MeshStandardMaterial>(null)
  const flashRef = useRef<Mesh>(null)
  const flashMaterialRef = useRef<MeshBasicMaterial>(null)
  // El agarre es el primer tramo del guion, así que su reloj es el del tutorial
  // entero: no hace falta descontarle nada.
  const grabbed = useRef(false)

  useFrame(() => {
    const stick = stickRef.current
    const material = stickMaterialRef.current
    const flash = flashRef.current
    const flashMaterial = flashMaterialRef.current
    if (!stick || !material || !flash || !flashMaterial) return

    // Con el movimiento reducido no hay caída ni destello: el palo se queda
    // donde la mano lo agarra y el gatillo, marcado. Y **sin darlo por
    // apretado**: el verde de la confirmación releva a la marca ámbar y apaga
    // su onda (ver `SqueezeButton`), así que la única imagen que le queda a
    // quien ha pedido no ver movimiento dejaría de señalar qué botón es, que es
    // justo lo que hay que enseñar. Se reponen los valores del material porque
    // la preferencia puede cambiar a media demostración, con el palo a medio
    // desvanecer.
    if (reducedMotion) {
      stick.position.y = DEMO_STICK_CATCH
      stick.scale.setScalar(1)
      material.opacity = 1
      material.emissiveIntensity = 0.35
      flash.visible = false
      grabbed.current = false
      return
    }

    const phase = (elapsed.current % GRAB_CYCLE) / GRAB_CYCLE
    grabbed.current = phase >= GRAB_AT

    if (!grabbed.current) {
      const fall = phase / GRAB_AT
      stick.position.y = DEMO_STICK_TOP - (DEMO_STICK_TOP - DEMO_STICK_CATCH) * fall
      stick.scale.setScalar(1)
      material.opacity = 1
      material.emissiveIntensity = 0.35
      flash.visible = false
      return
    }

    // Atrapado: el palo se enciende, crece y se desvanece mientras sale la onda.
    const t = (phase - GRAB_AT) / (1 - GRAB_AT)
    stick.position.y = DEMO_STICK_CATCH
    stick.scale.setScalar(1 + t * 0.4)
    material.opacity = Math.max(0, 1 - t * 1.4)
    material.emissiveIntensity = 1.6 * (1 - t)
    flash.visible = true
    flash.scale.setScalar(0.4 + t * 2.2)
    flashMaterial.opacity = Math.max(0, 0.7 * (1 - t))
  })

  return (
    <group position={[0, -0.02, 0]}>
      {/* El mando, en tres cuartos para que el gatillo lateral quede de cara.
          Es el mismo dibujo que el jugador tiene en la mano. */}
      <group position={[0, -0.11, 0.02]} rotation={[0.25, -0.5, 0]} scale={1.6}>
        <ControllerModel
          side={1}
          highlight
          pulsing={!reducedMotion}
          isPressed={() => grabbed.current}
        />
      </group>

      {/* El palo que cae hacia la mano. */}
      <group ref={stickRef} position={[0, DEMO_STICK_TOP, 0.04]}>
        <mesh>
          <cylinderGeometry args={[0.011, 0.011, 0.15, 12]} />
          <meshStandardMaterial
            ref={stickMaterialRef}
            color={STICK_COLOR}
            emissive={STICK_COLOR}
            emissiveIntensity={0.35}
            roughness={0.65}
            transparent
            opacity={1}
          />
        </mesh>
      </group>

      {/* Onda del acierto, donde se cierra la mano. */}
      <mesh
        ref={flashRef}
        position={[0, DEMO_STICK_CATCH, 0.04]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[0.05, 0.006, 6, 24]} />
        <meshBasicMaterial
          ref={flashMaterialRef}
          color={STICK_CAUGHT_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** Separación entre los palos de la fila, en metros. */
const COUNT_SPACING = 0.062

/**
 * Cuántos palos van a caer: tantos como se hayan elegido, apareciendo uno a uno
 * para que se puedan contar, y cayendo después como caerán de verdad.
 */
function StickCountDemo({
  elapsed,
  stickCount,
  reducedMotion,
}: {
  elapsed: RefObject<number>
  stickCount: number
  reducedMotion: boolean
}) {
  const sticks = useRef<(Group | null)[]>([])
  const width = (stickCount - 1) * COUNT_SPACING

  useFrame(() => {
    const { stepProgress } = tutorialFrameAt(elapsed.current)

    sticks.current.forEach((stick, index) => {
      if (!stick) return
      if (reducedMotion) {
        stick.scale.setScalar(1)
        stick.position.y = 0
        return
      }

      // Cada palo entra un poco después del anterior, y todos han entrado a
      // media demostración: la otra mitad es la caída.
      const entrance = (index / Math.max(stickCount, 1)) * 0.5
      const appear = Math.min(1, Math.max(0, (stepProgress - entrance) * 8))
      stick.scale.setScalar(appear)
      // Ya contados, se sueltan escalonados, como en la partida.
      const fall = Math.min(1, Math.max(0, (stepProgress - 0.55 - entrance) * 2.2))
      stick.position.y = -fall * 0.12
    })
  })

  return (
    <group position={[0, 0.02, 0.02]}>
      {Array.from({ length: stickCount }, (_, index) => (
        <group
          key={index}
          ref={(node) => {
            sticks.current[index] = node
          }}
          position={[index * COUNT_SPACING - width / 2, 0, 0]}
        >
          <mesh>
            <cylinderGeometry args={[0.01, 0.01, 0.14, 10]} />
            <meshStandardMaterial
              color={STICK_COLOR}
              emissive={STICK_COLOR}
              emissiveIntensity={0.5}
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * En qué nivel se juega: la misma ficha del menú, agrandada y entrando de
 * frente. Sin cifras ni nombres, igual que donde se elige.
 */
function LevelDemo({
  elapsed,
  reducedMotion,
}: {
  elapsed: RefObject<number>
  reducedMotion: boolean
}) {
  const cardRef = useRef<Group>(null)
  const { difficulty } = useGame()

  useFrame(() => {
    const card = cardRef.current
    if (!card) return
    if (reducedMotion) {
      card.scale.setScalar(1)
      return
    }
    const { stepProgress } = tutorialFrameAt(elapsed.current)
    // Entra creciendo en el primer cuarto y se queda quieta: es un dato, no una
    // animación que haya que seguir.
    card.scale.setScalar(0.6 + 0.4 * Math.min(1, stepProgress * 4))
  })

  return (
    <group ref={cardRef} position={[0, -0.02, 0.02]} scale={0.6}>
      <mesh>
        <boxGeometry args={[0.34, 0.24, 0.014]} />
        <meshStandardMaterial
          color={DIFFICULTY_COLORS[difficulty]}
          emissive={DIFFICULTY_COLORS[difficulty]}
          emissiveIntensity={0.45}
          roughness={0.55}
        />
      </mesh>
      <XRDifficultyBars
        difficulty={difficulty}
        lit
        position={[0, -0.075, 0.012]}
        scale={2.4}
      />
    </group>
  )
}

/** Lo que se enseña en cada tramo del guion. */
function TutorialStage({
  step,
  elapsed,
  stickCount,
  reducedMotion,
}: {
  step: TutorialStepKey
  elapsed: RefObject<number>
  stickCount: number
  reducedMotion: boolean
}) {
  if (step === 'grab') {
    return <GrabDemo elapsed={elapsed} reducedMotion={reducedMotion} />
  }
  if (step === 'sticks') {
    return (
      <StickCountDemo
        elapsed={elapsed}
        stickCount={stickCount}
        reducedMotion={reducedMotion}
      />
    )
  }
  return <LevelDemo elapsed={elapsed} reducedMotion={reducedMotion} />
}

/**
 * El tutorial en marcha: lleva el reloj, decide qué tramo toca y pinta cuánto
 * queda.
 *
 * El reloj es un ref y no estado: la barra de progreso y las animaciones se
 * mueven en cada fotograma, y renderizar noventa veces por segundo para eso
 * sería tirar el visor. Lo único que provoca un render es el cambio de tramo,
 * tres veces en toda la demostración.
 */
function TutorialPanel() {
  const { stickCount, finishTutorial } = useGame()
  const reducedMotion = useReducedMotion()
  const elapsed = useRef(0)
  const [step, setStep] = useState<TutorialStepKey | null>(
    () => tutorialFrameAt(0).step,
  )
  const progressRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    // El delta se limita como en `Stick`: si el visor se queda sin fotogramas,
    // el tutorial no se salta medio guion de un salto.
    elapsed.current += Math.min(delta, 0.05)
    const frame = tutorialFrameAt(elapsed.current)
    if (frame.step !== step) setStep(frame.step)

    const bar = progressRef.current
    if (bar) {
      // Anclada a la izquierda: crece hacia la derecha desde su extremo.
      const filled = Math.max(frame.progress, 0.001)
      bar.scale.x = filled
      bar.position.x = (-PROGRESS_WIDTH * (1 - filled)) / 2
    }
  })

  return (
    <group position={XR_TUTORIAL_POSITION}>
      <XRPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} color={PANEL_COLOR} />

      {step != null && (
        <TutorialStage
          step={step}
          elapsed={elapsed}
          stickCount={stickCount}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Cuánto queda. Es lo que convierte la espera en algo que se aguanta:
          se ve que dura segundos, no minutos. */}
      <group position={XR_TUTORIAL_PROGRESS_OFFSET}>
        <mesh>
          <boxGeometry args={[PROGRESS_WIDTH, 0.01, 0.006]} />
          <meshBasicMaterial color="#1c2634" toneMapped={false} />
        </mesh>
        <mesh ref={progressRef} position={[0, 0, 0.004]}>
          <boxGeometry args={[PROGRESS_WIDTH, 0.01, 0.006]} />
          <meshBasicMaterial color="#22c55e" toneMapped={false} />
        </mesh>
      </group>

      {/* Saltar. Está montado desde el primer fotograma y en su sitio de
          siempre: quien ya sabe jugar no tiene que esperar a que aparezca. */}
      <XRPressable
        position={XR_TUTORIAL_SKIP_OFFSET}
        onSelect={finishTutorial}
        hitSize={[0.18, 0.13, 0.06]}
      >
        <mesh position={[0, 0, -0.008]}>
          <boxGeometry args={[0.15, 0.1, 0.014]} />
          <meshStandardMaterial
            color="#334155"
            emissive="#94a3b8"
            emissiveIntensity={0.28}
            roughness={0.5}
          />
        </mesh>
        <XRSkipIcon position={[0, 0, 0.008]} />
      </XRPressable>
    </group>
  )
}

export function XRTutorial() {
  const mode = useXR((state) => state.mode)
  const { gameState } = useGame()

  // Solo dentro del visor: en escritorio el menú lo explica con texto, que se
  // lee antes de lo que dura esta demostración.
  if (mode == null || gameState !== 'tutorial') {
    return null
  }

  // Fuera de la fase no queda montado, así que cada pase estrena su reloj:
  // volverlo a ver desde el menú empieza por el principio.
  return <TutorialPanel />
}
