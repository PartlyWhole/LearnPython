def turn_around():
    turn_left()
    turn_left()


# The rows shrink instead of growing: 4, 3, 2, 1.
for row in range(4):
    for i in range(4 - row):
        put()
        move()
    turn_around()
    for i in range(4 - row):
        move()
    turn_left()
    move()
    turn_left()
