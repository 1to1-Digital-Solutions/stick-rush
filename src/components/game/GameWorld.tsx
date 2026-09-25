'use client'

import { useEffect, useState, Suspense, type ReactNode } from 'react'
import { contarMontaje } from '../../lib/montajes'
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
import { showsPlace } from '../../lib/ajustes'
import { entryPlacement, type HostAnchor } from '../../lib/hostAnchor'
import { useGame, type SceneryMode } from '../../lib/gameStore'
import { DECOR_POINTER_EVENTS, MENU_POINTER_ORDER } from '../../lib/punteros'
import { sceneryOf } from '../../lib/sceneryPreference'
import { ManosDelJugador } from '../xr/ManosDelJugador'
import { XRCountdown } from '../xr/XRCountdown'
import { XRGazeAnchor } from '../xr/XRGazeAnchor'
import { XRHud, XRQuitButton, XRQuitConfirm } from '../xr/XRHud'
import { XRMenu } from '../xr/XRMenu'
import { XRPlayerHeight } from '../xr/XRPlayerHeight'
import { XRSessionController } from '../xr/XRSessionController'
import { XRTutorial } from '../xr/XRTutorial'
import { Calentar } from './Calentar'
import { Backdrop } from './Backdrop'
import { Fairground } from './Fairground'
import { SceneryFade } from './SceneryFade'
import { StickMachine } from './StickMachine'
import { Ground } from './Ground'
import { useGameMusic } from './useGameMusic'
import { useGameSound } from './useGameSound'
import { XRWorldHeight } from '../xr/XRWorldHeight'

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
 * Delante de esa foto está el recinto de verdad —puestos, guirnaldas y noria,
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
  // Qué se ve lo dice el escenario del arcade (`xrcade:scenery`), con la regla
  // que siguen el salón y los demás juegos (`showsPlace`): el salón entra
  // siempre en realidad aumentada si el visor la tiene, así que el tipo de
  // sesión no dice qué se eligió. Solo hace de guarda: fuera de sesión
  // inmersiva no hay passthrough que revelar, y dentro de una `immersive-vr`
  // tampoco —detrás no hay habitación, solo negro—. Con la preferencia
  // recordada entre visitas, quien la dejó en passthrough podría abrir la
  // siguiente sesión en VR y encontrarse mirando la nada sin saber por qué.
  const isAR = !showsPlace(mode, sceneryOf(scenery))

  // Lo que solo es de la plaza se **oculta** en tu habitación, no se desmonta.
  // Desmontar libera los materiales, y los shaders que solo usaban ellos se
  // vuelven a compilar al volver: un tirón a cada cambio de escenario, con el
  // visor puesto. Oculto no se pinta ni da sombra, y se le niegan los punteros,
  // que no miran si algo se ve.
  const soloEnLaPlaza = { visible: !isAR, pointerEvents: isAR ? ('none' as const) : undefined }

  return (
    <>
      {/* Solo se ve mientras carga el HDRI; luego lo sustituye el fondo.
          Con `<color attach="background">` no se veía nunca: ese atajo adjunta
          el color a **su padre**, y aquí el padre es un grupo, donde
          `background` no significa nada —no falla, no avisa, simplemente no
          hace nada—. Así que mientras el HDRI bajaba, lo que había arriba era
          el negro del compositor. Este sí se monta y se desmonta: es el color
          con el que se limpia la imagen, no un material, y no compila nada. */}
      {!isAR && <Backdrop color={BACKDROP_COLOR} />}
      <group {...soloEnLaPlaza}>
        <Ground />
        <Fairground />
      </group>

      {/* Suspense propio: mientras se carga el HDRI el resto de la escena ya se
          ve, en vez de quedarse todo el Canvas en blanco esperándolo. */}
      <Suspense fallback={null}>
        {/* El suelo proyectado va siempre montado y dentro de un grupo que se
            oculta, porque drei monta un componente distinto con suelo y sin él:
            cambiar entre los dos tiraba la malla del suelo —y su shader— y
            liberaba la textura del HDRI, que había que volver a subir. El
            entorno de reflejos se queda puesto en los dos escenarios. */}
        <group {...soloEnLaPlaza}>
          <Environment
            files={assetUrl(HDRI_PATH)}
            background={!isAR}
            environmentIntensity={1.4}
            // Proyecta el HDRI también sobre el suelo, de modo que la máquina se
            // planta en el empedrado de la plaza en vez de sobre un plano de
            // color con un corte visible contra el horizonte de la foto.
            ground={{ height: 1.6, radius: 14, scale: 45 }}
          />
        </group>
      </Suspense>
    </>
  )
}

/** El origen del anfitrión, para cuando no presta ningún anclaje: el mundo se queda ahí. */
const ORIGEN = { x: 0, z: 0 }

/**
 * Planta el mundo donde y con qué rumbo diga el anfitrión.
 *
 * **Aquí el decorado no se ancla a la mirada**, a diferencia de los otros doce: la máquina
 * se queda donde el anfitrión ponga el origen, corrida hacia delante para dejar a quien
 * juega a su distancia. Dentro del salón eso se notaba: el arco de cabinas está plantado a
 * los pies de quien entró y girado hacia donde miraba, y la máquina aparecía en el −Z de la
 * calibración de la sala, o sea donde cayera. Con el anclaje prestado sale justo donde
 * estaba el arco.
 *
 * **Se planta una vez y se queda.** Un decorado que se recoloca mientras se juega es lo que
 * hace imposible apuntar. Lo único que lo suelta es recentrar la sala: entonces el espacio
 * de referencia se mueve entero, lo prestado apunta a donde ya no hay nada, y el mundo
 * vuelve al origen del anfitrión, que es lo que hacía antes de esto.
 */
