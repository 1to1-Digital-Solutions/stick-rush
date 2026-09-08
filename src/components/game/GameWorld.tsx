'use client'

import { Suspense } from 'react'
import { Environment } from '@react-three/drei'
import { useXR } from '@react-three/xr'
import { assetUrl } from '../../lib/assets'
import {
  BACKDROP_COLOR,
  HDRI_PATH,
  MACHINE_HEIGHT,
  MACHINE_RADIUS,
  PLAYER_OFFSET_Z,
} from '../../lib/gameConfig'
import { useGame, type SceneryMode } from '../../lib/gameStore'
import { XRCountdown } from '../xr/XRCountdown'
import { XRGazeAnchor } from '../xr/XRGazeAnchor'
import { XRHaptics } from '../xr/XRHaptics'
import { XRHud, XRQuitButton } from '../xr/XRHud'
import { XRMenu } from '../xr/XRMenu'
import { XRPlayerHeight } from '../xr/XRPlayerHeight'
import { XRSessionController } from '../xr/XRSessionController'
import { XRTutorial } from '../xr/XRTutorial'
import { Fairground } from './Fairground'
import { SceneryFade } from './SceneryFade'
import { StickMachine } from './StickMachine'
import { Ground } from './Ground'
import { useGameMusic } from './useGameMusic'
import { useGameSound } from './useGameSound'

/**
 * El juego entero como OBJETOS DE THREE, sin Canvas y sin sesión propia.
 *
 * Es lo que se monta dentro del Canvas de quien lo hospeda —su propia web o el
 * salón de xrcade— y por eso aquí no hay `<Canvas>`, ni `<XR>`, ni `<XROrigin>`:
 * WebXR da una sesión por documento y esa sesión va atada al Canvas que la
 * abrió, así que quien es dueño del Canvas es dueño de la sesión. Si la abriera
 * el juego, volver al salón la cerraría, y volver a un salón que es una página
 * 2D significa quitarse el visor.
 *
 * Nada de DOM puede entrar aquí: dentro de un Canvas solo caben objetos de
 * three. El menú y el marcador en 2D se quedan en la web del juego; dentro del
 * visor sus equivalentes son `<XRMenu>` y `<XRHud>`, que sí son geometría.
 */

/**
 * Escenario: recinto de feria, fondo, suelo e iluminación de entorno.
 *
 * El HDRI (una plaza de pueblo de noche, CC0, servido desde `public/`) envuelve
 * la escena, se proyecta sobre el suelo y le da la luz cálida de las farolas.
 * Delante de esa foto está el recinto de verdad —casetas, guirnaldas y noria,
 * ver `<Fairground>`—, que es lo que da volumen: una foto de fondo no cambia al
 * mover la cabeza, y en el visor eso se nota enseguida.
 *
 * En AR no se dibuja ni recinto, ni fondo, ni suelo: el escenario es la
 * habitación del jugador y taparla rompería el passthrough. El HDRI sí se
 * mantiene, pero solo como fuente de reflejos (`background={false}`): sin él la
 * máquina se vería plana y apagada sobre la sala real.
 */
function SceneBackdrop({ scenery }: { scenery: SceneryMode }) {
  const mode = useXR((state) => state.mode)
  // Solo se quita el escenario cuando la sesión concedida es de verdad de
  // realidad mixta. Fuera de sesión inmersiva no hay passthrough que revelar,
  // y dentro de una `immersive-vr` tampoco: detrás no hay habitación, solo
  // negro. Con la preferencia recordada entre visitas, quien la dejó en
  // passthrough podría abrir la siguiente sesión en VR —un visor sin
  // passthrough, o uno que no conceda AR— y encontrarse mirando la nada sin
  // saber por qué. La decisión se toma aquí, que es el único sitio que sabe
  // qué tipo de sesión hay, y no en el botón que la eligió.
  const isAR = mode === 'immersive-ar' && scenery === 'passthrough'

  return (
    <>
      {!isAR && (
        <>
          {/* Solo se ve mientras carga el HDRI; luego lo sustituye el fondo. */}
          <color attach="background" args={[BACKDROP_COLOR]} />
          <Ground />
          <Fairground />
        </>
      )}

      {/* Suspense propio: mientras se carga el HDRI el resto de la escena ya se
          ve, en vez de quedarse todo el Canvas en blanco esperándolo. */}
      <Suspense fallback={null}>
        <Environment
          files={assetUrl(HDRI_PATH)}
          background={!isAR}
          environmentIntensity={1.4}
          // Proyecta el HDRI también sobre el suelo, de modo que la máquina se
          // planta en el empedrado de la plaza en vez de sobre un plano de
          // color con un corte visible contra el horizonte de la foto.
          ground={isAR ? undefined : { height: 1.6, radius: 14, scale: 45 }}
        />
      </Suspense>
    </>
  )
}

