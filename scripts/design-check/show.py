import json, sys

rows = {r["name"]: r for r in json.load(open(sys.argv[1]))}
filt = sys.argv[2] if len(sys.argv) > 2 else ""
names = [n for n in rows if filt.lower() in n.lower()]
print(f"{'layer':<32}{'live x,y,w,h':<26}{'design x,y,w,h':<26}{'delta x,y,w,h'}")
for n in names:
    r = rows[n]
    if "live" not in r:
        print(f"{n:<32}{r.get('issue')}")
        continue
    l, d = r["live"], r["design"]
    print(
        f"{n:<32}"
        f"{l['x']:>8.1f},{l['y']:>8.1f},{l['w']:>7.1f},{l['h']:>6.1f}   "
        f"{d['x']:>8.1f},{d['y']:>8.1f},{d['w']:>7.1f},{d['h']:>6.1f}   "
        f"{r['dx']:>7.1f},{r['dy']:>7.1f},{r['dw']:>7.1f},{r['dh']:>6.1f}"
        + ("  " + r["style"] if r.get("style") else "")
    )
