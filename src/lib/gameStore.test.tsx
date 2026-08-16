import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MACHINE_HEIGHT, MAX_STICKS, MIN_STICKS } from './gameConfig'
import { COUNTDOWN_SECONDS, useGameStoreValue } from './gameStore'
import { HIGH_SCORE_KEYS } from './highScore'
import { HOOP_ADJUST_RANGE, HOOP_ADJUST_STEP } from './hoopHeight'
import { MUTED_KEY } from './mutePreference'
import { TUTORIAL_SECONDS, TUTORIAL_SEEN_KEY } from './tutorial'

// La cuenta atrás usa `setTimeout`, así que todo el fichero corre con relojes
// falsos: si no, cada partida costaría tres segundos reales de test.
beforeEach(() => {
  vi.useFakeTimers()
  // El récord se guarda en `localStorage`, que jsdom comparte entre tests: sin
  // vaciarlo, una partida de un test daría por batido el récord de otro.
  localStorage.clear()
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
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.gameState).toBe('menu')
    expect(result.current.stickCount).toBe(MIN_STICKS)
    expect(result.current.difficulty).toBe('easy')
    expect(result.current.score).toBe(0)
  })

  it('acepta cualquier número de palos dentro del rango', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(9))
    expect(result.current.stickCount).toBe(9)
  })

  it('recorta los valores fuera de rango en vez de romper la escena', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setStickCount(MIN_STICKS - 3))
    expect(result.current.stickCount).toBe(MIN_STICKS)

    act(() => result.current.setStickCount(MAX_STICKS + 100))
    expect(result.current.stickCount).toBe(MAX_STICKS)

    act(() => result.current.setStickCount(-1))
    expect(result.current.stickCount).toBe(MIN_STICKS)
  })

  it('redondea los decimales y descarta NaN', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setStickCount(7.4))
    expect(result.current.stickCount).toBe(7)

    act(() => result.current.setStickCount(Number.NaN))
    expect(result.current.stickCount).toBe(MIN_STICKS)
  })

  it('cambia de dificultad', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setDifficulty('impossible'))
    expect(result.current.difficulty).toBe('impossible')
  })
})

describe('ciclo de una partida', () => {
  it('empieza a jugar con el marcador a cero', () => {
    const { result } = renderHook(() => useGameStoreValue())
    startPlaying(result)

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('renueva el identificador de partida para remontar los palos', () => {
    const { result } = renderHook(() => useGameStoreValue())
    const before = result.current.runId
    startPlaying(result)
    expect(result.current.runId).toBe(before + 1)
  })

  it('suma los palos atrapados sin cerrar la partida antes de tiempo', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))

    expect(result.current.score).toBe(1)
    expect(result.current.resolved).toBe(1)
    expect(result.current.gameState).toBe('playing')
  })

  it('cuenta como resuelto el palo perdido, sin sumar al marcador', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    act(() => result.current.missStick())

    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(1)
  })

  it('termina la partida cuando se resuelve el último palo', () => {
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 5)
    act(() => result.current.missStick())

    expect(result.current.gameState).toBe('finished')
  })
})

