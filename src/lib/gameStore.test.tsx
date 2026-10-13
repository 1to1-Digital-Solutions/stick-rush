import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MACHINE_HEIGHT, MAX_STICKS, MIN_STICKS } from './gameConfig'
import { COUNTDOWN_SECONDS, useGame, useGameStoreValue, type OpcionesDelSalon } from './gameStore'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, DEFAULT_GAME_MODE } from './gameMode'
import { buildStickLayout } from './stickLayout'
import { HIGH_SCORE_KEYS } from './highScore'
import { HAZANAS, HAZANAS_KEY } from './hazanas'
import { HOOP_ADJUST_RANGE, HOOP_ADJUST_STEP } from './hoopHeight'
import { OWN_SCENERY_KEY } from './sceneryPreference'
import { PLAZO_DEL_PASO, TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE, type TutorialStepKey } from './tutorial'
import { DEFAULT_VOLUMES, SCENERY_KEY, VOLUME_KEYS } from './settings'
import { setLang, setVolume } from './settingsClient'
import type { Goal } from './goal'
import { formatoDeCifra } from './textos'

// La cuenta atrás usa `setTimeout`, así que todo el fichero corre con relojes
// falsos: si no, cada partida costaría tres segundos reales de test.
beforeEach(() => {
  vi.useFakeTimers()
  // El récord se guarda en `localStorage`, que jsdom comparte entre tests: sin
  // vaciarlo, una partida de un test daría por batido el récord de otro.
  localStorage.clear()
  // Los volúmenes salen de los ajustes del arcade, que cachean lo leído para
  // que `useSyncExternalStore` no repinte sin parar: vaciar `localStorage` a
  // secas dejaría el caché con el valor de la prueba anterior. Se restablecen
  // por la API, que es la que lo invalida.
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Agota la cuenta atrás y deja la partida en juego.
 *
 * Segundo a segundo, y no de un salto: cada tic reprograma el siguiente desde
 * un efecto, que no corre hasta que React vuelve a renderizar. Avanzar tres
 * segundos de golpe solo dispararía el primero.
 */
function runOutCountdown() {
  for (let second = 0; second < COUNTDOWN_SECONDS; second++) {
    act(() => void vi.advanceTimersByTime(1000))
  }
}

/**
 * Abre el juego y deja elegida **la práctica**, que es lo que juegan casi todos estos tests: ahí
 * se eligen los palos y la velocidad. El menú abre en el reto (lo comprueba «práctica y desafío»).
 */
function abrirEnPractica(opciones?: OpcionesDelSalon) {
  const hook = renderHook(() => useGameStoreValue(opciones))
  act(() => hook.result.current.setGameMode('practice'))
  return hook
}

/** Arranca una partida y agota la cuenta atrás, dejándola en juego. */
function startPlaying(store: {
  current: ReturnType<typeof useGameStoreValue>
}) {
  act(() => store.current.startGame())
  runOutCountdown()
}

/** Juega una partida entera atrapando `caught` palos y perdiendo el resto. */
function playRound(
  store: { current: ReturnType<typeof useGameStoreValue> },
  total: number,
  caught: number,
) {
  act(() => store.current.setStickCount(total))
  startPlaying(store)
  for (let i = 0; i < total; i++) {
    act(() => {
      if (i < caught) store.current.catchStick(0.5)
      else store.current.missStick()
    })
  }
}

describe('selección previa a la partida', () => {
  it('arranca en el menú con los valores por defecto', () => {
    const { result } = abrirEnPractica()
    expect(result.current.gameState).toBe('menu')
    expect(result.current.stickCount).toBe(MIN_STICKS)
    expect(result.current.difficulty).toBe('easy')
    expect(result.current.score).toBe(0)
  })

  it('acepta cualquier número de palos dentro del rango', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setStickCount(9))
    expect(result.current.stickCount).toBe(9)
  })

  it('recorta los valores fuera de rango en vez de romper la escena', () => {
    const { result } = abrirEnPractica()

    act(() => result.current.setStickCount(MIN_STICKS - 3))
    expect(result.current.stickCount).toBe(MIN_STICKS)

    act(() => result.current.setStickCount(MAX_STICKS + 100))
    expect(result.current.stickCount).toBe(MAX_STICKS)

    act(() => result.current.setStickCount(-1))
    expect(result.current.stickCount).toBe(MIN_STICKS)
  })

  it('redondea los decimales y descarta NaN', () => {
    const { result } = abrirEnPractica()

    act(() => result.current.setStickCount(7.4))
    expect(result.current.stickCount).toBe(7)

    act(() => result.current.setStickCount(Number.NaN))
    expect(result.current.stickCount).toBe(MIN_STICKS)
  })

  it('cambia de dificultad', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setDifficulty('impossible'))
    expect(result.current.difficulty).toBe('impossible')
  })
})

describe('ciclo de una partida', () => {
  it('empieza a jugar con el marcador a cero', () => {
    const { result } = abrirEnPractica()
    startPlaying(result)

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('renueva el identificador de partida para remontar los palos', () => {
    const { result } = abrirEnPractica()
    const before = result.current.runId
    startPlaying(result)
    expect(result.current.runId).toBe(before + 1)
  })

  it('suma los palos atrapados sin cerrar la partida antes de tiempo', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))

    expect(result.current.score).toBe(1)
    expect(result.current.resolved).toBe(1)
    expect(result.current.gameState).toBe('playing')
  })

  it('cuenta como resuelto el palo perdido, sin sumar al marcador', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    act(() => result.current.missStick())

    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(1)
  })

  it('termina la partida cuando se resuelve el último palo', () => {
    const { result } = abrirEnPractica()
    playRound(result, 5, 3)

    expect(result.current.gameState).toBe('finished')
    expect(result.current.score).toBe(3)
    expect(result.current.resolved).toBe(5)
  })

  it('no se queda colgada si dos palos se resuelven de golpe', () => {
    // Dos mandos XR sobre palos distintos, o el último palo tocando el suelo
    // mientras se atrapa otro: ambas resoluciones caen en el mismo lote de
    // React. El contador se actualiza en función del valor previo, así que
    // ninguna se pierde.
    const { result } = abrirEnPractica()
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.catchStick(0.5)
      }
    })

    expect(result.current.resolved).toBe(5)
    expect(result.current.score).toBe(5)
    expect(result.current.gameState).toBe('finished')
  })

  it('sobrevive a una resolución de más sin volver al menú', () => {
    const { result } = abrirEnPractica()
    playRound(result, 5, 5)
    act(() => result.current.missStick())

    expect(result.current.gameState).toBe('finished')
  })
})

describe('cuenta atrás', () => {
  it('la partida no arranca de golpe: primero cuenta', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame())

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS)
  })

  it('va bajando un segundo cada vez', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame())

    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS - 1)

    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS - 2)
    expect(result.current.gameState).toBe('countdown')
  })

  it('los palos no caen mientras se cuenta', () => {
    // `StickMachine` los mantiene parados mirando la fase; si la cuenta atrás
    // no fuera una fase propia, el primer palo saldría antes del "ya".
    const { result } = abrirEnPractica()
    act(() => result.current.startGame())
    expect(result.current.gameState).not.toBe('playing')
  })

  it('al llegar a cero se empieza a jugar', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame())
    runOutCountdown()

    expect(result.current.gameState).toBe('playing')
  })

  it('volver al menú durante la cuenta la corta', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame())
    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')

    // Y no arranca sola después: un temporizador que quedara vivo no puede
    // devolver al jugador a una partida que ha cancelado.
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current.gameState).toBe('menu')
  })
})

