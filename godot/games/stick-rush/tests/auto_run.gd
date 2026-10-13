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
## Y el del objetivo: con el metadato `goal` del salón el cartel enseña los listones de medalla (sin
## récord todavía, el bronce dicho en palos y el oro); sin él (la segunda entrada al reto), solo la
## misión.
##
## Y **la partida a dos** (`duel.ts`): el desafío a dos, las dos tandas seguidas por el jugador
## automático, la segunda con la semilla de la primera; el segundo deja escapar un palo más, así que
## gana el primero; se apunta a la pareja sin tocar el récord, al salón se le cuenta una vez, y el
## final suena a ganar.
##
## Se lanza con `--fixed-fps 72`, como el jugador automático.
extends Node

const MAIN := "res://games/stick-rush/main.tscn"
const SALON := preload("res://games/stick-rush/tests/fake_salon.gd")
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
## El objetivo de la cabina tal y como lo deja el salón en su metadato `goal` (`xrcade.gd`).
const OBJETIVO := {
	"medallas": {"bronce": 1900, "plata": 3750, "oro": 5200},
	"mejorEs": "mas", "unidad": "points in challenge", "record": null, "modo": "challenge",
}
## Sin récord en el salón, la primera vez: el bronce en palos (`contable`) y el oro.
const LISTONES := "Bronze ≈ 13 sticks · Gold 5,200"

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


func montar(meta_de_menu := false, a_dos := false) -> void:
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness_menu" if meta_de_menu else "harness", true)
	if a_dos:
		game.set_meta("a_dos", true)
	game.set_meta("sfx_bus", "Mudo")
	# Lo que comprueba está escrito en inglés: sin idioma pedido, el juego habla el del sistema.
	game.set_meta("lang", "en")
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
				comprobar_el_cartel(fase == "reto")
			elif frames >= FOTOGRAMAS_DEL_RETO:
				repartos.append(game.reparto_de_la_tanda())
				game.queue_free()
				if fase == "reto":
					# Otra vez, desde cero, con la misma semilla: tiene que salir el mismo reparto.
					# Y ya sin objetivo: un salón que no le pone medallas al juego.
					salon.remove_meta("goal")
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
				game.queue_free()
				# Sin salón que preste semilla: la partida a dos es una partida normal.
				get_tree().root.remove_child(salon)
				salon.free()
				salon = null
				fase = "a-dos"
				montar(false, true)
			elif frames > MAX_FRAMES:
				fallos.append("el reto no ha acabado en %d fotogramas (fase %s)" % [MAX_FRAMES, game.fase()])
				terminar()
		"a-dos":
			if game.has_meta("result"):
				comprobar_a_dos(JSON.parse_string(game.get_meta("result")))
				terminar()
			elif frames > MAX_FRAMES * 2:
				fallos.append("la partida a dos no ha acabado en %d fotogramas (fase %s)" % [MAX_FRAMES * 2, game.fase()])
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
	if resultados.size() != 1 or resultados[0].mode != "practice" or resultados[0].challenge or int(resultados[0].points) != int(r.points):
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
	salon.set_meta("goal", JSON.stringify(OBJETIVO))
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


## Con el objetivo del salón el cartel enseña los listones bajo la misión; sin él, solo la misión.
func comprobar_el_cartel(con_objetivo: bool) -> void:
	var lineas: PackedStringArray = game.cartel_del_objetivo().split("\n", false)
	if lineas.is_empty():
		fallos.append("en la cuenta atrás del reto no hay cartel del objetivo")
	elif con_objetivo and not lineas.has(LISTONES):
		fallos.append("con el objetivo del salón el cartel no enseña los listones: %s" % [lineas])
	elif not con_objetivo and lineas.size() != 1:
		fallos.append("sin objetivo del salón el cartel dice algo más que la misión: %s" % [lineas])


func comprobar_los_repartos() -> void:
	if repartos.size() != 2 or repartos[0] == "" or repartos[0] != repartos[1]:
		fallos.append("la misma semilla no da el mismo reparto: %s" % [repartos])


func comprobar_el_reto(r: Dictionary) -> void:
	var resultados: Array = salon.resultados
	if resultados.size() != 1 or resultados[0].mode != "challenge" or not resultados[0].challenge or int(resultados[0].points) != int(r.points):
		fallos.append("al salón se le cuenta el reto como %s" % [resultados])
	if r.outcome != "cleared" or int(r.sticks) != 13 or int(r.misses) != 1:
		fallos.append("el reto acaba %s con %d palos y %d perdidos" % [r.outcome, r.sticks, r.misses])
	if int(r.semilla) != SEMILLA:
		fallos.append("el reto se ha jugado con la semilla %d" % r.semilla)
	print("PARTIDA-AUTO reto %d de %d, %d puntos, %d µs de media jugando" % [r.score, r.sticks, r.points, r.usecJugandoAvg])


func comprobar_a_dos(r: Dictionary) -> void:
	var duelo = r.duelo
	if duelo == null or duelo.points[0] == null or duelo.points[1] == null:
		fallos.append("la partida a dos no ha acabado: %s" % [duelo])
		return
	var uno := int(duelo.points[0])
	var dos := int(duelo.points[1])
	if uno <= dos:
		fallos.append("el segundo deja escapar un palo más y aun así saca %d contra %d" % [dos, uno])
	var semillas: Array = r.semillas
	if semillas.size() != 2 or int(semillas[0]) != int(semillas[1]):
		fallos.append("las dos tandas no empiezan con la misma semilla: %s" % [semillas])
	var pareja: Dictionary = r.pareja
	if int(pareja.wins[0]) != 1 or int(pareja.wins[1]) != 0 or int(pareja.ties) != 0:
		fallos.append("a la pareja se le apunta %s" % [pareja])
	if int(r.best) != 0 or r.record:
		fallos.append("una tanda a dos ha tocado el récord del desafío: %d" % r.best)
	var resultados: Array = r.resultados
	if resultados.size() != 1 or resultados[0].mode != "duel" or resultados[0].challenge or int(resultados[0].points) != uno:
		fallos.append("al salón se le cuenta la partida a dos como %s" % [resultados])
	var pedidos: Dictionary = r.sfx.requested
	if cuenta(pedidos, "countdown-3") != 2 or cuenta(pedidos, "go") != 2:
		fallos.append("dos tandas son dos cuentas atrás: %s" % [pedidos])
	if cuenta(pedidos, "over-win") != 2 or cuenta(pedidos, "record") != 1:
		fallos.append("el final de la partida a dos no suena a ganar una vez: %s" % [pedidos])
	print("PARTIDA-AUTO a dos %d contra %d, pareja %s" % [uno, dos, pareja])


func terminar() -> void:
	set_process(false)
	if salon != null:
		salon.queue_free()
	print("PARTIDA-AUTO %s %s" % ["ok" if fallos.is_empty() else "FAIL", ", ".join(fallos)])
	get_tree().quit(0 if fallos.is_empty() else 1)
