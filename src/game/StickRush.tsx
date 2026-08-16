'use client'

import { GameProvider } from '../components/GameProvider'
import { GameScene } from '../components/game/GameScene'
import { setAssetsBase } from '../lib/assets'

export interface StickRushProps {
  /**
   * De dónde cuelgan los ficheros estáticos del juego (el HDRI, las texturas y
   * los perfiles de mando que se copian de `public/`). Por defecto la raíz del
   * sitio, que es donde los sirve su propia web.
   */
  assetsBase?: string
}

/**
 * El juego entero, listo para montar dentro de cualquier aplicación de React.
 *
 * Ocupa lo que mida su contenedor —dale una altura— y no sabe nada de rutas,
 * layout ni metadatos: quien lo monta decide dónde vive y qué hay alrededor.
 * El contrato completo está en `docs/montar-el-juego.md`.
 */
export function StickRush({ assetsBase }: StickRushProps) {
  // Durante el render y no en un efecto: la escena pide el HDRI y las texturas
  // en cuanto se monta, es decir, antes de que corra ningún efecto. Escribir la
  // misma base dos veces no cambia nada, así que repetir el render es inocuo.
  if (assetsBase !== undefined) setAssetsBase(assetsBase)

  return (
    <GameProvider>
      <GameScene />
    </GameProvider>
  )
}