describe('cuenta atrás', () => {
  it('la partida no arranca de golpe: primero cuenta', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS)
  })

  it('va bajando un segundo cada vez', () => {
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())
    expect(result.current.gameState).not.toBe('playing')
  })

  it('al llegar a cero se empieza a jugar', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())
    runOutCountdown()

    expect(result.current.gameState).toBe('playing')
  })

  it('volver al menú durante la cuenta la corta', () => {
    const { result } = renderHook(() => useGameStoreValue())
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
  /** Deja correr la demostración entera, como si nadie la saltara. */
  function watchTutorial() {
    act(() => void vi.advanceTimersByTime(TUTORIAL_SECONDS * 1000))
  }

  /** Pone las gafas: es lo que hace `XRSessionController` al abrirse la sesión. */
  function wearHeadset(store: {
    current: ReturnType<typeof useGameStoreValue>
  }) {
    act(() => store.current.setImmersive(true))
  }

  it('con las gafas puestas, la primera partida empieza enseñando', () => {
    // Y sin que nadie lo pida: quien llega por primera vez no sabe que hay algo
    // que pedir. La decisión es del juego y no del botón que se pulse, porque
    // dentro de la sesión también se empieza desde el overlay con el teclado.
    const { result } = renderHook(() => useGameStoreValue())
    wearHeadset(result)

    act(() => result.current.startGame())
    expect(result.current.gameState).toBe('tutorial')
  })

  it('en escritorio no se antepone nada, aunque no se haya visto', () => {
    // Allí la pantalla de inicio lo explica con texto, que se lee antes de lo
    // que dura la demostración.
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())

    expect(result.current.tutorialSeen).toBe(false)
    expect(result.current.gameState).toBe('countdown')
  })

  it('con las gafas puestas pero ya visto, se juega directamente', () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1')
    const { result } = renderHook(() => useGameStoreValue())
    wearHeadset(result)

    act(() => result.current.startGame())
    expect(result.current.gameState).toBe('countdown')
  })

  it('con tutorial, la partida empieza enseñando y no contando', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame({ tutorial: true }))

    expect(result.current.gameState).toBe('tutorial')
    // La cuenta atrás no corre por debajo: sus tres segundos son para
    // colocarse, y gastarlos mirando la demostración los desperdicia.
    expect(result.current.countdown).toBe(0)
  })

  it('los palos no caen mientras se enseña', () => {
    // `StickMachine` los mantiene parados en cualquier fase que no sea jugar.
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame({ tutorial: true }))
    expect(result.current.gameState).not.toBe('playing')
  })

  it('al acabar da paso a la cuenta atrás entera', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame({ tutorial: true }))
    watchTutorial()

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS)

    runOutCountdown()
    expect(result.current.gameState).toBe('playing')
  })

  it('se puede saltar en cualquier momento', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame({ tutorial: true }))

    act(() => result.current.finishTutorial())
    expect(result.current.gameState).toBe('countdown')
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS)

    // Y el temporizador de la demostración no puede devolverle a ella después.
    act(() => void vi.advanceTimersByTime(TUTORIAL_SECONDS * 1000))
    expect(result.current.gameState).not.toBe('tutorial')
  })

  it('verlo entero cuenta como visto, y no vuelve a salir al empezar', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame({ tutorial: true }))
    watchTutorial()

    expect(result.current.tutorialSeen).toBe(true)
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe('1')
  })

  it('saltarlo también cuenta como visto: ya ha decidido', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame({ tutorial: true }))
    act(() => result.current.finishTutorial())

    expect(result.current.tutorialSeen).toBe(true)
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe('1')
  })

  it('dejarlo a medias no cuenta como visto', () => {
    // Volver al menú desde la demostración no es haberla visto: se la
    // encontrará otra vez al darle a empezar.
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame({ tutorial: true }))
    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.tutorialSeen).toBe(false)
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBeNull()

    // Y el temporizador que quedara vivo no puede darlo por visto desde el
    // menú, ni dejar preparada una cuenta atrás que nadie ha pedido.
    watchTutorial()
    expect(result.current.gameState).toBe('menu')
    expect(result.current.tutorialSeen).toBe(false)
    expect(result.current.countdown).toBe(0)
  })

  it('la revancha no vuelve a enseñarlo', () => {
    // Al acabar una partida en el visor se puede repetir sin pasar por el menú:
    // ahí el tutorial ya se ha visto, y repetirlo sería un peaje por partida.
    const { result } = renderHook(() => useGameStoreValue())
    wearHeadset(result)
    act(() => result.current.startGame())
    act(() => result.current.finishTutorial())
    runOutCountdown()

    act(() => result.current.startGame())
    expect(result.current.gameState).toBe('countdown')
  })

  it('lo visto en otra visita sigue visto al volver', () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1')
    const { result } = renderHook(() => useGameStoreValue())

    expect(result.current.tutorialSeen).toBe(true)
  })

  it('se puede volver a ver aunque ya se conozca', () => {
    // Es lo que hace el botón del menú inmersivo: pedirlo explícitamente vale
    // más que lo que hubiera guardado.
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1')
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.startGame({ tutorial: true }))
    expect(result.current.gameState).toBe('tutorial')
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

  it('se entra en práctica, sin vidas que perder', () => {
    const { result } = renderHook(() => useGameStoreValue())

    expect(result.current.gameMode).toBe('practice')
    expect(result.current.lives).toBeNull()
  })

  it('en práctica, fallarlos todos no corta la partida antes de tiempo', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(13))
    startPlaying(result)

    for (let i = 0; i < 12; i++) act(() => result.current.missStick())

    expect(result.current.gameState).toBe('playing')
    expect(result.current.lives).toBeNull()
  })

  it('el desafío arranca con tres vidas y cada fallo cuesta una', () => {
    const { result } = renderHook(() => useGameStoreValue())
    startChallenge(result, 13)
    expect(result.current.lives).toBe(3)

    act(() => result.current.missStick())
    expect(result.current.lives).toBe(2)

    act(() => result.current.missStick())
    expect(result.current.lives).toBe(1)
    expect(result.current.gameState).toBe('playing')
  })

  it('atrapar palos no gasta vidas', () => {
    const { result } = renderHook(() => useGameStoreValue())
    startChallenge(result, 13)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))

    expect(result.current.lives).toBe(3)
  })

  it('quedarse sin vidas cierra la partida aunque queden palos', () => {
    // Es lo que distingue al desafío: la partida tiene un final que no depende
    // de que caiga todo lo que hay colgado.
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
    startChallenge(result, 13)

    act(() => {
      for (let i = 0; i < 4; i++) result.current.missStick()
    })

    expect(result.current.lives).toBe(0)
    expect(result.current.outcome).toBe('failed')
  })

  it('resolver todos los palos con vidas es superar el reto', () => {
    const { result } = renderHook(() => useGameStoreValue())
    startChallenge(result, 5)

    act(() => result.current.missStick())
    for (let i = 0; i < 4; i++) act(() => result.current.catchStick(0.5))

    expect(result.current.outcome).toBe('cleared')
    expect(result.current.gameState).toBe('finished')
    expect(result.current.lives).toBe(2)
  })

  it('la partida de práctica termina sin desenlace de reto', () => {
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 3)

    expect(result.current.gameState).toBe('finished')
    expect(result.current.outcome).toBe('cleared')
    expect(result.current.lives).toBeNull()
  })

  it('el modo sobrevive a la partida y a volver al menú', () => {
    // Como el número de palos o la dificultad: elegirlo otra vez en cada
    // revancha sería justo lo que estorba con el visor puesto.
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
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

describe('escenario o passthrough', () => {
  it('se entra con el escenario puesto', () => {
    // Es la experiencia completa; quien prefiera ver su cuarto lo quita desde
    // el menú inmersivo.
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.scenery).toBe('scene')
  })

  it('se puede alternar en cualquier momento', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setScenery('passthrough'))
    expect(result.current.scenery).toBe('passthrough')

    act(() => result.current.setScenery('scene'))
    expect(result.current.scenery).toBe('scene')
  })

  it('la elección sobrevive a la partida', () => {
    // Cambiar de decorado no es parte de la partida: quitarlo al empezar o al
    // volver al menú obligaría a elegirlo cada vez.
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setScenery('passthrough'))

    playRound(result, 5, 3)
    expect(result.current.scenery).toBe('passthrough')

    act(() => result.current.resetGame())
    expect(result.current.scenery).toBe('passthrough')
  })
})

