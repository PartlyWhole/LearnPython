def turn_right():
    turn_left()
    turn_left()
    turn_left()


def go_around():
    """Pass the blocked cell ahead: up, over it, and back down, facing east."""
    turn_left()
    move()
    turn_right()
    move()
    move()
    turn_right()
    move()
    turn_left()


for i in range(3):
    move()
go_around()
for i in range(3):
    move()
