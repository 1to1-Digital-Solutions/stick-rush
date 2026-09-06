/**
 * El almacenamiento del navegador, cuando deja tocarlo.
 *
 * En modo privado, o con el almacenamiento vetado por política, leer
 * `window.localStorage` **lanza** en vez de devolver `null`. Todo lo que el
 * juego guarda —el récord, la altura del aro, si ya se vio el tutorial del
 * visor y si se juega en silencio— es prescindible, así que aquí ese fallo se
 * traduce a "no hay almacenamiento" y cada cosa decide con qué valor se queda.
 * En el servidor tampoco lo hay, y eso es lo que mantiene igual el HTML que se
 * prerenderiza y el que se hidrata.
 */
export function gameStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Un valor guardado entre visitas al que React se puede suscribir
 * (`useSyncExternalStore`), con la misma tolerancia a fallos que lo demás: si
 * el almacenamiento no está, se lee el valor por defecto y guardar no hace
 * nada. Lo leído se interpreta siempre con `parse`, porque es entrada externa.
 * Lo usan el progreso de Niveles y la racha sin fin; el récord y las demás
 * preferencias son anteriores y llevan la suya propia.
 */
export function createStoredPreference<T>(options: {
  key: string
  parse: (raw: string | null) => T
  serialize: (value: T) => string
}) {
  const listeners = new Set<() => void>()
  const get = (): T => {
    const storage = gameStorage()
    if (!storage) return options.parse(null)
    try {
      return options.parse(storage.getItem(options.key))
    } catch {
      return options.parse(null)
    }
  }
  return {
    get,
    getServer: (): T => options.parse(null),
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      window.addEventListener('storage', listener)
      return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', listener)
      }
    },
    save(value: T): void {
      const storage = gameStorage()
      if (!storage) return
      try {
        storage.setItem(options.key, options.serialize(value))
      } catch {
        // Cuota agotada o escritura prohibida: se sigue jugando sin guardar.
        return
      }
      for (const listener of listeners) listener()
    },
  }
}