describe('silencio', () => {
  it('se entra con sonido', () => {
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.muted).toBe(false)
  })

  it('se puede silenciar y volver a activar', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setMuted(true))
    expect(result.current.muted).toBe(true)

    act(() => result.current.setMuted(false))
    expect(result.current.muted).toBe(false)
  })

  it('la elección sobrevive a la partida', () => {
    // Silenciar es una preferencia del jugador, no un ajuste de la ronda:
    // devolver el sonido al empezar o al volver al menú obligaría a apagarlo
    // cada vez, que es justo lo que molesta con el visor puesto.
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setMuted(true))

    playRound(result, 5, 3)
    expect(result.current.muted).toBe(true)

    act(() => result.current.resetGame())
    expect(result.current.muted).toBe(true)
  })

  it('la elección sobrevive a la visita', () => {
    // Es para lo que se guarda: en el visor, apagar el sonido cada vez que uno
    // se pone las gafas es el gesto más incómodo del juego.
    const first = renderHook(() => useGameStoreValue())
    act(() => first.result.current.setMuted(true))
    first.unmount()

    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.muted).toBe(true)
  })

  it('volver al sonido también se recuerda', () => {
    // El otro lado del mismo trato: quien lo enciende no se encuentra el juego
    // mudo otra vez en la visita siguiente.
    const first = renderHook(() => useGameStoreValue())
    act(() => first.result.current.setMuted(true))
    act(() => first.result.current.setMuted(false))
    first.unmount()

    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.muted).toBe(false)
  })

  it('lo que silencie otra pestaña se ve aquí', () => {
    // El navegador cuenta con el evento `storage` que otra pestaña ha escrito.
    // Sin escucharlo, silenciar en una dejaría la otra sonando.
    const { result } = renderHook(() => useGameStoreValue())

    act(() => {
      localStorage.setItem(MUTED_KEY, '1')
      window.dispatchEvent(new StorageEvent('storage', { key: MUTED_KEY }))
    })

    expect(result.current.muted).toBe(true)
  })
})

