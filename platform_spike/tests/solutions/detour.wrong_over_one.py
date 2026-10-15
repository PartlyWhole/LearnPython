def turn_right():
    turn_left()
    turn_left()
    turn_left()


def go_around():
    """Pass the blocked cell ahead: up, over it, and back down, facing east."""
    turn_left()
    move()
    turn_right()
    move()
    turn_right()
    move()
    turn_left()


# 8 columns to cross: 6 single steps and one detour that crosses 2.
for i in range(7):
    if front_is_clear():
        move()
    else:
        go_around()
