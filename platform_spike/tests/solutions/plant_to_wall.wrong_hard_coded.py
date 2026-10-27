def plant():
    while gems_here():
        pick()
    put()


for i in range(6):
    plant()
    move()
plant()