describe('tutorial de la primera vez', () => {
  /** Pone las gafas: es lo que hace `XRSessionController` al abrirse la sesión. */
  function wearHeadset(store: {
    current: ReturnType<typeof useGameStoreValue>
  }) {
    act(() => store.current.setImmersive(true))
  }

  /** Atrapa un palo, que es lo que supera los pasos de la lección. */
  function catchOne(store: { current: ReturnType<typeof useGameStoreValue> }) {
    act(() => store.current.catchStick(0.5))
  }

  /** Deja correr el plazo de seguridad del paso que esté puesto. */
  function waitOutStep(
    store: { current: ReturnType<typeof useGameStoreValue> },
    step: TutorialStepKey,
  ) {
    act(() => void vi.advanceTimersByTime(PLAZO_DEL_PASO[step] * 1000))
  }

  it('con las gafas puestas, la primera partida va enseñando', () => {
    // Y sin que nadie lo pida: quien llega por primera vez no sabe que hay algo
    // que pedir. La decisión es del juego y no del botón que se pulse, porque
    // dentro de la sesión también se empieza desde el overlay con el teclado.
    const { result } = abrirEnPractica()
    wearHeadset(result)

    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(true)
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('pero la partida no se para: la lección corre encima', () => {
    // Es la diferencia con la demostración de antes, que ponía la partida en
    // cola: quien la miraba sin hacer nada salía igual que entró.
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS)

    runOutCountdown()
    expect(result.current.gameState).toBe('playing')
    expect(result.current.teaching).toBe(true)
  })

  it('en escritorio no enseña nada, aunque no se haya visto', () => {
    // Allí la pantalla de inicio lo explica con texto, que se lee antes de
    // empezar y sin gafas puestas.
    const { result } = abrirEnPractica()
    act(() => result.current.startGame())

    expect(result.current.tutorialSeen).toBe(false)
    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialStep).toBeNull()
  })

  it('con las gafas puestas pero ya vista, se juega directamente', () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    const { result } = abrirEnPractica()
    wearHeadset(result)

    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(false)
  })

  it('quien vio la lección vieja la vuelve a ver: no es la misma', () => {
    // Lo guardado es la versión de la lección. La 1 era la demostración por
    // reloj, que no se hacía jugando.
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1')
    const { result } = abrirEnPractica()
    wearHeadset(result)

    expect(result.current.tutorialSeen).toBe(false)
    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(true)
  })

  it('cada paso se supera atrapando un palo, no mirando', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()

    expect(result.current.tutorialStep).toBe('grab')
    catchOne(result)
    expect(result.current.tutorialStep).toBe('around')
    catchOne(result)
    expect(result.current.tutorialStep).toBeNull()
  })

  it('y al superarlos todos la lección se retira y queda vista', () => {
    // Retirarla es quedarse sin paso: eso es lo que desmonta el panel, en el
    // visor y en el overlay. Lo que se guarda es lo que la quita de las
    // próximas partidas.
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()
    catchOne(result)
    catchOne(result)

    expect(result.current.tutorialStep).toBeNull()
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe(TUTORIAL_SEEN_VALUE)
  })

  it('y no vuelve a salir en la siguiente partida de la misma visita', () => {
    // Lo aprendido atrapando se anota fuera de React, así que `startGame` tiene
    // que releerlo: mirando lo que se leyó al montar, la segunda partida de la
    // misma visita volvería a enseñar lo ya aprendido.
    const { result } = abrirEnPractica()
    wearHeadset(result)
    act(() => result.current.startGame())
    runOutCountdown()
    catchOne(result)
    catchOne(result)

    act(() => result.current.resetGame())
    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialSeen).toBe(true)
  })

  it('el botón de siguiente da el paso por pasado sin haberlo hecho', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()

    act(() => result.current.nextTutorialStep())
    expect(result.current.tutorialStep).toBe('around')
    act(() => result.current.nextTutorialStep())
    expect(result.current.tutorialStep).toBeNull()
  })

  it('y sin paso puesto no hace nada', () => {
    // Sin lección en marcha no hay nada que pasar, y sumar a la cuenta de
    // saltados dejaría el primer paso oculto en la próxima partida.
    const { result } = abrirEnPractica()
    act(() => result.current.startGame())
    runOutCountdown()

    act(() => result.current.nextTutorialStep())
    expect(result.current.tutorialStep).toBeNull()
  })

  it('el plazo de seguridad pasa el paso solo, si el hito no llega', () => {
    // Un paso que no se consiga —porque los palos se escapan— dejaría a alguien
    // encerrado en él con el panel delante de la cara toda la partida.
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()

    waitOutStep(result, 'grab')
    expect(result.current.tutorialStep).toBe('around')
    waitOutStep(result, 'around')
    expect(result.current.tutorialStep).toBeNull()
  })

  it('el plazo no corre mientras no se juega', () => {
    // Con la cuenta atrás no hay palos que atrapar: gastar ahí el plazo del
    // primer paso sería pasarlo antes de que nadie haya podido intentarlo.
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))

    act(() => void vi.advanceTimersByTime(PLAZO_DEL_PASO.grab * 1000))
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('ni con la pregunta de salir en pantalla, que para la partida', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()
    act(() => result.current.askToQuit())

    waitOutStep(result, 'grab')
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('saltarla cuenta como vista: ya ha decidido', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))
    act(() => result.current.finishTutorial())

    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialStep).toBeNull()
    expect(result.current.tutorialSeen).toBe(true)
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe(TUTORIAL_SEEN_VALUE)
  })

  it('y saltarla no toca la partida, que nunca llegó a pararse', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()
    act(() => result.current.catchStick(0.5))
    act(() => result.current.finishTutorial())

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(1)
  })

  it('retirarla dos veces no vuelve a escribir nada', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))
    act(() => result.current.finishTutorial())
    localStorage.removeItem(TUTORIAL_SEEN_KEY)

    act(() => result.current.finishTutorial())
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBeNull()
  })

  it('dejarla a medias no cuenta como vista', () => {
    // Volver al menú con el panel puesto no es haberla hecho: se la encontrará
    // otra vez al darle a empezar.
    const { result } = abrirEnPractica()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()
    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialSeen).toBe(false)
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBeNull()

    // Y el plazo que quedara vivo no puede darla por vista desde el menú.
    waitOutStep(result, 'grab')
    expect(result.current.gameState).toBe('menu')
    expect(result.current.tutorialSeen).toBe(false)
  })

  it('y la siguiente partida empieza la lección desde el principio', () => {
    // Los pasos dados por pasados se olvidan al volver al menú: si no, quien
    // dejó la lección a medias se encontraría el segundo paso sin ver el
    // primero.
    const { result } = abrirEnPractica()
    wearHeadset(result)
    act(() => result.current.startGame())
    runOutCountdown()
    act(() => result.current.nextTutorialStep())
    expect(result.current.tutorialStep).toBe('around')

    act(() => result.current.resetGame())
    act(() => result.current.startGame())
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('una vez vista no vuelve a salir al empezar otra', () => {
    const { result } = abrirEnPractica()
    wearHeadset(result)
    act(() => result.current.startGame())
    act(() => result.current.finishTutorial())
    runOutCountdown()

    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(false)
  })

  it('lo visto en otra visita sigue visto al volver', () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    const { result } = abrirEnPractica()

    expect(result.current.tutorialSeen).toBe(true)
  })

  it('se puede volver a ver aunque ya se conozca', () => {
    // Es lo que hace el botón del menú inmersivo: pedirlo explícitamente vale
    // más que lo que hubiera guardado.
    localStorage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    const { result } = abrirEnPractica()

    act(() => result.current.startGame({ tutorial: true }))
    expect(result.current.teaching).toBe(true)
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('con qué se juega lo apunta la sesión, y solo cambia lo que se enseña', () => {
    // Con las manos desnudas no hay botón que nombrar: cambia la frase, no lo
    // que hay que hacer.
    const { result } = abrirEnPractica()
    expect(result.current.bareHanded).toBe(false)

    act(() => result.current.setBareHanded(true))
    expect(result.current.bareHanded).toBe(true)
  })
})

/**
 * El calentamiento (`calentamiento.ts`): la primera partida con el visor, en el reto y con la
 * lección delante, no cuenta.
 */
describe('el calentamiento', () => {
  function enElReto(opciones?: OpcionesDelSalon) {
    const hook = renderHook(() => useGameStoreValue(opciones))
    act(() => hook.result.current.setImmersive(true))
    return hook
  }

  it('tres palos al suelo con la lección delante dejan el reto intacto', () => {
    const { result } = enElReto()
    act(() => result.current.startGame())
    runOutCountdown()
    expect(result.current.calentando).toBe(true)

    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.gameState).toBe('playing')
    expect(result.current.lives).toBe(3)
    expect(result.current.cartel?.title).toBe('Warm-up · does not count for a medal')
    expect(result.current.cartel?.subdued).toBe(true)
  })

  it('al cerrarse la lección el reto empieza de cero y avisa de que ya cuenta', () => {
    const { result } = enElReto({ objetivo: { medals: { bronze: 1900, silver: 3750, gold: 5200 }, better: 'higher', unit: 'points', record: null, mode: 'challenge' } })
    act(() => result.current.startGame())
    runOutCountdown()
    act(() => result.current.missStick())
    act(() => result.current.catchStick(0.5))
    const antes = result.current.runId

    // El segundo palo atrapado supera el último paso.
    act(() => result.current.catchStick(0.5))

    expect(result.current.calentando).toBe(false)
    expect(result.current.teaching).toBe(false)
    expect(result.current.runId).toBe(antes + 1)
    expect(result.current.gameState).toBe('countdown')
    expect([result.current.score, result.current.resolved, result.current.points, result.current.lives]).toEqual([0, 0, 0, 3])
    expect(result.current.ahoraCuenta).toBe(true)
    expect(result.current.cartel?.title).toBe('Now it counts for a medal')
    expect(result.current.cartel?.detail).toBe('Bronze ≈ 13 sticks · Gold 5,200')

    // Hasta que se resuelve el primer palo del reto.
    runOutCountdown()
    act(() => result.current.missStick())
    expect(result.current.ahoraCuenta).toBe(false)
    expect(result.current.lives).toBe(2)
  })

  it('saltar la lección también empieza el reto de cero', () => {
    const { result } = enElReto()
    act(() => result.current.startGame())
    runOutCountdown()
    act(() => result.current.missStick())
    act(() => result.current.finishTutorial())

    expect([result.current.calentando, result.current.resolved, result.current.gameState]).toEqual([false, 0, 'countdown'])
  })

  it('en la práctica, a dos y al volver al menú no hay calentamiento', () => {
    const practica = abrirEnPractica()
    act(() => practica.result.current.setImmersive(true))
    act(() => practica.result.current.startGame())
    expect(practica.result.current.calentando).toBe(false)

    const { result } = enElReto()
    act(() => result.current.startGame())
    act(() => result.current.resetGame())
    expect([result.current.calentando, result.current.ahoraCuenta]).toEqual([false, false])
  })
})

