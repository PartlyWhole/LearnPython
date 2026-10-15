def turn_around():
    turn_left()
    turn_left()


for row in range(4):
    for i in range(row):
        put()
        move()
    turn_around()
    for i in range(row):
        move()
    turn_left()
    move()
    turn_left()
