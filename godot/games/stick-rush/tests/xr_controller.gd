## Stick Rush with a headset, without a headset: fake controllers (`@kit/runtime/xr/simulated`) and
## the automatic player that takes the fist to each stick and squeezes the side trigger, along the
## same path as a real hand. Each case mounts the game again with its hall settings and checks the
## kit's XR grammar with the game's real common files (`xrLayout.ts` for the height,
## `hostAnchor.ts`, `hapticFeedback.ts`):
##
## - the sticks are caught with either hand, the one on each stick's side, and each catch
##   vibrates in the hand that catches it (`catchPulses`: the grab of `hapticFeedback.ts`);
## - seated at eye height the world goes down what the eyes go down from 1.6 m and the hoop stays at
##   its height; standing, the world does not move and the hoop is planted half a metre above the eyes;
## - with a hall, the world is planted where the anchor lends; without one, at the feet and facing forward;
## - the thumbstick of the other hand turns the world 30° seated, and standing it does not;
## - the first time it teaches: the two steps of the tutorial and the real controller in both hands;
## - the web's hints are seen: the footprints, the ghost stick and the controller beside it;
## - the hidden feat (`feats.ts`): facing forward it does not come up, and with the head turned right
##   round —catching the sticks behind the back— it is reported to the hall in the JSON of
##   `report_result`, once.
##
## It is launched with `--fixed-fps 72`, like the automatic player.
extends Node

const MAIN := "res://games/stick-rush/main.tscn"
const SALON := preload("res://games/stick-rush/tests/fake_salon.gd")
const REFERENCE := 1.6
const TURN_STEP := PI / 6
const MAX_FRAMES := 72 * 120
## The height of the desktop hoop (`MACHINE_HEIGHT`) and how far it rises above the eyes (`HOOP_RISE_ABOVE_EYES`).
const DESKTOP_HOOP := 1.95
const ABOVE_THE_EYES := 0.5
## The grab of `hapticFeedback.ts`: what vibrates on catching a stick (halfway through the fall, without the last-gasp one).
const GRAB := {"amplitude": 0.25, "seconds": 0.018}

const CASES := [
	{
		"name": "right-handed seated in the hall",
		"settings": {"xrcade:hand": "right", "xrcade:play-height": "eyes"},
		"eyes": 1.15,
		"anchor": {"position": Vector3(0.3, 0.0, -0.2), "yaw": 0.25},
		"turns": true,
	},
	{
		"name": "left-handed standing, without a hall",
		"settings": {"xrcade:hand": "left", "xrcade:play-height": "standing"},
		"eyes": 1.7,
		"anchor": null,
		"turns": false,
	},
	{
		"name": "with the back to the machine, in the hall",
		"settings": {"xrcade:hand": "right", "xrcade:play-height": "standing"},
		"eyes": 1.6,
		"anchor": {"position": Vector3.ZERO, "yaw": 0.0},
		"turns": false,
		"look": 180.0,
	},
]
## The feat of catching a stick behind the back (`FEATS.behindBack`).
const BEHIND_BACK := "SR_BEHIND_BACK"

var case_index := -1
var game: Node
var salon: Node
var frames := 0
var failures: Array[String] = []


func _ready() -> void:
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Muted")
	AudioServer.set_bus_mute(bus, true)
	next()


func next() -> void:
	if game != null:
		game.queue_free()
		game = null
	if salon != null:
		# Out right now, not at the end of the frame: the next game looks for `/root/XRcade` on entering.
		salon.get_parent().remove_child(salon)
		salon.free()
		salon = null
	case_index += 1
	if case_index >= CASES.size():
		print("XR-CONTROLLER %s %s" % ["ok" if failures.is_empty() else "FAIL", "; ".join(failures)])
		get_tree().quit(0 if failures.is_empty() else 1)
		return
	var c: Dictionary = CASES[case_index]
	if c.anchor != null:
		salon = SALON.new()
		salon.name = "XRcade"
		salon.anchor_position = c.anchor.position
		salon.anchor_yaw = c.anchor.yaw
		get_tree().root.add_child.call_deferred(salon)
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness", true)
	game.set_meta("sfx_bus", "Muted")
	game.set_meta("xr_simulado", true)
	game.set_meta("eyes", c.eyes)
	game.set_meta("settings", JSON.stringify(c.settings))
	if c.has("look"):
		game.set_meta("look", c.look)
	add_child.call_deferred(game)