describe('práctica y desafío', () => {
  /**
   * Arranca una partida de desafío con `total` palos y la deja en juego. Pasa
   * por el menú primero, como el jugador: el modo solo se cambia ahí.
   */
  function startChallenge(
    store: { current: ReturnType<typeof useGameStoreValue> },
    total: number,
  ) {
    act(() => store.current.resetGame())
    act(() => store.current.setGameMode('challenge'))
    act(() => store.current.setStickCount(total))
    startPlaying(store)
  }

  it('el menú abre en el reto, con sus tres vidas: Jugar sin tocar nada empieza la partida que da medalla', () => {
    const { result } = renderHook(() => useGameStoreValue())

    expect(DEFAULT_GAME_MODE).toBe('challenge')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.lives).toBe(CHALLENGE_LIVES)

    startPlaying(result)

    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.activeStickCount).toBe(CHALLENGE_SETUP.stickCount)
    expect(result.current.activeDifficulty).toBe(CHALLENGE_SETUP.difficulty)
    expect(result.current.faseDelCartel).toBe('before')
  })

  it('y se abre en el reto siempre: no se recuerda el último modo jugado', () => {
    const first = abrirEnPractica()
    playRound(first.result, 5, 5)

    const reopened = renderHook(() => useGameStoreValue())

    expect(reopened.result.current.gameMode).toBe('challenge')
  })

  it('la práctica queda a un toque, sin vidas que perder', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGameMode('practice'))

    expect(result.current.gameMode).toBe('practice')
    expect(result.current.lives).toBeNull()
  })

  it('en práctica, fallarlos todos no corta la partida antes de tiempo', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setStickCount(13))
    startPlaying(result)

    for (let i = 0; i < 12; i++) act(() => result.current.missStick())

    expect(result.current.gameState).toBe('playing')
    expect(result.current.lives).toBeNull()
  })

  it('el desafío arranca con tres vidas y cada fallo cuesta una', () => {
    const { result } = abrirEnPractica()
    startChallenge(result, 13)
    expect(result.current.lives).toBe(3)

    act(() => result.current.missStick())
    expect(result.current.lives).toBe(2)

    act(() => result.current.missStick())
    expect(result.current.lives).toBe(1)
    expect(result.current.gameState).toBe('playing')
  })

  it('atrapar palos no gasta vidas', () => {
    const { result } = abrirEnPractica()
    startChallenge(result, 13)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))

    expect(result.current.lives).toBe(3)
  })

  it('quedarse sin vidas cierra la partida aunque queden palos', () => {
    // Es lo que distingue al desafío: la partida tiene un final que no depende
    // de que caiga todo lo que hay colgado.
    const { result } = abrirEnPractica()
    startChallenge(result, 13)

    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.lives).toBe(0)
    expect(result.current.outcome).toBe('failed')
    expect(result.current.gameState).toBe('finished')
    expect(result.current.resolved).toBeLessThan(result.current.stickCount)
  })

  it('un fallo de más no deja las vidas en negativo', () => {
    // Dos palos pueden tocar el suelo en el mismo lote justo al agotarse la
    // última vida.
    const { result } = abrirEnPractica()
    startChallenge(result, 13)

    act(() => {
      for (let i = 0; i < 4; i++) result.current.missStick()
    })

    expect(result.current.lives).toBe(0)
    expect(result.current.outcome).toBe('failed')
  })

  it('resolver todos los palos con vidas es superar el reto', () => {
    const { result } = abrirEnPractica()
    startChallenge(result, CHALLENGE_SETUP.stickCount)

    act(() => result.current.missStick())
    for (let i = 1; i < CHALLENGE_SETUP.stickCount; i++) act(() => result.current.catchStick(0.5))

    expect(result.current.outcome).toBe('cleared')
    expect(result.current.gameState).toBe('finished')
    expect(result.current.lives).toBe(2)
  })

  it('la partida de práctica termina sin desenlace de reto', () => {
    const { result } = abrirEnPractica()
    playRound(result, 5, 3)

    expect(result.current.gameState).toBe('finished')
    expect(result.current.outcome).toBe('cleared')
    expect(result.current.lives).toBeNull()
  })

  it('el modo sobrevive a la partida y a volver al menú', () => {
    // Como el número de palos o la dificultad: elegirlo otra vez en cada
    // revancha sería justo lo que estorba con el visor puesto.
    const { result } = abrirEnPractica()
    startChallenge(result, 5)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    act(() => result.current.resetGame())

    expect(result.current.gameMode).toBe('challenge')
    // Y las vidas vuelven a estar enteras: en el menú son las que se ponen en
    // juego, no las que quedaron de la anterior.
    expect(result.current.lives).toBe(3)
    expect(result.current.outcome).toBeNull()
  })

  it('el modo solo se cambia entre partidas', () => {
    // La puntuación y el modo en el que se hizo son un par: con el resumen en
    // pantalla, cambiar de modo mandaba esos puntos al récord del otro modo,
    // uno que no se ha jugado. Rompiendo la guarda, el récord de desafío
    // aparece con los puntos de esta partida de práctica.
    const { result } = abrirEnPractica()
    playRound(result, 5, 5)
    const points = result.current.points
    expect(points).toBeGreaterThan(0)

    act(() => result.current.setGameMode('challenge'))
    expect(result.current.gameMode).toBe('practice')

    act(() => result.current.resetGame())
    act(() => result.current.setGameMode('challenge'))
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.bestPoints).toBe(0)
  })

  it('cada modo lleva su propio récord', () => {
    // Un desafío se corta al quedarse sin vidas, así que con una marca común
    // nunca podría batir a la práctica equivalente.
    const { result } = abrirEnPractica()
    playRound(result, 5, 5)
    const practiceRecord = result.current.bestPoints
    expect(practiceRecord).toBeGreaterThan(0)

    startChallenge(result, 5)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    // Una partida sin puntos no deja récord, pero el de práctica tampoco se
    // asoma al desafío: aquí no hay nada hecho todavía.
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)

    act(() => result.current.resetGame())
    act(() => result.current.setGameMode('practice'))
    expect(result.current.bestPoints).toBe(practiceRecord)
  })

  it('un desafío bate su récord aunque quede lejos del de práctica', () => {
    // Es el motivo de que haya dos marcas: un desafío se corta al quedarse sin
    // vidas, así que con una sola nunca podría batir a la práctica y el modo
    // con algo en juego sería el único sin nada que superar.
    const { result } = abrirEnPractica()
    playRound(result, 5, 5)
    const practiceRecord = result.current.bestPoints

    startChallenge(result, 5)
    act(() => result.current.catchStick(0.5))
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.points).toBeLessThan(practiceRecord)
    expect(result.current.isRecord).toBe(true)
    expect(result.current.bestPoints).toBe(result.current.points)

    act(() => result.current.resetGame())
    act(() => result.current.setGameMode('practice'))
    expect(result.current.bestPoints).toBe(practiceRecord)
  })
})

describe('el desafío va preconfigurado', () => {
  it('juega siempre con lo que fija el modo, elija lo que se elija en práctica', () => {
    // Su récord es el de la cabina: con la dificultad y los palos a elegir, dos récords del
    // desafío no serían la misma partida.
    const { result } = abrirEnPractica()
    act(() => result.current.setDifficulty('impossible'))
    act(() => result.current.setStickCount(MAX_STICKS))
    act(() => result.current.setGameMode('challenge'))

    expect(result.current.activeDifficulty).toBe(CHALLENGE_SETUP.difficulty)
    expect(result.current.activeStickCount).toBe(CHALLENGE_SETUP.stickCount)

    // Y lo elegido sigue ahí para cuando se vuelva a la práctica.
    act(() => result.current.setGameMode('practice'))
    expect(result.current.activeDifficulty).toBe('impossible')
    expect(result.current.activeStickCount).toBe(MAX_STICKS)
  })
})

