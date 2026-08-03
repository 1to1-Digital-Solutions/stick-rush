extends Node3D
## Escena principal de Stick Rush (port Godot del juego web, MVP desktop para Steam).
## Construye TODO por código (cámara, luces, suelo, máquina, UI) para que el proyecto
## sea revisable sin abrir el editor; el flujo replica el web: menú (nº de palos 5-13 +
## dificultad) → partida (palos que caen escalonados, clic para atrapar) → resultado.

enum GameState { MENU, PLAYING, FINISHED }

var state: GameState = GameState.MENU
var stick_count := GameConfig.MIN_STICKS
var difficulty := "easy"
var score := 0
var _resolved := 0

var _sticks_root: Node3D
var _menu: Control
var _hud: Control
var _finished: Control
var _hud_label: Label
var _finished_label: Label
var _count_label: Label
var _difficulty_option: OptionButton


func _ready() -> void:
	_build_world()
	_build_machine()
	_sticks_root = Node3D.new()
	_sticks_root.name = "Sticks"
	add_child(_sticks_root)
	_build_ui()
	_show_menu()


# ————————————————————— Mundo y máquina —————————————————————

func _build_world() -> void:
	var camera := Camera3D.new()
	camera.position = Vector3(0.0, 2.0, 8.0)  # misma cámara que el web ([0,2,8], fov 60)
	camera.fov = 60.0
	camera.current = true
	add_child(camera)

	var sun := DirectionalLight3D.new()
	sun.position = Vector3(4.0, 8.0, 6.0)
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	add_child(sun)
	sun.look_at(Vector3.ZERO)  # tras add_child: look_at necesita estar en el árbol

	var fill := OmniLight3D.new()
	fill.position = Vector3(0.0, GameConfig.MACHINE_HEIGHT + 3.0, 2.0)
	fill.light_energy = 0.7
	fill.omni_range = 25.0
	add_child(fill)

	var ground_mesh := PlaneMesh.new()
	ground_mesh.size = Vector2(40.0, 40.0)
	var ground_mat := StandardMaterial3D.new()
	ground_mat.albedo_color = Color("#1e293b")
	ground_mesh.material = ground_mat
	var ground := MeshInstance3D.new()
	ground.mesh = ground_mesh
	ground.position = Vector3(0.0, GameConfig.GROUND_Y, 0.0)
	add_child(ground)

	var env := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#0f172a")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#334155")
	environment.ambient_light_energy = 0.6
	env.environment = environment
	add_child(env)


## Arco de la máquina: la curva del web (arc_point) aproximada con segmentos de
## cilindro + los dos soportes verticales (TubeGeometry no existe en Godot).
func _build_machine() -> void:
	var machine := Node3D.new()
	machine.name = "Machine"
	add_child(machine)

	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color("#cbd5e1")
	metal.metallic = 0.8
	metal.roughness = 0.2

	var segments := 32
	for i in range(segments):
		var a := GameConfig.arc_point(float(i) / segments)
		var b := GameConfig.arc_point(float(i + 1) / segments)
		machine.add_child(_segment(a, b, 0.12, metal))

	var support_mat := StandardMaterial3D.new()
	support_mat.albedo_color = Color("#94a3b8")
	support_mat.metallic = 0.8
	support_mat.roughness = 0.25
	# Los soportes van del suelo (GROUND_Y) al arranque del arco, no de y=0.
	var post_height: float = GameConfig.MACHINE_HEIGHT - GameConfig.GROUND_Y
	for x in [-GameConfig.MACHINE_RADIUS, GameConfig.MACHINE_RADIUS]:
		var post_mesh := CylinderMesh.new()
		post_mesh.height = post_height
		post_mesh.top_radius = 0.1
		post_mesh.bottom_radius = 0.12
		post_mesh.material = support_mat
		var post := MeshInstance3D.new()
		post.mesh = post_mesh
		post.position = Vector3(x, (GameConfig.MACHINE_HEIGHT + GameConfig.GROUND_Y) / 2.0, 0.0)
		machine.add_child(post)


## Cilindro orientado del punto `a` al `b` (tramo del arco).
func _segment(a: Vector3, b: Vector3, radius: float, material: StandardMaterial3D) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.height = a.distance_to(b) * 1.05  # ligero solape para que no se vean juntas
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.material = material
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = (a + b) / 2.0
	var direction := (b - a).normalized()
	# El eje del cilindro es Y: rotación que lleva UP a la dirección del tramo.
	instance.basis = Basis(Quaternion(Vector3.UP, direction))
	return instance


# ————————————————————— Partida —————————————————————

