ahead = scan()
spot = ahead.index(max(ahead))
for _ in range(spot):
    move()
for _ in range(gems_here()):
    pick()
