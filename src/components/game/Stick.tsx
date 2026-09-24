'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Texture } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import {
  STICK_CAUGHT_COLOR,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  STICK_MISSED_COLOR,
  STICK_RADIUS,
  stickFallProgress,
} from '../../lib/gameConfig'
import { pulsarAtrape } from '../../lib/haptics'
import { publishStick, stickProbeRequested } from '../../lib/sceneProbe'
import { stickPointerEvents } from '../../lib/punteros'
import { SWING_RELEASE_DECAY, hangingSwing } from '../../lib/stickSwing'
import {
  type StickState,
  canCatchStick,
  canCatchWithPointer,
} from '../../lib/xrInteraction'

/**
 * Dónde cae el palo en el mundo, para publicarlo. Se reutiliza entre palos y
 * fotogramas: uno nuevo por palo y frame serían noventa vectores por segundo
 * tirados a la basura.
 */
const puntoDelPalo = new Vector3()

/**
 * Tipo de puntero que ha disparado el evento, si lo trae. Los eventos de ratón
 * no lo llevan; los de @pmndrs/pointer-events (los de XR) sí.
 */
function pointerTypeOf(event: unknown): string | undefined {
  if (typeof event !== 'object' || event == null) return undefined
  const { pointerType } = event as { pointerType?: unknown }
  return typeof pointerType === 'string' ? pointerType : undefined
}

export interface StickProps {
  /**
   * Clave del palo dentro de la partida, para publicar dónde está a quien lo
   * haya pedido desde fuera del Canvas (ver `@/lib/sceneProbe`).
   */
  probeId: string
  /** Punto de anclaje en el aro del que cuelga el palo. */
  anchor: [number, number, number]
  color: string
  /**
   * Relieve y rugosidad de la madera. Los carga y comparte StickMachine: el
   * material sí es propio de cada palo (el destello al atraparlo cambia su
   * emisión), pero las texturas, que es lo caro, se cargan una sola vez.
   */
  normalMap: Texture
  roughnessMap: Texture
  /** Velocidad de caída en unidades por segundo (según dificultad). */
  speed: number
  /** Retardo, en segundos, antes de empezar a caer. */
  delay: number
  /** Hueco propio dentro del ciclo del vaivén, en [0, 1). */
  swingPhase: number
  /**
   * Si el palo se mece mientras cuelga. Se apaga cuando el sistema pide reducir
   * el movimiento: el vaivén es decorado, y quien lo desactiva prefiere la
   * máquina quieta a que respire.
   */
  swaying: boolean
  /**
   * Con la partida parada (menú o fin) el palo se queda colgando: su reloj no
   * corre. Si no, los palos se soltaban mientras el jugador elegía opciones y
   * al empezar ya estaban por el suelo.
   */
  paused: boolean
  /**
   * Atrapado por el jugador (click o mando XR). Recibe cuánto había caído el
   * palo, de 0 (recién soltado) a 1 (a ras de suelo): cogerlo pronto puntúa más.
   */
  onCatch: (fallProgress: number) => void
  /** Se le escapó y ha tocado el suelo. */
  onMiss: () => void
}

