def level_pile():
    while gems_here() < 2:
        put()
    while gems_here() > 2:
        pick()


level_pile()
while front_is_clear():
    move()
    level_pile()
