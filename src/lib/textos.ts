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
  // Lo que dice la pestaña y lo que se lee al compartir el enlace
  'Catch the sticks falling from the machine before they hit the ground. Play in the browser or in mixed reality (VR/AR).':
    'Atrapa los palos que caen de la máquina antes de que toquen el suelo. Juega en el navegador o en realidad mixta (VR/AR).',

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

  // A dos
  'On your own': 'Solo',
  'Two players': 'A dos',
  Players: 'Jugadores',
  'Who you play against': 'Contra quién juegas',
  'Your three lives against your record.': 'Tus tres vidas contra tu récord.',
  'Pass the controller: same sticks, most points wins.':
    'Pasaos el mando: mismos palos, gana quien más saque.',
  'Player 1': 'Jugador 1',
  'Player 2': 'Jugador 2',
  '{player}: {points} points': '{player}: {points} puntos',
  'Pass the controller to {player}.': 'Pásale el mando a {player}.',
  '{player}, your turn': '{player}, te toca',
  '{player} wins': 'Gana {player}',
  "It's a tie": 'Empate',
  'Duels won: {one}–{two} · tied: {ties}': 'Ganadas: {one}–{two} · empates: {ties}',

  // Dificultades
  Easy: 'Fácil',
  Hard: 'Difícil',

  // Marcador
  Points: 'Puntos',
  Lives: 'Vidas',
  'Best streak': 'Mejor racha',
  'End run': 'Terminar',
  // Tutorial del visor. Una frase por paso **y por gesto**: con mando se nombra
  // el botón de agarre; con las manos desnudas, el pellizco, que es lo que mueve
  // ese mismo puntero cuando no hay botón que apretar.
  //
  // Cortas a propósito: lo que enseña el gesto es el dibujo de al lado, y la frase que
  // explicaba además que la mano se cierra encima ocupaba cuatro renglones en inglés y no
  // dejaba sitio al dibujo. Lo mide `tutorial.legible.test.ts`.
  'Hold the grip button on a stick, do not point at it':
    'Mantén el botón de agarre sobre un palo, no lo apuntes',
  'Pinch your fingers on a stick, do not point at it':
    'Junta los dedos sobre un palo, no lo apuntes',
  'They fall all around you: turn and catch another one':
    'Caen por todos lados: gírate y atrapa otro',
  Next: 'Siguiente',
  Hoop: 'Aro',
  Sticks: 'Palos',
  Speed: 'Velocidad',
  Around: 'Alrededor',
  'Leave the game?': '¿Dejar la partida?',
  'You lose what you have got so far.': 'Pierdes lo que llevas.',
  'Keep playing': 'Seguir jugando',
  Leave: 'Salir',
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
 * Todas las claves del diccionario, para poder recorrerlas.
 *
 * La clave **es la frase en inglés**, así que esta lista es también la lista de todo lo que
 * dice el juego. Sirve para comprobar que no queda ninguna que ya no diga nadie.
 */
export const TEXT_KEYS = Object.keys(ES) as TextKey[]

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

/**
 * Rellena los huecos de una frase.
 *
 * Las frases con hueco llevan `{algo}` y no se parten en trozos para concatenarlos: el orden de
 * las palabras cambia de un idioma a otro, y concatenar obliga al español a fingir la sintaxis
 * inglesa.
 */
export function formatea(plantilla: string, valores: Record<string, string | number>): string {
  return plantilla.replace(/\{(\w+)\}/g, (hueco, nombre: string) =>
    nombre in valores ? String(valores[nombre]) : hueco,
  )
}

/**
 * Una cifra con los miles separados, sin `Intl`.
 *
 * El marcador no puede pedirle el formato al motor: el que ejecutará esta lógica fuera del
 * navegador no lleva las tablas de idioma dentro —QuickJS-ng no trae `Intl` y el V8 de
 * GodotJS se compila sin ICU—, así que ahí `toLocaleString` o revienta o devuelve el número
 * pelado, sin separadores. Y la puntuación es lo primero que se mira. Aquí solo hay
 * aritmética y concatenación, que valen igual en todos los motores.
 *
 * Lo único que cambia con el idioma es el separador: punto en español, coma en inglés. Una
 * cifra que no es un número —un récord editado a mano en el almacenamiento— se cuenta como
 * cero, que es mejor que enseñar «NaN» a quien está jugando.
 */
export function formatoDeCifra(n: number, lang: Lang): string {
  if (!Number.isFinite(n)) return '0'

  const separator = lang === 'es' ? '.' : ','
  const rounded = Math.round(n)
  let rest = String(Math.abs(rounded))
  let thousands = ''
  while (rest.length > 3) {
    thousands = `${separator}${rest.slice(-3)}${thousands}`
    rest = rest.slice(0, -3)
  }

  return `${rounded < 0 ? '-' : ''}${rest}${thousands}`
}
