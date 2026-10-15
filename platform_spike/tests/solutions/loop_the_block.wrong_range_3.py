def turn_right():
    turn_left()
    turn_left()
    turn_left()


def go_around_corner():
    move()
    move()
    move()
    pick()
    turn_right()
    move()


for i in range(3):
    go_around_corner()