func _start_game() -> void:
	score = 0
	_resolved = 0
	state = GameState.PLAYING
	for child in _sticks_root.get_children():
		child.queue_free()

	var speed: float = GameConfig.DIFFICULTY_SPEEDS[difficulty]
	for i in range(stick_count):
		# Reparto por el arco evitando los extremos exactos, como el web.
		var t := (i + 1.0) / (stick_count + 1.0)
		var stick := Stick.new()
		_sticks_root.add_child(stick)
		# Caída escalonada: cada palo arranca ~1s después del anterior, con jitter.
		var delay := i * (1.0 + randf() * 0.5)
		stick.setup(GameConfig.arc_point(t), GameConfig.stick_color(i), speed, delay)
		stick.caught.connect(_on_stick_caught)
		stick.resolved.connect(_on_stick_resolved)

	_menu.visible = false
	_finished.visible = false
	_hud.visible = true
	_update_hud()


func _on_stick_caught() -> void:
	score += 1
	_update_hud()


func _on_stick_resolved() -> void:
	_resolved += 1
	_update_hud()
	if _resolved >= stick_count:
		_finish_game()


func _finish_game() -> void:
	state = GameState.FINISHED
	_hud.visible = false
	if score == stick_count:
		_finished_label.text = "¡Perfecto! %d/%d palos" % [score, stick_count]
	else:
		_finished_label.text = "Atrapados %d de %d" % [score, stick_count]
	_finished.visible = true


func _show_menu() -> void:
	state = GameState.MENU
	for child in _sticks_root.get_children():
		child.queue_free()
	_hud.visible = false
	_finished.visible = false
	_menu.visible = true


func _update_hud() -> void:
	_hud_label.text = "Atrapados: %d / %d" % [score, stick_count]


# ————————————————————— UI —————————————————————

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	# — Menú —
	_menu = _panel_centrado(layer)
	var menu_box := _menu.get_node("Center/Box") as VBoxContainer

	var title := Label.new()
	title.text = "STICK RUSH"
	title.add_theme_font_size_override("font_size", 42)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	menu_box.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Atrapa los palos antes de que toquen el suelo"
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	menu_box.add_child(subtitle)

	_count_label = Label.new()
	_count_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	menu_box.add_child(_count_label)

	var slider := HSlider.new()
	slider.min_value = GameConfig.MIN_STICKS
	slider.max_value = GameConfig.MAX_STICKS
	slider.step = 1
	slider.value = stick_count
	slider.custom_minimum_size = Vector2(260, 0)
	slider.value_changed.connect(_on_count_changed)
	menu_box.add_child(slider)
	_on_count_changed(slider.value)

	var difficulty_title := Label.new()
	difficulty_title.text = "Dificultad"
	difficulty_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	menu_box.add_child(difficulty_title)

	_difficulty_option = OptionButton.new()
	for key in GameConfig.DIFFICULTY_ORDER:
		_difficulty_option.add_item(GameConfig.DIFFICULTY_LABELS[key])
	_difficulty_option.selected = 0
	_difficulty_option.item_selected.connect(_on_difficulty_selected)
	menu_box.add_child(_difficulty_option)

	var play := Button.new()
	play.text = "Jugar"
	play.custom_minimum_size = Vector2(200, 44)
	play.pressed.connect(_start_game)
	menu_box.add_child(play)

	# — HUD —
	_hud = Control.new()
	_hud.set_anchors_preset(Control.PRESET_TOP_LEFT)
	layer.add_child(_hud)
	_hud_label = Label.new()
	_hud_label.position = Vector2(24, 16)
	_hud_label.add_theme_font_size_override("font_size", 26)
	_hud.add_child(_hud_label)

	# — Fin de partida —
	_finished = _panel_centrado(layer)
	var end_box := _finished.get_node("Center/Box") as VBoxContainer
	_finished_label = Label.new()
	_finished_label.add_theme_font_size_override("font_size", 32)
	_finished_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	end_box.add_child(_finished_label)
	var again := Button.new()
	again.text = "Jugar otra vez"
	again.custom_minimum_size = Vector2(200, 44)
	again.pressed.connect(_start_game)
	end_box.add_child(again)
	var to_menu := Button.new()
	to_menu.text = "Menú"
	to_menu.pressed.connect(_show_menu)
	end_box.add_child(to_menu)


## Control a pantalla completa con un VBox centrado accesible en "Center/Box".
func _panel_centrado(layer: CanvasLayer) -> Control:
	var control := Control.new()
	control.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(control)
	var center := CenterContainer.new()
	center.name = "Center"
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	control.add_child(center)
	var box := VBoxContainer.new()
	box.name = "Box"
	box.add_theme_constant_override("separation", 14)
	center.add_child(box)
	return control


func _on_count_changed(value: float) -> void:
	stick_count = int(value)
	_count_label.text = "Palos: %d" % stick_count


func _on_difficulty_selected(index: int) -> void:
	difficulty = GameConfig.DIFFICULTY_ORDER[index]
