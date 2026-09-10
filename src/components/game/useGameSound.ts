'use client'

import { useEffect, useRef, useState } from 'react'
import { type GameState, useGame } from '../../lib/gameStore'
import { createSoundEngine, type RoundOutcome, type SoundEngine } from '../../lib/sound'

/**
 * Pone sonido a la partida: al atrapar, al perder y en la cuenta atrás.
 *
 * Escucha el estado del juego en vez de engancharse a los componentes, así que
 * suena igual con el ratón que con los mandos del visor —que es donde más falta
 * hace, porque allí no hay marcador que mirar sin apartar la vista de los palos.
 *
 * Se monta una sola vez, en `GameScene`. Con los efectos a cero en los ajustes
 * del arcade (`muted` del store) no llega a tocar la Web Audio API.
 */
export function useGameSound() {
  const {
    gameState,
    countdown,
    score,
    resolved,
    streak,
    muted,
    sfxVolume,
    isRecord,
    levelResult,
    lives,
  } = useGame()
  const engineRef = useRef<SoundEngine | null>(null)
  // El volumen de efectos del arcade, guardado aparte para poder aplicarlo al
  // motor sin que cambiarlo lo vuelva a crear.
  const sfxVolumeRef = useRef(sfxVolume)
  // El navegador no deja sonar hasta que el jugador ha tocado la página. Es
  // estado y no un ref porque de él depende crear el audio, y el gesto puede
  // ser el propio botón de silenciar: apuntarlo en un render deja que el
  // efecto vea las dos cosas a la vez y no abra un contexto para cerrarlo acto
  // seguido.
  const [interacted, setInteracted] = useState(false)
  const previous = useRef({
    score: 0,
    missed: 0,
    countdown: 0,
    gameState: 'menu' as GameState,
  })

  useEffect(() => {
    if (interacted) return

    // El clic y no el `pointerdown`: los botones del juego se activan al hacer
    // clic, así que atender el gesto en ese mismo evento deja que React vea
    // «ya ha interactuado» y «quiere silencio» en el mismo render. Con
    // `pointerdown` llegarían en eventos distintos y silenciar con el primer
    // clic de la página abriría un contexto de audio para cerrarlo acto
    // seguido. El teclado también pasa por aquí: activar un botón con Enter
    // dispara su clic. Y en el visor el gesto es el botón de entrar en la
    // sesión, que todavía es DOM.
    const remember = () => setInteracted(true)
    window.addEventListener('click', remember)

    return () => window.removeEventListener('click', remember)
  }, [interacted])

  // Mover el volumen en los ajustes del arcade no rehace el audio: toca el nodo
  // maestro y ya. Recrearlo cerraba el contexto y abría otro a cada paso del
  // deslizador, que es un corte de sonido por cada empujón. Y el ref guarda el
  // valor para el motor que todavía no existe: en silencio no hay ninguno, y
  // al volver el sonido tiene que nacer al volumen que se eligió mientras.
  useEffect(() => {
    sfxVolumeRef.current = sfxVolume
    engineRef.current?.setVolume(sfxVolume)
  }, [sfxVolume])

  useEffect(() => {
    // En silencio no se toca la Web Audio API: ni contexto, ni nodos, ni
    // permiso de reproducción que pedir. Y al silenciar a media partida, la
    // limpieza de este efecto cierra el contexto que hubiera abierto.
    if (!interacted || muted) return

    // Sin Web Audio (navegador antiguo, entorno de test) se juega en silencio.
    const AudioContextClass = window.AudioContext
    if (AudioContextClass == null) return

    const context = new AudioContextClass()
    engineRef.current = createSoundEngine(context, sfxVolumeRef.current)
    // Que el navegador se niegue a reanudarlo es un desenlace previsto —su
    // política de reproducción automática— y significa jugar sin sonido.
    void context.resume().catch(() => {})

    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
      if (context.state !== 'closed') void context.close()
    }
  }, [interacted, muted])

  const missed = resolved - score

  useEffect(() => {
    const engine = engineRef.current
    const before = previous.current
    previous.current = { score, missed, countdown, gameState }
    if (engine == null) return

    // Los contadores solo suben dentro de una partida, así que comparar con el
    // valor anterior basta para saber qué acaba de pasar. Si dos palos se
    // resuelven en el mismo lote de React suena una vez: dos copias del mismo
    // sonido a la vez no se oyen como dos, se oyen como una más fuerte.
    if (score > before.score) engine.play({ name: 'catch', streak })
    if (missed > before.missed) engine.play({ name: 'miss' })

    if (gameState === 'countdown' && countdown > 0 && countdown !== before.countdown) {
      engine.play({ name: 'countdown', secondsLeft: countdown })
    }
    // A jugar solo se entra agotando la cuenta atrás; volver al menú por el
    // camino la corta sin salida.
    if (gameState === 'playing' && before.gameState === 'countdown') {
      engine.play({ name: 'go' })
    }

    // El final. Se acababa el último palo y no sonaba nada: la pantalla de fin
    // llegaba sin avisar, y con el visor puesto el marcador está donde uno no
    // siempre está mirando.
    if (gameState === 'finished' && before.gameState !== 'finished') {
      engine.play({ name: 'over', outcome: roundOutcome(levelResult, lives) })
      // El récord va por encima del cierre y no en su lugar: batir la marca
      // puede pasar ganando o terminando sin más, y hay que oír las dos cosas.
      if (isRecord) engine.play({ name: 'record' })
    }
  }, [score, missed, countdown, gameState, streak, isRecord, levelResult, lives])
}

/**
 * Cómo ha acabado esta partida, para elegir el cierre.
 *
 * En Niveles se aprueba o no; en el desafío se pierde quedándose sin vidas; en práctica no
 * hay nada que ganar ni que perder y el cierre solo dice «se acabó».
 */
function roundOutcome(
  levelResult: { passed: boolean } | null,
  lives: number | null,
): RoundOutcome {
  if (levelResult != null) return levelResult.passed ? 'win' : 'loss'
  if (lives != null) return lives > 0 ? 'win' : 'loss'
  return 'close'
}
