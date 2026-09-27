'use client'

import { FLECHA_DE_SALIR } from './canvasPanel'
import { PANEL_ORDER } from './buttonHighlight'
import { NO_RAYCAST } from '../raycast'

import { type ReactNode, useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Path, Shape, Vector2 } from 'three'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_ORDER,
  type Difficulty,
} from '../../lib/gameConfig'
import { PRESS_PULSE, pulseHaptics } from '../../lib/haptics'
import {
  XR_CHECK_ICON,
  XR_CROSS_ICON,
  XR_HEART_ICON,
  XR_HOME_ICON,
  XR_MUSIC_ICON,
  XR_MUSIC_OFF_ICON,
  XR_MUTED_ICON,
  XR_SHARE_ICON,
  XR_SOUND_ICON,
  XR_STAR_ICON,
  XR_TRIANGLE_CENTER,
  XR_TRIANGLE_ROTATION,
  sceneMountains,
  type IconShape,
  type TriangleTip,
} from '../../lib/xrIcons'

/**
 * Piezas de interfaz para las sesiones inmersivas.
 *
 * En VR/AR no hay DOM, así que menú, marcador y botones son geometría. Todo lo
 * de aquí es local: ni fuentes, ni texturas, ni nada que salga a la red.
 */

/** Fondo de los paneles: oscuro y semitransparente, legible sobre passthrough. */
export const PANEL_COLOR = '#0f1f2b'

