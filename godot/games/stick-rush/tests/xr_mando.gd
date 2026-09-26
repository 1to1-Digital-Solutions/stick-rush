## Stick Rush con visor, sin visor: mandos de mentira (`@kit/runtime/xr/simulado`) y el jugador
## automático que lleva el puño a cada palo y aprieta el gatillo lateral, por el mismo camino que una
## mano de verdad. Cada caso monta el juego de nuevo con sus ajustes del salón y comprueba la
## gramática XR del kit con los ficheros comunes de verdad del juego (`xrLayout.ts` para la altura,
## `hostAnchor.ts`, `tactos.ts`):
##
## - los palos se cogen con cualquiera de las dos manos, la del lado de cada palo, y cada atrape
##   vibra en la mano que lo coge (`pulsosDelAtrape`: el agarre de `tactos.ts`);
## - sentado a los ojos el mundo baja lo que los ojos bajan de 1,6 m y el aro se queda en su cota;
##   de pie, el mundo no se mueve y el aro se planta medio metro por encima de los ojos;
## - con salón, el mundo se planta donde presta el anclaje; sin él, a los pies y de frente;
## - el stick de la otra mano gira el mundo 30° sentado, y de pie no;
## - la primera vez enseña: los dos pasos del tutorial y el mando de verdad en las dos manos;
## - las ayudas de la web se ven: las huellas, el palo fantasma y el mando junto a él.
##
## Se lanza con `--fixed-fps 72`, como el jugador automático.
extends Node

const MAIN := "res://games/stick-rush/main.tscn"
const SALON := preload("res://games/stick-rush/tests/salon_de_mentira.gd")
const REFERENCIA := 1.6
const PASO_DE_GIRO := PI / 6
const MAX_FRAMES := 72 * 120
## La cota del aro de escritorio (`MACHINE_HEIGHT`) y lo que sube sobre los ojos (`HOOP_RISE_ABOVE_EYES`).
const ARO_DE_ESCRITORIO := 1.95
const SOBRE_LOS_OJOS := 0.5
## El agarre de `tactos.ts`: lo que vibra al coger un palo (a media caída, sin el in extremis).
const AGARRE := {"amplitud": 0.25, "segundos": 0.018}

const CASOS := [
	{
		"nombre": "diestro sentado en el salón",
		"ajustes": {"xrcade:hand": "right", "xrcade:play-height": "eyes"},
		"ojos": 1.15,
		"anclaje": {"position": Vector3(0.3, 0.0, -0.2), "yaw": 0.25},
		"gira": true,
	},
	{
		"nombre": "zurdo de pie, sin salón",
		"ajustes": {"xrcade:hand": "left", "xrcade:play-height": "standing"},
		"ojos": 1.7,
		"anclaje": null,
		"gira": false,
	},
]

var caso := -1
var game: Node
var salon: Node
var frames := 0
var fallos: Array[String] = []


func _ready() -> void:
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Mudo")
	AudioServer.set_bus_mute(bus, true)
	siguiente()


func siguiente() -> void:
	if game != null:
		game.queue_free()
		game = null
	if salon != null:
		# Fuera ya, no al final del fotograma: el juego siguiente busca `/root/XRcade` al entrar.
		salon.get_parent().remove_child(salon)
		salon.free()
		salon = null
	caso += 1
	if caso >= CASOS.size():
		print("XR-MANDO %s %s" % ["ok" if fallos.is_empty() else "FAIL", "; ".join(fallos)])
		get_tree().quit(0 if fallos.is_empty() else 1)
		return
	var c: Dictionary = CASOS[caso]
	if c.anclaje != null:
		salon = SALON.new()
		salon.name = "XRcade"
		salon.anchor_position = c.anclaje.position
		salon.anchor_yaw = c.anclaje.yaw
		get_tree().root.add_child.call_deferred(salon)
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness", true)
	game.set_meta("sfx_bus", "Mudo")
	game.set_meta("xr_simulado", true)
	game.set_meta("ojos", c.ojos)
	game.set_meta("ajustes", JSON.stringify(c.ajustes))
	add_child.call_deferred(game)


