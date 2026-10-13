'use client'

import { useXR } from '@react-three/xr'
import { useCallback } from 'react'

import { useLang } from '../../lib/settingsClient'
import { useGame } from '../../lib/gameStore'
import { traductor, type TextKey } from '../../lib/textos'
import {
  FRASES,
  FRASES_CON_LAS_MANOS,
  TUTORIAL_BUTTONS,
  TUTORIAL_STEPS,
  type TutorialStepKey,
} from '../../lib/tutorial'
import {
  TUTORIAL_BOTON,
  TUTORIAL_PANEL,
  TUTORIAL_TEXT,
  XR_TUTORIAL_NEXT_OFFSET,
  XR_TUTORIAL_POSITION,
  XR_TUTORIAL_SKIP_OFFSET,
} from '../../lib/xrLayout'
import { NO_RAYCAST } from '../raycast'
import { ButtonHighlight, useButtonFeedback } from './buttonHighlight'
import { CanvasPanel, paragraphHeight, drawParagraph, drawText, roundedRect } from './canvasPanel'
import { RealController } from './RealController'
import { dibujarMando } from './mandoDibujado'
import { dibujarMano } from './manoDibujada'
import { PANEL_COLOR } from './XRUi'

/**
 * Cómo se atrapa un palo, dentro del visor y solo la primera vez.
 *
 * **Se aprende haciendo, no mirando.** Cada paso se supera atrapando un palo de verdad, y la
 * partida **no se para** mientras tanto: la máquina suelta palos y el panel espera. Antes
 * era una demostración por reloj con la partida en cola —un mando de mentira cogiendo un
 * palo de mentira—, y quien la miraba sin hacer nada salía igual que entró.
 *
 * **Y se enseña el gesto que le sirve a quien juega.** Con mandos, el botón de agarre
 * resaltado sobre el dibujo (`mandoDibujado.ts`) **y sobre el mando que se tiene en la mano**
 * (`MandoDeVerdad.tsx`): con el visor puesto lo que hay ahí tiene cinco botones y ninguno con
 * su nombre escrito. Con las manos desnudas, el pellizco (`manoDibujada.ts`), que es lo que
 * mueve el puntero de agarre cuando no hay mando: cambia la frase y cambia el dibujo.
 *
 * **Siempre hay salida**: siguiente, saltar y un plazo por paso. Un hito que no llegue
 * —porque los palos se escapan— dejaría a alguien encerrado en su paso.
 *
 * El guion vive en `lib/tutorial.ts`, probado sin navegador; aquí solo se pinta y se escucha.
 */

/** Medidas del panel, en metros: lo dice `TUTORIAL_PANEL`. */
export const PANEL_WIDTH = TUTORIAL_PANEL.width
export const PANEL_HEIGHT = TUTORIAL_PANEL.height

/** Los dos botones, abajo del panel. */
const BOTONES = [
  { id: 'next' as const, offset: XR_TUTORIAL_NEXT_OFFSET, texto: 'Next' as TextKey },
  { id: 'skip' as const, offset: XR_TUTORIAL_SKIP_OFFSET, texto: 'Skip tutorial' as TextKey },
]

/**
 * Lo apagado del panel y lo que se lee encima: los mismos grises con los que escribe el menú
 * del visor, para que el tutorial no parezca de otro juego.
 */
const DIM_COLOR = '#94a3b8'
const LIGHT_COLOR = '#e2e8f0'

/** Cómo se llama la frase, para medirla igual que se pinta. */
const FRASE = { size: TUTORIAL_TEXT.phrase, maxWidth: PANEL_WIDTH - 0.1 }

/**
 * Dónde cae cada cosa en el panel de un paso.
 *
 * Se calcula y no se escribe a mano porque **la frase no ocupa lo mismo en los dos
 * idiomas**: la misma línea son dos renglones en inglés y tres en español, y el dibujo tiene
 * que bajar con ella. Sale de aquí y no de dentro del dibujo para que el test pueda
 * comprobar los mismos números que se pintan, y no una copia suya.
 */
export function repartoDelPaso(
  ctx: CanvasRenderingContext2D,
  step: TutorialStepKey,
  frases: Record<TutorialStepKey, TextKey>,
  t: (clave: TextKey) => string,
): { techoDeLaFrase: number; sueloDeLaFrase: number; gesto: number } {
  const techoDeLaFrase = PANEL_HEIGHT / 2 - 0.13
  const sueloDeLaFrase = techoDeLaFrase - paragraphHeight(ctx, t(frases[step]), FRASE)
  const techoDeLosBotones = XR_TUTORIAL_SKIP_OFFSET[1] + TUTORIAL_BOTON.height / 2
  return { techoDeLaFrase, sueloDeLaFrase, gesto: (sueloDeLaFrase + techoDeLosBotones) / 2 }
}

/**
 * El panel del tutorial: por qué paso va, lo que pide, el gesto que lo hace y los dos
 * botones de abajo.
 *
 * Sale del componente para que un test lo pueda medir con un lienzo de mentira
 * (`legibilidad.ts`): es texto que nadie ha visto aún con el visor puesto, y la frase larga
 * en español es donde se sale.
 */
