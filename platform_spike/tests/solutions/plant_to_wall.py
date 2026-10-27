def plant():
    while gems_here():
        pick()
    put()


while front_is_clear():
    plant()
    move()
plant()