func _process(_delta: float) -> void:
	if game == null or not game.is_inside_tree():
		return
	frames += 1
	if game.has_meta("result"):
		comprobar(JSON.parse_string(game.get_meta("result")))
		siguiente()
	elif frames > MAX_FRAMES:
		fallos.append("%s: la partida no ha acabado en %d fotogramas (fase %s)" % [CASOS[caso].nombre, MAX_FRAMES, game.fase()])
		siguiente()


func cerca(a: float, b: float, margen := 1e-3) -> bool:
	return absf(a - b) <= margen


func es(pulso: Dictionary, receta: Dictionary) -> bool:
	return cerca(float(pulso.amplitud), receta.amplitud) and cerca(float(pulso.segundos), receta.segundos)


func comprobar(r: Dictionary) -> void:
	var c: Dictionary = CASOS[caso]
	var f: Array[String] = []
	var xr: Dictionary = r.xr
	var sentado: bool = c.ajustes["xrcade:play-height"] == "eyes"

	if r.outcome != "cleared" or int(r.score) != 8 or int(r.misses) != 1:
		f.append("la partida acaba «%s» con %d cogidos y %d perdidos" % [r.outcome, r.score, r.misses])
	# Con las dos manos, cada una los de su lado, y cada atrape vibra en la suya.
	var por_mano: Dictionary = xr.atrapesPorMano
	if int(por_mano.left) < 1 or int(por_mano.right) < 1 or int(por_mano.left) + int(por_mano.right) != int(r.score):
		f.append("se han cogido %s con cada mano, de %d" % [por_mano, r.score])
	var pulsos: Array = xr.vibraciones
	for mano in ["left", "right"]:
		var suyos := pulsos.filter(func(p): return p.mano == mano)
		if suyos.size() != int(por_mano[mano]) or suyos.any(func(p): return not es(p, AGARRE)):
			f.append("la mano %s ha vibrado %s para %d atrapes" % [mano, suyos, por_mano[mano]])

	var subida: float = (c.ojos - REFERENCIA) if sentado else 0.0
	if not cerca(float(xr.subida), subida):
		f.append("el mundo ha subido %.3f y tenía que subir %.3f" % [xr.subida, subida])
	var aro: float = ARO_DE_ESCRITORIO if sentado else c.ojos + SOBRE_LOS_OJOS
	if not cerca(float(xr.aro), aro, 0.03):
		f.append("el aro está a %.3f y tocaba %.3f" % [xr.aro, aro])
	var colocacion: Dictionary = xr.colocacion
	if c.anclaje != null:
		if not (cerca(colocacion.x, c.anclaje.position.x) and cerca(colocacion.z, c.anclaje.position.z) and cerca(colocacion.yaw, c.anclaje.yaw)):
			f.append("plantado en %s y el salón prestaba %s" % [colocacion, c.anclaje])
	elif not (cerca(colocacion.x, 0.0) and cerca(colocacion.z, 0.0) and cerca(colocacion.yaw, 0.0)):
		f.append("sin salón tenía que plantarse a los pies y de frente: %s" % colocacion)
	var giro: float = PASO_DE_GIRO if c.gira else 0.0
	if not cerca(float(xr.giro), giro):
		f.append("girado %.3f y tocaba %.3f" % [xr.giro, giro])

	for paso in ["grab", "around"]:
		if not paso in xr.tutorial:
			f.append("el tutorial no ha enseñado %s (%s)" % [paso, xr.tutorial])
	if xr.manosConMando != ["left", "right"]:
		f.append("el mando de verdad ha salido en %s y tocaba en las dos manos" % [xr.manosConMando])
	for ayuda in ["suelo", "palo", "mando"]:
		if not ayuda in xr.ayudas:
			f.append("no se ha visto la ayuda %s (%s)" % [ayuda, xr.ayudas])

	for fallo in f:
		fallos.append("%s: %s" % [c.nombre, fallo])
	print("XR-MANDO caso «%s»: %d de %d, manos %s, %d pulsos, subida %.3f, aro %.3f, giro %.3f, %d µs de media jugando%s" % [
		c.nombre, r.score, r.sticks, por_mano, pulsos.size(), xr.subida, xr.aro, xr.giro, r.usecJugandoAvg,
		"" if f.is_empty() else " — FAIL",
	])
