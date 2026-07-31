# Stick Rush — versión Godot (desktop, objetivo Steam)

Port **desde cero** del juego web (que sigue siendo la versión para navegadores). El código web
es la especificación funcional: `src/lib/gameConfig.ts` ↔ `scripts/game_config.gd`,
`src/components/game/Stick.tsx` ↔ `scripts/stick.gd`, `StickMachine.tsx` + `gameStore.ts` ↔
`scripts/main.gd`.

> ⚠️ **Escrito sin ejecutar Godot en esta máquina** (no está instalado). Al abrirlo por primera
> vez, revisa la consola del editor: si algo chirría, serán detalles de API, no de diseño.

## Abrir y jugar

1. Instala **Godot 4.3+** (https://godotengine.org/download — la estándar, no la .NET).
2. `Importar` → selecciona `godot/project.godot` → abrir → ▶ (F5).
3. Menú: nº de palos (5–13) + dificultad (Fácil→Imposible) → **Jugar**. Clic izquierdo sobre un
   palo (colgando o cayendo) para atraparlo; si toca el suelo, perdido. Al resolverse todos,
   resultado y repetir/menú.

## Estructura

- `project.godot` — configuración (Godot 4.3, Forward+, 1280×720).
- `scenes/main.tscn` — escena raíz mínima: un `Node3D` con `main.gd` (todo lo demás se
  construye por código, para que el proyecto sea revisable sin abrir el editor).
- `scripts/game_config.gd` — constantes espejo del web (velocidades, paleta, geometría, arco).
- `scripts/stick.gd` — el palo: cuelga → cae tras su retardo escalonado → atrapado (flash) o
  perdido (suelo). Señales `caught`/`resolved`.
- `scripts/main.gd` — mundo (cámara/luces/suelo), máquina (arco por segmentos + soportes),
  partida (spawn por el arco con jitter, marcador, fin) y UI (menú/HUD/resultado).

## Mecánica (idéntica al web)

- Palos repartidos por el arco en `t=(i+1)/(n+1)`; retardo del palo `i` = `i·(1+rand·0.5)` s.
- Velocidad por dificultad: 0.8 / 1.5 / 2.5 / 4.0 / 7.0 unidades/s.
- Se puede atrapar colgando o cayendo; perdido al llegar a `GROUND_Y` (−2).
- Puntuación = atrapados; la partida cierra cuando todos los palos se resuelven.

## Export a desktop (camino a Steam)

1. Editor → `Proyecto → Exportar…` → añade presets **Windows Desktop**, **macOS** y
   **Linux** (descarga las *export templates* cuando el editor lo pida).
2. Exporta un build por plataforma y pruébalo fuera del editor.
3. Steam: alta en **Steam Direct** (100 $ por app, recuperables a 1.000 $ de ventas; reparto
   70/30), crear la app en Steamworks, subir builds con `steamcmd`/SteamPipe.
4. Integración Steam API (logros, overlay) más adelante: GDExtension **GodotSteam**
   (https://godotsteam.com) es el estándar de facto.
5. Futuro Steam VR: Godot 4 trae **OpenXR** integrado; la escena 3D actual es reutilizable
   (cámara XR + controladores en lugar del ratón, mismo `try_catch()` de los palos).

## Pendiente (siguientes iteraciones)

- Sonido (atrapar/perder/fin) y música; vibración de los palos al colgar.
- Pantalla de pausa; guardar la mejor puntuación (`user://`).
- Icono propio y nombre de paquete por plataforma en los presets de export.
