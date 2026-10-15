def turn_around():
    turn_left()
    turn_left()


for row in range(4):
    for i in range(row + 1):
        put()
        move()
    turn_around()
    for i in range(4):
        move()
    turn_left()
    move()
    turn_left()