/** Panel de fondo. En AR es lo que despega la interfaz de la pared real. */
export function XRPanel({
  width,
  height,
  color = PANEL_COLOR,
  opacity = 0.82,
}: {
  width: number
  height: number
  color?: string
  opacity?: number
}) {
  return (
    /*
      **Sin escribir profundidad, y con su sitio en el orden.** Es un plano transparente de
      un panel, y a milímetros de los botones que lleva encima la ordenación por profundidad
      no decide nada fiable: basta inclinar la cabeza hacia un botón del borde para que el
      fondo se pinte DESPUÉS de él y, escribiendo profundidad, se lo lleve por delante
      (ver `buttonHighlight.tsx`).
    */
    <mesh position={[0, 0, -0.02]} renderOrder={PANEL_ORDER.back}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
        depthWrite={false}
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Color del halo que marca el botón apuntado. */
const HOVER_COLOR = '#7dd3fc'

/**
 * Y con el que se enciende al apretarlo, que es otra cosa que apuntarlo.
 *
 * El botón **se hunde y cambia de color** en vez de desaparecer: encoge por debajo de su
 * tamaño de reposo —que a un metro se lee como que se mete hacia dentro— y el halo pasa de
 * este azul a blanco y sube de intensidad. Reportado con el visor puesto: «cuando se pulsa el
 * botón, el botón debería de seguir ahí (reaccionar bien, como hundiéndose, cambiando de
 * color y eso bien, pero no desapareciendo)».
 */
const PRESSED_COLOR = '#ffffff'

/** Lo que encoge un botón apretado, desde el 1,08 que crece al apuntarlo. */
const PRESSED_SCALE = 0.98
/** El claro con el que se pintan los iconos sobre placa oscura. */
const ICONO_COLOR = '#e2e8f0'

/**
 * Ventana, en milisegundos, durante la que se ignora una segunda pulsación.
 * Los dos mandos pueden cruzarse sobre el mismo botón, y un agarre suele
 * registrar el puntero de rayo y el de contacto casi a la vez.
 */
const DEBOUNCE_MS = 300

/**
 * Botón 3D.
 *
 * Acepta cualquier puntero —el rayo del mando, la mano o el ratón—, al revés
 * que los palos, que solo se dejan coger con la mano: un menú que hubiera que
 * tocar físicamente sería incómodo de manejar.
 *
 * Dos decisiones que vienen de probarlo en el visor:
 *
 * - **Se resuelve al pulsar, no al soltar.** `onClick` exige pulsar y soltar
 *   sobre el mismo objeto; apuntando a pulso a un metro de distancia, el rayo
 *   se sale del botón entre una cosa y la otra y la pulsación se pierde. Es el
 *   mismo motivo por el que `Stick` escucha `onPointerDown`.
 * - **El foco se ve.** Sin modelo de mando el jugador no tenía forma de saber
 *   a qué apuntaba. Ahora el botón apuntado crece *y* se enciende con un halo:
 *   forma y color, nunca solo color.
 * - **La pulsación se nota.** Apuntando desde lejos la mano no toca nada, así
 *   que el mando da un toque corto al activarse el botón (`PRESS_PULSE`). Es la
 *   única confirmación que no depende de mirar el sitio donde ha cambiado algo.
 *
 * La zona sensible es una caja invisible más grande que el dibujo del botón:
 * apuntando en el aire, un objetivo del tamaño exacto del icono se falla
 * constantemente. Que sea invisible no la excluye del raycasting —los punteros
 * de @pmndrs/pointer-events no miran `visible`, solo si hay listeners.
 */
export function XRPressable({
  position,
  rotation,
  onSelect,
  children,
  hitSize,
  disabled = false,
}: {
  position: [number, number, number]
  /**
   * Giro del botón entero. Los botones apartados a un lado tienen que encarar
   * al jugador, y el giro va aquí y no en el dibujo para que la placa, el
   * icono, el halo de foco y la zona sensible se muevan juntos: girar solo la
   * placa deja el icono cruzado con ella y medio dibujo se pierde dentro.
   */
  rotation?: [number, number, number]
  onSelect: () => void
  children: ReactNode
  hitSize: [number, number, number]
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const lastFired = useRef(0)

  const handle = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    setPressed(true)
    event.stopPropagation()
    if (disabled) return

    const now =
      typeof performance !== 'undefined' ? performance.now() : lastFired.current
    if (now - lastFired.current < DEBOUNCE_MS) return
    lastFired.current = now

    // El toque va antes de la acción y no después: hay botones que cierran la
    // sesión o cambian la escena entera, y con la sesión ya terminada el mando
    // no vibra. `pulseHaptics` nunca lanza, así que adelantarlo no puede
    // llevarse por delante la pulsación. Solo cuando el botón se activa de
    // verdad: uno apagado o una pulsación repetida no confirman nada.
    pulseHaptics(event, PRESS_PULSE)
    onSelect()
  }

  const active = hovered && !disabled
  const [hitWidth, hitHeight] = hitSize

  return (
    <group
      position={position}
      rotation={rotation}
      scale={pressed ? PRESSED_SCALE : active ? 1.08 : 1}
      onPointerDown={handle}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (!disabled) setHovered(true)
      }}
      onPointerUp={() => setPressed(false)}
      onPointerOut={() => {
        setHovered(false)
        setPressed(false)
      }}
    >
      {children}

      {/* Halo de foco: por detrás del dibujo, para enmarcarlo sin taparlo.
          **Sin escribir profundidad y con su sitio en el orden.** Un plano transparente
          de un panel sí apunta su profundidad salvo que se le diga que no, y a
          milímetros de sus vecinos la ordenación por profundidad se da la vuelta en
          cuanto se inclina la cabeza hacia un botón del borde: entonces el halo se
          pintaba antes que el fondo del panel y lo borraba, y el botón se veía como un
          agujero a la escena. El porqué entero, en `buttonHighlight.tsx`.
          Apretado se enciende más y cambia de color: es lo único que dice, desde
          dentro, que el botón ha oído. */}
      <mesh position={[0, 0, -0.014]} visible={active || pressed} renderOrder={PANEL_ORDER.behind}>
        <planeGeometry args={[hitWidth * 0.98, hitHeight * 0.94]} />
        <meshBasicMaterial
          color={pressed ? PRESSED_COLOR : HOVER_COLOR}
          transparent
          depthWrite={false}
          opacity={pressed ? 0.55 : 0.34}
          toneMapped={false}
        />
      </mesh>

      <mesh visible={false}>
        <boxGeometry args={hitSize} />
      </mesh>
    </group>
  )
}

/**
 * Firma común de los iconos. `size` es la medida característica del dibujo en
 * metros —radio en los que salen de una primitiva, semilado en las siluetas—,
 * y cada icono trae la suya, elegida para pesar lo mismo dentro de su botón.
 */
type IconProps = {
  position?: [number, number, number]
  size?: number
  color?: string
}

/**
 * Semilado de las siluetas, en metros: unos cinco centímetros y medio de icono.
 * Uno solo para todas, porque comparten cuadro y así no se descuadran entre
 * ellas; con menos, la casa quedaba visiblemente más pequeña que el aro de
 * repetir en la misma fila de botones.
 */
const ICON_SIZE = 0.028

/** Grosor de los triángulos, en metros: son placas, no cuñas. */
const TRIANGLE_THICKNESS = 0.01

