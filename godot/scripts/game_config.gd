class_name GameConfig
## Configuración del juego: espejo de src/lib/gameConfig.ts del proyecto web
## (el código web es la especificación funcional; mantener ambos en sintonía).

## Velocidad de caída (unidades/segundo) por dificultad.
const DIFFICULTY_SPEEDS := {
	"easy": 0.8,
	"medium": 1.5,
	"hard": 2.5,
	"expert": 4.0,
	"impossible": 7.0,
}

## Etiquetas visibles (idioma del producto: español), en orden de menor a mayor.
const DIFFICULTY_ORDER: Array[String] = ["easy", "medium", "hard", "expert", "impossible"]
const DIFFICULTY_LABELS := {
	"easy": "Fácil",
	"medium": "Medio",
	"hard": "Difícil",
	"expert": "Experto",
	"impossible": "Imposible",
}

## Paleta de los palos; se asigna cíclicamente por índice.
const STICK_COLORS: Array[Color] = [
	Color("#D97706"),
	Color("#15803D"),
	Color("#DC2626"),
	Color("#7C3AED"),
	Color("#0284C7"),
]

## Límites de palos seleccionables.
const MIN_STICKS := 5
const MAX_STICKS := 13

## Geometría de la máquina y de los palos (mismas unidades que el web).
const MACHINE_RADIUS := 3.0
const MACHINE_HEIGHT := 3.0
const STICK_LENGTH := 1.5
const GROUND_Y := -2.0


static func stick_color(index: int) -> Color:
	return STICK_COLORS[index % STICK_COLORS.size()]


## Punto del arco de la máquina para t en [0,1] (izquierda→derecha).
## Igual que buildArcPoints del web: semicírculo XY achatado (y = sin·R·0.5 + H).
static func arc_point(t: float) -> Vector3:
	var angle := PI - t * PI
	return Vector3(
		cos(angle) * MACHINE_RADIUS,
		sin(angle) * MACHINE_RADIUS * 0.5 + MACHINE_HEIGHT,
		0.0,
	)
