## Partidas automáticas enteras, hasta el final, contando lo que pasa: que la tanda y la partida de
## `src/lib` y la escena están cosidas (palos atrapados y perdidos, puntos, racha y récord), que
## suena lo que toca y tantas veces como toca (la regla de `useGameSound.ts`), que la máquina y la
## feria son las de la web, y que al acabar se cuenta el resultado al salón. Sin audio de verdad:
## todo va a un bus silenciado, que cuenta igual.
##
## Y el contrato del reto: con un salón que presta una semilla (`challenge_seed`), el juego entra
## jugando el desafío con los palos sacados de ella, la misma semilla da el mismo reparto, y la
## partida jugada se le cuenta al salón como reto.
##
## Se lanza con `--fixed-fps 72`, como el jugador automático.
extends Node

const MAIN := "res://games/stick-rush/main.tscn"
const SALON := preload("res://games/stick-rush/tests/salon_de_mentira.gd")
## La partida del jugador automático (`PARTIDA_DEL_BOT`): nueve palos, y uno que deja escapar.
const PALOS := 9
## La música de la web (`MUSIC_VOLUME`) por el ambiente de partida del salón (60 de 100).
const MUSIC_VOLUME := 0.22 * 0.6
## La partida dura unos catorce segundos de juego y el reto unos veinticinco: con dos minutos, algo
## se ha atascado.
const MAX_FRAMES := 72 * 120
## Una semilla cualquiera para el reto.
const SEMILLA := 20260926
## Lo que se deja correr el reto para mirar su reparto: la cuenta atrás y un poco más.
const FOTOGRAMAS_DEL_RETO := 72 * 5

var game: Node
var salon: Node
var frames := 0
var fallos: Array[String] = []
var fase := "partida"
var repartos: Array[String] = []


func _ready() -> void:
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Mudo")
	AudioServer.set_bus_mute(bus, true)
	montar()


func montar(meta_de_menu := false) -> void:
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness_menu" if meta_de_menu else "harness", true)
	game.set_meta("sfx_bus", "Mudo")
	add_child(game)


func _process(_delta: float) -> void:
	frames += 1
	match fase:
		"partida":
			if game.has_meta("result"):
				comprobar(JSON.parse_string(game.get_meta("result")))
				empezar_el_reto()
			elif frames > MAX_FRAMES:
				fallos.append("la partida no ha acabado en %d fotogramas (fase %s)" % [MAX_FRAMES, game.fase()])
				terminar()
		"reto", "reto-otra-vez":
			if frames == 10:
				comprobar_la_entrada()
			elif frames >= FOTOGRAMAS_DEL_RETO:
				repartos.append(game.reparto_de_la_tanda())
				game.queue_free()
				if fase == "reto":
					# Otra vez, desde cero, con la misma semilla: tiene que salir el mismo reparto.
					fase = "reto-otra-vez"
					montar(true)
				else:
					comprobar_los_repartos()
					# Y ahora jugado entero por el jugador automático: se le cuenta al salón como reto.
					fase = "reto-jugado"
					montar()
		"reto-jugado":
			if game.has_meta("result"):
				comprobar_el_reto(JSON.parse_string(game.get_meta("result")))
				terminar()
			elif frames > MAX_FRAMES:
				fallos.append("el reto no ha acabado en %d fotogramas (fase %s)" % [MAX_FRAMES, game.fase()])
				terminar()


## Dos recuentos iguales: el JSON trae los números como decimales.
func iguales(hay: Dictionary, toca: Dictionary) -> bool:
	if hay.size() != toca.size():
		return false
	for clave in toca:
		if int(hay.get(clave, -1)) != int(toca[clave]):
			return false
	return true


func cuenta(de: Dictionary, nombre: String) -> int:
	return int(de.get(nombre, 0))


