'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  type Difficulty,
  MAX_STICKS,
  MIN_STICKS,
} from './gameConfig'
import {
  CHALLENGE_SETUP,
  DEFAULT_GAME_MODE,
  type GameMode,
  type RunOutcome,
  remainingLives,
  runOutcome,
} from './gameMode'
import {
  getBestEndlessStreak,
  getBestPoints,
  getServerBestEndlessStreak,
  getServerBestPoints,
  saveBestEndlessStreak,
  saveBestPoints,
  subscribeBestEndlessStreak,
  subscribeBestPoints,
} from './highScore'
import {
  controllerHolder,
  createDuel,
  duelOver,
  duelWinner,
  juegaADos,
  mejorDelDuelo,
  recordTurn,
  type Duel,
  type Player,
  type PlayerCount,
} from './duel'
import { saveDuelResult, type DuelTally } from './duelTally'
import { useDuelTally } from './useDuelTally'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, type Stars } from './levels'
import {
  getServerStarsList,
  getServerUnlockedLevel,
  getStarsList,
  getUnlockedLevel,
  saveLevelResult,
  subscribeStarsList,
  subscribeUnlockedLevel,
} from './progress'
import { volumeFactor } from './settings'
import { setScenery as setArcadeScenery, useLang, useScenery, useVolumes } from './settingsClient'
import { llevaLaCuenta, partidaDelCartel } from './machineSign'
import {
  goalSign,
  medalToCelebrate,
  type GoalPhase,
  type Medal,
  type Goal,
  type GoalSignView,
} from './goal'
import { traductorSuave } from './textos'
import { exposeTestRun } from './testRun'
import {
  HOOP_ADJUST_STEP,
  clampHoopAdjustment,
  getHoopAdjustment,
  hoopHeightFor,
  saveHoopAdjustment,
} from './hoopHeight'
import {
  SIN_HAZANAS,
  conHazanas,
  contarAtrape,
  contarTanda,
  estrenarHazanas,
  type CuentaDeHazanas,
  type ResultadoConHazanas,
} from './feats'
import { forgetOwnScenery, sceneryModeOf, sceneryOf } from './sceneryPreference'
import { gameStorage } from './storage'
import { randomSeed, deriveSeed, type Challenge } from './seed'
import { stickPoints } from './scoring'
import {
  PLAZO_DEL_PASO,
  type TutorialStepKey,
  hitosAtrapando,
  markTutorialSeen,
  saltarPaso,
  tutorialSeen as leerTutorialVisto,
  tutorialStep as pasoDelTutorial,
} from './tutorial'
import { enCalentamiento } from './warmup'

export type GameState = 'menu' | 'countdown' | 'playing' | 'finished'

/**
 * Qué se ve alrededor de la máquina en una sesión inmersiva.
 *
 * - `scene`: el escenario del juego (la plaza de noche). Es el «modo VR».
 * - `passthrough`: la habitación real del jugador. Es el «modo AR».
 *
 * No son dos tipos de sesión de WebXR sino dos formas de pintar la misma:
 * cambiar de `immersive-vr` a `immersive-ar` obligaría a cerrar la sesión y
 * abrir otra, con su parpadeo y su permiso. Entrando siempre en `immersive-ar`
 * —cuando el visor la soporta— basta con dibujar el decorado o no para pasar de
 * uno a otro al instante.
 */
export type SceneryMode = 'scene' | 'passthrough'

/** Segundos de cuenta atrás entre pulsar "Jugar" y el primer palo. */
export const COUNTDOWN_SECONDS = 3

/**
 * El modo que se juega con el `reto` del salón: el del récord de la cabina
 * (`stick-rush:best-points:challenge`), con lo que ese modo fija (`CHALLENGE_SETUP`).
 */
const MODO_DEL_RETO: GameMode = 'challenge'

/**
 * Lo que el salón le pasa al store a través de la escena (ver `StickRushScene`).
 *
 * Todo opcional: sin nada, el juego arranca en el menú y sortea como en su propia web.
 */
export interface OpcionesDelSalon {
  /**
   * Jugar este reto: se entra **directamente** en una partida del desafío, sin lección, con los
   * palos que caen y su turno sacados de la semilla. Se lee al montar; otro reto es otro montaje.
   */
  reto?: Challenge
  /**
   * Se llama una vez al acabar cada partida con puntuación (no al dejarla a medias), con las
   * hazañas estrenadas en ella si hay alguna (`feats.ts`).
   */
  onFinish?: (resultado: ResultadoConHazanas) => void
  /**
   * Los listones de medalla del juego y la marca de quien juega, para el cartel de encima del
   * marcador (`objetivo.ts`). Sin él —el juego abierto suelto— el cartel dice la misión y el
   * récord guardado en este navegador.
   */
  objetivo?: Goal
}

