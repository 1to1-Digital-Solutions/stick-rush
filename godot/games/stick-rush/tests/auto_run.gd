## Whole automatic runs, to the end, counting what happens: that the round and the run of
## `src/lib` and the scene are stitched together (sticks caught and missed, points, streak and
## record), that what is due sounds and as many times as is due (the rule of `useGameSound.ts`),
## that the machine and the fairground are those of the web, and that on ending the result is
## reported to the hall. Without real audio: everything goes to a muted bus, which counts just the
## same.
##
## And the contract of the challenge: with a hall that lends a seed (`challenge_seed`), the game
## enters already playing the challenge mode with the sticks drawn from it, the same seed gives the
## same layout, and the run played is reported to the hall as a challenge.
##
## And that of the goal: with the hall's `goal` metadata the sign shows the medal thresholds
## (with no record yet, the bronze told in sticks and the gold); without it (the second entry into
## the challenge), only the mission.
##
## And **the two-player run** (`duel.ts`): the challenge with two players, the two rounds in a row
## by the automatic player, the second with the seed of the first; the second one lets one more
## stick get away, so the first one wins; it is recorded for the pair without touching the record,
## the hall is told once, and the end sounds like winning.
##
## It is launched with `--fixed-fps 72`, like the automatic player.
extends Node

const MAIN := "res://games/stick-rush/main.tscn"
const SALON := preload("res://games/stick-rush/tests/fake_salon.gd")
## The run of the automatic player (`BOT_RUN`): nine sticks, and one that it lets get away.
const STICKS := 9
## The music of the web (`MUSIC_VOLUME`) times the hall's in-run ambience (60 out of 100).
const MUSIC_VOLUME := 0.22 * 0.6
## The run lasts about fourteen seconds of play and the challenge about twenty-five: at two
## minutes, something has got stuck.
const MAX_FRAMES := 72 * 120
## Any seed for the challenge.
const SEED := 20260926
## How long the challenge is left running to look at its layout: the countdown and a bit more.
const CHALLENGE_FRAMES := 72 * 5
## The cabinet's goal just as the hall leaves it in its `goal` metadata (`xrcade.gd`).
const GOAL := {
	"medallas": {"bronce": 1900, "plata": 3750, "oro": 5200},
	"mejorEs": "mas", "unidad": "points in challenge", "record": null, "modo": "challenge",
}
## With no record in the hall, the first time: the bronze in sticks (`asCount`) and the gold.
const THRESHOLDS := "Bronze ≈ 13 sticks · Gold 5,200"

var game: Node
var salon: Node
var frames := 0
var failures: Array[String] = []
var stage := "run"
var layouts: Array[String] = []


func _ready() -> void:
	AudioServer.add_bus()
	var bus := AudioServer.bus_count - 1
	AudioServer.set_bus_name(bus, "Muted")
	AudioServer.set_bus_mute(bus, true)
	mount()


func mount(menu_meta := false, two_players := false) -> void:
	frames = 0
	game = (load(MAIN) as PackedScene).instantiate()
	game.set_meta("harness_menu" if menu_meta else "harness", true)
	if two_players:
		game.set_meta("two_players", true)
	game.set_meta("sfx_bus", "Muted")
	# What it checks is written in English: with no language asked for, the game speaks the system's.
	game.set_meta("lang", "en")
	add_child(game)


func _process(_delta: float) -> void:
	frames += 1
	match stage:
		"run":
			if game.has_meta("result"):
				check(JSON.parse_string(game.get_meta("result")))
				start_the_challenge()
			elif frames > MAX_FRAMES:
				failures.append("the run has not ended in %d frames (phase %s)" % [MAX_FRAMES, game.phase()])
				finish()
		"challenge", "challenge-again":
			if frames == 10:
				check_the_entry()
				check_the_sign(stage == "challenge")
			elif frames >= CHALLENGE_FRAMES:
				layouts.append(game.round_layout())
				game.queue_free()
				if stage == "challenge":
					# Again, from scratch, with the same seed: the same layout has to come out.
					# And now with no goal: a hall that gives the game no medals.
					salon.remove_meta("goal")
					stage = "challenge-again"
					mount(true)
				else:
					check_the_layouts()
					# And now played whole by the automatic player: it is reported to the hall as a challenge.
					stage = "challenge-played"
					mount()
		"challenge-played":
			if game.has_meta("result"):
				check_the_challenge(JSON.parse_string(game.get_meta("result")))
				game.queue_free()
				# With no hall to lend a seed: the two-player run is a normal run.
				get_tree().root.remove_child(salon)
				salon.free()
				salon = null
				stage = "two-players"
				mount(false, true)
			elif frames > MAX_FRAMES:
				failures.append("the challenge has not ended in %d frames (phase %s)" % [MAX_FRAMES, game.phase()])
				finish()
		"two-players":
			if game.has_meta("result"):
				check_two_players(JSON.parse_string(game.get_meta("result")))
				finish()
			elif frames > MAX_FRAMES * 2:
				failures.append("the two-player run has not ended in %d frames (phase %s)" % [MAX_FRAMES * 2, game.phase()])
				finish()


