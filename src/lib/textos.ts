/**
 * Lo que el juego dice, en español.
 *
 * **La clave es el propio texto en inglés.** No hay ids inventados
 * (`hud.puntos`) por dos motivos. El primero es que se lee: en el componente
 * pone `t('Back to the menu')`, y quien pasa por ahí sabe qué se pinta sin ir
 * a buscar el diccionario. El segundo es que TypeScript lo vigila solo: `TextKey`
 * sale de las claves de este objeto, así que cambiar la frase en el componente
 * y olvidarse de aquí **no compila**, en vez de dejar una clave huérfana que
 * solo se nota cuando alguien pone el juego en español.
 *
 * El inglés no se guarda dos veces: si el idioma es inglés, `texto` devuelve la
 * clave. Este fichero solo tiene la traducción.
 *
 * **Lo que NO entra aquí.** Los comentarios, los identificadores y los errores
 * de programador siguen en español porque son para quien mantiene el repo. Las
 * claves de almacenamiento tampoco se tocan nunca: traducirlas borraría los
 * récords de quien juega.
 *
 * El idioma lo elige quien juega una sola vez, en el menú de xrcade, y llega
 * aquí por la cookie del arcade (ver `ajustes.ts`).
 */

import type { Lang } from './ajustes'

const ES = {
  // Menú
  'Catch the sticks before they hit the ground.': 'Atrapa los palos antes de que toquen el suelo.',
  Mode: 'Modo',
  'Number of sticks': 'Número de palos',
  Difficulty: 'Dificultad',
  Play: 'Jugar',
  Length: 'Longitud',
  Level: 'Nivel',
  'Best endless streak': 'Mejor racha sin fin',
  'My record': 'Mi récord',
  'Best score in': 'Mejor marca en',
  'sticks on': 'palos en',
  Medium: 'Media',
  Expert: 'Experta',
  Impossible: 'Imposible',

  // Modos
  Practice: 'Práctica',
  Levels: 'Niveles',
  Challenge: 'Desafío',
  'Every stick drops and missing costs nothing.': 'Caen todos los palos y fallar no cuesta nada.',
  'One level at a time: the one you clear stays unlocked.':
    'Un nivel cada vez: el que superas queda desbloqueado.',
  'Three lives: every stick that gets away costs one.':
    'Tres vidas: cada palo que se escapa cuesta una.',
  Set: 'Tanda',
  Endless: 'Sin fin',
  'The sticks you picked, and that is it.': 'Los palos elegidos y se acaba.',
  'It reloads until you say stop.': 'Se recarga hasta que tú digas.',

  // Dificultades
  Easy: 'Fácil',
  Hard: 'Difícil',

  // Marcador
  Points: 'Puntos',
  Lives: 'Vidas',
  'Best streak': 'Mejor racha',
  'End run': 'Terminar',
  'Back to the menu': 'Volver al menú',
  Share: 'Compartir',

  // Resumen
  'Game over!': '¡Partida terminada!',
  'Challenge cleared!': '¡Reto superado!',
  'You are out of lives': 'Te has quedado sin vidas',
  'New record!': '¡Nuevo récord!',
  'Best streak!': '¡Mejor racha!',
  'Your record:': 'Tu récord:',
  'Your best streak:': 'Tu mejor racha:',
  'You caught': 'Has atrapado',
  of: 'de',
  'sticks.': 'palos.',
  'sticks, endless.': 'palos sin fin.',
  '1 star': '1 estrella',

  // Compartir
  'Shared!': '¡Compartido!',
  'Result copied to the clipboard.': 'Resultado copiado al portapapeles.',
  'This browser will not share or copy: write the score down yourself.':
    'Este navegador no deja compartir ni copiar: apunta la puntuación a mano.',

  // Visor
  'Enter the headset': 'Entrar en el visor',
  'Inside you choose between the scene and your room': 'Dentro eliges entre escenario y tu habitación',
  'Your headset only supports virtual reality': 'Tu visor solo admite realidad virtual',
  'How it plays, in a few seconds.': 'Cómo se juega, en unos segundos.',
  'Skip tutorial': 'Saltar tutorial',
  'Loading scene…': 'Cargando escena…',

  // Cuando algo se rompe
  'Something went wrong': 'Algo ha fallado',
  'Something unexpected happened. Try again.': 'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
  Code: 'Código',
  'Try again': 'Reintentar',
} as const

/** Cada frase que el juego sabe decir, escrita como se dice en inglés. */
export type TextKey = keyof typeof ES

/**
 * Una frase en el idioma que se pida.
 *
 * En inglés devuelve la clave, que ya es la frase: guardar el original dos
 * veces sería tener dos sitios donde cambiarlo y uno donde olvidarse.
 */
export function texto(lang: Lang, key: TextKey): string {
  return lang === 'es' ? ES[key] : key
}

/**
 * El traductor de un idioma, para no repetirlo en cada línea.
 *
 * Se pide una vez arriba del componente —`const t = traductor(useLang())`— y se
 * usa como `t('Back to the menu')`.
 */
export function traductor(lang: Lang) {
  return (key: TextKey) => texto(lang, key)
}
