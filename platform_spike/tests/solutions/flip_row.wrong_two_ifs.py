for i in range(7):
    move()
    if gems_here():
        pick()
    if not gems_here():
        put()
