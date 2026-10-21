"""Test programs and worlds shared by the CPython and Pyodide runs."""

WORLD = {"width": 6, "height": 4, "start": [0, 0, "E"], "bag": 3,
         "blocked": [[3, 1]], "gems": {"2,0": 2, "5,0": 1}, "max_steps": 10_000}

CASES = {
    "collect_row": """\
while front_is_clear():
    move()
    while gems_here() > 0:
        pick()
""",
    "wall_error": """\
turn_left()
turn_left()
turn_left()
move()
move()
move()
move()
""",
    "runaway_api_loop": """\
while True:
    turn_left()
""",
    "seeded_random": """\
heads = 0
for _ in range(50):
    if coin_flip():
        heads += 1
print(heads)
""",
    "build_with_put": """\
for _ in range(3):
    put()
    move()
put()
""",
    "scan_list": """\
ahead = scan()
total = sum(ahead)
for _ in range(len(ahead)):
    move()
""",
    "nested_calls": """\
def turn_right():
    for _ in range(3):
        turn_left()

def step_and_turn():
    move()
    turn_right()

step_and_turn()
turn_left()
step_and_turn()
""",
}

# Cases that must NOT run inside the shared harness (handled specially by the browser test).
PURE_PYTHON_INFINITE_LOOP = "x = 0\nwhile True:\n    x += 1\n"