export function Stick({
  probeId,
  anchor,
  color,
  normalMap,
  roughnessMap,
  speed,
  delay,
  swingPhase,
  swaying,
  paused,
  onCatch,
  onMiss,
}: StickProps) {
  const groupRef = useRef<Group>(null)
  const materialRef = useRef<MeshStandardMaterial>(null)
  const meshRef = useRef<Mesh>(null)
  const ringRef = useRef<Mesh>(null)
  const ringMaterialRef = useRef<MeshBasicMaterial>(null)
  // Cuánto se ha teñido de rojo el palo perdido, de 0 a 1.
  const missTint = useRef(0)

  // Los colores se crean una vez por palo: instanciarlos dentro del bucle de
  // render generaría basura en cada uno de los 90 fotogramas del visor.
  const { baseColor, caughtColor, missedColor } = useMemo(
    () => ({
      baseColor: new Color(color),
      caughtColor: new Color(STICK_CAUGHT_COLOR),
      missedColor: new Color(STICK_MISSED_COLOR),
    }),
    [color],
  )

  const [state, setState] = useState<StickState>('hanging')
  // Visibilidad: se oculta cuando termina la animación de captura.
  const [visible, setVisible] = useState(true)
  // Tiempo acumulado desde el inicio (para gestionar el delay escalonado).
  const elapsed = useRef(0)
  // Reloj del vaivén. Es aparte del anterior porque corre también con la
  // partida parada: mecerse mientras el jugador elige o cuenta atrás es
  // justamente para lo que está.
  const swingTime = useRef(0)
  // Cuánto del vaivén se aplica, de 1 (colgando) a 0 (soltado o quieto). Nace
  // a 0 si el sistema ya pedía reducir el movimiento: empezar a 1 dejaba al
  // palo naciendo inclinado y enderezándose durante un cuarto de segundo, que
  // es justo el movimiento que esa preferencia quiere evitar.
  const swingLevel = useRef(swaying ? 1 : 0)
  // Intensidad del glow al ser atrapado, que decae con el tiempo.
  const flash = useRef(0)
  // Un palo solo puede resolverse una vez. Hace falta un ref además del
  // estado porque `setState` no se aplica hasta el siguiente render: dos
  // capturas en el mismo frame (los dos mandos XR apuntando al mismo palo,
  // o una captura justo cuando toca el suelo) verían ambas 'falling'.
  const resolved = useRef(false)
  // Si el puntero está sobre el palo, para mantener el cursor al día y
  // devolverlo al desmontar.
  const hovering = useRef(false)

  const [anchorX, anchorY, anchorZ] = anchor

  // Cuándo se deja coger un palo: ver `canCatchStick`.
  const catchable = canCatchStick(state, paused)

  const releaseCursor = () => {
    if (!hovering.current) return
    hovering.current = false
    document.body.style.cursor = 'auto'
  }

  // El palo desaparece al ser atrapado y se desmonta al acabar la partida:
  // si el puntero estaba encima, `onPointerOut` ya no llega y el cursor se
  // quedaría en 'pointer'.
  useEffect(() => releaseCursor, [])

  // Lo que quede por vibrar del último atrape se cancela al desmontar el palo: un pulso
  // programado que saliera después vibraría por algo que ya no está.
  const cancelarPulsos = useRef<() => void>(() => {})
  useEffect(() => () => cancelarPulsos.current(), [])

  // Y deja de anunciarse al irse: una clave que se queda puesta le dice a quien
  // mire desde fuera que sigue habiendo un palo ahí, quieto para siempre.
  useEffect(() => () => publishStick(probeId, null), [probeId])

  // El palo perdido se queda en el suelo aunque el aro cambie de altura.
  //
  // El aro se acomoda a quien juega (ver `@/lib/hoopHeight`) y puede subir o
  // bajar desde el menú con los palos de la partida anterior todavía tirados por
  // el suelo. Al moverse el anclaje, React reescribe la posición del grupo y se
  // llevaría con él a los palos ya resueltos: se levantarían del suelo hasta la
  // altura del aro y se quedarían ahí colgados, rojos y sin cuerda, hasta la
  // partida siguiente.
  useEffect(() => {
    const group = groupRef.current
    if (!group || state !== 'missed') return
    group.position.y = STICK_MISS_Y
  }, [anchorY, state])

  // La ventana de captura también se abre y se cierra sola, con el puntero
  // quieto encima: el ratón se queda sobre un palo mientras corre la cuenta
  // atrás, y al arrancar la partida no llega ningún `pointerover` nuevo que
  // encienda el cursor. Lo mismo al revés cuando el palo bajo el puntero toca
  // el suelo o se acaba la partida: el cursor seguiría ofreciendo un palo que
  // ya no se coge.
  useEffect(() => {
    if (!hovering.current) return
    document.body.style.cursor = catchable ? 'pointer' : 'auto'
  }, [catchable])

  const handleCatch = (event?: ThreeEvent<PointerEvent | MouseEvent>) => {
    // Se coge con la mano, no apuntando: ver `canCatchWithPointer`.
    if (!canCatchWithPointer(pointerTypeOf(event))) return
    event?.stopPropagation()
    if (resolved.current) return
    if (!catchable) return
    resolved.current = true
    setState('caught')
    flash.current = 1
    // El verde entra de golpe: el destello ya es la confirmación, y una
    // transición desde el amarillo la volvería tibia.
    const material = materialRef.current
    if (material) {
      material.color.copy(caughtColor)
      material.emissive.copy(caughtColor)
    }
    releaseCursor()
    // Dónde estaba el palo al cogerlo decide el bonus por reflejos. Se lee de
    // la posición viva y no del estado, que aún no se ha vuelto a renderizar, y
    // se mide contra su propio anclaje: el aro se acomoda a quien juega, así que
    // no todos los palos salen de la misma altura.
    const fallProgress = stickFallProgress(groupRef.current?.position.y ?? anchorY, anchorY)
    onCatch(fallProgress)
    // El toque en el mando va después de contar el palo: la vibración es el
    // adorno y la puntuación es el juego, así que un mando que se porte mal no
    // puede llevarse por delante el acierto. Vibra la mano que lo ha cogido, y
    // más si ha sido in extremis (`lib/haptics.ts`).
    cancelarPulsos.current = pulsarAtrape(event, fallProgress)
  }

  useFrame((_, rawDelta) => {
    const group = groupRef.current
    if (!group) return

    // Limita el delta para evitar saltos tras pestañas en segundo plano.
    const delta = Math.min(rawDelta, 0.05)
    if (!paused) {
      elapsed.current += delta
    }

    // Dónde está el palo, para quien mire desde fuera del Canvas. Se publica el
    // cuerpo y no el grupo: el grupo está en el aro y el cilindro cuelga un
    // palmo por debajo, que es adonde hay que llevar la mano.
    if (stickProbeRequested()) {
      const cuerpo = meshRef.current
      if (cuerpo != null) {
        cuerpo.getWorldPosition(puntoDelPalo)
        publishStick(probeId, {
          x: puntoDelPalo.x,
          y: puntoDelPalo.y,
          z: puntoDelPalo.z,
          catchable,
        })
      }
    }

    // Vaivén: el palo colgado se mece; en cuanto se suelta se endereza, porque
    // uno que cae inclinándose cuesta de seguir con la mano.
    if (swaying && state === 'hanging') {
      swingTime.current += delta
      swingLevel.current = 1
    } else if (swingLevel.current > 0) {
      swingLevel.current = Math.max(
        0,
        swingLevel.current - delta * SWING_RELEASE_DECAY,
      )
    }
    if (swingLevel.current > 0) {
      const tilt = hangingSwing(swingTime.current, swingPhase)
      group.rotation.x = tilt.x * swingLevel.current
      group.rotation.z = tilt.z * swingLevel.current
    } else if (group.rotation.x !== 0 || group.rotation.z !== 0) {
      // Solo los dos ejes del vaivén: el giro sobre Y no es suyo y borrarlo
      // desharía cualquier orientación que el palo llegue a tener.
      group.rotation.x = 0
      group.rotation.z = 0
    }

    // Acierto: el palo se enciende en verde, da un golpe de escala y se
    // desvanece, mientras una onda sale de donde estaba. Es el único momento en
    // que el juego dice "bien" en el visor, donde no hay marcador que leer sin
    // apartar la vista de los palos.
    if (flash.current > 0) {
      flash.current = Math.max(0, flash.current - delta * CATCH_FLASH_DECAY)
      const t = flash.current
      group.scale.setScalar(1 + (1 - t) * 0.5)

      const material = materialRef.current
      if (material) {
        material.emissiveIntensity = t * 2.4
        material.opacity = Math.min(t * 1.6, 1)
      }

      const ring = ringRef.current
      const ringMaterial = ringMaterialRef.current
      if (ring && ringMaterial) {
        ring.visible = true
        ring.scale.setScalar(0.3 + (1 - t) * 2.6)
        ringMaterial.opacity = t * 0.7
      }

      if (flash.current <= 0 && state === 'caught') {
        setVisible(false)
      }
    }

    // Fallo: el palo tocado el suelo se tiñe de rojo. Se queda ahí, así que al
    // final de la partida el suelo cuenta lo que se ha escapado.
    if (state === 'missed' && missTint.current < 1) {
      missTint.current = Math.min(1, missTint.current + delta * MISS_TINT_SPEED)
      const material = materialRef.current
      if (material) {
        material.color.copy(baseColor).lerp(missedColor, missTint.current)
        material.emissive.copy(missedColor)
        material.emissiveIntensity = 0.35 * missTint.current
      }
    }

    if (state === 'hanging') {
      if (!paused && elapsed.current >= delay) {
        setState('falling')
      }
      return
    }

    if (state === 'falling' && !resolved.current && !paused) {
      group.position.y -= speed * delta
      if (group.position.y <= STICK_MISS_Y) {
        group.position.y = STICK_MISS_Y
        resolved.current = true
        setState('missed')
        onMiss()
      }
    }
  })

  return (
    // **Y solo está para el rayo mientras se pueda coger** (`lib/punteros.ts`). Apagar un palo
    // con `visible` no lo aparta del puntero: el ya atrapado se quedaba escuchando, invisible,
    // a medio metro de la cara y justo entre la mano y el menú.
    <group
      ref={groupRef}
      position={[anchorX, anchorY, anchorZ]}
      visible={visible}
      pointerEvents={stickPointerEvents(catchable)}
    >
      {/* Hilo que une el arco con el palo. Solo mientras cuelga: en cuanto el
          palo se suelta deja de haber nada que lo sujete. */}
      <mesh position={[0, -STICK_CORD_LENGTH / 2, 0]} visible={state === 'hanging'}>
        <cylinderGeometry args={[0.005, 0.005, STICK_CORD_LENGTH, 6]} />
        <meshStandardMaterial color="#4a4038" metalness={0.1} roughness={0.9} />
      </mesh>

      {/* El palo en sí, colgando bajo el hilo. */}
      <mesh
        ref={meshRef}
        position={[0, -STICK_CORD_LENGTH - STICK_LENGTH / 2, 0]}
        onClick={handleCatch}
        // El agarre se resuelve al cerrar la mano, sin esperar a soltar: con el
        // palo cayendo, exigir un clic completo (pulsar y soltar sobre el mismo
        // objeto) haría fallar agarres que el jugador siente como buenos.
        onPointerDown={handleCatch}
        onPointerOver={(e) => {
          e.stopPropagation()
          hovering.current = true
          // El cursor promete que el palo se puede coger, así que responde a la
          // misma regla que la captura y no a una copia suya. Un palo que ya no
          // se coge apaga el cursor en vez de dejarlo como estuviera: el puntero
          // puede venir de otro palo que sí valía.
          document.body.style.cursor = catchable ? 'pointer' : 'auto'
        }}
        onPointerOut={releaseCursor}
      >
        <cylinderGeometry args={[STICK_RADIUS, STICK_RADIUS, STICK_LENGTH, 16]} />
        {/* Madera pintada, no plástico: el grano en relieve y la aspereza
            irregular son los que dan la sensación de peso. */}
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          normalMap={normalMap}
          normalScale={[0.8, 0.8]}
          roughnessMap={roughnessMap}
          emissive={color}
          emissiveIntensity={0}
          metalness={0}
          roughness={0.75}
          // Transparente desde el principio para poder desvanecer el palo al
          // atraparlo: alternar `transparent` en caliente recompila el shader y
          // da un tirón justo en el momento del destello.
          transparent
          opacity={1}
        />
      </mesh>

      {/* Onda del acierto: sale de donde estaba el palo y se abre. Empieza
          oculta y solo la enciende el destello. */}
      <mesh
        ref={ringRef}
        position={[0, -STICK_CORD_LENGTH - STICK_LENGTH / 2, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[0.05, 0.006, 6, 24]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={STICK_CAUGHT_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** A qué ritmo se apaga el destello del acierto (1/s). */
const CATCH_FLASH_DECAY = 1.8
/** A qué ritmo se tiñe de rojo el palo perdido (1/s). */
const MISS_TINT_SPEED = 3.5
