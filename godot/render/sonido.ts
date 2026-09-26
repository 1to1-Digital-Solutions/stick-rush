/**
 * El motor de sonido de la web (`src/lib/sound.ts`) tal como lo necesita el render de efectos del
 * kit (`xrcade/godot-kit/render-sfx.mjs`), que lo ejecuta en un Chromium sin ventana con el
 * `AudioContext` cambiado por un `OfflineAudioContext`.
 *
 * No es otra receta: son las mismas voces y el mismo nodo maestro, con dos arreglos para que el
 * render las oiga.
 *
 * - **El contexto lo abre esto y no quien lo llama.** `createSoundEngine` recibe el contexto por
 *   parámetro (en la web lo abre `useGameSound` con el primer clic), y el render solo sabe pasar
 *   argumentos que se escriben en JSON.
 * - **El contexto dice que está en marcha.** El motor calla si el contexto no corre —en la web es
 *   lo que evita el bocinazo al volver a ponerse el visor—, y un `OfflineAudioContext` no corre
 *   hasta que se le pide el render, que es justo después de disparar. Así que se le enseña al motor
 *   uno que dice `running`; todo lo demás es el contexto de verdad.
 *
 * Vive fuera de `scene/` porque no viaja al motor: solo lo lee el render, en el navegador. Y su
 * carpeta lleva `.gdignore`, como `scene/`: el motor trata como script cualquier `.ts` que vea.
 */
import { createSoundEngine } from '@/lib/sound'

export function createStickRushAudio() {
  const context = new AudioContext()
  const enMarcha = new Proxy(context, {
    get(destino, clave) {
      if (clave === 'state') return 'running'
      const valor = Reflect.get(destino, clave, destino)
      return typeof valor === 'function' ? valor.bind(destino) : valor
    },
  })
  return createSoundEngine(enMarcha)
}
