def collect():
    while gems_here():
        pick()


collect()
while front_is_clear():
    move()
    collect()
