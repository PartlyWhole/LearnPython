def turn_around():
    turn_left()
    turn_left()


def fill_row():
    # Moves before putting: every row lands one cell too far right.
    for i in range(5):
        move()
        put()


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
