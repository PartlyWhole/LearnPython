def turn_right():
    turn_left()
    turn_left()
    turn_left()


def turn_around():
    turn_left()
    turn_left()


def fill_gap():
    if gems_here() == 0:
        put()


def repair_column():
    """Start: at the foot of a column, facing east. End: same cell, facing east."""
    turn_left()
    fill_gap()
    while front_is_clear():
        move()
        fill_gap()
    turn_around()
    while front_is_clear():
        move()
    turn_left()


def next_column():
    for _ in range(4):
        move()


repair_column()
while front_is_clear():
    next_column()
    repair_column()
