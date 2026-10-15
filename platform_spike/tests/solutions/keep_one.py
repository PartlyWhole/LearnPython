def trim():
    while gems_here() > 1:
        pick()


trim()
while front_is_clear():
    move()
    trim()
