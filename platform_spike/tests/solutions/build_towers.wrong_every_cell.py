def turn_right():
    turn_left()
    turn_left()
    turn_left()


def turn_around():
    turn_left()
    turn_left()


def build_tower():
    """Start: on a site, facing east. End: same cell, facing east."""
    turn_left()
    move()
    put()
    move()
    put()
    turn_around()
    move()
    move()
    turn_left()


def visit():
    build_tower()


visit()
while front_is_clear():
    move()
    visit()