func comprobar(r: Dictionary) -> void:
	var pedidos: Dictionary = r.sfx.requested
	var sonados: Dictionary = r.sfx.played
	if r.outcome != "cleared":
		fallos.append("la partida acaba «%s» y no «cleared»" % r.outcome)
	if int(r.sticks) != PALOS or int(r.resolved) != PALOS:
		fallos.append("%d palos resueltos de %d" % [r.resolved, r.sticks])
	if int(r.misses) != 1 or int(r.score) != PALOS - 1:
		fallos.append("el jugador automático tenía que coger todos menos uno: %d cogidos, %d perdidos" % [r.score, r.misses])
	if int(r.bestStreak) < 2 or int(r.points) <= 0:
		fallos.append("racha %d y %d puntos" % [r.bestStreak, r.points])
	# Es la primera partida guardando aparte: es récord, y lo guardado es lo hecho.
	if not r.record or int(r.best) != int(r.points):
		fallos.append("récord %s, guardado %d, hecho %d" % [r.record, r.best, r.points])
	var estados: Array = r.palos
	if estados.count("caught") != PALOS - 1 or estados.count("missed") != 1:
		fallos.append("los palos acaban %s" % [estados])

	# Suena la cuenta atrás (3, 2, 1), la salida, cada atrape en su nota, el perdido y el cierre.
	for nombre in ["countdown-3", "countdown-2", "countdown-1", "go", "miss", "over-close", "record"]:
		if cuenta(pedidos, nombre) != 1:
			fallos.append("%s ha sonado %d veces" % [nombre, cuenta(pedidos, nombre)])
	var atrapes := 0
	for n in range(1, 9):
		atrapes += cuenta(pedidos, "catch-%d" % n)
	if atrapes != int(r.score):
		fallos.append("%d notas de atrape para %d palos" % [atrapes, r.score])
	if cuenta(pedidos, "catch-1") < 1 or cuenta(pedidos, "catch-2") < 1:
		fallos.append("la nota no sube con la racha: %s" % [pedidos])
	for nombre in r.variants:
		if int(r.variants[nombre]) < 1:
			fallos.append("%s no tiene fichero" % nombre)
		if cuenta(sonados, nombre) != cuenta(pedidos, nombre):
			fallos.append("%s: pedido %d, sonado %d" % [nombre, cuenta(pedidos, nombre), cuenta(sonados, nombre)])
	if not r.music.playing or absf(float(r.music.volume) - MUSIC_VOLUME) > 0.001:
		fallos.append("la música no está sonando a %.3f: %s" % [MUSIC_VOLUME, r.music])

	# Al salón se le cuenta una vez, sin ser el reto, con los mismos puntos.
	var resultados: Array = r.resultados
	if resultados.size() != 1 or resultados[0].modo != "practice" or resultados[0].reto or int(resultados[0].puntos) != int(r.points):
		fallos.append("al salón se le cuenta %s" % [resultados])
	# Lo que se ve: la máquina de la web y la feria con las piezas del kit.
	if not iguales(r.maquina, {"matte": 24, "frame": 2, "truss": 43, "bulbs": 8}):
		fallos.append("la máquina no es la de la web: %s" % [r.maquina])
	var feria: Dictionary = r.feria
	if not iguales(feria.piezas, {"puesto": 6, "farol": 8, "banderola": 8}) or int(feria.siluetas) != 42 or int(feria.cabinas) != 12:
		fallos.append("la feria no es la de la web: %s" % [feria])
	print("PARTIDA-AUTO %d de %d, racha %d, %d puntos, %d fotogramas, %d µs de media jugando (%d de pico)" % [
		r.score, r.sticks, r.bestStreak, r.points, r.frames, r.usecJugandoAvg, r.usecJugandoMax,
	])


func empezar_el_reto() -> void:
	game.queue_free()
	fase = "reto"
	salon = SALON.new()
	salon.name = "XRcade"
	salon.set_meta("challenge_seed", SEMILLA)
	get_tree().root.add_child(salon)
	# Sin el jugador automático: el reto se entra jugando, sin pasar por el menú, y aquí solo se mira.
	montar(true)


func comprobar_la_entrada() -> void:
	if game.modo_de_la_partida() != "challenge":
		fallos.append("con la semilla del salón se juega %s y no el desafío" % game.modo_de_la_partida())
	if not game.en_reto():
		fallos.append("con la semilla del salón la partida no es el reto")
	if game.fase() != "countdown":
		fallos.append("con el reto del salón se entra a la cuenta atrás, no a %s" % game.fase())
	if int(game.semilla_de_la_partida()) != SEMILLA:
		fallos.append("la semilla es %d y el salón prestó %d" % [game.semilla_de_la_partida(), SEMILLA])


func comprobar_los_repartos() -> void:
	if repartos.size() != 2 or repartos[0] == "" or repartos[0] != repartos[1]:
		fallos.append("la misma semilla no da el mismo reparto: %s" % [repartos])


func comprobar_el_reto(r: Dictionary) -> void:
	var resultados: Array = salon.resultados
	if resultados.size() != 1 or resultados[0].modo != "challenge" or not resultados[0].reto or int(resultados[0].puntos) != int(r.points):
		fallos.append("al salón se le cuenta el reto como %s" % [resultados])
	if r.outcome != "cleared" or int(r.sticks) != 13 or int(r.misses) != 1:
		fallos.append("el reto acaba %s con %d palos y %d perdidos" % [r.outcome, r.sticks, r.misses])
	if int(r.semilla) != SEMILLA:
		fallos.append("el reto se ha jugado con la semilla %d" % r.semilla)
	print("PARTIDA-AUTO reto %d de %d, %d puntos, %d µs de media jugando" % [r.score, r.sticks, r.points, r.usecJugandoAvg])


func terminar() -> void:
	set_process(false)
	if salon != null:
		salon.queue_free()
	print("PARTIDA-AUTO %s %s" % ["ok" if fallos.is_empty() else "FAIL", ", ".join(fallos)])
	get_tree().quit(0 if fallos.is_empty() else 1)