export function dibujarElPaso(
  ctx: CanvasRenderingContext2D,
  step: TutorialStepKey | null,
  frases: Record<TutorialStepKey, TextKey>,
  t: (clave: TextKey) => string,
  conLasManos: boolean,
): void {
  roundedRect(ctx, 0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0.02)
  ctx.fillStyle = PANEL_COLOR
  ctx.fill()

  if (step == null) return

  // Por cuál se va, que es lo que dice cuánto queda.
  drawText(ctx, `${TUTORIAL_STEPS.indexOf(step) + 1}/${TUTORIAL_STEPS.length}`, 0, PANEL_HEIGHT / 2 - 0.05, {
    size: TUTORIAL_TEXT.counter,
    color: DIM_COLOR,
  })

  // En párrafo y no en una línea: encogida hasta caber de una, la frase quedaba en letra de
  // dos centímetros y con el visor puesto no se entendía nada.
  //
  // **Anclado por arriba**, no centrado: centrado, la frase que pasa de dos líneas a tres
  // crece hacia arriba y se mete debajo del contador. El español las tiene casi siempre.
  const reparto = repartoDelPaso(ctx, step, frases, t)
  drawParagraph(ctx, t(frases[step]), 0, reparto.techoDeLaFrase, {
    ...FRASE,
    color: LIGHT_COLOR,
    weight: '600',
    anchor: 'top',
  })

  // Lo que quien juega tiene de verdad en la mano, y no lo que trae la mayoría.
  const colores = { cuerpo: DIM_COLOR, resaltado: LIGHT_COLOR }
  if (conLasManos) {
    dibujarMano(ctx, 0, reparto.gesto, TUTORIAL_BUTTONS[step] != null, colores)
  } else {
    dibujarMando(ctx, 0, reparto.gesto, TUTORIAL_BUTTONS[step], colores)
  }

  for (const boton of BOTONES) {
    const [bx, by] = boton.offset
    roundedRect(ctx, bx, by, TUTORIAL_BOTON.width, TUTORIAL_BOTON.height, 0.016)
    ctx.fillStyle = DIM_COLOR
    ctx.fill()
    drawText(ctx, t(boton.texto), bx, by, {
      size: TUTORIAL_TEXT.button,
      color: PANEL_COLOR,
      weight: '700',
      maxWidth: TUTORIAL_BOTON.width - 0.03,
    })
  }
}

export function XRTutorial() {
  const {
    gameState,
    bareHanded: conLasManos,
    tutorialStep: step,
    finishTutorial,
    nextTutorialStep,
  } = useGame()
  const t = traductor(useLang())
  const frases = conLasManos ? FRASES_CON_LAS_MANOS : FRASES
  const enSesion = useXR((state) => state.mode != null)
  // Apuntado y pulsado, que es lo que el botón tiene que contestar (`buttonHighlight.tsx`).
  const { stateOf, handlersFor } = useButtonFeedback()

  // **El paso lo lleva el store**, que es quien ve los palos atrapados y quien cuenta los
  // plazos: aquí solo se pinta. Y solo mientras se juega de verdad —durante la cuenta atrás
  // no hay nada que atrapar, y encima del cartel de fin el panel taparía el resultado—.
  const activo = enSesion && gameState === 'playing' && step !== null

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => dibujarElPaso(ctx, step, frases, t, conLasManos),
    [step, frases, t, conLasManos],
  )

  if (!activo) return null

  return (
    <>
      {/* Fuera del grupo del panel a propósito: esto no vive en el panel, vive en la mano.
          Se coloca solo, deshaciendo lo que le pongan sus padres. En las dos manos porque
          aquí vale cualquiera de ellas: encender solo una sería decir que la otra no sirve.
          Con las manos desnudas no hay mando que enseñar y no se monta nada. */}
      <RealController hand="left" button={TUTORIAL_BUTTONS[step]} />
      <RealController hand="right" button={TUTORIAL_BUTTONS[step]} />
      <group position={XR_TUTORIAL_POSITION}>
        <CanvasPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} draw={draw} fallbackColor={PANEL_COLOR} />
        {BOTONES.map((boton) => (
          <group key={boton.id} position={[boton.offset[0], boton.offset[1], 0.002]}>
            {/* Saltar no es «pasar todos los pasos»: es dar la lección por vista, lo que
                además la retira de las próximas partidas. Quien la salta ya ha decidido. */}
            <mesh
              onClick={boton.id === 'next' ? nextTutorialStep : finishTutorial}
              {...handlersFor(boton.id)}
            >
              <planeGeometry args={[TUTORIAL_BOTON.width, TUTORIAL_BOTON.height]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* **Encenderse al apuntar es lo que dice que el botón responde.** El resto de
                paneles del juego ya lo hacen. */}
            <ButtonHighlight
              width={TUTORIAL_BOTON.width}
              height={TUTORIAL_BOTON.height}
              state={stateOf(boton.id)}
              glow={LIGHT_COLOR}
              ink={PANEL_COLOR}
            />
          </group>
        ))}
        {/* El panel no se puede pulsar entero: solo sus botones. */}
        <mesh position={[0, 0, -0.001]} raycast={NO_RAYCAST}>
          <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}