## Two equal counts: the JSON brings the numbers as decimals.
func equal(actual: Dictionary, expected: Dictionary) -> bool:
	if actual.size() != expected.size():
		return false
	for key in expected:
		if int(actual.get(key, -1)) != int(expected[key]):
			return false
	return true


func count(from: Dictionary, sound: String) -> int:
	return int(from.get(sound, 0))


func check(r: Dictionary) -> void:
	var requested: Dictionary = r.sfx.requested
	var played: Dictionary = r.sfx.played
	if r.outcome != "cleared":
		failures.append("the run ends «%s» and not «cleared»" % r.outcome)
	if int(r.sticks) != STICKS or int(r.resolved) != STICKS:
		failures.append("%d sticks resolved out of %d" % [r.resolved, r.sticks])
	if int(r.misses) != 1 or int(r.score) != STICKS - 1:
		failures.append("the automatic player had to catch all but one: %d caught, %d missed" % [r.score, r.misses])
	if int(r.bestStreak) < 2 or int(r.points) <= 0:
		failures.append("streak %d and %d points" % [r.bestStreak, r.points])
	# It is the first run saving apart: it is a record, and what is saved is what was achieved.
	if not r.record or int(r.best) != int(r.points):
		failures.append("record %s, saved %d, achieved %d" % [r.record, r.best, r.points])
	var states: Array = r.stickStates
	if states.count("caught") != STICKS - 1 or states.count("missed") != 1:
		failures.append("the sticks end %s" % [states])

	# The countdown sounds (3, 2, 1), the start, each catch on its note, the missed one and the close.
	for sound in ["countdown-3", "countdown-2", "countdown-1", "go", "miss", "over-close", "record"]:
		if count(requested, sound) != 1:
			failures.append("%s has sounded %d times" % [sound, count(requested, sound)])
	var catches := 0
	for n in range(1, 9):
		catches += count(requested, "catch-%d" % n)
	if catches != int(r.score):
		failures.append("%d catch notes for %d sticks" % [catches, r.score])
	if count(requested, "catch-1") < 1 or count(requested, "catch-2") < 1:
		failures.append("the note does not go up with the streak: %s" % [requested])
	for sound in r.variants:
		if int(r.variants[sound]) < 1:
			failures.append("%s has no file" % sound)
		if count(played, sound) != count(requested, sound):
			failures.append("%s: requested %d, played %d" % [sound, count(requested, sound), count(played, sound)])
	if not r.music.playing or absf(float(r.music.volume) - MUSIC_VOLUME) > 0.001:
		failures.append("the music is not playing at %.3f: %s" % [MUSIC_VOLUME, r.music])

	# The hall is told once, without being the challenge, with the same points.
	var results: Array = r.results
	if results.size() != 1 or results[0].mode != "practice" or results[0].challenge or int(results[0].points) != int(r.points):
		failures.append("the hall is told %s" % [results])
	# What is seen: the web's machine and the fairground with the pieces of the kit.
	if not equal(r.machine, {"matte": 24, "frame": 2, "truss": 43, "bulbs": 8}):
		failures.append("the machine is not the web's: %s" % [r.machine])
	var fairground: Dictionary = r.fairground
	if not equal(fairground.pieces, {"puesto": 6, "farol": 8, "banderola": 8}) or int(fairground.silhouettes) != 42 or int(fairground.cabins) != 12:
		failures.append("the fairground is not the web's: %s" % [fairground])
	print("AUTO-RUN %d of %d, streak %d, %d points, %d frames, %d µs on average playing (%d peak)" % [
		r.score, r.sticks, r.bestStreak, r.points, r.frames, r.usecPlayingAvg, r.usecPlayingMax,
	])


