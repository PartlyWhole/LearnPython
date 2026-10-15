def turn_right():
    turn_left()
    turn_left()
    turn_left()


def go_around_corner():
    move()
    move()
    pick()
    turn_right()
    move()


go_around_corner()
go_around_corner()
go_around_corner()
go_around_corner()
