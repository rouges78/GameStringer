"""Quick scan of installed Steam games to estimate translation difficulty."""
import os, re

STEAM_PATHS = [
    r"C:\Program Files (x86)\Steam\steamapps",
    r"D:\SteamLibrary\steamapps",
    r"E:\SteamLibrary\steamapps",
]

games = []
for sp in STEAM_PATHS:
    if not os.path.isdir(sp):
        continue
    for f in os.listdir(sp):
        if f.startswith("appmanifest_") and f.endswith(".acf"):
            try:
                with open(os.path.join(sp, f), "r", encoding="utf-8", errors="ignore") as fh:
                    acf = fh.read()
                name = re.search(r'"name"\s+"([^"]+)"', acf)
                appid = re.search(r'"appid"\s+"(\d+)"', acf)
                installdir = re.search(r'"installdir"\s+"([^"]+)"', acf)
                if name and appid and installdir:
                    ipath = os.path.join(sp, "common", installdir.group(1))
                    if os.path.isdir(ipath):
                        games.append((name.group(1), appid.group(1), ipath))
            except:
                pass

print(f"Giochi installati trovati: {len(games)}")
print()

results = []
for name, appid, path in games:
    engine = "?"
    has_ita = False
    try:
        root_files = os.listdir(path)
        root_lower = [f.lower() for f in root_files]
        all_str = " ".join(root_lower)

        if "unityplayer.dll" in root_lower:
            engine = "Unity"
        elif any(f.endswith(".pak") for f in root_lower):
            engine = "Unreal"
        elif "renpy" in all_str:
            engine = "RenPy"
        elif "data.win" in root_lower:
            engine = "GameMaker"
        elif "godot" in all_str:
            engine = "Godot"
        elif any("rpg" in f and "rt" in f for f in root_lower):
            engine = "RPGMaker"
        elif any("xna" in f or "monogame" in f for f in root_lower):
            engine = "XNA/Mono"

        # Quick ITA check
        for f in root_files:
            fl = f.lower()
            if "italian" in fl or "italiano" in fl or fl == "it":
                has_ita = True
                break
            subp = os.path.join(path, f)
            if os.path.isdir(subp) and f.lower() in (
                "localization", "localisation", "languages", "lang", "i18n", "locale",
            ):
                try:
                    sublower = " ".join(os.listdir(subp)).lower()
                    if "ital" in sublower or "_it" in sublower or "it." in sublower:
                        has_ita = True
                except:
                    pass
                break
    except:
        pass

    # Difficulty score
    score = 0
    reasons = []
    if engine == "?":
        score += 30
        reasons.append("motore sconosciuto")
    elif engine == "Unreal":
        score += 25
        reasons.append("Unreal (.pak)")
    elif engine == "Unity":
        score += 5
        reasons.append("Unity")
    elif engine == "RenPy":
        score -= 5
        reasons.append("RenPy (facile)")
    elif engine == "RPGMaker":
        score -= 5
        reasons.append("RPGMaker (facile)")
    elif engine == "GameMaker":
        score += 10
        reasons.append("GameMaker")
    elif engine == "Godot":
        score += 5
        reasons.append("Godot")

    if not has_ita:
        score += 20
        reasons.append("no ITA")
    else:
        score -= 15
        reasons.append("ha ITA")

    results.append((score, name, engine, has_ita, reasons))

results.sort(key=lambda x: -x[0])

print("=" * 75)
print("TOP 25 PIU DIFFICILI DA TRADURRE")
print("=" * 75)
for i, (sc, nm, eng, ita, reas) in enumerate(results[:25]):
    ita_s = "SI" if ita else "NO"
    print(f"{i+1:2d}. [{sc:3d}] {nm[:42]:42s} {eng:10s} ITA:{ita_s}  ({', '.join(reas)})")

print()
print("=" * 75)
print("TOP 10 PIU FACILI (buoni per iniziare)")
print("=" * 75)
easy = sorted(results, key=lambda x: x[0])
for i, (sc, nm, eng, ita, reas) in enumerate(easy[:10]):
    ita_s = "SI" if ita else "NO"
    print(f"{i+1:2d}. [{sc:3d}] {nm[:42]:42s} {eng:10s} ITA:{ita_s}")

print()
eng_count = {}
for _, _, eng, _, _ in results:
    eng_count[eng] = eng_count.get(eng, 0) + 1
print("MOTORI:")
for e, c in sorted(eng_count.items(), key=lambda x: -x[1]):
    print(f"  {e}: {c}")

no_ita = sum(1 for _, _, _, ita, _ in results if not ita)
print(f"\nSenza italiano: {no_ita}/{len(results)}")
print(f"Con italiano:   {len(results)-no_ita}/{len(results)}")
