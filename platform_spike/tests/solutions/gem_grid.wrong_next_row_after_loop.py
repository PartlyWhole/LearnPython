def turn_around():
    turn_left()
    turn_left()


def fill_row():
    for i in range(5):
        put()
        move()


def next_row():
    turn_around()
    for i in range(5):
        move()
    turn_left()
    move()
    turn_left()


for row in range(3):
    fill_row()
next_row()
