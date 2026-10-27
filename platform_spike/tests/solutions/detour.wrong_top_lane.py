def turn_right():
    turn_left()
    turn_left()
    turn_left()


# Skips the detour: walks the whole top lane (blocked cells up there stop it).
turn_left()
move()
turn_right()
for i in range(8):
    if front_is_clear():
        move()
turn_right()
move()
turn_left()
