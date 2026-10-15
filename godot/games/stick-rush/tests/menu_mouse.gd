## The menu and the sticks with the mouse, in the real scene: that it starts in the menu with the
## challenge chosen and practice one tap away, that choosing
## speed and sticks and raising the hoop and pressing play starts the run with that, that a click on
## a stick during the countdown does not catch it and while playing it does, that a click in the air
## catches nothing, that Escape asks before leaving the run, that leaving goes back to the menu with
## the mode that was chosen, and that the arrow in the corner leaves the game.
##
## The speed, the sticks and the hoop go behind «Más opciones», which is unfolded before choosing them.
##
## The clicks are mouse events pushed to the viewport, over where the camera paints each button
## (`button_on_screen`) or each stick (`stick_on_screen`): the same path as a real click, aim
## included. Pressing and releasing go in different steps, as with a hand: the press counts on
## pressing. Between one step and the next a long third of a second goes by, which is what the aim
## asks for so as not to take two clicks in a row for a double brush.
extends Node

const MAIN := "res://games/stick-rush/main.tscn"
const MAX_FRAMES := 72 * 40
## Frames between step and step: at 72 per second, a long third of a second.
const BETWEEN_STEPS := 26
## A point of the sky, far from any button and from any stick.
const SKY := Vector2(900, 60)

## The steps: [what, with what]. `press`/`release` a button by its id (or `stick`, or the sky),
## `escape`, `wait` for a phase, `wait_time` frames, and the checks.
const STEPS := [
	["wait", "menu"],
	# The menu opens on the challenge; a tap on the mode switches it to practice, which is where things are chosen.
	["mode", "challenge"],
	["press", "mode"], ["release", ""],
	["mode", "practice"],
	# Practice's options and the hoop are folded behind «Más opciones»: they are unfolded to choose them.
	["press", "options"], ["release", ""],
	["press", "difficulty:hard"], ["release", ""],
	["press", "sticks:7"], ["release", ""],
	["press", "hoopUp"], ["release", ""],
	["hoop", 0.05],
	["press", "play"], ["release", ""],
	["wait", "countdown"],
	["selection", "practice:hard:7"],
	["press", "stick"], ["release", ""],
	["caught", 0],
	["wait_time", 72 * 3],
	["wait", "playing"],
	["press", "sky"], ["release", ""],
	["caught", 0],
	["press", "stick"], ["release", ""],
	["caught", 1],
	["escape", ""],
	["wait", "quit"],
	["press", "confirm:leave"], ["release", ""],
	["wait", "menu"],
	# The chosen mode is still set on coming back. (It is not pressed again: with no window the engine
	# runs faster than the clock, and two taps on the same button so close together are a double brush.)
	["mode", "practice"],
	["press", "exit"], ["release", ""],
	["exited", ""],
]

var game: Node
var frames := 0
var step := 0
var wait := 0
var failures: Array[String] = []
var pressed_at := Vector2(-1, -1)


func _ready() -> void:
	# With no window, the engine paints at 64×64: it is played in the proportion of a screen.
	get_window().size = Vector2i(1152, 648)
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Muted")
	AudioServer.set_bus_mute(bus, true)
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness_menu", true)
	game.set_meta("sfx_bus", "Muted")
	add_child(game)


func move_to(at: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.position = at
	get_viewport().push_input(e)


func button(at: Vector2, pressed: bool) -> void:
	var e := InputEventMouseButton.new()
	e.position = at
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = pressed
	get_viewport().push_input(e)


func _process(_delta: float) -> void:
	frames += 1
	if frames > MAX_FRAMES:
		failures.append("it has not ended in %d frames (step %d)" % [MAX_FRAMES, step])
		finish()
		return
	if wait > 0:
		wait -= 1
		return
	wait = BETWEEN_STEPS
	if step >= STEPS.size():
		finish()
		return
	var what: String = STEPS[step][0]
	var with = STEPS[step][1]
	match what:
		"wait":
			if game.phase() != with:
				failures.append("step %d: the phase is %s and not %s" % [step, game.phase(), with])
		"wait_time":
			wait = int(with)
		"press":
			if with == "sky":
				pressed_at = SKY
			elif with == "stick":
				pressed_at = game.stick_on_screen()
			else:
				pressed_at = game.button_on_screen(with)
			if pressed_at.x < 0:
				failures.append("step %d: cannot find %s" % [step, with])
			move_to(pressed_at)
			button(pressed_at, true)
			# The stick or the air, from one frame to another: let the next step look straight away.
			if with == "stick" or with == "sky":
				wait = 3
		"release":
			button(pressed_at, false)
		"escape":
			var e := InputEventKey.new()
			e.keycode = KEY_ESCAPE
			e.pressed = true
			get_viewport().push_input(e)
		"selection":
			if game.selection() != with:
				failures.append("%s is played and %s was chosen" % [game.selection(), with])
		"hoop":
			if absf(float(game.hoop_adjustment()) - float(with)) > 1e-6:
				failures.append("the hoop has been raised %.3f and not %.3f" % [game.hoop_adjustment(), with])
		"caught":
			if int(game.caught()) != int(with):
				failures.append("step %d: %d sticks caught and %d were due" % [step, game.caught(), with])
		"mode":
			if game.run_mode() != with:
				failures.append("step %d: the mode is %s and not %s" % [step, game.run_mode(), with])
		"exited":
			if not game.has_meta("salida"):
				failures.append("the exit arrow has not exited")
	step += 1


func finish() -> void:
	set_process(false)
	print("MENU-MOUSE %s %s" % ["ok" if failures.is_empty() else "FAIL", ", ".join(failures)])
	get_tree().quit(0 if failures.is_empty() else 1)
