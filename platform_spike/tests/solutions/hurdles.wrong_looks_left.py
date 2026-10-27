def turn_right():
    turn_left()
    turn_left()
    turn_left()


def right_is_clear():
    turn_left()
    clear = front_is_clear()
    turn_right()
    return clear


def jump():
    turn_left()
    while not right_is_clear():
        move()
    turn_right()
    move()
    while not right_is_clear():
        move()
    turn_right()
    while front_is_clear():
        move()
    turn_left()


while gems_here() == 0:
    if front_is_clear():
        move()
    else:
        jump()
pick()