export interface GameStore {
  /** Número de palos elegido (5–13). */
  stickCount: number
  /** Dificultad seleccionada. */
  difficulty: Difficulty
  /** Práctica, niveles o desafío (ver `gameMode.ts`). */
  gameMode: GameMode
  /**
   * Práctica sin fin: cuando se resuelve la tanda de palos la máquina vuelve a
   * cargar otra, hasta que el jugador termina. El récord es la mejor racha.
   */
  endless: boolean
  /**
   * Cuántos juegan: solo, o dos por turnos con el mismo mando. Solo cuenta en el desafío
   * (`juegaADos`), que es la misma partida para todos.
   */
  players: PlayerCount
  /**
   * La partida a dos en marcha, con la tanda recién acabada ya apuntada, o `null` si se juega
   * solo. Con ella, el final de una tanda es el aviso de pasar el mando o el de quién ha ganado.
   */
  duel: Duel | null
  /** Quién tiene el mando en la partida a dos, o `null` si se juega solo. */
  player: Player | null
  /** Las partidas a dos que lleva ganadas cada uno de la pareja que esté delante. */
  duelTally: DuelTally
  /**
   * Si el final suena a ganar encima del cierre: un récord batido, o el final de una partida a
   * dos, que siempre la gana alguien de los que están delante —o empatan— y se celebra.
   */
  celebra: boolean
  /** Nivel elegido en Niveles, o `null` = el más alto desbloqueado. */
  level: number | null
  /** El nivel que se juega: el elegido, o el más alto desbloqueado. */
  activeLevel: number
  /** Hasta qué nivel se puede jugar, recordado entre visitas. */
  unlockedLevel: number
  /** Estrellas de cada nivel, del primero al último. */
  levelStars: readonly Stars[]
  /** Cómo acabó el nivel jugado, solo con la partida terminada en Niveles. */
  levelResult: { stars: Stars; passed: boolean; unlocked: number | null } | null
  /** Velocidad a la que se juega: la elegida, o la del nivel en Niveles. */
  activeDifficulty: Difficulty
  /** Palos que cuelgan de la máquina en esta tanda: los elegidos, o los del nivel. */
  activeStickCount: number
  /**
   * Semilla del reparto de palos de la tanda en curso: sale de la de la partida y del número
   * de tanda (`semillaDe`), así que en la partida sin fin cada recarga trae palos nuevos y en
   * el reto todos los que lo juegan ven caer los mismos palos en el mismo orden.
   */
  stickSeed: number
  /**
   * Lo que se juega ahora es el `reto` que pasó el salón. Deja de serlo en cuanto se empieza
   * otra partida o se vuelve al menú.
   */
  enReto: boolean
  /**
   * La lección corre sobre el reto: **lo que pasa aún no cuenta** (`warmup.ts`). Los palos
   * perdidos no quitan vidas y la partida no se acaba; al cerrarse la lección el reto empieza de
   * cero.
   */
  calentando: boolean
  /** La lección se acaba de cerrar y aún no se ha resuelto el primer palo del reto: se avisa. */
  ahoraCuenta: boolean
  /** Tanda en curso de la partida sin fin, empezando en 0; siempre 0 si no. */
  wave: number
  /** Palos atrapados y resueltos de la TANDA en curso; en sin fin, no de la partida. */
  waveScore: number
  waveResolved: number
  /**
   * Vidas que quedan en la partida, o `null` en un modo que no se juega con
   * ellas. En el menú son las de salida: es lo que se pone en juego al empezar.
   */
  lives: number | null
  /**
   * Cómo ha acabado la partida, o `null` mientras sigue viva. Es lo que
   * distingue superar el reto de quedarse sin vidas en la pantalla de fin.
   */
  outcome: RunOutcome | null
  /**
   * Lo que dice el cartel del objetivo (`objetivo.ts`), ya traducido, o `null` si no hay nada que
   * colgar: en el menú, y fuera del reto con el juego abierto suelto.
   */
  cartel: GoalSignView | null
  /**
   * En qué momento va la partida que cuenta para medalla —antes de resolverse el primer palo,
   * jugando o acabada—, o `null` si lo que se juega no cuenta. Con ella el cartel ya dice los
   * puntos y las vidas, y el marcador de debajo los calla.
   */
  faseDelCartel: GoalPhase | null
  /** La medalla que ya es de quien juega en esta partida: cuando sube, se celebra el listón. */
  medalla: Medal | null
  /** Palos atrapados en la partida actual. */
  score: number
  /**
   * Palos ya resueltos (atrapados + perdidos) en la partida actual. Es estado
   * y no un contador interno porque el HUD 3D de XR lo pinta palo a palo.
   */
  resolved: number
  /** Puntos acumulados (ver `scoring.ts`). */
  points: number
  /** Palos seguidos atrapados sin fallar ninguno. */
  streak: number
  /** La mejor racha de la partida, para el resumen final. */
  bestStreak: number
  /**
   * Mejor puntuación conseguida **en el modo elegido**, guardada entre visitas
   * (ver `highScore.ts`). Durante una partida es la marca a batir: no incorpora
   * los puntos en curso hasta que la partida termina.
   */
  bestPoints: number
  /**
   * La partida recién terminada ha superado el récord anterior. Se apaga al
   * empezar la siguiente o al volver al menú.
   */
  isRecord: boolean
  /** Fase del juego. */
  gameState: GameState
  /**
   * Segundos que faltan para que se suelte el primer palo. Solo tiene sentido
   * en `countdown`; fuera de esa fase vale 0.
   */
  countdown: number
  /**
   * Identificador de partida. Se incrementa al iniciar una nueva para
   * forzar el remontaje de los sticks y reiniciar sus animaciones.
   */
  runId: number
  /** Escenario o passthrough en sesión inmersiva. */
  scenery: SceneryMode
  /**
   * Juego en silencio, porque los efectos están a cero en los ajustes del
   * arcade. Ya no es una preferencia del juego: se elige una vez en xrcade y
   * vale para los doce (ver `ajustes.ts`). Aquí se deja derivado porque media
   * escena pregunta «¿estoy mudo?» y no «¿a cuánto están los efectos?».
   */
  muted: boolean
  /** Volumen de los efectos, de 0 a 1, tal y como lo quiere la Web Audio API. */
  sfxVolume: number
  /** Música de fondo encendida: el ambiente de los ajustes, por encima de cero. */
  music: boolean
  /** Volumen del ambiente, de 0 a 1. */
  ambienceVolume: number
  /**
   * Altura del aro, en metros, ya acomodada a quien juega: sale de la altura
   * del visor más la corrección manual (ver `hoopHeight.ts`).
   */
  hoopHeight: number
  /** Corrección manual sobre esa altura, en metros. Se guarda entre visitas. */
  hoopAdjustment: number
  /**
   * Altura de ojos que ha medido el visor, o `null` cuando no hay sesión, aún
   * no ha dado tiempo a medir o su espacio de referencia no permite saberla. La
   * usa el aro y también la interfaz inmersiva, que cuelga de los ojos del
   * jugador y no del suelo (ver `xrUiRise` en `xrLayout.ts`).
   */
  playerEyeHeight: number | null
  /**
   * Si el tutorial del visor ya se vio en este navegador. Se guarda entre
   * visitas: es lo que hace que se enseñe una sola vez.
   */
  tutorialSeen: boolean
  /**
   * Si esta partida arrancó enseñando a jugar. Lo decide `startGame` y lo apaga
   * `finishTutorial`; la lección corre **con la partida en marcha**, así que no
   * es un estado del juego sino un acompañante suyo (ver `tutorial.ts`).
   *
   * Superados los pasos no se apaga: lo que retira el panel es quedarse sin
   * paso que enseñar, y es `tutorialStep` quien lo dice.
   */
  teaching: boolean
  /**
   * Qué paso del tutorial toca enseñar, o `null` si no hay lección o ya no
   * queda nada. Se **deduce** de los palos atrapados, así que avanza solo al
   * atrapar; el plazo de seguridad de cada paso también lo lleva el store, para
   * que la lección no dependa de que el Canvas pinte a tiempo.
   *
   * Lo leen los dos sitios que la enseñan: el panel del visor y su reflejo en
   * el overlay, que tienen que ir por el mismo paso.
   */
  tutorialStep: TutorialStepKey | null
  /** Da por pasado el paso de ahora. Lo llama el botón de siguiente. */
  nextTutorialStep: () => void
  /** Si hay una sesión inmersiva abierta, es decir, si se juega con gafas. */
  immersive: boolean
  /**
   * Si se está jugando con las manos desnudas, sin mandos (ver
   * `playingBareHanded`). Cambia **lo que hay que enseñar**, no lo que hay que
   * hacer: los palos se cogen igual, pero el gesto se llama de otra manera.
   *
   * Vive aquí, y no solo dentro del Canvas, porque lo necesitan los dos sitios
   * que enseñan la lección: el panel del visor y su reflejo en el overlay, que
   * es DOM y no alcanza el estado de la sesión. Lo pone al día
   * `XRSessionController`, que es quien ya mira lo que hay conectado.
   */
  bareHanded: boolean