describe('el reto del salón', () => {
  const RETO = { seed: 20260925 }

  function conReto(opciones: OpcionesDelSalon) {
    return renderHook((props: OpcionesDelSalon) => useGameStoreValue(props), {
      initialProps: opciones,
    })
  }

  it('sin opciones se queda en el menú, con el reto elegido pero sin ser el reto del salón', () => {
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.gameState).toBe('menu')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.enReto).toBe(false)
  })

  it('con reto se entra contando, en el desafío y con lo que fija el modo', () => {
    const { result } = conReto({ reto: RETO })
    expect(result.current.gameState).toBe('countdown')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.enReto).toBe(true)
    expect(result.current.activeDifficulty).toBe(CHALLENGE_SETUP.difficulty)
    expect(result.current.activeStickCount).toBe(CHALLENGE_SETUP.stickCount)
    expect(result.current.lives).toBe(3)
    runOutCountdown()
    expect(result.current.gameState).toBe('playing')
  })

  it('sin lección, aunque se juegue con las gafas y no se haya visto nunca', () => {
    const { result } = conReto({ reto: RETO })
    act(() => result.current.setImmersive(true))
    runOutCountdown()
    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialStep).toBeNull()
  })

  it('la misma semilla reparte los mismos palos, y otra semilla no', () => {
    const uno = conReto({ reto: RETO }).result.current
    const otro = conReto({ reto: RETO }).result.current
    const distinto = conReto({ reto: { seed: RETO.seed + 1 } }).result.current

    expect(uno.stickSeed).toBe(otro.stickSeed)
    const reparto = (seed: number) =>
      buildStickLayout(CHALLENGE_SETUP.stickCount, seed).map(({ delay }) => delay)
    expect(reparto(uno.stickSeed)).toEqual(reparto(otro.stickSeed))
    expect(reparto(distinto.stickSeed)).not.toEqual(reparto(uno.stickSeed))
  })

  it('sin reto, cada partida estrena semilla', () => {
    const { result } = abrirEnPractica()
    startPlaying(result)
    const primera = result.current.stickSeed
    act(() => result.current.resetGame())
    startPlaying(result)
    expect(result.current.stickSeed).not.toBe(primera)
  })

  it('al acabar el reto avisa una vez, con sus puntos y como reto', () => {
    const onFinish = vi.fn()
    const { result, rerender } = conReto({ reto: RETO, onFinish })
    runOutCountdown()
    act(() => result.current.catchStick(0.5))
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.gameState).toBe('finished')
    // Volver a pintar la pantalla final —con otro aviso, además— no la cuenta otra vez.
    const otroAviso = vi.fn()
    rerender({ reto: RETO, onFinish: otroAviso })
    rerender({ reto: RETO, onFinish: otroAviso })

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith({
      mode: 'challenge',
      points: result.current.points,
      challenge: true,
    })
    expect(result.current.points).toBeGreaterThan(0)
    expect(otroAviso).not.toHaveBeenCalled()
  })

  it('un palo que se resuelve con la partida ya acabada no la cuenta otra vez', () => {
    // Dos palos pueden resolverse en el mismo lote que agota la última vida: la pantalla final
    // se vuelve a calcular con más puntos, pero la partida es la misma.
    const onFinish = vi.fn()
    const { result } = conReto({ reto: RETO, onFinish })
    runOutCountdown()
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    act(() => result.current.catchStick(0.5))

    expect(result.current.gameState).toBe('finished')
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('otra partida tras el reto ya no es el reto, aunque sea el mismo modo', () => {
    const onFinish = vi.fn()
    const { result } = conReto({ reto: RETO, onFinish })
    const semillaDelReto = result.current.stickSeed
    runOutCountdown()
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    startPlaying(result)
    expect(result.current.enReto).toBe(false)
    expect(result.current.stickSeed).not.toBe(semillaDelReto)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish).toHaveBeenLastCalledWith({ mode: 'challenge', points: 0, challenge: false })
  })

  it('avisa de cualquier partida con puntuación, no solo del desafío', () => {
    const onFinish = vi.fn()
    const { result } = abrirEnPractica({ onFinish })
    playRound(result, 5, 5)
    expect(onFinish).toHaveBeenCalledWith({
      mode: 'practice',
      points: result.current.points,
      challenge: false,
    })
  })

  it('dejarla a medias no es acabarla: no avisa', () => {
    const onFinish = vi.fn()
    const { result } = conReto({ reto: RETO, onFinish })
    runOutCountdown()
    act(() => result.current.catchStick(0.5))
    act(() => result.current.askToQuit())
    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.enReto).toBe(false)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('sin aviso que dar, acabar sigue guardando el récord como siempre', () => {
    const { result } = conReto({ reto: RETO })
    runOutCountdown()
    act(() => result.current.catchStick(0.5))
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(localStorage.getItem(HIGH_SCORE_KEYS.challenge)).toBe(String(result.current.points))
  })
})

