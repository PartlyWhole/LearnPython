def take_big_pile():
    if gems_here() > 3:
        while gems_here() > 0:
            pick()


take_big_pile()
while front_is_clear():
    move()
    take_big_pile()
