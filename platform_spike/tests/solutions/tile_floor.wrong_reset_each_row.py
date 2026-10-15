def turn_right():
    turn_left()
    turn_left()
    turn_left()


def face_next_row(going_east):
    if going_east:
        turn_right()
    else:
        turn_left()


place = True  # does the cell I'm standing on get a gem?
going_east = True
while True:
    if place:
        put()
    if front_is_clear():
        move()
        place = not place
    else:
        face_next_row(going_east)
        if not front_is_clear():
            break
        move()
        place = True
        face_next_row(going_east)
        going_east = not going_east
