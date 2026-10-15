def trim():
    while gems_here() > 0:
        pick()


trim()
while front_is_clear():
    move()
    trim()