  setScenery: (scenery: SceneryMode) => void
  setStickCount: (count: number) => void
  setDifficulty: (difficulty: Difficulty) => void
  /**
   * Elige modo. **Solo desde el menú**: con una partida en marcha, o con su
   * resumen en pantalla, no hace nada (ver el porqué en la implementación).
   */
  setGameMode: (mode: GameMode) => void
  setEndless: (endless: boolean) => void
  /** Solo, o a dos pasándose el mando. Se lee al empezar cada partida. */
  setPlayers: (players: PlayerCount) => void
  /** Elige nivel entre los desbloqueados; lo que no lo está se recorta. */
  setLevel: (level: number) => void
  /** Termina la partida sin fin a voluntad: es su única salida con resumen. */
  endRun: () => void
  /**
   * Sube (pasos positivos) o baja (negativos) el aro. Cada paso son
   * `HOOP_ADJUST_STEP` metros y el recorrido está acotado, así que el aro no
   * puede acabar fuera del alcance ni dentro del suelo.
   */
  adjustHoop: (steps: number) => void
  /**
   * Altura de ojos que mide el visor, o `null` cuando no hay sesión o su
   * espacio de referencia no permite saberla.
   */
  setPlayerEyeHeight: (height: number | null) => void
  /** Apunta si se está jugando dentro del visor. Lo lleva al día la sesión. */
  setImmersive: (immersive: boolean) => void
  /** Apunta si se juega con las manos desnudas. Lo lleva al día la sesión. */
  setBareHanded: (bareHanded: boolean) => void
  /**
   * Lo que se está preguntando ahora mismo, o `null` si no se pregunta nada.
   *
   * Dejar la partida a medias **pierde lo que se lleve hecho**, y el botón se pulsa sin
   * querer: con el visor puesto no se ve lo que hay a los lados y el brazo pasa por donde
   * pasa. Así que no se sale de golpe: se para y se pregunta. Mientras se pregunta no cae
   * ningún palo, porque si no, decidir costaría puntos.
   */
  prompt: 'quit' | null
  /** Para la partida y pregunta si de verdad se quiere dejar. */
  askToQuit: () => void
  /** No: se sigue jugando desde donde estaba. */
  keepPlaying: () => void

  /**
   * Empieza una partida.
   *
   * Por su cuenta enciende la lección de cómo se juega cuando toca: con las
   * gafas puestas y sin haberla visto nunca. Es del juego y no del botón que se
   * pulse, porque dentro de la sesión también se puede empezar desde el overlay
   * con el teclado. `tutorial` fuerza la decisión en los dos sentidos: lo usa el
   * botón de volver a verla desde el menú.
   */
  startGame: (options?: { tutorial?: boolean }) => void
  /**
   * Retira el tutorial y lo da por visto. Lo llaman el botón de saltar y el
   * propio final de la lección: las dos cosas cuentan, así que a partir de ahí
   * no vuelve a salir. **No toca la partida**, que sigue donde estaba.
   */
  finishTutorial: () => void
  /**
   * Palo atrapado. `fallProgress` (fracción de su tiempo de caída: 0 recién
   * soltado, 1 a ras de suelo) decide el bonus por reflejos. `espaldas`, si se
   * cogió de espaldas a él (`deEspaldas` de `feats.ts`): solo cuenta para su hazaña.
   */
  catchStick: (fallProgress: number, espaldas?: boolean) => void
  /**
   * Palo perdido: rompe la racha, cuenta para cerrar la partida y, en desafío,
   * cuesta una vida.
   */
  missStick: () => void
  resetGame: () => void
}

export const GameContext = createContext<GameStore | null>(null)

/** Restringe el número de palos al rango permitido. */
function clampStickCount(count: number): number {
  if (Number.isNaN(count)) return MIN_STICKS
  return Math.min(MAX_STICKS, Math.max(MIN_STICKS, Math.round(count)))
}

