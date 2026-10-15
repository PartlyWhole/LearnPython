def turn_right():
    turn_left()
    turn_left()
    turn_left()


def turn_around():
    turn_left()
    turn_left()


def go_to_gem():
    move()
    turn_right()
    move()
    turn_left()
    move()
    move()


def come_home():
    turn_around()
    move()
    move()
    turn_right()
    move()
    turn_left()
    move()


go_to_gem()
pick()
come_home()
