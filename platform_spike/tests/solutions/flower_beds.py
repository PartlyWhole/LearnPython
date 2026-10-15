def turn_right():
    turn_left()
    turn_left()
    turn_left()


def plant_bed():
    # Start: the bed's west corner, facing east.
    # End: where the next bed starts, facing east.
    put()
    turn_left()
    move()
    turn_right()
    move()
    put()
    move()
    turn_right()
    move()
    put()
    turn_left()
    move()
    move()
    move()


for i in range(3):
    plant_bed()
