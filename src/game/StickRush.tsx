'use client'

import { useEffect } from 'react'
import { GameProvider } from '../components/GameProvider'
import { GameScene } from '../components/game/GameScene'
import { endXrSession } from '../components/xr/xrStore'
import { setAssetsBase } from '../lib/assets'
import type { ResultadoConHazanas } from '../lib/hazanas'
import type { Reto } from '../lib/semilla'
import { ExitProvider } from './exit'

export interface StickRushProps {
  /**
   * De dónde cuelgan los ficheros estáticos del juego (el HDRI, las texturas y
   * los perfiles de mando que se copian de `public/`). Por defecto la raíz del
   * sitio, que es donde los sirve su propia web.
   */
  assetsBase?: string
  /**
   * Jugar un reto concreto del salón: el reto del día, o el código de «reta mi puntuación».
   *
   * Con él la escena entra **directamente en una partida del desafío** —el modo del récord de
   * la cabina—, con Medio y trece palos (`CHALLENGE_SETUP`) y sin lección, y el turno y el
   * titubeo de cada palo salen de la semilla: misma semilla, mismos palos cayendo en el mismo
   * orden y al mismo tiempo. Se lee al montar: para otro reto, se vuelve a montar.
   */
  reto?: Reto
  /**
   * Se llama **una vez** al acabar cada partida con puntuación, en cualquier modo, con sus
   * puntos aunque no sean récord. Dejar la partida a medias o salir no la acaba. Lleva `hazanas`
   * con los nombres de API estrenados en la partida, si hay alguno (`lib/hazanas.ts`).
   */
  onTerminar?: (resultado: ResultadoConHazanas) => void
}

/**
 * El juego entero **con su Canvas y su sesión**, listo para montar dentro de
 * cualquier aplicación de React que quiera una página de juego.
 *
 * Ocupa lo que mida su contenedor —dale una altura— y no sabe nada de rutas,
 * layout ni metadatos: quien lo monta decide dónde vive y qué hay alrededor.
 *
 * Para montarlo DENTRO de un Canvas y una sesión que ya existen —lo que hace el
 * salón inmersivo de xrcade, y lo que permite volver sin quitarse el visor— hay
 * que usar `<StickRushScene>`. Este de aquí abre su propia sesión, y en un
 * documento solo cabe una. El contrato completo está en
 * `docs/montar-el-juego.md`.
 */
export function StickRush({ assetsBase, reto, onTerminar }: StickRushProps) {
  // Durante el render y no en un efecto: la escena pide el HDRI y las texturas
  // en cuanto se monta, es decir, antes de que corra ningún efecto. Escribir la
  // misma base dos veces no cambia nada, así que repetir el render es inocuo.
  if (assetsBase !== undefined) setAssetsBase(assetsBase)

  // Quitar el juego tiene que devolver el visor a quien lo montó: la sesión no
  // se cierra sola al desmontar el árbol (ver `xr/xrStore.ts`). Aquí y no en la
  // escena porque es el borde del montaje, lo mismo que promete `unmount()`.
  useEffect(() => () => endXrSession(), [])

  return (
    <GameProvider reto={reto} onTerminar={onTerminar}>
      {/* Aquí salir es cerrar la sesión: esta web es el juego y no hay ningún
          sitio al que volver. En el salón significa lo contrario. */}
      <ExitProvider onExit={endXrSession}>
        <GameScene />
      </ExitProvider>
    </GameProvider>
  )
}
