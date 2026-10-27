ahead = scan()
steps = max(ahead)          # the biggest count, not where it is
for _ in range(steps):
    move()
for _ in range(gems_here()):
    pick()