func start_the_challenge() -> void:
	game.queue_free()
	stage = "challenge"
	salon = SALON.new()
	salon.name = "XRcade"
	salon.set_meta("challenge_seed", SEED)
	salon.set_meta("goal", JSON.stringify(GOAL))
	get_tree().root.add_child(salon)
	# Without the automatic player: the challenge is entered already playing, without going through the menu, and here it is only watched.
	mount(true)


func check_the_entry() -> void:
	if game.run_mode() != "challenge":
		failures.append("with the hall's seed %s is played and not the challenge" % game.run_mode())
	if not game.in_challenge():
		failures.append("with the hall's seed the run is not the challenge")
	if game.phase() != "countdown":
		failures.append("with the hall's challenge it enters the countdown, not %s" % game.phase())
	if int(game.run_seed()) != SEED:
		failures.append("the seed is %d and the hall lent %d" % [game.run_seed(), SEED])


## With the hall's goal the sign shows the thresholds under the mission; without it, only the mission.
func check_the_sign(with_goal: bool) -> void:
	var lines: PackedStringArray = game.goal_sign().split("\n", false)
	if lines.is_empty():
		failures.append("in the countdown of the challenge there is no goal sign")
	elif with_goal and not lines.has(THRESHOLDS):
		failures.append("with the hall's goal the sign does not show the thresholds: %s" % [lines])
	elif not with_goal and lines.size() != 1:
		failures.append("without the hall's goal the sign says something more than the mission: %s" % [lines])


func check_the_layouts() -> void:
	if layouts.size() != 2 or layouts[0] == "" or layouts[0] != layouts[1]:
		failures.append("the same seed does not give the same layout: %s" % [layouts])


func check_the_challenge(r: Dictionary) -> void:
	var results: Array = salon.results
	if results.size() != 1 or results[0].mode != "challenge" or not results[0].challenge or int(results[0].points) != int(r.points):
		failures.append("the hall is told the challenge as %s" % [results])
	if r.outcome != "cleared" or int(r.sticks) != 13 or int(r.misses) != 1:
		failures.append("the challenge ends %s with %d sticks and %d missed" % [r.outcome, r.sticks, r.misses])
	if int(r.seed) != SEED:
		failures.append("the challenge has been played with the seed %d" % r.seed)
	print("AUTO-RUN challenge %d of %d, %d points, %d µs on average playing" % [r.score, r.sticks, r.points, r.usecPlayingAvg])


func check_two_players(r: Dictionary) -> void:
	var duel = r.duel
	if duel == null or duel.points[0] == null or duel.points[1] == null:
		failures.append("the two-player run has not ended: %s" % [duel])
		return
	var one := int(duel.points[0])
	var two := int(duel.points[1])
	if one <= two:
		failures.append("the second one lets one more stick get away and still scores %d against %d" % [two, one])
	var seeds: Array = r.seeds
	if seeds.size() != 2 or int(seeds[0]) != int(seeds[1]):
		failures.append("the two rounds do not start with the same seed: %s" % [seeds])
	var pair: Dictionary = r.pair
	if int(pair.wins[0]) != 1 or int(pair.wins[1]) != 0 or int(pair.ties) != 0:
		failures.append("the pair is credited %s" % [pair])
	if int(r.best) != 0 or r.record:
		failures.append("a two-player round has touched the record of the challenge: %d" % r.best)
	var results: Array = r.results
	if results.size() != 1 or results[0].mode != "duel" or results[0].challenge or int(results[0].points) != one:
		failures.append("the hall is told the two-player run as %s" % [results])
	var requested: Dictionary = r.sfx.requested
	if count(requested, "countdown-3") != 2 or count(requested, "go") != 2:
		failures.append("two rounds are two countdowns: %s" % [requested])
	if count(requested, "over-win") != 2 or count(requested, "record") != 1:
		failures.append("the end of the two-player run does not sound like winning once: %s" % [requested])
	print("AUTO-RUN two players %d against %d, pair %s" % [one, two, pair])


func finish() -> void:
	set_process(false)
	if salon != null:
		salon.queue_free()
	print("AUTO-RUN %s %s" % ["ok" if failures.is_empty() else "FAIL", ", ".join(failures)])
	get_tree().quit(0 if failures.is_empty() else 1)