function HostAnchored({ anchor, children }: { anchor?: HostAnchor; children: ReactNode }) {
  const [lent, setLent] = useState(anchor ?? null)
  const referenceSpace = useXR((state) => state.originReferenceSpace)

  useEffect(() => {
    if (referenceSpace == null) return
    const alRecentrar = () => setLent(null)
    referenceSpace.addEventListener('reset', alRecentrar)
    return () => referenceSpace.removeEventListener('reset', alRecentrar)
  }, [referenceSpace])

  // Sin nada prestado sale el origen y el grupo es la identidad, que es lo de siempre.
  const sitio = entryPlacement(lent, ORIGEN, 0)

  return (
    // La altura no se hereda: el anfitrión solo sabe del suelo (ver `lib/hostAnchor.ts`).
    <group name="world-anchor" position={[sitio.x, 0, sitio.z]} rotation={[0, sitio.yaw, 0]}>
      {children}
    </group>
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
  /**
   * Dónde y con qué rumbo plantar el mundo, si quien monta la escena lo sabe: el
   * salón de xrcade presta el anclaje con el que tiene plantado su arco de cabinas.
   * Sin él, el mundo se queda en el origen que ponga el anfitrión.
   */
  anchor?: HostAnchor
}

export function GameWorld({ hasDomUi = false, anchor }: GameWorldProps) {
  // Cuántas veces se monta el mundo, cuando alguien lo está contando (`lib/montajes.ts`).
  // Montarlo dos veces al entrar en la sesión **es** el parpadeo que se reporta del visor.
  useEffect(() => {
    contarMontaje('mundo')
  }, [])

  // TODO EL MUNDO cuelga de `XRWorldHeight`, que lo baja hasta quien juega si
  // lo ha pedido en los ajustes del arcade. Envuelve la escena entera, luces
  // incluidas: mover solo el objetivo lo dejaría flotando sobre su decorado.
  return (
    <XRWorldHeight>
      {/* Arranca/cierra partidas según el estado de la sesión inmersiva. */}
      <XRSessionController />
      {/* Pone el aro al alcance de quien lleva el visor. */}
      <XRPlayerHeight />
      <GameSound />
      {/* Las manos: el guante con mandos, la mano articulada sin ellos. Van aquí y no en el
          store porque el store es de quien monta, y el del salón no dibuja manos. */}
      <ManosDelJugador />

      {/* La interfaz inmersiva NO cuelga del origen del jugador, sino de
          `<XRGazeAnchor always={!hasDomUi}>`, que la planta delante de su cara: el -Z del origen lo
          fija la calibración de la sala, así que entrar mirando a otro lado
          dejaba el menú a la espalda, invisible e imposible de apuntar.
          Va fuera del grupo del mundo a propósito: acompaña al jugador, no al
          decorado. */}
      {/* Y gana el rayo pase lo que pase por delante (`lib/punteros.ts`): la pregunta de
          salir sale en plena partida, con palos cayendo entre la mano y el botón, y ahí sí
          hay palos que se pueden coger. Es un orden, no una distancia. */}
      <XRGazeAnchor always={!hasDomUi} pointerEventsOrder={MENU_POINTER_ORDER}>
        <XRHud hasDomUi={hasDomUi} />
        <XRMenu hasDomUi={hasDomUi} />
        <XRTutorial />
        <XRCountdown hasDomUi={hasDomUi} />
        <XRQuitButton hasDomUi={hasDomUi} />
        <XRQuitConfirm />
      </XRGazeAnchor>

      {/* EL MUNDO, corrido para dejar al jugador donde le toca.
          La escena está dibujada con la máquina en el origen y el jugador
          un paso por detrás del centro del aro (`PLAYER_OFFSET_Z`). Antes eso se conseguía
          moviendo al jugador con `<XROrigin position={PLAYER_POSITION}>`, pero
          el origen es de quien monta —el salón planta ahí su arco de cabinas— y
          dos orígenes en la misma sesión se pisan. Se mueve el decorado la misma
          distancia en sentido contrario: la geometría que ve el jugador es
          idéntica y el origen se queda donde su dueño lo puso. */}
      <HostAnchored anchor={anchor}>
        {/* **El mundo no está para el rayo** (`lib/punteros.ts`): quien juega está DENTRO de
            la máquina, así que entre su mano y el menú hay siempre travesaños, palos y
            decorado. Nada de eso escucha nada, pero basta un anfitrión con un oyente por
            encima —el salón— para que todo lo que cuelgue de él cuente como tocado. Lo único
            que vuelve a encenderse es el palo que se puede coger, y lo dice él. */}
        <group position={[0, 0, -PLAYER_OFFSET_Z]} pointerEvents={DECOR_POINTER_EVENTS}>
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
      </HostAnchored>
      {/* Calienta los shaders de la escena, y va AQUÍ y no en el Canvas de la web del
          juego: el salón monta esto y no aquello, así que colgado de allí no se
          precalentaba nada justo donde se juega de verdad. */}
      <Calentar />
    </XRWorldHeight>
  )
}
