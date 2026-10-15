def take_big_pile():
    while gems_here() > 2:
        pick()


take_big_pile()
while front_is_clear():
    move()
    take_big_pile()