func _process(_delta: float) -> void:
	if game == null or not game.is_inside_tree():
		return
	frames += 1
	if game.has_meta("result"):
		check(JSON.parse_string(game.get_meta("result")))
		next()
	elif frames > MAX_FRAMES:
		failures.append("%s: the run has not ended in %d frames (phase %s)" % [CASES[case_index].name, MAX_FRAMES, game.phase()])
		next()


func near(a: float, b: float, margin := 1e-3) -> bool:
	return absf(a - b) <= margin


func matches(pulse: Dictionary, recipe: Dictionary) -> bool:
	return near(float(pulse.amplitude), recipe.amplitude) and near(float(pulse.seconds), recipe.seconds)


func check(r: Dictionary) -> void:
	var c: Dictionary = CASES[case_index]
	var f: Array[String] = []
	var xr: Dictionary = r.xr
	var seated: bool = c.settings["xrcade:play-height"] == "eyes"

	if r.outcome != "cleared" or int(r.score) != 8 or int(r.misses) != 1:
		f.append("the run ends «%s» with %d caught and %d missed" % [r.outcome, r.score, r.misses])
	# The behind-the-back feat: only with the head turned, and to the hall in the JSON of `report_result`.
	var results: Array = r.results
	var behind: bool = c.has("look")
	var expected: Array = [BEHIND_BACK] if behind else []
	if results.size() != 1 or results[0].get("feats", []) != expected:
		f.append("on ending the feats %s are reported and %s were due" % [results, expected])
	if salon != null and (salon.results.size() != 1 or salon.results[0].get("feats", []) != expected):
		f.append("the hall receives %s and the feats %s were due" % [salon.results, expected])
	if behind:
		for failure in f:
			failures.append("%s: %s" % [c.name, failure])
		print("XR-CONTROLLER case «%s»: %d of %d, feats %s%s" % [c.name, r.score, r.sticks, expected, "" if f.is_empty() else " — FAIL"])
		return
	# With both hands, each one those on its side, and each catch vibrates in its own.
	var per_hand: Dictionary = xr.catchesPerHand
	if int(per_hand.left) < 1 or int(per_hand.right) < 1 or int(per_hand.left) + int(per_hand.right) != int(r.score):
		f.append("%s have been caught with each hand, out of %d" % [per_hand, r.score])
	var pulses: Array = xr.vibrations
	for hand in ["left", "right"]:
		var its_own := pulses.filter(func(p): return p.hand == hand)
		if its_own.size() != int(per_hand[hand]) or its_own.any(func(p): return not matches(p, GRAB)):
			f.append("the %s hand has vibrated %s for %d catches" % [hand, its_own, per_hand[hand]])

	var rise: float = (c.eyes - REFERENCE) if seated else 0.0
	if not near(float(xr.rise), rise):
		f.append("the world has risen %.3f and had to rise %.3f" % [xr.rise, rise])
	var hoop: float = DESKTOP_HOOP if seated else c.eyes + ABOVE_THE_EYES
	if not near(float(xr.hoop), hoop, 0.03):
		f.append("the hoop is at %.3f and %.3f was due" % [xr.hoop, hoop])
	var placement: Dictionary = xr.placement
	if c.anchor != null:
		if not (near(placement.x, c.anchor.position.x) and near(placement.z, c.anchor.position.z) and near(placement.yaw, c.anchor.yaw)):
			f.append("planted at %s and the hall lent %s" % [placement, c.anchor])
	elif not (near(placement.x, 0.0) and near(placement.z, 0.0) and near(placement.yaw, 0.0)):
		f.append("without a hall it had to be planted at the feet and facing forward: %s" % placement)
	var turn: float = TURN_STEP if c.turns else 0.0
	if not near(float(xr.turn), turn):
		f.append("turned %.3f and %.3f was due" % [xr.turn, turn])

	for step in ["grab", "around"]:
		if not step in xr.tutorial:
			f.append("the tutorial has not taught %s (%s)" % [step, xr.tutorial])
	if xr.handsWithController != ["left", "right"]:
		f.append("the real controller has come up in %s and was due in both hands" % [xr.handsWithController])
	for hint in ["ground", "stick", "controller"]:
		if not hint in xr.hints:
			f.append("the hint %s has not been seen (%s)" % [hint, xr.hints])

	for failure in f:
		failures.append("%s: %s" % [c.name, failure])
	print("XR-CONTROLLER case «%s»: %d of %d, hands %s, %d pulses, rise %.3f, hoop %.3f, turn %.3f, %d µs on average playing%s" % [
		c.name, r.score, r.sticks, per_hand, pulses.size(), xr.rise, xr.hoop, xr.turn, r.usecPlayingAvg,
		"" if f.is_empty() else " — FAIL",
	])