describe('altura del aro', () => {
  it('sin visor y sin corrección guardada, el aro está donde siempre', () => {
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.hoopAdjustment).toBe(0)
    expect(result.current.hoopHeight).toBeCloseTo(MACHINE_HEIGHT, 6)
  })

  it('sube y baja a pasos, y el aro le sigue', () => {
    const { result } = renderHook(() => useGameStoreValue())

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
    const { result } = renderHook(() => useGameStoreValue())

    for (let i = 0; i < 20; i++) act(() => result.current.adjustHoop(1))
    expect(result.current.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_RANGE, 6)

    for (let i = 0; i < 40; i++) act(() => result.current.adjustHoop(-1))
    expect(result.current.hoopAdjustment).toBeCloseTo(-HOOP_ADJUST_RANGE, 6)
  })

  it('la corrección se guarda y sigue ahí en la visita siguiente', () => {
    const { result, unmount } = renderHook(() => useGameStoreValue())
    act(() => result.current.adjustHoop(-2))
    const chosen = result.current.hoopAdjustment
    unmount()

    // Otra visita: el store nace leyendo lo guardado, sin pasar por el menú.
    const { result: later } = renderHook(() => useGameStoreValue())
    expect(later.current.hoopAdjustment).toBeCloseTo(chosen, 6)
  })

  it('no escribe nada cuando la pulsación no cambia el valor', () => {
    // En el tope el botón se apaga, pero un mando que insista no puede acabar
    // escribiendo en el almacenamiento en cada pulsación.
    const { result } = renderHook(() => useGameStoreValue())
    for (let i = 0; i < 4; i++) act(() => result.current.adjustHoop(1))

    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    act(() => result.current.adjustHoop(1))
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it('la corrección sobrevive a la partida', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.adjustHoop(-1))
    const chosen = result.current.hoopAdjustment

    playRound(result, 5, 3)
    expect(result.current.hoopAdjustment).toBeCloseTo(chosen, 6)

    act(() => result.current.resetGame())
    expect(result.current.hoopAdjustment).toBeCloseTo(chosen, 6)
  })

  it('con el visor midiendo, el aro se planta sobre los ojos del jugador', () => {
    const { result } = renderHook(() => useGameStoreValue())

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
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setPlayerEyeHeight(1.9))
    expect(result.current.hoopHeight).toBeGreaterThan(MACHINE_HEIGHT)

    act(() => result.current.setPlayerEyeHeight(null))
    expect(result.current.hoopHeight).toBeCloseTo(MACHINE_HEIGHT, 6)
  })

  it('la medida del visor queda a la vista, no solo dentro del aro', () => {
    // La interfaz inmersiva también cuelga de los ojos del jugador (ver
    // `xrUiRise` en `xrLayout.ts`), así que necesita el mismo dato.
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.playerEyeHeight).toBeNull()

    act(() => result.current.setPlayerEyeHeight(1.2))
    expect(result.current.playerEyeHeight).toBe(1.2)

    act(() => result.current.setPlayerEyeHeight(null))
    expect(result.current.playerEyeHeight).toBeNull()
  })

  it('una medida imposible del visor no mueve el aro', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setPlayerEyeHeight(Number.NaN))
    expect(result.current.hoopHeight).toBeCloseTo(MACHINE_HEIGHT, 6)
  })
})

