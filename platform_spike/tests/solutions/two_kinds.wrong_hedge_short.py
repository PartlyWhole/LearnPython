def turn_around():
    turn_left()
    turn_left()


def plant_tree():
    # Start: at the tree's cell, facing east. End: where the hedge starts, facing east.
    put()
    turn_left()
    move()
    put()
    turn_around()
    move()
    turn_left()
    move()
    move()


def plant_hedge():
    # Start: the hedge's west cell, facing east. End: where the next tree goes, facing east.
    put()
    move()
    put()
    move()


for i in range(3):
    plant_tree()
    plant_hedge()
