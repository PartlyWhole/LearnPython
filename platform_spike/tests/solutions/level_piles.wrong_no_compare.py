def level():
    while gems_here():
        pick()
    put()
    put()


level()
while front_is_clear():
    move()
    level()
