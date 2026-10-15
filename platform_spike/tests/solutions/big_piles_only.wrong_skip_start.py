def take_big_pile():
    if gems_here() > 2:
        while gems_here() > 0:
            pick()


while front_is_clear():
    move()
    take_big_pile()
