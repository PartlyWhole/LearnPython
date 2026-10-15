def turn_around():
    turn_left()
    turn_left()


def build_post():
    # Start: at the foot of a post, facing east. End: same cell, facing east.
    put()
    turn_left()
    move()
    put()
    move()
    put()
    turn_around()
    move()
    move()
    turn_left()


def next_post():
    # Start: at the foot of a post, facing east. End: at the foot of the next one.
    move()
    move()
    move()


for i in range(3):
    build_post()
    next_post()
