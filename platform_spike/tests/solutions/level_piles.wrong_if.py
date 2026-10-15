def level_pile():
    if gems_here() < 2:
        put()
    if gems_here() > 2:
        pick()


level_pile()
while front_is_clear():
    move()
    level_pile()
