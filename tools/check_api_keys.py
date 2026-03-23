import os
lines = open(r'C:\dev\GameStringer\.env.local', 'r').readlines()
for l in lines:
    l = l.strip()
    if 'KEY' in l.upper() and not l.startswith('#') and '=' in l:
        k = l.split('=')[0]
        v = l.split('=', 1)[1].strip()
        has = 'SET' if v and v not in ('""', "''", '') else 'EMPTY'
        print(f'{k}: {has}')
