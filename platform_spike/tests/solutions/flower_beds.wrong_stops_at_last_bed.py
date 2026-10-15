def turn_right():
    turn_left()
    turn_left()
    turn_left()


def plant_bed():
    # Start: the bed's west corner, facing east.
    # End: the bed's east corner, facing east.
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


plant_bed()
for i in range(2):
    move()
    move()
    move()
    plant_bed()
