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


def face_down(going_east):
    if going_east:
        turn_right()
    else:
        turn_left()


going_east = True
while True:
    sweep_row()
    face_down(going_east)
    if not front_is_clear():
        break
    move()
    turn_right()
