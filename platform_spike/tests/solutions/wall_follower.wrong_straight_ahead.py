def turn_right():
    turn_left()
    turn_left()
    turn_left()


def right_is_clear():
    turn_right()
    clear = front_is_clear()
    turn_left()
    return clear


def step_along_wall():
    while not front_is_clear():   # the wall rises ahead: turn to climb it
        turn_left()
    move()


while gems_here():
    pick()
    step_along_wall()