/** Enchufa el escenario a lo que el jugador elige en el menú inmersivo. */
function SceneryFadeBridge() {
  const { scenery } = useGame()

  return (
    <SceneryFade mode={scenery}>
      {(applied) => <SceneBackdrop scenery={applied} />}
    </SceneryFade>
  )
}

/**
 * Puente entre el estado del juego y el sonido.
 *
 * Es un hook y no pinta nada, así que da igual estar dentro del Canvas: el
 * sonido acompaña a la partida, no a la escena. Necesita un componente propio
 * porque los hooks no se pueden llamar sueltos.
 */
function GameSound() {
  useGameSound()
  // Y la música de fondo, por lo mismo y en el mismo sitio.
  useGameMusic()
  return null
}

export interface GameWorldProps {
  /**
   * Quien monta la escena pone además interfaz en DOM alrededor. Montado en el
   * salón de xrcade no hay nada de eso —el hub no pone DOM—, así que la
   * interfaz de dentro de la escena es la única que hay y tiene que colocarse y
   * verse aunque no haya visor. Sin esto, el juego se veía en el hub y no había
   * forma de empezar la partida.
   */
  hasDomUi?: boolean
}

export function GameWorld({ hasDomUi = false }: GameWorldProps) {
  return (
    <>
      {/* Arranca/cierra partidas según el estado de la sesión inmersiva. */}
      <XRSessionController />
      {/* Pone el aro al alcance de quien lleva el visor. */}
      <XRPlayerHeight />
      {/* Avisa por los mandos del palo que se ha escapado. */}
      <XRHaptics />
      <GameSound />

      {/* La interfaz inmersiva NO cuelga del origen del jugador, sino de
          `<XRGazeAnchor always={!hasDomUi}>`, que la planta delante de su cara: el -Z del origen lo
          fija la calibración de la sala, así que entrar mirando a otro lado
          dejaba el menú a la espalda, invisible e imposible de apuntar.
          Va fuera del grupo del mundo a propósito: acompaña al jugador, no al
          decorado. */}
      <XRGazeAnchor always={!hasDomUi}>
        <XRHud hasDomUi={hasDomUi} />
        <XRMenu hasDomUi={hasDomUi} />
        <XRTutorial />
        <XRCountdown hasDomUi={hasDomUi} />
        <XRQuitButton hasDomUi={hasDomUi} />
      </XRGazeAnchor>

      {/* EL MUNDO, corrido para dejar al jugador donde le toca.
          La escena está dibujada con la máquina en el origen y el jugador
          adelantado hacia el aro (`PLAYER_OFFSET_Z`). Antes eso se conseguía
          moviendo al jugador con `<XROrigin position={PLAYER_POSITION}>`, pero
          el origen es de quien monta —el salón planta ahí su arco de cabinas— y
          dos orígenes en la misma sesión se pisan. Se mueve el decorado la misma
          distancia en sentido contrario: la geometría que ve el jugador es
          idéntica y el origen se queda donde su dueño lo puso. */}
      <group position={[0, 0, -PLAYER_OFFSET_Z]}>
        <ambientLight intensity={0.35} />
        {/* Foco cálido sobre la máquina, como el de una caseta de feria de noche. */}
        <pointLight
          position={[0, MACHINE_HEIGHT + 1, -MACHINE_RADIUS * 0.4]}
          intensity={16}
          color="#ffd479"
          distance={10}
          castShadow
        />
        {/* Relleno frío por detrás, para despegar la máquina del fondo oscuro. */}
        <directionalLight position={[2.5, 4, 3]} intensity={0.35} color="#9fb6d6" />

        {/* Las texturas de la madera se cargan aquí dentro; con su propio
            Suspense la máquina aparece en cuanto están, sin bloquear el resto. */}
        <Suspense fallback={null}>
          <StickMachine />
        </Suspense>

        {/* El decorado cambia con la cortina cerrada, para que el salto entre
            la plaza y la habitación del jugador no se vea. */}
        <SceneryFadeBridge />
      </group>
    </>
  )
}