describe('escenario o passthrough', () => {
  it('se entra con el escenario puesto', () => {
    // Es la experiencia completa; quien prefiera ver su cuarto lo quita desde
    // el menú inmersivo.
    const { result } = abrirEnPractica()
    expect(result.current.scenery).toBe('scene')
  })

  it('se puede alternar en cualquier momento', () => {
    const { result } = abrirEnPractica()

    act(() => result.current.setScenery('passthrough'))
    expect(result.current.scenery).toBe('passthrough')

    act(() => result.current.setScenery('scene'))
    expect(result.current.scenery).toBe('scene')
  })

  it('la elección sobrevive a la partida', () => {
    // Cambiar de decorado no es parte de la partida: quitarlo al empezar o al
    // volver al menú obligaría a elegirlo cada vez.
    const { result } = abrirEnPractica()
    act(() => result.current.setScenery('passthrough'))

    playRound(result, 5, 3)
    expect(result.current.scenery).toBe('passthrough')

    act(() => result.current.resetGame())
    expect(result.current.scenery).toBe('passthrough')
  })

  it('el selector del menú escribe el escenario del arcade, con sus valores', () => {
    // Una sola preferencia, la misma que enseña el panel del salón: `passthrough` se guarda
    // como `room`, que es lo que el salón y los demás juegos entienden.
    const { result } = abrirEnPractica()

    act(() => result.current.setScenery('passthrough'))
    expect(window.localStorage.getItem(SCENERY_KEY)).toBe('room')
    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()

    act(() => result.current.setScenery('scene'))
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })

  it('lo que se elige en el salón llega a la partida sin recargar', () => {
    const { result } = abrirEnPractica()

    act(() => {
      window.localStorage.setItem(SCENERY_KEY, 'room')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current.scenery).toBe('passthrough')
  })

  it('la clave propia del juego no manda y se borra al montar la partida, sin trasladarla', () => {
    // Con passthrough guardado en la clave propia de esta cabina no se puede quedar sin plaza:
    // manda lo que diga el salón, y sin nada elegido allí, el sitio dibujado.
    window.localStorage.setItem(OWN_SCENERY_KEY, 'passthrough')

    const { result } = abrirEnPractica()

    expect(result.current.scenery).toBe('scene')
    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })
})

describe('silencio', () => {
  // Ya no es una preferencia del juego: sale del volumen de efectos que se
  // elige en xrcade y vale para los doce (ver `ajustes.ts`). Lo que se
  // comprueba aquí es que el store lo traduce bien y que se entera de los
  // cambios, vengan del menú del arcade o de otra pestaña.
  it('se entra con sonido', () => {
    const { result } = abrirEnPractica()
    expect(result.current.muted).toBe(false)
  })

  it('se puede silenciar y volver a activar', () => {
    const { result } = abrirEnPractica()

    act(() => setVolume('sfx', 0))
    expect(result.current.muted).toBe(true)

    act(() => setVolume('sfx', DEFAULT_VOLUMES.sfx))
    expect(result.current.muted).toBe(false)
  })

  it('la elección sobrevive a la partida', () => {
    // Silenciar es una preferencia del jugador, no un ajuste de la ronda:
    // devolver el sonido al empezar o al volver al menú obligaría a apagarlo
    // cada vez, que es justo lo que molesta con el visor puesto.
    const { result } = abrirEnPractica()
    act(() => setVolume('sfx', 0))

    playRound(result, 5, 3)
    expect(result.current.muted).toBe(true)

    act(() => result.current.resetGame())
    expect(result.current.muted).toBe(true)
  })

  it('la elección sobrevive a la visita', () => {
    // Es para lo que se guarda: en el visor, apagar el sonido cada vez que uno
    // se pone las gafas es el gesto más incómodo que hay.
    const first = abrirEnPractica()
    act(() => setVolume('sfx', 0))
    first.unmount()

    const { result } = abrirEnPractica()
    expect(result.current.muted).toBe(true)
  })

  it('volver al sonido también se recuerda', () => {
    // El otro lado del mismo trato: quien lo enciende no se encuentra el juego
    // mudo otra vez en la visita siguiente.
    const first = abrirEnPractica()
    act(() => setVolume('sfx', 0))
    act(() => setVolume('sfx', DEFAULT_VOLUMES.sfx))
    first.unmount()

    const { result } = abrirEnPractica()
    expect(result.current.muted).toBe(false)
  })

  it('lo que silencie otra pestaña se ve aquí', () => {
    // El navegador cuenta con el evento `storage` que otra pestaña ha escrito.
    // Sin escucharlo, silenciar en una dejaría la otra sonando.
    const { result } = abrirEnPractica()

    act(() => {
      localStorage.setItem(VOLUME_KEYS.sfx, '0')
      window.dispatchEvent(new StorageEvent('storage', { key: VOLUME_KEYS.sfx }))
    })

    expect(result.current.muted).toBe(true)
  })
})

describe('altura del aro', () => {
  it('sin visor y sin corrección guardada, el aro está donde siempre', () => {
    const { result } = abrirEnPractica()
    expect(result.current.hoopAdjustment).toBe(0)
    expect(result.current.hoopHeight).toBeCloseTo(MACHINE_HEIGHT, 6)
  })

  it('sube y baja a pasos, y el aro le sigue', () => {
    const { result } = abrirEnPractica()

    act(() => result.current.adjustHoop(1))
    expect(result.current.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_STEP, 6)
    expect(result.current.hoopHeight).toBeCloseTo(
      MACHINE_HEIGHT + HOOP_ADJUST_STEP,
      6,
    )

    act(() => result.current.adjustHoop(-2))
    expect(result.current.hoopAdjustment).toBeCloseTo(-HOOP_ADJUST_STEP, 6)
  })

  it('no se pasa del tope por mucho que se insista', () => {
    // Es la valla que pide el enunciado: desde el menú no se puede dejar el aro
    // ni por las nubes ni dentro del suelo.
    const { result } = abrirEnPractica()

    for (let i = 0; i < 20; i++) act(() => result.current.adjustHoop(1))
    expect(result.current.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_RANGE, 6)

    for (let i = 0; i < 40; i++) act(() => result.current.adjustHoop(-1))
    expect(result.current.hoopAdjustment).toBeCloseTo(-HOOP_ADJUST_RANGE, 6)
  })

  it('la corrección se guarda y sigue ahí en la visita siguiente', () => {
    const { result, unmount } = abrirEnPractica()
    act(() => result.current.adjustHoop(-2))
    const chosen = result.current.hoopAdjustment
    unmount()

    // Otra visita: el store nace leyendo lo guardado, sin pasar por el menú.
    const { result: later } = abrirEnPractica()
    expect(later.current.hoopAdjustment).toBeCloseTo(chosen, 6)
  })

  it('no escribe nada cuando la pulsación no cambia el valor', () => {
    // En el tope el botón se apaga, pero un mando que insista no puede acabar
    // escribiendo en el almacenamiento en cada pulsación.
    const { result } = abrirEnPractica()
    for (let i = 0; i < 4; i++) act(() => result.current.adjustHoop(1))

    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    act(() => result.current.adjustHoop(1))
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it('la corrección sobrevive a la partida', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.adjustHoop(-1))
    const chosen = result.current.hoopAdjustment

    playRound(result, 5, 3)
    expect(result.current.hoopAdjustment).toBeCloseTo(chosen, 6)

    act(() => result.current.resetGame())
    expect(result.current.hoopAdjustment).toBeCloseTo(chosen, 6)
  })

  it('con el visor midiendo, el aro se planta sobre los ojos del jugador', () => {
    const { result } = abrirEnPractica()

    act(() => result.current.setPlayerEyeHeight(1.2))
    const seated = result.current.hoopHeight
    expect(seated).toBeLessThan(MACHINE_HEIGHT)

    // Y la corrección manual se suma a lo medido, no lo sustituye.
    act(() => result.current.adjustHoop(1))
    expect(result.current.hoopHeight).toBeCloseTo(seated + HOOP_ADJUST_STEP, 6)
  })

  it('al cerrarse la sesión el aro vuelve a su altura de referencia', () => {
    // Fuera del visor no hay a quién medir, y la medida de la última sesión no
    // dice nada de quien juegue después.
    const { result } = abrirEnPractica()
    act(() => result.current.setPlayerEyeHeight(1.9))
    expect(result.current.hoopHeight).toBeGreaterThan(MACHINE_HEIGHT)

    act(() => result.current.setPlayerEyeHeight(null))
    expect(result.current.hoopHeight).toBeCloseTo(MACHINE_HEIGHT, 6)
  })

  it('la medida del visor queda a la vista, no solo dentro del aro', () => {
    // La interfaz inmersiva también cuelga de los ojos del jugador (ver
    // `xrUiRise` en `xrLayout.ts`), así que necesita el mismo dato.
    const { result } = abrirEnPractica()
    expect(result.current.playerEyeHeight).toBeNull()

    act(() => result.current.setPlayerEyeHeight(1.2))
    expect(result.current.playerEyeHeight).toBe(1.2)

    act(() => result.current.setPlayerEyeHeight(null))
    expect(result.current.playerEyeHeight).toBeNull()
  })

  it('una medida imposible del visor no mueve el aro', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setPlayerEyeHeight(Number.NaN))
    expect(result.current.hoopHeight).toBeCloseTo(MACHINE_HEIGHT, 6)
  })
})

describe('puntuación y racha', () => {
  it('atrapar suma puntos; fallar no', () => {
    const { result } = abrirEnPractica()
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    const afterCatch = result.current.points
    expect(afterCatch).toBeGreaterThan(0)

    act(() => result.current.missStick())
    expect(result.current.points).toBe(afterCatch)
  })

  it('cogerlo pronto puntúa más que rescatarlo del suelo', () => {
    const early = abrirEnPractica()
    startPlaying(early.result)
    act(() => early.result.current.catchStick(0))

    const late = abrirEnPractica()
    startPlaying(late.result)
    act(() => late.result.current.catchStick(1))

    expect(early.result.current.points).toBeGreaterThan(late.result.current.points)
  })

  it('la misma partida renta más en una dificultad alta', () => {
    const easy = abrirEnPractica()
    startPlaying(easy.result)
    act(() => easy.result.current.catchStick(0.5))

    const hard = abrirEnPractica()
    act(() => hard.result.current.setDifficulty('impossible'))
    startPlaying(hard.result)
    act(() => hard.result.current.catchStick(0.5))

    expect(hard.result.current.points).toBeGreaterThan(easy.result.current.points)
  })

  it('la racha crece al encadenar y se rompe al fallar', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setStickCount(9))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))
    expect(result.current.streak).toBe(2)

    act(() => result.current.missStick())
    expect(result.current.streak).toBe(0)

    act(() => result.current.catchStick(0.5))
    expect(result.current.streak).toBe(1)
  })

  it('guarda la mejor racha aunque luego se rompa', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setStickCount(9))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))
    act(() => result.current.missStick())

    expect(result.current.streak).toBe(0)
    expect(result.current.bestStreak).toBe(3)
  })

  it('dos palos atrapados en el mismo lote puntúan cada uno por su racha', () => {
    // Los dos mandos XR pueden resolver a la vez. Si la racha se leyera del
    // render anterior, ambos cobrarían el mismo bonus y el segundo saldría
    // barato.
    const batched = abrirEnPractica()
    act(() => batched.result.current.setStickCount(9))
    startPlaying(batched.result)
    act(() => {
      batched.result.current.catchStick(0.5)
      batched.result.current.catchStick(0.5)
    })

    const sequential = abrirEnPractica()
    act(() => sequential.result.current.setStickCount(9))
    startPlaying(sequential.result)
    act(() => sequential.result.current.catchStick(0.5))
    act(() => sequential.result.current.catchStick(0.5))

    expect(batched.result.current.streak).toBe(2)
    expect(batched.result.current.points).toBe(sequential.result.current.points)
  })

  it('empezar otra partida borra puntos y racha', () => {
    const { result } = abrirEnPractica()
    playRound(result, 5, 5)
    expect(result.current.points).toBeGreaterThan(0)

    startPlaying(result)

    expect(result.current.points).toBe(0)
    expect(result.current.streak).toBe(0)
    expect(result.current.bestStreak).toBe(0)
  })
})