export function useGameStoreValue({ reto, onFinish, objetivo }: OpcionesDelSalon = {}): GameStore {
  const [stickCount, setStickCountState] = useState(MIN_STICKS)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  // Se abre en el reto, con salón o sin él (`DEFAULT_GAME_MODE`): Jugar sin tocar nada empieza la
  // partida que da medalla, y la práctica está a un toque, en el mismo sitio. Con el reto del
  // salón el modo es ese mismo: el del récord de la cabina.
  const [gameMode, setGameModeState] = useState<GameMode>(DEFAULT_GAME_MODE)
  // El reto se mira una sola vez, al montar: es lo que decide con qué se arranca.
  const [enReto, setEnReto] = useState(() => reto != null)
  // De dónde sale el reparto de la partida en marcha. La del reto si se juega el reto; si no,
  // una nueva en cada partida (`startGame`), que sigue siendo distinta cada vez. En el menú da
  // igual cuál: los palos cuelgan quietos.
  const [semilla, setSemilla] = useState(() => reto?.seed ?? 0)
  const [endless, setEndless] = useState(false)
  const [players, setPlayers] = useState<PlayerCount>(1)
  /**
   * La partida a dos con las tandas **ya cerradas** apuntadas. La que se acaba de jugar no se
   * apunta al acabar —sería escribir estado desde un efecto—: se deduce de la partida terminada
   * (`duelAhora`) y se apunta al empezar la siguiente.
   */
  const [duel, setDuel] = useState<Duel | null>(null)
  const duelTally = useDuelTally()
  // `null` es «el más alto desbloqueado»: así el menú enseña el nivel que toca
  // sin leer el almacenamiento en el primer render, que no está en el servidor.
  const [level, setLevelState] = useState<number | null>(null)
  // La partida sin fin la termina el jugador: es lo único que la cierra.
  const [endedByPlayer, setEndedByPlayer] = useState(false)
  // Tanda de la partida sin fin, y con qué marcador empezó: el marcador de la
  // partida sigue subiendo mientras la máquina se recarga.
  const [wave, setWave] = useState(0)
  const [waveStart, setWaveStart] = useState({ score: 0, resolved: 0 })
  const [score, setScore] = useState(0)
  const [resolved, setResolved] = useState(0)
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  // El récord no es estado de React: vive en el navegador y el juego se
  // suscribe a él. Así no hay que sincronizarlo con efectos ni queda una copia
  // que pueda discrepar de lo guardado. Cada modo tiene el suyo, así que la
  // lectura cambia con el modo elegido.
  const readRecord = useCallback(() => getBestPoints(gameMode), [gameMode])
  const bestPoints = useSyncExternalStore(
    subscribeBestPoints,
    readRecord,
    getServerBestPoints,
  )
  // La marca a batir se congela al empezar: en cuanto la partida termina y se
  // guarda, `bestPoints` ya incluye lo recién hecho y no serviría para saber si
  // se ha superado nada.
  const [recordToBeat, setRecordToBeat] = useState(() =>
    reto != null ? getBestPoints(MODO_DEL_RETO) : 0,
  )
  /**
   * El récord del salón, tomado al empezar como el local: al acabar, el salón apunta la marca
   * nueva y vuelve a pasar `objetivo` con ella (`onFinish`), y el cartel compararía la partida
   * consigo misma («Has igualado tu récord»).
   */
  const recordDelSalon = objetivo?.record ?? null
  const salonVivo = useRef(recordDelSalon)
  useEffect(() => {
    salonVivo.current = recordDelSalon
  }, [recordDelSalon])
  const [salonAlEmpezar, setSalonAlEmpezar] = useState(recordDelSalon)
  // El progreso de Niveles y la racha sin fin tampoco son estado de React: viven
  // en el navegador y se leen suscritos, como el récord.
  const unlockedLevel = useSyncExternalStore(
    subscribeUnlockedLevel,
    getUnlockedLevel,
    getServerUnlockedLevel,
  )
  const starsList = useSyncExternalStore(subscribeStarsList, getStarsList, getServerStarsList)
  const levelStarsAll = useMemo(
    () => starsList.split(',').map((s) => Number(s) as Stars),
    [starsList],
  )
  const bestEndlessStreak = useSyncExternalStore(
    subscribeBestEndlessStreak,
    getBestEndlessStreak,
    getServerBestEndlessStreak,
  )
  // Hasta dónde se podía jugar al empezar, y con qué nivel se empezó. El nivel
  // se congela al empezar: al superarlo se desbloquea el siguiente en el acto, y
  // si el activo siguiera al desbloqueado la partida terminada se convertiría en
  // la siguiente a medias, con más palos que resolver y el resumen esfumado.
  const [unlockedAtStart, setUnlockedAtStart] = useState(1)
  const [levelAtStart, setLevelAtStart] = useState(1)
  // Lo único que se guarda es si hay partida en marcha. Las tres fases de una
  // partida —contando, jugando y terminada— se derivan de la cuenta atrás y de
  // los palos resueltos, así no hay fuentes de verdad que sincronizar ni
  // efectos que cambien de fase provocando renders en cascada.
  //
  // Con reto se entra jugando: el salón ya ha elegido juego y modo por quien juega.
  const [running, setRunning] = useState(() => reto != null)
  // Si esta partida empezó calentando (`warmup.ts`). Se apaga solo al volver a empezar el
  // reto de cero: mientras tanto la partida no se acaba, aunque la lección ya se haya retirado.
  const [calentamiento, setCalentamiento] = useState(false)
  const [avisoDeQueCuenta, setAvisoDeQueCuenta] = useState(false)
  // El escenario tampoco es estado de React, y además no es del juego: es el
  // escenario del arcade (`xrcade:scenery`), traducido a `scene`/`passthrough` en
  // el borde (`sceneryPreference.ts`). Se cambia desde el panel del salón y desde
  // el menú de aquí, y los dos tienen que ver lo mismo a la vez. Que diga
  // passthrough no basta para servirlo: en una sesión sin habitación real detrás,
  // quien pinta la escena lo ignora y mantiene el escenario.
  const scenery = sceneryModeOf(useScenery())
  const setScenery = useCallback(
    (value: SceneryMode) => setArcadeScenery(sceneryOf(value)),
    [],
  )
  // La clave propia del juego se borra al montar el estado de la partida, sin
  // trasladarla: la elección que manda es la del salón.
  useEffect(() => {
    forgetOwnScenery(gameStorage())
  }, [])
  // El sonido no es estado de este juego: sale de los ajustes del arcade, que
  // se eligen una vez en xrcade y valen para los doce. Aquí solo se traduce a
  // lo que la escena pregunta: si está mudo y a qué volumen (ver `ajustes.ts`).
  const volumes = useVolumes()
  const muted = volumes.sfx === 0
  const sfxVolume = volumeFactor(volumes.sfx)
  const music = volumes.ambience > 0
  const ambienceVolume = volumeFactor(volumes.ambience)
  const [countdown, setCountdown] = useState(() => (reto != null ? COUNTDOWN_SECONDS : 0))
  const [prompt, setPrompt] = useState<'quit' | null>(null)
  const [runId, setRunId] = useState(0)
  // Las hazañas de la partida en curso (`feats.ts`). No se pintan: se cuentan al atrapar y al
  // resolverse cada tanda, y se le cuentan al salón al acabar. A dos, las de las dos tandas.
  const hazanas = useRef<CuentaDeHazanas>(SIN_HAZANAS)
  // La corrección de la altura del aro sale de lo guardado en visitas
  // anteriores. En el servidor no hay almacenamiento y vale 0, pero eso no
  // desajusta la hidratación: el aro solo se pinta dentro del Canvas, que se
  // carga en cliente.
  const [hoopAdjustment, setHoopAdjustmentState] = useState(getHoopAdjustment)
  // Lo que mide el visor, mientras dure la sesión. Fuera de ella no hay a quién
  // medir y el aro se queda a la altura de referencia.
  const [playerEyeHeight, setPlayerEyeHeight] = useState<number | null>(null)
  // El tutorial se ve una vez y se recuerda, como la altura del aro. Se lee al
  // montar y no en cada consulta porque decide qué se pinta: leer el
  // almacenamiento en mitad de un render lo volvería impredecible.
  const [tutorialSeen, setTutorialSeen] = useState(() => leerTutorialVisto())
  // Si esta partida va enseñando a jugar. **No para nada**: la lección se hace
  // atrapando palos, así que corre en paralelo a la partida y se retira cuando
  // se han superado sus pasos o cuando se salta (ver `tutorial.ts`).
  const [teaching, setTeaching] = useState(false)
  // Los pasos que se han dado por pasados sin hacerlos: a botón o por plazo.
  const [tutorialSkipped, setTutorialSkipped] = useState(0)
  // Si hay gafas puestas. El juego lo necesita para saber a quién enseñar cómo
  // se juega: en escritorio la pantalla de inicio ya lo explica con texto.
  const [immersive, setImmersive] = useState(false)
  // Con qué se está jugando: mandos o manos desnudas. Solo cambia la lección.
  const [bareHanded, setBareHanded] = useState(false)

  const levels = gameMode === 'levels'
  const endlessRun = gameMode === 'practice' && endless
  const selectedLevel = clampLevel(Math.min(level ?? unlockedLevel, unlockedLevel))
  const activeLevel = running ? levelAtStart : selectedLevel
  const currentLevel = levelSpec(activeLevel)
  // Lo elegido solo cuenta en práctica: en Niveles lo dice el nivel, y el desafío va fijo
  // (`CHALLENGE_SETUP`) para que su récord —el de la cabina— sea siempre la misma partida.
  const setup = levels ? currentLevel : gameMode === 'challenge' ? CHALLENGE_SETUP : { difficulty, stickCount }
  const activeDifficulty = setup.difficulty
  const activeStickCount = setup.stickCount
  // Cada tanda, su semilla: sin fin, cada recarga reparte palos nuevos; en el resto de modos
  // solo hay la tanda 0.
  const stickSeed = deriveSeed(semilla, wave)
  const waveScore = score - waveStart.score
  const waveResolved = resolved - waveStart.resolved

  // Los palos que se han escapado. Se deriva en vez de contarse aparte: un
  // tercer contador que hay que mantener a la par de los otros dos es un
  // desajuste esperando a pasar.
  const misses = resolved - score
  // Cuándo se acaba una partida lo decide el modo (ver `gameMode.ts`): en
  // práctica, el último palo; en desafío, también quedarse sin vidas. Sin fin
  // no se acaba sola: la cierra el jugador.
  const outcome = running && !calentamiento
    ? endlessRun
      ? endedByPlayer
        ? 'cleared'
        : null
      : runOutcome({ mode: gameMode, resolved, misses, stickCount: activeStickCount })
    : null
  // Calentando, los palos perdidos no cuestan vidas.
  const lives = remainingLives(gameMode, calentamiento ? 0 : misses)
  const ahoraCuenta = avisoDeQueCuenta && resolved === 0
  const gameState: GameState = !running
    ? 'menu'
    : countdown > 0
      ? 'countdown'
      : outcome
        ? 'finished'
        : 'playing'

  // Por qué paso va la lección. Sale de lo que ya ha hecho quien juega —los
  // palos que lleva atrapados— y de lo que se haya dado por pasado: una cuenta
  // propia del tutorial acabaría discrepando de la partida, y aquí lo que manda
  // es la partida.
  const tutorialStep = teaching
    ? pasoDelTutorial(hitosAtrapando(score), tutorialSkipped)
    : null

  // Un tic por segundo hasta soltar el primer palo. La cuenta atrás da tiempo a
  // colocarse —en el visor uno acaba de pulsar un botón y tiene las manos donde
  // no toca— y avisa de que la partida va a empezar de verdad.
  useEffect(() => {
    if (!running || countdown <= 0 || prompt !== null) return
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [running, countdown, prompt])

  // Saltarlo y terminarlo son la misma salida: en los dos casos quien juega ya
  // ha decidido, y la lección no vuelve a salir. La partida no se toca, porque
  // nunca llegó a pararse.
  const finishTutorial = useCallback(() => {
    if (!teaching) return
    markTutorialSeen()
    setTutorialSeen(true)
    setTeaching(false)
  }, [teaching])

  // Superados todos los pasos, la lección queda anotada como vista. Es un
  // efecto porque no lo dispara ningún gesto —lo dispara haber atrapado los
  // palos que pedía—, y **solo escribe fuera de React**: el panel ya se retira
  // solo, porque lo que lo monta es el paso y el paso se ha quedado en `null`.
  // Apagar además `teaching` desde aquí sería pedir un render de más para algo
  // que no se ve.
  useEffect(() => {
    if (!teaching || tutorialStep !== null) return
    markTutorialSeen()
  }, [teaching, tutorialStep])

  // El plazo de seguridad del paso: si el hito no llega —porque los palos se
  // escapan, o porque quien juega se queda leyendo—, se pasa solo. Corre solo
  // mientras se juega de verdad: con la cuenta atrás no hay palos que atrapar,
  // y con la pregunta de salir en pantalla la partida está parada.
  useEffect(() => {
    if (tutorialStep === null || gameState !== 'playing' || prompt !== null) return
    const plazo = setTimeout(
      () => setTutorialSkipped((pasados) => saltarPaso(pasados, tutorialStep)),
      PLAZO_DEL_PASO[tutorialStep] * 1000,
    )
    return () => clearTimeout(plazo)
  }, [tutorialStep, gameState, prompt])

  const nextTutorialStep = useCallback(() => {
    if (tutorialStep === null) return
    setTutorialSkipped((pasados) => saltarPaso(pasados, tutorialStep))
  }, [tutorialStep])

  // Sin fin: tanda resuelta, la máquina se recarga. Se apunta de qué tanda se
  // pasó para que dos ejecuciones del efecto —Strict Mode las provoca— no
  // salten dos.
  const advancedWave = useRef(-1)
  useEffect(() => {
    if (!running || !endlessRun || gameState !== 'playing') return
    if (waveResolved < activeStickCount) return
    // Dos ejecuciones del efecto por la misma tanda —Strict Mode las provoca en
    // desarrollo— sumarían dos veces lo hecho.
    /* v8 ignore next */
    if (advancedWave.current === wave) return
    advancedWave.current = wave
    hazanas.current = contarTanda(hazanas.current, {
      palos: activeStickCount,
      atrapados: waveScore,
      ajusteDelAro: hoopAdjustment,
    })
    setWaveStart({ score, resolved })
    setWave((value) => value + 1)
  }, [running, endlessRun, gameState, waveResolved, waveScore, activeStickCount, wave, score, resolved, hoopAdjustment])

  // Cómo acabó el nivel, solo con la partida terminada en Niveles.
  const levelResult = useMemo(() => {
    if (!levels || gameState !== 'finished') return null
    const stars = levelStars(score, activeStickCount)
    const passed = levelPassed(stars)
    const abre = passed && activeLevel + 1 > unlockedAtStart && activeLevel < LEVEL_COUNT
    return { stars, passed, unlocked: abre ? activeLevel + 1 : null }
  }, [levels, gameState, score, activeStickCount, activeLevel, unlockedAtStart])

  // Cada modo guarda lo suyo al terminar: puntos, racha o estrellas. Guardar
  // solo hace algo si mejora lo que había, así que repetirlo no cambia nada. Se
  // guarda al final y no palo a palo para que durante la partida el récord siga
  // siendo la marca a batir.
  //
  // Y aquí mismo se le cuenta al salón, una vez por partida y aunque no sea récord. Este efecto
  // se rehace con cada render de la pantalla final (y dos veces en desarrollo): la partida de la
  // que ya se avisó se apunta para no contarla dos veces. El aviso se lee del último render y no
  // entra en las dependencias: un anfitrión que pasa una función nueva en cada render no tiene
  // por qué rehacer nada.
  const avisada = useRef(-1)
  const avisar = useRef(onFinish)
  useEffect(() => {
    avisar.current = onFinish
  }, [onFinish])
  // La partida a dos con la tanda que acaba de terminar ya apuntada: el aviso de pasar el mando y
  // el de quién ha ganado salen de aquí.
  const duelAhora = duel !== null && gameState === 'finished' ? recordTurn(duel, points) : duel
  useEffect(() => {
    if (gameState !== 'finished') return
    // La tanda de la partida, si se ha resuelto entera: la que acaba sin vidas no. La partida sin
    // fin cuenta cada tanda al recargar, y la que se deja a medias al terminarla no es tanda.
    // Contarla otra vez en el siguiente render no cambia nada.
    if (!endlessRun && resolved === activeStickCount) {
      hazanas.current = contarTanda(hazanas.current, {
        palos: activeStickCount,
        atrapados: score,
        ajusteDelAro: hoopAdjustment,
      })
    }
    // A dos no hay récord que guardar: una tanda a dos no es la marca de nadie. Lo que cuenta es
    // quién gana, y se apunta al acabar la segunda, una vez por partida; al salón, la partida
    // entera y no cada tanda, con lo mejor que se hizo.
    if (duelAhora !== null) {
      if (!duelOver(duelAhora) || avisada.current === runId) return
      avisada.current = runId
      saveDuelResult(duelWinner(duelAhora))
      avisar.current?.(
        conHazanas(
          { mode: 'duel', points: mejorDelDuelo(duelAhora), challenge: false },
          estrenarHazanas(hazanas.current.logradas),
        ),
      )
      return
    }
    if (levelResult) saveLevelResult(activeLevel, levelResult.stars)
    else if (endlessRun) saveBestEndlessStreak(bestStreak)
    else saveBestPoints(gameMode, points)
    if (avisada.current === runId) return
    avisada.current = runId
    avisar.current?.(
      conHazanas({ mode: gameMode, points: points, challenge: enReto }, estrenarHazanas(hazanas.current.logradas)),
    )
  }, [
    gameState,
    gameMode,
    points,
    bestStreak,
    endlessRun,
    levelResult,
    activeLevel,
    runId,
    enReto,
    duelAhora,
    resolved,
    activeStickCount,
    score,
    hoopAdjustment,
  ])

  // La marca de este modo: puntos, o la racha en la partida sin fin. En Niveles
  // no hay marca que batir: hay estrellas.
  const bestForMode = endlessRun ? bestEndlessStreak : levels ? 0 : bestPoints
  const scoreForRecord = endlessRun ? bestStreak : points
  // La partida ha batido el récord con el que empezó *y* lo guardado es
  // exactamente esta puntuación. Sin esa segunda condición, con el
  // almacenamiento bloqueado la marca a batir se quedaría a cero para siempre y
  // cada partida con puntos se anunciaría como récord. Y se exige la igualdad y
  // no "al menos": con dos pestañas abiertas, la otra puede haber guardado algo
  // mejor mientras se jugaba, y entonces esta partida supera la marca que
  // congeló al empezar pero no la que hay guardada. Derivado y no guardado:
  // dura lo que dure la pantalla de fin de partida.
  const isRecord =
    gameState === 'finished' &&
    !levels &&
    duelAhora === null &&
    scoreForRecord > recordToBeat &&
    bestForMode === scoreForRecord
  const hoopHeight = hoopHeightFor({
    eyeHeight: playerEyeHeight,
    adjustment: hoopAdjustment,
  })

  // El cartel del objetivo: qué hay que superar y cuánto falta. Se arma ya traducido, como lo
  // pide `objetivo.ts`: sus frases son plantillas y partirlas fuera no vale para dos idiomas.
  const lang = useLang()
  const aDos = duelAhora !== null
  const partidaQueSeCuenta = useMemo(
    () =>
      partidaDelCartel(
        {
          objetivo: objetivo == null ? objetivo : { ...objetivo, record: salonAlEmpezar },
          gameMode,
          aDos,
          gameState,
          points,
          lives,
          resolved,
          stickCount: activeStickCount,
          record: recordToBeat,
          calentando: calentamiento,
          ahoraCuenta,
        },
        traductorSuave(lang),
      ),
    [objetivo, salonAlEmpezar, gameMode, aDos, gameState, points, lives, resolved, activeStickCount, recordToBeat, calentamiento, ahoraCuenta, lang],
  )
  const cartel = useMemo(
    () => (partidaQueSeCuenta == null ? null : goalSign(partidaQueSeCuenta, traductorSuave(lang))),
    [partidaQueSeCuenta, lang],
  )
  const faseDelCartel = llevaLaCuenta(partidaQueSeCuenta) ? partidaQueSeCuenta.phase : null
  const medalla = partidaQueSeCuenta == null ? null : medalToCelebrate(partidaQueSeCuenta)

  const setStickCount = useCallback((count: number) => {
    setStickCountState(clampStickCount(count))
  }, [])

  // Se guarda al tocarlo y no al salir: en el visor no hay "salir", uno se
  // quita las gafas. Y solo cuando el valor cambia de verdad, para no escribir
  // en cada pulsación una vez alcanzado el tope.
  const adjustHoop = useCallback(
    (steps: number) => {
      const next = clampHoopAdjustment(hoopAdjustment + steps * HOOP_ADJUST_STEP)
      if (next === hoopAdjustment) return
      saveHoopAdjustment(next)
      setHoopAdjustmentState(next)
    },
    [hoopAdjustment],
  )

  /**
   * El modo es de la partida entera, así que solo se cambia entre partidas.
   *
   * No es una precaución teórica: los puntos conseguidos y el modo en el que se
   * consiguieron son un par, y el récord se guarda leyendo los dos. Con el
   * resumen en pantalla —donde la puntuación sigue viva— cambiar de modo
   * copiaría esa puntuación al récord del otro, que no se ha jugado. Hoy ningún
   * menú se ve en esa fase, pero la regla es del juego y no de dónde esté el
   * botón.
   */
  const setGameMode = useCallback(
    (mode: GameMode) => {
      if (running) return
      setGameModeState(mode)
    },
    [running],
  )

  const setLevel = useCallback(
    (next: number) => {
      if (running) return
      setLevelState(clampLevel(Math.min(next, getUnlockedLevel())))
    },
    [running],
  )

  const endRun = useCallback(() => setEndedByPlayer(true), [])

  const clearRun = useCallback(() => {
    setScore(0)
    setResolved(0)
    setPoints(0)
    setStreak(0)
    setBestStreak(0)
    setWave(0)
    setWaveStart({ score: 0, resolved: 0 })
    setEndedByPlayer(false)
    advancedWave.current = -1
  }, [])
  const startGame = useCallback(
    (options?: { tutorial?: boolean }) => {
      setPrompt(null)
      // Con las gafas puestas y sin haberla visto nunca, la partida va
      // enseñando. La cuenta atrás no cambia: la lección se aprende atrapando
      // palos, así que empieza cuando empiezan a caer y no antes.
      //
      // Se **relee** del almacenamiento en vez de mirar lo que se leyó al
      // montar: la lección que se termina atrapando queda anotada sin pasar por
      // React, así que el estado se habría quedado atrás y la segunda partida
      // de la misma visita volvería a enseñar lo ya aprendido.
      const visto = leerTutorialVisto()
      setTutorialSeen(visto)
      clearRun()
      // Lo que viene es otra partida: ya no es el reto del salón aunque se juegue en el mismo
      // modo, y estrena semilla. A dos, el segundo juega **la semilla del primero**: los mismos
      // palos en el mismo orden. Con la partida acabada, o sin ninguna, empieza otra.
      setEnReto(false)
      const partida = !juegaADos(gameMode, players)
        ? null
        : duelAhora === null || duelOver(duelAhora)
          ? createDuel(randomSeed())
          : duelAhora
      setDuel(partida)
      // Las hazañas empiezan de cero con cada partida, salvo el segundo turno de una a dos: la
      // partida es de los dos turnos y se le cuenta al salón entera al acabar el segundo.
      if (partida === null || partida !== duelAhora) hazanas.current = SIN_HAZANAS
      setSemilla(partida?.semilla ?? randomSeed())
      setRecordToBeat(
        gameMode === 'practice' && endless ? getBestEndlessStreak() : getBestPoints(gameMode),
      )
      setSalonAlEmpezar(salonVivo.current)
      setUnlockedAtStart(getUnlockedLevel())
      setLevelAtStart(selectedLevel)
      setRunId((id) => id + 1)
      const ensenando = options?.tutorial ?? (immersive && !visto)
      setTeaching(ensenando)
      setCalentamiento(enCalentamiento({ ensenando, gameMode, aDos: partida !== null, enReto: false }))
      setAvisoDeQueCuenta(false)
      setTutorialSkipped(0)
      setCountdown(COUNTDOWN_SECONDS)
      setRunning(true)
    },
    [clearRun, gameMode, players, duelAhora, endless, selectedLevel, immersive],
  )

  // **La lección se cierra y el reto empieza de cero** (`warmup.ts`): por sus pasos, por
  // «Siguiente», por «Saltar» o por su plazo, que en los cuatro casos deja el paso en `null`. La
  // lección ya queda anotada como vista (`finishTutorial` o el efecto de arriba), así que la
  // partida nueva no enseña; y avisa de que ahora cuenta hasta que se resuelva su primer palo.
  //
  // Una vez por partida: dos ejecuciones del efecto —Strict Mode las provoca— empezarían dos.
  const reempezada = useRef(-1)
  useEffect(() => {
    if (!calentamiento || !running || tutorialStep !== null) return
    /* v8 ignore next */
    if (reempezada.current === runId) return
    reempezada.current = runId
    startGame({ tutorial: false })
    setAvisoDeQueCuenta(true)
  }, [calentamiento, running, tutorialStep, startGame, runId])

  const catchStick = useCallback(
    (fallProgress: number, espaldas = false) => {
      hazanas.current = contarAtrape(hazanas.current, { espaldas })
      setScore((value) => value + 1)
      setResolved((value) => value + 1)
      // La racha se calcula aquí y no fuera porque los puntos dependen de ella:
      // con dos palos resolviéndose en el mismo lote, leer `streak` del render
      // anterior daría el mismo bonus a los dos.
      setStreak((previous) => {
        const next = previous + 1
        setBestStreak((best) => Math.max(best, next))
        setPoints((total) =>
          total + stickPoints({ difficulty: activeDifficulty, streak: next, fallProgress }),
        )
        return next
      })
    },
    [activeDifficulty],
  )

  const missStick = useCallback(() => {
    setResolved((value) => value + 1)
    setStreak(0)
  }, [])

  // El gancho de los e2e comunes (`partidaDePrueba.ts`): solo hace algo si el test lo ha pedido.
  // Lee el estado vigente de una referencia, no el del render en que se dejó puesto.
  const enCurso = useRef({ cartel, resolved, score })
  useEffect(() => {
    enCurso.current = { cartel, resolved, score }
  }, [cartel, resolved, score])
  useEffect(() => {
    exposeTestRun({
      start: () => {
        startGame({ tutorial: false })
        setCountdown(0)
      },
      score: (puntos) => {
        setPoints(puntos)
        // Como si ya se hubiera atrapado un palo: hasta el primero, el cartel dice la misión.
        if (enCurso.current.resolved === 0) {
          setResolved(1)
          setScore(1)
        }
      },
      end: () => {
        // Los palos que quedan, atrapados: el reto se supera y se le cuenta al salón.
        const { resolved: hechos, score: atrapados } = enCurso.current
        setScore(atrapados + activeStickCount - hechos)
        setResolved(activeStickCount)
      },
      sign: () => enCurso.current.cartel,
    })
  }, [startGame, activeStickCount])

  const askToQuit = useCallback(() => setPrompt('quit'), [])
  const keepPlaying = useCallback(() => setPrompt(null), [])

  const resetGame = useCallback(() => {
    setPrompt(null)
    clearRun()
    setCountdown(0)
    // Dejar la lección a medias no cuenta como haberla visto: quien vuelve al
    // menú con el panel puesto se la encuentra otra vez al empezar.
    setTeaching(false)
    setCalentamiento(false)
    setAvisoDeQueCuenta(false)
    setTutorialSkipped(0)
    setEnReto(false)
    // Volver al menú deja la partida a dos: la siguiente empieza de cero. Lo conseguido en la
    // partida dejada a medias no se cuenta, como sus puntos.
    setDuel(null)
    hazanas.current = SIN_HAZANAS
    setRunning(false)
  }, [clearRun])

  return useMemo(
    () => ({
      prompt,
      askToQuit,
      keepPlaying,
      stickCount,
      difficulty,
      gameMode,
      endless,
      players,
      duel: duelAhora,
      player: duelAhora === null ? null : controllerHolder(duelAhora),
      duelTally,
      celebra: isRecord || (duelAhora !== null && duelOver(duelAhora)),
      level,
      activeLevel,
      unlockedLevel,
      levelStars: levelStarsAll,
      levelResult,
      activeDifficulty,
      activeStickCount,
      stickSeed,
      enReto,
      calentando: calentamiento,
      ahoraCuenta,
      wave,
      waveScore,
      waveResolved,
      lives,
      outcome,
      cartel,
      faseDelCartel,
      medalla,
      score,
      resolved,
      points,
      streak,
      bestStreak,
      bestPoints: bestForMode,
      isRecord,
      gameState,
      countdown,
      runId,
      scenery,
      muted,
      sfxVolume,
      music,
      ambienceVolume,
      hoopHeight,
      hoopAdjustment,
      playerEyeHeight,
      tutorialSeen,
      teaching,
      tutorialStep,
      immersive,
      bareHanded,
      setScenery,
      setStickCount,
      setDifficulty,
      setGameMode,
      setEndless,
      setPlayers,
      setLevel,
      endRun,
      adjustHoop,
      setPlayerEyeHeight,
      setImmersive,
      setBareHanded,
      startGame,
      finishTutorial,
      nextTutorialStep,
      catchStick,
      missStick,
      resetGame,
    }),
    [
      prompt,
      askToQuit,
      keepPlaying,
      stickCount,
      difficulty,
      gameMode,
      endless,
      players,
      duelAhora,
      duelTally,
      level,
      activeLevel,
      unlockedLevel,
      levelStarsAll,
      levelResult,
      activeDifficulty,
      activeStickCount,
      stickSeed,
      enReto,
      calentamiento,
      ahoraCuenta,
      wave,
      waveScore,
      waveResolved,
      lives,
      outcome,
      cartel,
      faseDelCartel,
      medalla,
      score,
      resolved,
      points,
      streak,
      bestStreak,
      bestForMode,
      isRecord,
      gameState,
      countdown,
      runId,
      scenery,
      muted,
      sfxVolume,
      music,
      ambienceVolume,
      hoopHeight,
      hoopAdjustment,
      playerEyeHeight,
      tutorialSeen,
      teaching,
      tutorialStep,
      immersive,
      bareHanded,
      setScenery,
      setStickCount,
      setGameMode,
      setLevel,
      endRun,
      adjustHoop,
      startGame,
      finishTutorial,
      nextTutorialStep,
      catchStick,
      missStick,
      resetGame,
    ],
  )
}

export function useGame(): GameStore {
  const store = useContext(GameContext)
  if (!store) {
    throw new Error('useGame must be used inside a <GameProvider>')
  }
  return store
}
