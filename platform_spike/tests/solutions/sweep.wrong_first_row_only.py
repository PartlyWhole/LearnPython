def turn_right():
    turn_left()
    turn_left()
    turn_left()


def collect():
    while gems_here() > 0:
        pick()


def sweep_row():
    collect()
    while front_is_clear():
        move()
        collect()


sweep_row()