describe('mejor puntuación', () => {
  it('se empieza sin récord', () => {
    const { result } = abrirEnPractica()
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('la marca a batir no se mueve mientras se juega', () => {
    // Si el récord se actualizara palo a palo, al terminar sería siempre igual
    // a los puntos de la partida y nunca se podría decir que se ha batido.
    const { result } = abrirEnPractica()
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => result.current.catchStick(0))

    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('al terminar, la puntuación pasa a ser el récord', () => {
    const { result } = abrirEnPractica()
    playRound(result, 5, 5)

    expect(result.current.bestPoints).toBe(result.current.points)
    expect(result.current.isRecord).toBe(true)
  })

  it('una partida peor no baja el récord ni lo anuncia', () => {
    const { result } = abrirEnPractica()
    playRound(result, 5, 5)
    const record = result.current.bestPoints

    playRound(result, 5, 1)

    expect(result.current.points).toBeLessThan(record)
    expect(result.current.bestPoints).toBe(record)
    expect(result.current.isRecord).toBe(false)
  })

  it('el récord sobrevive a volver al menú y a la siguiente partida', () => {
    const { result } = abrirEnPractica()
    playRound(result, 5, 5)
    const record = result.current.bestPoints

    act(() => result.current.resetGame())
    expect(result.current.bestPoints).toBe(record)
    // Y el anuncio se apaga: pertenece a la partida que acaba de terminar.
    expect(result.current.isRecord).toBe(false)

    startPlaying(result)
    expect(result.current.bestPoints).toBe(record)
  })

  it('una partida sin atrapar nada no cuenta como récord', () => {
    const { result } = abrirEnPractica()
    playRound(result, 5, 0)

    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('el récord sigue ahí al volver a abrir el juego', () => {
    // Es lo que separa "entre partidas" de "entre visitas": el segundo store
    // no comparte nada con el primero salvo el almacenamiento del navegador.
    const first = abrirEnPractica()
    playRound(first.result, 5, 5)
    const record = first.result.current.bestPoints
    expect(record).toBeGreaterThan(0)

    const reopened = abrirEnPractica()

    expect(reopened.result.current.bestPoints).toBe(record)
    // Recuperado, no recién batido: nadie ha jugado todavía en esta visita.
    expect(reopened.result.current.isRecord).toBe(false)
  })

  it('sin poder guardar no se anuncia un récord que no existe', () => {
    // Modo privado: `localStorage` existe pero lanza al escribir. Ahí la marca
    // a batir se queda a cero para siempre, así que sin comprobar que el
    // récord llegó a guardarse toda partida con puntos sería "nuevo récord".
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })

    const { result } = abrirEnPractica()
    playRound(result, 5, 5)

    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('no anuncia récord si otra pestaña guardó algo mejor mientras se jugaba', () => {
    // La marca a batir se congela al empezar, así que una partida puede superar
    // esa y aun así quedarse por debajo de lo guardado. Anunciarla sería
    // prometer un récord que el menú va a desmentir en cuanto se vuelva.
    const { result } = abrirEnPractica()
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => {
      localStorage.setItem(HIGH_SCORE_KEYS.practice, '999999')
      window.dispatchEvent(
        new StorageEvent('storage', { key: HIGH_SCORE_KEYS.practice }),
      )
    })
    for (let i = 0; i < 5; i++) act(() => result.current.catchStick(0.5))

    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.bestPoints).toBe(999999)
    expect(result.current.isRecord).toBe(false)
  })

  it('un récord ilegible en el navegador no rompe el juego', () => {
    localStorage.setItem('stick-rush:best-points', 'lo que sea')

    const { result } = abrirEnPractica()

    expect(result.current.bestPoints).toBe(0)

    // Y la primera partida lo deja bien escrito.
    playRound(result, 5, 5)
    expect(result.current.bestPoints).toBe(result.current.points)
  })
})

describe('vuelta al menú y revancha', () => {
  it('vuelve al menú conservando la configuración elegida', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setDifficulty('hard'))
    playRound(result, 6, 2)

    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
    expect(result.current.stickCount).toBe(6)
    expect(result.current.difficulty).toBe('hard')
  })

  it('no se queda en "terminada" al encadenar otra partida', () => {
    const { result } = abrirEnPractica()
    playRound(result, 5, 5)
    expect(result.current.gameState).toBe('finished')

    startPlaying(result)

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('no da por terminada una partida que no ha empezado', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.missStick())
    expect(result.current.gameState).toBe('menu')
  })
})

describe('práctica sin fin', () => {
  it('al resolver la tanda la máquina se recarga en vez de acabar, y termina el jugador', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setEndless(true))
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    const primerReparto = result.current.stickSeed

    for (let i = 0; i < 5; i++) act(() => result.current.catchStick(0.5))

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(5)
    // Tanda nueva: palos nuevos, contador de tanda a cero, el de la partida sigue.
    expect(result.current.stickSeed).not.toBe(primerReparto)
    expect(result.current.waveResolved).toBe(0)
    expect(result.current.waveScore).toBe(0)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.endRun())

    expect(result.current.gameState).toBe('finished')
    expect(result.current.outcome).toBe('cleared')
    // La marca de este modo es la racha, no los puntos.
    expect(result.current.bestPoints).toBe(6)
    expect(result.current.isRecord).toBe(true)
    expect(localStorage.getItem(HIGH_SCORE_KEYS.practice)).toBeNull()
  })
})

describe('modo niveles', () => {
  it('juega el nivel más alto desbloqueado con sus palos y velocidad, sin vidas', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setGameMode('levels'))
    act(() => result.current.setDifficulty('impossible'))

    expect(result.current.activeLevel).toBe(1)
    expect(result.current.activeStickCount).toBe(5)
    expect(result.current.activeDifficulty).toBe('easy')
    expect(result.current.lives).toBeNull()
  })

  it('superar el nivel da estrellas y desbloquea el siguiente, sin mover el jugado', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setGameMode('levels'))
    startPlaying(result)

    for (let i = 0; i < 5; i++) act(() => (i < 4 ? result.current.catchStick(0.5) : result.current.missStick()))

    expect(result.current.gameState).toBe('finished')
    expect(result.current.levelResult).toEqual({ stars: 2, passed: true, unlocked: 2 })
    expect(result.current.unlockedLevel).toBe(2)
    expect(result.current.activeLevel).toBe(1)

    act(() => result.current.resetGame())
    expect(result.current.activeLevel).toBe(2)
    expect(result.current.activeStickCount).toBe(9)
  })

  it('no superar no abre nada, y no se elige más allá de lo desbloqueado', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setGameMode('levels'))
    act(() => result.current.setLevel(9))
    expect(result.current.activeLevel).toBe(1)
    startPlaying(result)

    for (let i = 0; i < 5; i++) act(() => result.current.missStick())

    expect(result.current.levelResult).toEqual({ stars: 0, passed: false, unlocked: null })
    expect(result.current.unlockedLevel).toBe(1)
    expect(result.current.isRecord).toBe(false)
  })
})

describe('terminar el tutorial cuando ya no está', () => {
  it('no hace nada', () => {
    // El botón de saltar y el reloj del tutorial llaman a lo mismo: sin esto,
    // el que llegue segundo arrancaría otra cuenta atrás a media partida.
    const { result } = abrirEnPractica()

    act(() => result.current.finishTutorial())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.countdown).toBe(0)
  })
})

describe('usar el store sin haberlo montado', () => {
  it('avisa con un error claro en vez de romper en otro sitio', () => {
    expect(() => renderHook(() => useGame())).toThrow(/GameProvider/)
  })
})

describe('elegir nivel a media partida', () => {
  it('no se puede: el nivel que se juega es el de cuando empezó', () => {
    // Cambiarlo por debajo cambiaría los palos y la velocidad a mitad de tanda.
    const { result } = abrirEnPractica()
    act(() => result.current.setGameMode('levels'))
    act(() => result.current.startGame())
    const jugando = result.current.activeLevel

    act(() => result.current.setLevel(1))

    expect(result.current.activeLevel).toBe(jugando)
  })
})

/**
 * Dejar la partida pregunta antes.
 *
 * **Se pulsa sin querer y se pierde lo hecho.** Con el visor puesto no se ve lo que hay a
 * los lados y la mano va a por los palos. Lo que hace que preguntar no salga caro es que la
 * partida se para: no cae ningún palo mientras la pregunta está en pantalla.
 */
describe('dejar la partida', () => {
  it('pregunta en vez de salir', () => {
    const hook = abrirEnPractica()
    act(() => hook.result.current.startGame())

    act(() => hook.result.current.askToQuit())

    expect(hook.result.current.prompt).toBe('quit')
    expect(hook.result.current.gameState).not.toBe('menu')
  })

  it('seguir jugando la devuelve donde estaba', () => {
    const hook = abrirEnPractica()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.keepPlaying())

    expect(hook.result.current.prompt).toBeNull()
  })

  it('y confirmar sí sale', () => {
    const hook = abrirEnPractica()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.resetGame())

    expect(hook.result.current.prompt).toBeNull()
    expect(hook.result.current.gameState).toBe('menu')
  })

  it('empezar otra se lleva la pregunta por delante', () => {
    const hook = abrirEnPractica()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.startGame())

    expect(hook.result.current.prompt).toBeNull()
  })
})

