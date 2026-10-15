def turn_around():
    turn_left()
    turn_left()


def move_to_wall():
    while front_is_clear():
        move()


def harvest_icicle():
    """Start: on the floor, facing east. End: same cell, facing east."""
    turn_left()
    while gems_here():
        pick()
        move()
    turn_around()
    move_to_wall()
    turn_left()


def harvest_cave():
    """Start: west end of the floor, facing east. End: east end, facing east."""
    while front_is_clear():
        harvest_icicle()
        move()
    harvest_icicle()


def return_home():
    """Start: east end, facing east. End: west end, facing east."""
    turn_around()
    move_to_wall()
    turn_around()


harvest_cave()
return_home()