describe('puntuación y racha', () => {
  it('atrapar suma puntos; fallar no', () => {
    const { result } = renderHook(() => useGameStoreValue())
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    const afterCatch = result.current.points
    expect(afterCatch).toBeGreaterThan(0)

    act(() => result.current.missStick())
    expect(result.current.points).toBe(afterCatch)
  })

  it('cogerlo pronto puntúa más que rescatarlo del suelo', () => {
    const early = renderHook(() => useGameStoreValue())
    startPlaying(early.result)
    act(() => early.result.current.catchStick(0))

    const late = renderHook(() => useGameStoreValue())
    startPlaying(late.result)
    act(() => late.result.current.catchStick(1))

    expect(early.result.current.points).toBeGreaterThan(late.result.current.points)
  })

  it('la misma partida renta más en una dificultad alta', () => {
    const easy = renderHook(() => useGameStoreValue())
    startPlaying(easy.result)
    act(() => easy.result.current.catchStick(0.5))

    const hard = renderHook(() => useGameStoreValue())
    act(() => hard.result.current.setDifficulty('impossible'))
    startPlaying(hard.result)
    act(() => hard.result.current.catchStick(0.5))

    expect(hard.result.current.points).toBeGreaterThan(easy.result.current.points)
  })

  it('la racha crece al encadenar y se rompe al fallar', () => {
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
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
    const batched = renderHook(() => useGameStoreValue())
    act(() => batched.result.current.setStickCount(9))
    startPlaying(batched.result)
    act(() => {
      batched.result.current.catchStick(0.5)
      batched.result.current.catchStick(0.5)
    })

    const sequential = renderHook(() => useGameStoreValue())
    act(() => sequential.result.current.setStickCount(9))
    startPlaying(sequential.result)
    act(() => sequential.result.current.catchStick(0.5))
    act(() => sequential.result.current.catchStick(0.5))

    expect(batched.result.current.streak).toBe(2)
    expect(batched.result.current.points).toBe(sequential.result.current.points)
  })

  it('empezar otra partida borra puntos y racha', () => {
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('la marca a batir no se mueve mientras se juega', () => {
    // Si el récord se actualizara palo a palo, al terminar sería siempre igual
    // a los puntos de la partida y nunca se podría decir que se ha batido.
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => result.current.catchStick(0))

    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('al terminar, la puntuación pasa a ser el récord', () => {
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 5)

    expect(result.current.bestPoints).toBe(result.current.points)
    expect(result.current.isRecord).toBe(true)
  })

  it('una partida peor no baja el récord ni lo anuncia', () => {
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 5)
    const record = result.current.bestPoints

    playRound(result, 5, 1)

    expect(result.current.points).toBeLessThan(record)
    expect(result.current.bestPoints).toBe(record)
    expect(result.current.isRecord).toBe(false)
  })

  it('el récord sobrevive a volver al menú y a la siguiente partida', () => {
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 0)

    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('el récord sigue ahí al volver a abrir el juego', () => {
    // Es lo que separa "entre partidas" de "entre visitas": el segundo store
    // no comparte nada con el primero salvo el almacenamiento del navegador.
    const first = renderHook(() => useGameStoreValue())
    playRound(first.result, 5, 5)
    const record = first.result.current.bestPoints
    expect(record).toBeGreaterThan(0)

    const reopened = renderHook(() => useGameStoreValue())

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

    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 5)

    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('no anuncia récord si otra pestaña guardó algo mejor mientras se jugaba', () => {
    // La marca a batir se congela al empezar, así que una partida puede superar
    // esa y aun así quedarse por debajo de lo guardado. Anunciarla sería
    // prometer un récord que el menú va a desmentir en cuanto se vuelva.
    const { result } = renderHook(() => useGameStoreValue())
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

    const { result } = renderHook(() => useGameStoreValue())

    expect(result.current.bestPoints).toBe(0)

    // Y la primera partida lo deja bien escrito.
    playRound(result, 5, 5)
    expect(result.current.bestPoints).toBe(result.current.points)
  })
})

describe('vuelta al menú y revancha', () => {
  it('vuelve al menú conservando la configuración elegida', () => {
    const { result } = renderHook(() => useGameStoreValue())
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
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 5)
    expect(result.current.gameState).toBe('finished')

    startPlaying(result)

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('no da por terminada una partida que no ha empezado', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.missStick())
    expect(result.current.gameState).toBe('menu')
  })
})