describe('la partida a dos', () => {
  type Store = { current: ReturnType<typeof useGameStoreValue> }

  /** Una tanda del desafío entera: atrapa `atrapa` palos y pierde el resto, hasta que se acaba. */
  function unaTanda(store: Store, atrapa: number) {
    startPlaying(store)
    for (let i = 0; i < CHALLENGE_SETUP.stickCount && store.current.gameState === 'playing'; i++) {
      act(() => {
        if (i < atrapa) store.current.catchStick(0.5)
        else store.current.missStick()
      })
    }
  }

  function aDos(onFinish?: OpcionesDelSalon['onFinish']) {
    const hook = renderHook(() => useGameStoreValue({ onFinish }))
    act(() => hook.result.current.setGameMode('challenge'))
    act(() => hook.result.current.setPlayers(2))
    return hook
  }

  it('solo, el desafío es el de siempre: sin partida a dos', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setGameMode('challenge'))
    expect(result.current.players).toBe(1)
    startPlaying(result)
    expect(result.current.duel).toBeNull()
    expect(result.current.player).toBeNull()
  })

  it('a dos fuera del desafío no cuenta: se juega solo', () => {
    const { result } = abrirEnPractica()
    act(() => result.current.setPlayers(2))
    startPlaying(result)
    expect(result.current.duel).toBeNull()
  })

  it('empieza el primero, y al acabar su tanda le pasa el mando al segundo', () => {
    const { result } = aDos()
    startPlaying(result)
    expect(result.current.player).toBe(0)

    for (let i = 0; i < CHALLENGE_SETUP.stickCount; i++) act(() => result.current.catchStick(0.5))
    const primero = result.current.points
    expect(result.current.gameState).toBe('finished')
    // Su tanda ya está apuntada, y el mando es del segundo.
    expect(result.current.duel?.points).toEqual([primero, null])
    expect(result.current.player).toBe(1)
    expect(result.current.celebra).toBe(false)
  })

  it('los dos juegan la misma tanda: la misma semilla, los mismos palos', () => {
    const { result } = aDos()
    unaTanda(result, 0)
    const semilla = result.current.stickSeed
    const palos = buildStickLayout(CHALLENGE_SETUP.stickCount, semilla)

    startPlaying(result)
    expect(result.current.stickSeed).toBe(semilla)
    expect(buildStickLayout(CHALLENGE_SETUP.stickCount, result.current.stickSeed)).toEqual(palos)
    expect(result.current.player).toBe(1)
  })

  it('gana quien más saca, se apunta a la pareja, suena a ganar y no toca el récord', () => {
    const onFinish = vi.fn()
    const { result, rerender } = aDos(onFinish)
    unaTanda(result, 5)
    const primero = result.current.points
    unaTanda(result, 1)
    const segundo = result.current.points

    expect(primero).toBeGreaterThan(segundo)
    expect(result.current.duel?.points).toEqual([primero, segundo])
    expect(result.current.duelTally).toEqual({ wins: [1, 0], ties: 0 })
    expect(result.current.celebra).toBe(true)
    expect(result.current.isRecord).toBe(false)
    expect(localStorage.getItem(HIGH_SCORE_KEYS.challenge)).toBeNull()
    // Al salón, la partida entera y una sola vez, aunque se vuelva a pintar.
    rerender()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith({ mode: 'duel', points: primero, challenge: false })
  })

  it('con los mismos puntos es empate', () => {
    const { result } = aDos()
    unaTanda(result, 0)
    unaTanda(result, 0)
    expect(result.current.duel?.points).toEqual([0, 0])
    expect(result.current.duelTally).toEqual({ wins: [0, 0], ties: 1 })
  })

  it('otra vez tras una partida acabada empieza otra, con otra semilla', () => {
    const { result } = aDos()
    unaTanda(result, 0)
    const semilla = result.current.stickSeed
    unaTanda(result, 0)
    startPlaying(result)
    expect(result.current.duel?.points).toEqual([null, null])
    expect(result.current.stickSeed).not.toBe(semilla)
    expect(result.current.player).toBe(0)
  })

  it('volver al menú deja la partida: la siguiente empieza de cero', () => {
    const { result } = aDos()
    unaTanda(result, 0)
    act(() => result.current.resetGame())
    expect(result.current.duel).toBeNull()
    startPlaying(result)
    expect(result.current.duel?.points).toEqual([null, null])
  })

  it('cambiar a jugar solo a media partida la deja', () => {
    const { result } = aDos()
    unaTanda(result, 0)
    act(() => result.current.setPlayers(1))
    startPlaying(result)
    expect(result.current.duel).toBeNull()
  })
})

describe('las hazañas', () => {
  type Store = { current: ReturnType<typeof useGameStoreValue> }

  function conAviso() {
    const onFinish = vi.fn()
    const hook = abrirEnPractica({ onFinish })
    return { ...hook, onFinish }
  }

  /** Lo que se le contó al salón la última vez. */
  function ultimo(onFinish: ReturnType<typeof vi.fn>) {
    return onFinish.mock.lastCall?.[0] as { feats?: readonly string[] } | undefined
  }

  function bajarElAroDelTodo(store: Store) {
    for (let i = 0; i < 20; i++) act(() => store.current.adjustHoop(-1))
  }

  it('los trece de una tanda sin que se escape ninguno: SR_CLEAN_SWEEP, una sola vez', () => {
    const { result, onFinish } = conAviso()
    playRound(result, MAX_STICKS, MAX_STICKS)
    expect(ultimo(onFinish)?.feats).toEqual([HAZANAS.tandaLimpia])
    expect(JSON.parse(localStorage.getItem(HAZANAS_KEY)!)).toEqual([HAZANAS.tandaLimpia])

    // La segunda vez ya estaba: el resultado vuelve a ser el de siempre.
    playRound(result, MAX_STICKS, MAX_STICKS)
    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(ultimo(onFinish)).not.toHaveProperty('feats')
  })

  it('doce de trece no la dan', () => {
    const { result, onFinish } = conAviso()
    playRound(result, MAX_STICKS, MAX_STICKS - 1)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(ultimo(onFinish)).not.toHaveProperty('feats')
  })

  it('en el desafío, la tanda entera sin perder una vida la da; quedarse sin vidas no', () => {
    const { result, onFinish } = conAviso()
    act(() => result.current.setGameMode('challenge'))
    startPlaying(result)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(result.current.gameState).toBe('finished')
    expect(ultimo(onFinish)).not.toHaveProperty('feats')

    startPlaying(result)
    for (let i = 0; i < CHALLENGE_SETUP.stickCount; i++) act(() => result.current.catchStick(0.5))
    expect(ultimo(onFinish)?.feats).toEqual([HAZANAS.tandaLimpia])
  })

  it('con el aro al mínimo, una tanda limpia de cinco: SR_LOW_HOOP', () => {
    const { result, onFinish } = conAviso()
    bajarElAroDelTodo(result)
    expect(result.current.hoopAdjustment).toBe(-HOOP_ADJUST_RANGE)
    playRound(result, 5, 5)
    expect(ultimo(onFinish)?.feats).toEqual([HAZANAS.aroAlMinimo])
  })

  it('con el aro un paso por encima del mínimo no, ni al mínimo con uno escapado', () => {
    const { result, onFinish } = conAviso()
    bajarElAroDelTodo(result)
    act(() => result.current.adjustHoop(1))
    playRound(result, 5, 5)
    expect(ultimo(onFinish)).not.toHaveProperty('feats')

    act(() => result.current.adjustHoop(-1))
    playRound(result, 5, 4)
    expect(ultimo(onFinish)).not.toHaveProperty('feats')
  })

  it('un palo cogido de espaldas: SR_BEHIND_BACK', () => {
    const { result, onFinish } = conAviso()
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    act(() => result.current.catchStick(0.5, true))
    for (let i = 0; i < 4; i++) act(() => result.current.missStick())
    expect(ultimo(onFinish)?.feats).toEqual([HAZANAS.deEspaldas])
  })

  it('cogerlos todos de frente no la da', () => {
    const { result, onFinish } = conAviso()
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    for (let i = 0; i < 5; i++) act(() => result.current.catchStick(0.5, false))
    expect(ultimo(onFinish)).not.toHaveProperty('feats')
  })

  it('sin fin, cuenta cada tanda al recargar, y se da al terminar la partida', () => {
    const { result, onFinish } = conAviso()
    act(() => result.current.setEndless(true))
    act(() => result.current.setStickCount(MAX_STICKS))
    startPlaying(result)
    for (let i = 0; i < MAX_STICKS; i++) act(() => result.current.catchStick(0.5))
    expect(result.current.wave).toBe(1)
    // La segunda tanda, a medias: no es tanda, pero la primera ya cuenta.
    act(() => result.current.catchStick(0.5))
    act(() => result.current.endRun())
    expect(ultimo(onFinish)?.feats).toEqual([HAZANAS.tandaLimpia])
  })

  it('sin fin, la tanda con uno escapado no cuenta', () => {
    const { result, onFinish } = conAviso()
    act(() => result.current.setEndless(true))
    act(() => result.current.setStickCount(MAX_STICKS))
    startPlaying(result)
    act(() => result.current.missStick())
    for (let i = 1; i < MAX_STICKS; i++) act(() => result.current.catchStick(0.5))
    expect(result.current.wave).toBe(1)
    act(() => result.current.endRun())
    expect(ultimo(onFinish)).not.toHaveProperty('feats')
  })

  it('dejar la partida a medias pierde lo conseguido en ella', () => {
    const { result, onFinish } = conAviso()
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    act(() => result.current.catchStick(0.5, true))
    act(() => result.current.resetGame())
    playRound(result, 5, 4)
    expect(ultimo(onFinish)).not.toHaveProperty('feats')
    expect(localStorage.getItem(HAZANAS_KEY)).toBeNull()
  })

  it('a dos, lo del primer turno se cuenta al salón al acabar el segundo', () => {
    const { result, onFinish } = conAviso()
    act(() => result.current.setGameMode('challenge'))
    act(() => result.current.setPlayers(2))
    startPlaying(result)
    for (let i = 0; i < CHALLENGE_SETUP.stickCount; i++) act(() => result.current.catchStick(0.5))
    expect(onFinish).not.toHaveBeenCalled()

    startPlaying(result)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(ultimo(onFinish)).toMatchObject({ mode: 'duel', feats: [HAZANAS.tandaLimpia] })

    // La partida siguiente empieza de cero: lo de la anterior no se arrastra.
    startPlaying(result)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    startPlaying(result)
    act(() => result.current.catchStick(0.5, true))
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(ultimo(onFinish)).toMatchObject({ mode: 'duel', feats: [HAZANAS.deEspaldas] })
  })
})

