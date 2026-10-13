## El menú y los palos con el ratón, en la escena de verdad: que se empieza en el menú con el reto
## elegido y la práctica a un toque, que elegir
## velocidad y palos y subir el aro y darle a jugar empieza la partida con eso, que un clic en un
## palo durante la cuenta atrás no lo coge y jugando sí, que un clic en el aire no coge nada, que
## Escape pregunta antes de dejar la partida, que salir vuelve al menú con el modo que se eligió, y
## que la flecha de la esquina sale del juego.
##
## La velocidad, los palos y el aro van tras «Más opciones», que se despliega antes de elegirlos.
##
## Los clics son eventos del ratón empujados al viewport, sobre donde la cámara pinta cada botón
## (`pantalla_del_boton`) o cada palo (`pantalla_del_palo`): el mismo camino que un clic de verdad,
## puntería incluida. Apretar y soltar van en pasos distintos, como con una mano: la pulsación
## cuenta al apretar. Entre un paso y el siguiente pasa un tercio de segundo largo, que es lo que la
## puntería pide para no tomar dos clics seguidos por un doble roce.
extends Node

const MAIN := "res://games/stick-rush/main.tscn"
const MAX_FRAMES := 72 * 40
## Fotogramas entre paso y paso: a 72 por segundo, un tercio de segundo largo.
const ENTRE_PASOS := 26
## Un punto del cielo, lejos de cualquier botón y de cualquier palo.
const CIELO := Vector2(900, 60)

## Los pasos: [qué, con qué]. `apretar`/`soltar` un botón por su id (o `palo`, o el cielo),
## `escape`, `esperar` una fase, `esperar_tiempo` fotogramas, y las comprobaciones.
const PASOS := [
	["esperar", "menu"],
	# El menú abre en el reto; un toque en el modo lo pasa a la práctica, que es donde se elige.
	["modo", "challenge"],
	["apretar", "mode"], ["soltar", ""],
	["modo", "practice"],
	# Lo de la práctica y el aro van plegados tras «Más opciones»: se despliegan para elegirlos.
	["apretar", "opciones"], ["soltar", ""],
	["apretar", "difficulty:hard"], ["soltar", ""],
	["apretar", "sticks:7"], ["soltar", ""],
	["apretar", "hoopUp"], ["soltar", ""],
	["aro", 0.05],
	["apretar", "play"], ["soltar", ""],
	["esperar", "countdown"],
	["eleccion", "practice:hard:7"],
	["apretar", "palo"], ["soltar", ""],
	["atrapados", 0],
	["esperar_tiempo", 72 * 3],
	["esperar", "playing"],
	["apretar", "cielo"], ["soltar", ""],
	["atrapados", 0],
	["apretar", "palo"], ["soltar", ""],
	["atrapados", 1],
	["escape", ""],
	["esperar", "quit"],
	["apretar", "confirm:leave"], ["soltar", ""],
	["esperar", "menu"],
	# El modo elegido sigue puesto al volver. (No se pulsa otra vez: sin ventana el motor corre
	# más deprisa que el reloj, y dos toques al mismo botón tan seguidos son un doble roce.)
	["modo", "practice"],
	["apretar", "exit"], ["soltar", ""],
	["salida", ""],
]

var game: Node
var frames := 0
var paso := 0
var espera := 0
var failures: Array[String] = []
var apretado_en := Vector2(-1, -1)


func _ready() -> void:
	# Sin ventana, el motor pinta en 64×64: se juega en la proporción de una pantalla.
	get_window().size = Vector2i(1152, 648)
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Mudo")
	AudioServer.set_bus_mute(bus, true)
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness_menu", true)
	game.set_meta("sfx_bus", "Mudo")
	add_child(game)


func mover_a(at: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.position = at
	get_viewport().push_input(e)


func boton(at: Vector2, apretado: bool) -> void:
	var e := InputEventMouseButton.new()
	e.position = at
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = apretado
	get_viewport().push_input(e)


func _process(_delta: float) -> void:
	frames += 1
	if frames > MAX_FRAMES:
		failures.append("no ha acabado en %d fotogramas (paso %d)" % [MAX_FRAMES, paso])
		terminar()
		return
	if espera > 0:
		espera -= 1
		return
	espera = ENTRE_PASOS
	if paso >= PASOS.size():
		terminar()
		return
	var que: String = PASOS[paso][0]
	var con = PASOS[paso][1]
	match que:
		"esperar":
			if game.fase() != con:
				failures.append("paso %d: la fase es %s y no %s" % [paso, game.fase(), con])
		"esperar_tiempo":
			espera = int(con)
		"apretar":
			if con == "cielo":
				apretado_en = CIELO
			elif con == "palo":
				apretado_en = game.pantalla_del_palo()
			else:
				apretado_en = game.pantalla_del_boton(con)
			if apretado_en.x < 0:
				failures.append("paso %d: no encuentro %s" % [paso, con])
			mover_a(apretado_en)
			boton(apretado_en, true)
			# El palo o el aire, de un fotograma a otro: que el siguiente paso mire enseguida.
			if con == "palo" or con == "cielo":
				espera = 3
		"soltar":
			boton(apretado_en, false)
		"escape":
			var e := InputEventKey.new()
			e.keycode = KEY_ESCAPE
			e.pressed = true
			get_viewport().push_input(e)
		"eleccion":
			if game.eleccion() != con:
				failures.append("se juega %s y se eligió %s" % [game.eleccion(), con])
		"aro":
			if absf(float(game.ajuste_del_aro()) - float(con)) > 1e-6:
				failures.append("el aro se ha subido %.3f y no %.3f" % [game.ajuste_del_aro(), con])
		"atrapados":
			if int(game.atrapados()) != int(con):
				failures.append("paso %d: %d palos cogidos y tocaban %d" % [paso, game.atrapados(), con])
		"modo":
			if game.modo_de_la_partida() != con:
				failures.append("paso %d: el modo es %s y no %s" % [paso, game.modo_de_la_partida(), con])
		"salida":
			if not game.has_meta("salida"):
				failures.append("la flecha de salir no ha salido")
	paso += 1


func terminar() -> void:
	set_process(false)
	print("MENU-RATON %s %s" % ["ok" if failures.is_empty() else "FAIL", ", ".join(failures)])
	get_tree().quit(0 if failures.is_empty() else 1)
