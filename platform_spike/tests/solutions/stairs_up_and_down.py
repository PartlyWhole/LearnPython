def turn_right():
    turn_left()
    turn_left()
    turn_left()


def right_is_clear():
    turn_right()
    clear = front_is_clear()
    turn_left()
    return clear


def step_up():
    turn_left()
    move()
    turn_right()
    move()


def step_down():
    turn_right()
    move()
    turn_left()


while front_is_clear():          # walk to the foot of the stairs
    move()
while not front_is_clear():      # climb while a step blocks the way
    step_up()
    pick()
while front_is_clear():          # cross the top and go down to the far wall
    move()
    if right_is_clear():
        step_down()
    pick()