/**
 * Triángulo lleno, de frente al jugador y con la punta hacia donde se pida.
 *
 * El giro y el recentrado salen de `@/lib/xrIcons`, donde se comprueban sin
 * navegador: acertar el giro es todo lo que hay que hacer bien aquí —una
 * composición equivocada deja el prisma de canto y el símbolo desaparece— y a
 * ojo no se distingue de la buena hasta que uno se pone las gafas.
 */
function XRTriangleIcon({
  tip,
  position = [0, 0, 0],
  size = ICON_SIZE,
  color = '#ffffff',
}: IconProps & { tip: TriangleTip }) {
  const [x, y, z] = position
  const [cx, cy] = XR_TRIANGLE_CENTER[tip]

  return (
    <mesh
      position={[x - cx * size, y - cy * size, z]}
      rotation={XR_TRIANGLE_ROTATION[tip]}
    >
      <cylinderGeometry args={[size, size, TRIANGLE_THICKNESS, 3]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/**
 * Triángulo de «reproducir»: el símbolo de empezar, sin idioma.
 *
 * `size` es el radio del prisma, así que el dibujo sale algo más alto que ancho
 * (1,7 × 1,5 veces esa medida). Con los 0,05 de cuando se veía de canto, el
 * triángulo ocuparía ahora casi toda la placa del botón.
 */
export function XRPlayIcon({ size = 0.032, ...props }: IconProps) {
  return <XRTriangleIcon tip="right" size={size} {...props} />
}

/**
 * Dos triángulos y un tope: saltarse lo que se está viendo e ir al final. Es el
 * mismo símbolo que cualquier reproductor, así que no hace falta explicarlo.
 */
export function XRSkipIcon({
  position = [0, 0, 0],
  size = 0.017,
  color = '#ffffff',
}: IconProps) {
  const [x, y, z] = position

  return (
    // Recolocado a la izquierda: los dos triángulos y el tope ocupan de −1,55 a
    // 1,95 veces `size`, así que sin esto el dibujo quedaría descentrado en su
    // placa frente a los iconos de una sola pieza.
    <group position={[x - size * 0.2, y, z]}>
      <XRPlayIcon position={[-size * 0.8, 0, 0]} size={size} color={color} />
      <XRPlayIcon position={[size * 0.7, 0, 0]} size={size} color={color} />
      <mesh position={[size * 1.75, 0, 0]}>
        <boxGeometry args={[size * 0.4, size * 1.9, 0.008]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * Las barras de un nivel: tantas como su puesto en la escala y cada una más
 * alta que la anterior, en el color que ese nivel tiene en todo el juego.
 *
 * Crecen desde `y = 0` hacia arriba, así que quien la coloca decide desde dónde.
 * La comparten el selector del menú y el tutorial: el nivel tiene que verse
 * igual donde se elige y donde se recuerda, o serían dos cosas distintas.
 */
export function XRDifficultyBars({
  difficulty,
  lit,
  position = [0, 0, 0],
  scale = 1,
}: {
  difficulty: Difficulty
  /** Encendidas (nivel elegido) o apagadas en el color del nivel. */
  lit: boolean
  position?: [number, number, number]
  scale?: number
}) {
  const index = DIFFICULTY_ORDER.indexOf(difficulty)
  const color = DIFFICULTY_COLORS[difficulty]

  return (
    <group position={position} scale={scale}>
      {Array.from({ length: index + 1 }, (_, bar) => {
        const height = 0.028 + bar * 0.017
        return (
          <mesh
            key={bar}
            position={[(bar - index / 2) * 0.022, height / 2, 0.004]}
          >
            <boxGeometry args={[0.013, height, 0.008]} />
            <meshStandardMaterial
              color={lit ? '#ffffff' : color}
              emissive={lit ? '#ffffff' : color}
              emissiveIntensity={lit ? 0.7 : 0.25}
              toneMapped={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * Triángulo apuntando arriba o abajo: subir o bajar el aro. Hacia dónde cae la
 * punta es lo único que distingue un botón del otro.
 */
export function XRArrowIcon({
  size = 0.026,
  up,
  ...props
}: IconProps & { up: boolean }) {
  return <XRTriangleIcon tip={up ? 'up' : 'down'} size={size} {...props} />
}

/**
 * Icono dibujado a partir de una silueta de `@/lib/xrIcons`.
 *
 * Apilar primitivas (un prisma triangular junto a una caja) no funcionó en el
 * visor: a un metro de distancia dos piezas próximas se ven como dos objetos y
 * no como una figura. Una silueta cerrada se lee de un vistazo.
 *
 * `size` es la mitad del lado del icono, porque las siluetas vienen
 * normalizadas al cuadro [-1, 1].
 */
function XRShapeIcon({
  icon,
  position = [0, 0, 0],
  size = ICON_SIZE,
  color = '#ffffff',
}: IconProps & { icon: IconShape }) {
  const shapes = useMemo(
    () =>
      icon.map(({ outline, holes }) => {
        const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)))
        for (const hole of holes ?? []) {
          shape.holes.push(new Path(hole.map(([x, y]) => new Vector2(x, y))))
        }
        return shape
      }),
    [icon],
  )

  return (
    <mesh position={position} scale={size}>
      <shapeGeometry args={[shapes]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** Casa: volver al menú del juego, sin salir de la sesión. */
export function XRHomeIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_HOME_ICON} {...props} />
}

/** La flecha de salir, como forma plana: la misma que se pinta en los lienzos. */
const FORMA_DE_SALIR = (() => {
  const { punta, cuerpo, grosor, codo, alas } = FLECHA_DE_SALIR
  const forma = new Shape()
  forma.moveTo(punta, 0)
  forma.lineTo(codo, alas)
  forma.lineTo(codo, grosor / 2)
  forma.lineTo(cuerpo, grosor / 2)
  forma.lineTo(cuerpo, -grosor / 2)
  forma.lineTo(codo, -grosor / 2)
  forma.lineTo(codo, -alas)
  forma.closePath()
  return forma
})()

/**
 * La flecha de **salir del juego**: volver al arcade.
 *
 * **Una sola forma para los trece.** Cada juego decía «salir» a su manera —la palabra
 * «Exit», un aspa, una puerta, una puerta con flecha— y el aspa, además, significa «cerrar
 * esto» en varios paneles. Reportado con el visor puesto: «no se entiende cuál es el botón de
 * salir del juego: a veces aparece un cuadrado, otras veces pone "leave"… habría que
 * unificarlo». La forma sale de `FLECHA_DE_SALIR`, la misma que pintan en su lienzo los
 * juegos que dibujan el menú con texto.
 */
export function XRSalirIcon({
  size = 0.05,
  color = ICONO_COLOR,
}: {
  size?: number
  color?: string
}) {
  return (
    <mesh scale={size} raycast={NO_RAYCAST}>
      <shapeGeometry args={[FORMA_DE_SALIR]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** Altavoz con ondas: el juego suena. */
export function XRSoundIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_SOUND_ICON} {...props} />
}

/** Corazón: una vida, en el selector de modo y en el marcador. */
export function XRHeartIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_HEART_ICON} {...props} />
}

/** Avión de papel: compartir el resultado de la partida. */
export function XRShareIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_SHARE_ICON} {...props} />
}

/** Estrella de nivel. */
export function XRStarIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_STAR_ICON} {...props} />
}

/** Color de la estrella ganada y de la que falta. */
export const XR_STAR_COLOR = '#fbbf24'
export const XR_STAR_SPENT_COLOR = '#3f4a5a'

/**
 * Tres estrellas en fila, llenas las ganadas. Las que faltan se apagan y
 * encogen: el estado se distingue por tamaño y no solo por color.
 */
export function XRStarsRow({
  stars,
  position = [0, 0, 0],
  size = 0.016,
  spacing = 0.045,
}: {
  stars: number
  position?: [number, number, number]
  size?: number
  spacing?: number
}) {
  return (
    <group position={position}>
      {Array.from({ length: 3 }, (_, index) => {
        const earned = index < stars
        return (
          <XRStarIcon
            key={index}
            position={[(index - 1) * spacing, 0, 0]}
            size={earned ? size : size * 0.7}
            color={earned ? XR_STAR_COLOR : XR_STAR_SPENT_COLOR}
          />
        )
      })}
    </group>
  )
}
/** Marca de verificación: el resultado salió del visor. */
export function XRCheckIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_CHECK_ICON} {...props} />
}

/** Aspa: no se pudo. */
export function XRCrossIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_CROSS_ICON} {...props} />
}

/** Altavoz con un aspa: el juego está en silencio. */
export function XRMutedIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_MUTED_ICON} {...props} />
}

