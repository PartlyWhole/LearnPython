def turn_around():
    turn_left()
    turn_left()


def turn_right():
    turn_left()
    turn_left()
    turn_left()


def fill_square():
    for row in range(2):
        for i in range(2):
            put()
            move()
        turn_around()
        move()
        move()
        turn_left()
        move()
        turn_left()


def next_square():
    for i in range(3):
        move()


for square in range(4):
    fill_square()
    next_square()
