ahead = scan()
spot = 0
for i in range(len(ahead)):
    if ahead[i] > 0 and spot == 0:
        spot = i
for _ in range(spot + 1):
    move()
for _ in range(gems_here()):
    pick()