/** Nota musical: la música de fondo suena. */
export function XRMusicIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_MUSIC_ICON} {...props} />
}

/** Nota musical con un aspa: la música está apagada. */
export function XRMusicOffIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_MUSIC_OFF_ICON} {...props} />
}

/**
 * Dos montañas y una luna: el escenario del juego.
 *
 * Las montañas usan el giro `up` de la tabla de triángulos, no uno propio: el que tenían
 * dejaba la cara de frente pero con el vértice abajo, así que se veían dos cuñas invertidas
 * y una luna en vez de un paisaje. Esa tabla está comprobada contra la geometría real de
 * three, que es lo único que distingue «apunta arriba» de «apunta abajo» sin gafas puestas.
 *
 * Lo que NO se reutiliza es `XR_TRIANGLE_CENTER`: sirve para centrar un icono en su placa, y
 * aquí lo que tiene que coincidir es el SUELO de las dos montañas. Alinearlas por su centro
 * las dejaría flotando a alturas distintas, que es medio paisaje.
 */
export function XRSceneIcon({
  position = [0, 0, 0],
  size = 0.04,
  color = '#ffffff',
}: IconProps) {
  return (
    <group position={position}>
      {sceneMountains(size).map(({ radio, x, y }, index) => (
        <mesh
          key={index}
          position={[x, y, 0]}
          rotation={XR_TRIANGLE_ROTATION.up}
        >
          <cylinderGeometry args={[radio, radio, TRIANGLE_THICKNESS, 3]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[size * 0.75, size * 0.85, 0]}>
        <circleGeometry args={[size * 0.2, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Un marco vacío: la habitación de verdad, sin decorado encima. */
export function XRPassthroughIcon({
  position = [0, 0, 0],
  size = 0.04,
  color = '#ffffff',
}: IconProps) {
  const thickness = size * 0.16

  return (
    <group position={position}>
      {/* Cuatro barras que dejan el centro despejado. */}
      {[
        [0, size * 0.9, size * 2, thickness],
        [0, -size * 0.9, size * 2, thickness],
        [-size, 0, thickness, size * 1.8],
        [size, 0, thickness, size * 1.8],
      ].map(([x, y, width, height], index) => (
        <mesh key={index} position={[x, y, 0]}>
          <boxGeometry args={[width, height, 0.008]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Dos flechas girando: repetir partida. Un anillo abierto con su punta. */
export function XRRepeatIcon({
  position = [0, 0, 0],
  size = 0.04,
  color = '#ffffff',
}: IconProps) {
  return (
    <group position={position}>
      <mesh>
        <torusGeometry args={[size, size * 0.22, 8, 20, Math.PI * 1.45]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[size, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[size * 0.42, size * 0.42, 0.01, 3]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Una ficha del icono de jugadores: su color y lo que crece. */
export interface Chip {
  color: string
  /** Lo que crece la ficha: la de quien tiene el mando va más grande. */
  scale?: number
}

/**
 * Quién juega: una ficha de este lado de la mesa, y otra enfrente si hay alguien más.
 *
 * Es el icono de contra quién de los hermanos (`XRPlayersIcon` de tower-tumble): la mesa entre las
 * dos fichas y la de enfrente arriba, que es donde está quien juega contra ti. En el menú dice
 * **cuántos juegan**: una ficha o dos; en el marcador, **de quién es la tanda**: la misma pareja,
 * con la de quien tiene el mando encendida y crecida —color y tamaño a la vez, para que el color no
 * sea la única señal (WCAG 1.4.1)—.
 */
export function XRPlayersIcon({
  size,
  table,
  near,
  far,
  position,
}: {
  /** Medida de una ficha, en metros. */
  size: number
  /** Color de la línea que hace de mesa entre las dos. */
  table: string
  /** La ficha de este lado: el jugador 1. */
  near: Chip
  /** La de enfrente, el jugador 2, o `null` cuando se juega solo. */
  far: Chip | null
  position?: [number, number, number]
}) {
  const gap = size * 1.6

  return (
    <group position={position}>
      {/* La mesa entre las dos: sin ella, dos cuadrados sueltos no se leen como dos personas
          enfrentadas. */}
      <mesh>
        <boxGeometry args={[size * 2.6, size * 0.3, 0.005]} />
        <meshStandardMaterial color={table} emissive={table} emissiveIntensity={0.3} />
      </mesh>
      {[
        { chip: near, y: -gap },
        { chip: far, y: gap },
      ].map(({ chip, y }) =>
        chip == null ? null : (
          <mesh key={y} position={[0, y, 0.002]} scale={[chip.scale ?? 1, chip.scale ?? 1, 1]}>
            <boxGeometry args={[size * 1.2, size * 1.2, 0.006]} />
            <meshStandardMaterial color={chip.color} emissive={chip.color} emissiveIntensity={0.4} />
          </mesh>
        ),
      )}
    </group>
  )
}
