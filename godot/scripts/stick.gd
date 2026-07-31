class_name Stick
extends StaticBody3D
## Un palo de la máquina: cuelga de su anclaje, arranca a caer tras su retardo
## escalonado y el jugador lo atrapa con clic mientras cuelga o cae (igual que
## en el web: src/components/game/Stick.tsx). Si toca el suelo, se pierde.

signal caught
## Resuelto (atrapado o perdido): el juego cierra la partida cuando todos resuelven.
signal resolved

enum State { HANGING, FALLING, CAUGHT, MISSED }

var state: State = State.HANGING
var speed := 1.0
var delay := 0.0

var _elapsed := 0.0
var _mesh: MeshInstance3D
var _material: StandardMaterial3D


## Construye el palo colgando de `anchor` (su extremo superior toca el anclaje).
func setup(anchor: Vector3, color: Color, fall_speed: float, fall_delay: float) -> void:
	speed = fall_speed
	delay = fall_delay
	position = anchor - Vector3(0.0, GameConfig.STICK_LENGTH / 2.0, 0.0)

	_material = StandardMaterial3D.new()
	_material.albedo_color = color
	_material.emission_enabled = true
	_material.emission = color
	_material.emission_energy_multiplier = 0.0

	var cylinder := CylinderMesh.new()
	cylinder.height = GameConfig.STICK_LENGTH
	cylinder.top_radius = 0.06
	cylinder.bottom_radius = 0.06
	cylinder.material = _material

	_mesh = MeshInstance3D.new()
	_mesh.mesh = cylinder
	add_child(_mesh)

	# Colisión algo más gruesa que el mesh para que sea fácil de clicar.
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.height = GameConfig.STICK_LENGTH
	capsule.radius = 0.16
	shape.shape = capsule
	add_child(shape)

	input_ray_pickable = true


func _process(delta: float) -> void:
	# Delta acotado, como en el web: evita saltos al volver de segundo plano.
	var dt: float = minf(delta, 0.05)
	_elapsed += dt

	# Flash de captura: la emisión decae y el palo desaparece al apagarse.
	if state == State.CAUGHT:
		var energy: float = maxf(0.0, _material.emission_energy_multiplier - dt * 2.5)
		_material.emission_energy_multiplier = energy
		_mesh.scale = Vector3.ONE * (1.0 + energy * 0.3)
		if energy == 0.0:
			visible = false
			set_process(false)
		return

	if state == State.MISSED:
		return

	# HANGING → FALLING al agotar el retardo escalonado.
	if state == State.HANGING and _elapsed >= delay:
		state = State.FALLING

	if state == State.FALLING:
		position.y -= speed * dt
		# Perdido al llegar al suelo (misma cota que el web: GROUND_Y).
		if position.y - GameConfig.STICK_LENGTH / 2.0 <= GameConfig.GROUND_Y:
			state = State.MISSED
			visible = false
			set_process(false)
			resolved.emit()


func _input_event(_camera: Camera3D, event: InputEvent, _pos: Vector3, _normal: Vector3, _shape: int) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		try_catch()


## Intenta atrapar el palo (clic o, en el futuro, mando). Válido colgando o cayendo.
func try_catch() -> void:
	if state != State.HANGING and state != State.FALLING:
		return
	state = State.CAUGHT
	_material.emission_energy_multiplier = 2.0
	caught.emit()
	resolved.emit()
