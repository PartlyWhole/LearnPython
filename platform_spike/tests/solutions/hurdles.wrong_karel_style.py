def turn_right():
    turn_left()
    turn_left()
    turn_left()


def right_is_clear():
    turn_right()
    clear = front_is_clear()
    turn_left()
    return clear


def jump():
    turn_left()                   # face north
    while not right_is_clear():   # climb until the cell to the east is free
        move()
    turn_right()                  # face east
    move()
    turn_right()                  # face south
    while front_is_clear():       # go back down to the track
        move()
    turn_left()                   # face east again


while gems_here() == 0:
    if front_is_clear():
        move()
    else:
        jump()
pick()