describe('el cartel del objetivo', () => {
  /** Los listones de Stick Rush en el salón. */
  const OBJETIVO: Goal = {
    medals: { bronze: 1900, silver: 3750, gold: 5200 },
    better: 'higher',
    unit: 'points in challenge',
    record: null,
    mode: 'challenge',
  }

  afterEach(() => {
    act(() => setLang('en'))
  })

  function conObjetivo(objetivo: Goal | undefined = OBJETIVO) {
    return renderHook(() => useGameStoreValue({ objetivo }))
  }

  it('al acabar compara con el récord del salón de antes, aunque el salón ya apunte la marca nueva', () => {
    const conRecord = { ...OBJETIVO, record: 0 }
    const hook = renderHook(({ objetivo }) => useGameStoreValue({ objetivo }), { initialProps: { objetivo: conRecord } })
    startPlaying(hook.result)
    act(() => hook.result.current.catchStick(0.5))
    for (let i = 0; i < 3; i++) act(() => hook.result.current.missStick())
    expect(hook.result.current.gameState).toBe('finished')
    const puntos = hook.result.current.points
    expect(puntos).toBeGreaterThan(0)
    // Lo que hace el salón al recibir el resultado: el objetivo vuelve con la marca nueva.
    hook.rerender({ objetivo: { ...conRecord, record: puntos } })

    expect(JSON.stringify(hook.result.current.cartel)).toContain('New record!')
    expect(JSON.stringify(hook.result.current.cartel)).not.toContain('matched')
  })

  it('en el menú no hay cartel', () => {
    const { result } = conObjetivo()

    expect(result.current.cartel).toBeNull()
    expect(result.current.faseDelCartel).toBeNull()
    expect(result.current.medalla).toBeNull()
  })

  it('al darle a Jugar sin tocar nada: la misión y el bronce en palos, hasta el primer palo', () => {
    const { result } = conObjetivo()
    act(() => result.current.startGame())

    expect(result.current.faseDelCartel).toBe('before')
    // Sin récord, la primera vez: el bronce contado en palos, que es lo que cuenta la misión.
    expect(result.current.cartel).toMatchObject({
      title: 'Catch 13 sticks. Drop three and out',
      detail: 'Bronze ≈ 13 sticks · Gold 5,200',
    })

    runOutCountdown()
    expect(result.current.faseDelCartel).toBe('before')

    act(() => result.current.missStick())
    expect(result.current.faseDelCartel).toBe('playing')
    expect(result.current.cartel).toMatchObject({ title: 'Bronze at 1,900 · you have 0', detail: 'Lives ♥♥♡ · Sticks 12' })
  })

  it('la medalla sube al cruzar cada listón, con los puntos de la partida', () => {
    const { result } = conObjetivo({ ...OBJETIVO, medals: { bronze: 1, silver: 400, gold: 100000 } })
    startPlaying(result)
    expect(result.current.medalla).toBeNull()

    act(() => result.current.catchStick(0.5))
    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.points).toBeLessThan(400)
    expect(result.current.medalla).toBe('bronze')

    for (let i = 0; i < 3; i++) act(() => result.current.catchStick(0.5))
    expect(result.current.points).toBeGreaterThanOrEqual(400)
    expect(result.current.medalla).toBe('silver')
    expect(result.current.cartel?.title).toBe(
      `Gold at 100,000 · you have ${formatoDeCifra(result.current.points, 'en')}`,
    )
  })

  it('al acabar dice lo conseguido y lo que faltó, y otra partida empieza de nuevo por la misión', () => {
    const { result } = conObjetivo()
    startPlaying(result)
    act(() => result.current.catchStick(0.5))
    const puntos = result.current.points
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.gameState).toBe('finished')
    expect(result.current.faseDelCartel).toBe('end')
    expect(result.current.cartel).toMatchObject({
      title: `No medal · ${puntos} points in challenge`,
      detail: `${formatoDeCifra(1900 - puntos, 'en')} short of bronze`,
    })

    // «Otra»: repetir el reto sin pasar por el menú.
    act(() => result.current.startGame())
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.faseDelCartel).toBe('before')
    expect(result.current.medalla).toBeNull()
  })

  it('se dice en el idioma de quien juega', () => {
    const { result } = conObjetivo()
    act(() => setLang('es'))
    act(() => result.current.startGame())

    expect(result.current.cartel).toMatchObject({
      title: 'Atrapa 13 palos. Tres al suelo y fuera',
      detail: 'Bronce ≈ 13 palos · Oro 5200',
    })
  })

  it('en la práctica, dentro del salón, dice que no cuenta y no lleva la cuenta', () => {
    const { result } = conObjetivo()
    act(() => result.current.setGameMode('practice'))
    startPlaying(result)

    expect(result.current.cartel).toMatchObject({ title: 'Practice · does not count for a medal', subdued: true })
    expect(result.current.faseDelCartel).toBeNull()
    expect(result.current.medalla).toBeNull()
  })

  it('a dos tampoco cuenta, y al acabar la tanda el cartel se retira', () => {
    const { result } = conObjetivo()
    act(() => result.current.setPlayers(2))
    startPlaying(result)

    expect(result.current.cartel?.title).toBe('Duel · does not count for a medal')
    expect(result.current.faseDelCartel).toBeNull()

    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(result.current.gameState).toBe('finished')
    expect(result.current.cartel).toBeNull()
  })

  it('con el juego abierto suelto: la misión y el récord guardado aquí, y fuera del reto nada', () => {
    localStorage.setItem(HIGH_SCORE_KEYS.challenge, '3100')
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())

    expect(result.current.cartel).toMatchObject({
      title: 'Catch 13 sticks. Drop three and out',
      detail: 'Your record 3,100',
    })
    expect(result.current.medalla).toBeNull()

    act(() => result.current.resetGame())
    act(() => result.current.setGameMode('practice'))
    startPlaying(result)
    expect(result.current.cartel).toBeNull()
  })

  it('con el reto del salón se entra ya con la misión delante', () => {
    const { result } = renderHook(() => useGameStoreValue({ reto: { seed: 7 }, objetivo: OBJETIVO }))

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.faseDelCartel).toBe('before')
    expect(result.current.cartel?.detail).toBe('Bronze ≈ 13 sticks · Gold 5,200')
  })
})

describe('el gancho de los e2e comunes (`partidaDePrueba.ts`)', () => {
  /** Los listones de ensayo de los e2e: el bronce a 10, sin récord. */
  const ENSAYO: Goal = {
    medals: { bronze: 10, silver: 20, gold: 30 },
    better: 'higher',
    unit: 'points in challenge',
    record: null,
    mode: 'challenge',
  }

  // Las escenas de los tests de antes siguen montadas: con el gancho pedido, también se dejarían.
  beforeEach(() => cleanup())
  afterEach(() => {
    delete window.__runStickRush
  })

  it('sin pedirlo no se deja nada', () => {
    renderHook(() => useGameStoreValue({ objetivo: ENSAYO }))
    expect(window.__runStickRush).toBeUndefined()
  })

  it('empieza el reto sin cuenta atrás, le pone los puntos, cruza el bronce y lo acaba contándoselo al salón', () => {
    window.__runStickRush = {}
    const onFinish = vi.fn()
    const { result } = renderHook(() => useGameStoreValue({ objetivo: ENSAYO, onFinish }))
    const partida = window.__runStickRush!

    expect(partida.sign!()).toBeNull()
    act(() => partida.start!())
    expect([result.current.gameState, result.current.gameMode, result.current.teaching]).toEqual(['playing', 'challenge', false])
    expect(partida.sign!()?.detail).toBe('Bronze 10 · Silver 20 · Gold 30')

    act(() => partida.score!(1))
    expect(partida.sign!()?.title).toBe('Bronze at 10 · you have 1')
    act(() => partida.score!(10))
    expect(partida.sign!()?.cheer).toBe('Bronze!')
    expect(result.current.resolved).toBe(1)

    act(() => partida.end!())
    expect(result.current.gameState).toBe('finished')
    expect(result.current.outcome).toBe('cleared')
    expect(partida.sign!()?.title).toBe('Bronze · 10 points in challenge')
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ mode: 'challenge', points: 10 }))
  })
})
