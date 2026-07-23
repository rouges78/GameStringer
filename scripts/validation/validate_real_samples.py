#!/usr/bin/env python3
"""
validate_real_samples.py — collaudo dei parser binari su FILE REALI.

Scansiona la cartella `.samples/` (gitignorata: mai committare file di gioco)
e valida contro file veri i formati che i parser Rust leggono oggi solo da
fixture sintetiche (vedi ADR-002 / ADR-003, "corpus di test reale"):

  1. global-metadata.dat  (Unity IL2CPP)
     - mirror di src-tauri/src/commands/il2cpp_metadata.rs (magic + version)
     - PASSO SUCCESSIVO ADR-003: estrazione best-effort degli STRING LITERAL
       (tabella `StringLiteral` + blob dati) — validata qui in Python PRIMA
       del port Rust, sulla stessa metodologia dei parser precedenti.

  2. *.utoc  (UE5 IoStore)
     - mirror di parse_utoc_header in src-tauri/src/commands/unreal_iostore.rs
       (magic, versione, contatori, flag, PerfectHash v4/v5)

  3. *.assets / resources.assets  (Unity SerializedFile)
     - controllo header (versione 16..22, endianness, dimensioni coerenti)
       come pre-verifica del percorso unity_serialized.rs

  4. data.win  (GameMaker)
     - mirror di parse_chunks/extract_strings in gamemaker_patcher.rs
     - CENSIMENTO PUNTATORI per il rebuilder (roadmap "GameMaker da parziale
       a pieno"): conta i siti u32 nel file che puntano ai dati stringa e
       stima i falsi positivi → dato necessario per decidere se la
       rilocazione generica dei puntatori è sicura (design del rebuilder).

  5. *.pak  (Unreal classico — ADR-001 prerequisito 1)
     - parse del footer (magic 0x5A6F12E1, v1..v11) e dell'INDICE:
       classico v1-v9 e PathHash/FullDirectoryIndex v10/v11 (che il reader
       Rust unreal_localization.rs oggi rifiuta)
     - SCOPERTA CANDIDATI FONT (bersaglio dell'opzione B dell'ADR-001):
       elenca le entry .ufont / Font / FontFace con path completo.

Uso:
    python3 scripts/validation/validate_real_samples.py [cartella]
    (default: .samples/ nella root del repo)

Output onesto: per ogni file PASS/WARN/FAIL con i numeri letti, mai un
"plausibile ma sbagliato" — se una struttura non torna, lo dice.
"""
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAMPLES = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.samples')

IL2CPP_MAGIC = 0xFAB11BAF
MAX_SUPPORTED_METADATA_VERSION = 29  # mirror il2cpp_metadata.rs
UTOC_MAGIC = b'-==--==--==--==-'
UTOC_MAX_KNOWN_VERSION = 5           # mirror unreal_iostore.rs (UE 5.3)

ok = warn = fail = 0


def report(status, path, msg):
    global ok, warn, fail
    icon = {'PASS': '✅', 'WARN': '⚠️ ', 'FAIL': '❌'}[status]
    if status == 'PASS':
        ok += 1
    elif status == 'WARN':
        warn += 1
    else:
        fail += 1
    print(f'{icon} [{status}] {os.path.relpath(path, SAMPLES)}: {msg}')


# ─── 1. global-metadata.dat ────────────────────────────────────────────────

def check_global_metadata(path):
    data = open(path, 'rb').read()
    if len(data) < 8:
        return report('FAIL', path, 'file troppo corto per l\'header')
    magic, version = struct.unpack_from('<Ii', data, 0)
    if magic != IL2CPP_MAGIC:
        return report('FAIL', path, f'magic 0x{magic:08X} ≠ 0xFAB11BAF: non è un global-metadata.dat')
    supported = version <= MAX_SUPPORTED_METADATA_VERSION
    report('PASS', path,
           f'header OK: metadata v{version} ({len(data)/1e6:.1f} MB) — BepInEx {"supportato" if supported else "NON supportato (percorso asset/CSV)"}')

    # ── String literal (best-effort, ADR-003 punto 1) ──
    # Layout header (Il2CppDumper, stabile v24..v29): dopo magic+version,
    # coppie (offset:u32, size:u32). La PRIMA coppia è StringLiteral
    # (entry {length:u32, dataIndex:u32}), la SECONDA è StringLiteralData (blob).
    try:
        lit_off, lit_size, dat_off, dat_size = struct.unpack_from('<IIII', data, 8)
        n = lit_size // 8
        checks = [
            ('tabella dentro il file', lit_off + lit_size <= len(data)),
            ('blob dentro il file', dat_off + dat_size <= len(data)),
            ('almeno 1 literal', n >= 1),
            ('size multiplo di 8', lit_size % 8 == 0),
        ]
        bad = [name for name, okc in checks if not okc]
        if bad:
            return report('WARN', path,
                          f'string-literal: struttura NON conforme ({", ".join(bad)}) — '
                          f'v{version} probabilmente ha layout header diverso: da studiare prima del port Rust')

        good = 0
        sample = []
        for i in range(n):
            length, data_index = struct.unpack_from('<II', data, lit_off + i * 8)
            if data_index + length <= dat_size:
                good += 1
                if len(sample) < 5 and 0 < length < 200:
                    raw = data[dat_off + data_index: dat_off + data_index + length]
                    try:
                        s = raw.decode('utf-8')
                        if s.isprintable():
                            sample.append(s)
                    except UnicodeDecodeError:
                        pass
        ratio = good / n if n else 0
        msg = (f'string-literal: {n} entry, {good} ({ratio:.0%}) con bounds validi; '
               f'esempi: {sample[:5] if sample else "(nessuna stringa UTF-8 stampabile nei primi hit)"}')
        if ratio > 0.99 and sample:
            report('PASS', path, msg + ' → layout CONFERMATO su file reale: pronto per il port Rust')
        elif ratio > 0.8:
            report('WARN', path, msg + ' → quasi conforme: verificare sotto-versione metadata prima del port')
        else:
            report('WARN', path, msg + ' → layout NON confermato per questa versione')
    except struct.error:
        report('WARN', path, 'string-literal: header troppo corto per le coppie offset/size')


# ─── 2. .utoc ──────────────────────────────────────────────────────────────

def check_utoc(path):
    data = open(path, 'rb').read()
    if len(data) < 144:
        return report('FAIL', path, 'UTOC troppo piccolo (<144 byte)')
    if data[0:16] != UTOC_MAGIC:
        return report('FAIL', path, 'magic UTOC non valido')
    off = 16
    version = data[off]; off += 4  # u8 + 3 reserved
    (header_size, entry_count, cb_count, cb_size, cm_count, cm_len,
     cblock_size, dir_index_size, partition_count) = struct.unpack_from('<9I', data, off)
    off += 36
    (container_id,) = struct.unpack_from('<Q', data, off); off += 8
    off += 16  # encryption key guid
    container_flags = data[off]; off += 1
    ph_seeds = chunks_wo_ph = 0
    if version >= 4:
        off += 3
        (ph_seeds,) = struct.unpack_from('<I', data, off); off += 4
        off += 8 * partition_count
    if version >= 5:
        (chunks_wo_ph,) = struct.unpack_from('<I', data, off); off += 4

    checks = [
        ('header_size plausibile', 100 <= header_size <= 4096),
        ('entry_count > 0', entry_count > 0),
        ('compressed_block_entry_size == 12', cb_size == 12),
        ('partizioni >= 1', partition_count >= 1),
    ]
    bad = [n for n, c in checks if not c]
    encrypted = bool(container_flags & 0x02)  # Encrypted flag
    detail = (f'UTOC v{version}: {entry_count} entry, {cb_count} blocchi compressi, '
              f'{partition_count} partizioni, {cm_count} metodi compressione, '
              f'PH seeds {ph_seeds}, flags 0x{container_flags:02X}'
              + (' [CRIPTATO — serve la chiave AES]' if encrypted else ''))
    if bad:
        report('FAIL', path, detail + f' — campi incoerenti: {", ".join(bad)}')
    elif version > UTOC_MAX_KNOWN_VERSION:
        report('WARN', path, detail + f' — v{version} > v{UTOC_MAX_KNOWN_VERSION} testata: lettura best-effort (come da parser Rust)')
    else:
        report('PASS', path, detail + ' → header CONFERMATO su file reale')


# ─── 3. Unity SerializedFile (.assets) ─────────────────────────────────────

def check_serialized_file(path):
    size = os.path.getsize(path)
    with open(path, 'rb') as f:
        head = f.read(64)
    if len(head) < 20:
        return report('FAIL', path, 'troppo corto per un SerializedFile')
    # Header classico big-endian: metadata_size, file_size, version, data_offset
    meta_be, fsize_be, version_be, doff_be = struct.unpack_from('>IIII', head, 0)
    if not (16 <= version_be <= 22):
        return report('WARN', path, f'version {version_be} fuori dal range 16..22 coperto da unity_serialized.rs')
    if version_be >= 22:
        # v22: dimensioni vere a 64 bit più avanti nell'header
        meta64, fsize64 = struct.unpack_from('>IQ', head, 20)[0], struct.unpack_from('>Q', head, 24)[0]
        coerente = fsize64 == size
        detail = f'SerializedFile v{version_be} (header 64-bit): file_size dichiarato {fsize64}, reale {size}'
    else:
        coerente = fsize_be == size
        detail = f'SerializedFile v{version_be}: file_size dichiarato {fsize_be}, reale {size}'
    if coerente:
        report('PASS', path, detail + ' → header coerente: pronto per estrazione TextAsset (unity_serialized.rs)')
    else:
        report('WARN', path, detail + ' → dimensioni non coerenti: verificare (bundle? troncato?)')


# ─── 4. GameMaker data.win ─────────────────────────────────────────────────

def check_data_win(path):
    data = open(path, 'rb').read()
    if len(data) < 16 or data[0:4] != b'FORM':
        return report('FAIL', path, 'header FORM mancante: non è un data.win')
    # mirror parse_chunks: FORM + size, poi chunk (nome 4B, size u32, dati)
    chunks = []
    pos = 8
    while pos + 8 <= len(data):
        name = data[pos:pos+4].decode('ascii', 'replace')
        (size,) = struct.unpack_from('<I', data, pos+4)
        chunks.append((name, pos+8, size))
        pos += 8 + size
    names = [c[0] for c in chunks]
    strg = next((c for c in chunks if c[0] == 'STRG'), None)
    if not strg:
        return report('WARN', path, f'{len(chunks)} chunk ({" ".join(names[:12])}…) ma STRG assente')
    _, strg_off, strg_size = strg
    (count,) = struct.unpack_from('<I', data, strg_off)
    table = strg_off + 4
    entries = []   # (entry_off, char_off, length)
    for i in range(min(count, 500_000)):
        p = table + i*4
        if p + 4 > len(data):
            break
        (entry_abs,) = struct.unpack_from('<I', data, p)
        if entry_abs + 4 > len(data):
            continue
        (slen,) = struct.unpack_from('<I', data, entry_abs)
        entries.append((entry_abs, entry_abs + 4, slen))
    report('PASS', path,
           f'FORM OK: {len(chunks)} chunk, STRG con {count} stringhe ({len(entries)} leggibili), '
           f'file {len(data)/1e6:.1f} MB')

    # ── Censimento puntatori (per il rebuilder) ──
    # Ipotesi da verificare: gli altri chunk referenziano le stringhe con u32
    # assoluti che puntano ai DATI (entry+4). Misuriamo: quanti siti u32 nel
    # file corrispondono a un char_off reale, e quanti "match" cadono su
    # indirizzi che NON sono inizio-dati (stima falsi positivi).
    char_offs = {e[1] for e in entries}
    decoys = {e[1] + 1 for e in entries if e[2] > 2}  # indirizzi interni: mai referenziati legittimamente
    hits = 0
    decoy_hits = 0
    referenced = set()
    strg_end = strg_off + strg_size
    step_report = max(1, len(data) // (20 * 1024 * 1024))
    try:
        import numpy as np
        buf = np.frombuffer(data, dtype=np.uint8)
        c_sorted = np.array(sorted(char_offs), dtype=np.uint64)
        d_sorted = np.array(sorted(decoys), dtype=np.uint64)
        for align in range(4):
            n = (len(data) - align - 4) // 4 * 4
            if n <= 0:
                continue
            words = buf[align:align+n].view('<u4').astype(np.uint64)
            # posizioni assolute dei siti
            pos_abs = np.arange(align, align+n, 4, dtype=np.uint64)
            # escludi i siti DENTRO la tabella STRG (quelli sono la tabella stessa)
            outside = (pos_abs < strg_off) | (pos_abs >= strg_end)
            w = words[outside]
            m = np.isin(w, c_sorted)
            hits += int(m.sum())
            referenced.update(w[m].tolist())
            decoy_hits += int(np.isin(w, d_sorted).sum())
    except ImportError:
        # fallback puro-Python (solo siti allineati a 4, più lento)
        for p in range(0, len(data) - 4, 4):
            if strg_off <= p < strg_end:
                continue
            (v,) = struct.unpack_from('<I', data, p)
            if v in char_offs:
                hits += 1
                referenced.add(v)
            elif v in decoys:
                decoy_hits += 1
            if p % (50*1024*1024) == 0 and p:
                print(f'   … censimento {p/1e6:.0f}/{len(data)/1e6:.0f} MB')
    ref_ratio = len(referenced) / len(char_offs) if char_offs else 0
    fp_rate = decoy_hits / max(1, len(decoys))
    msg = (f'censimento puntatori: {hits} siti → {len(referenced)}/{len(char_offs)} '
           f'stringhe referenziate ({ref_ratio:.0%}); falsi positivi stimati: '
           f'{decoy_hits} su {len(decoys)} esche ({fp_rate:.2%})')
    if ref_ratio > 0.6 and fp_rate < 0.01:
        report('PASS', path, msg + ' → rilocazione generica PROMETTENTE: dato sufficiente per progettare il rebuilder')
    elif ref_ratio > 0.3:
        report('WARN', path, msg + ' → segnale parziale: servono più campioni o parsing per-chunk (stile UndertaleModTool)')
    else:
        report('WARN', path, msg + ' → le stringhe non sembrano referenziate con puntatori diretti: rebuilder da progettare per-chunk')


# ─── 5. Unreal .pak (classico) ─────────────────────────────────────────────

PAK_MAGIC = 0x5A6F12E1


def _fstring(data, off):
    """FString UE: i32 len (negativo = UTF-16), poi bytes con terminatore."""
    (n,) = struct.unpack_from('<i', data, off)
    off += 4
    if n == 0:
        return '', off
    if n < 0:
        raw = data[off:off + (-n) * 2]
        return raw.decode('utf-16-le', 'replace').rstrip('\x00'), off + (-n) * 2
    raw = data[off:off + n]
    return raw.decode('utf-8', 'replace').rstrip('\x00'), off + n


def check_pak(path):
    size = os.path.getsize(path)
    with open(path, 'rb') as f:
        tail_len = min(size, 4096)
        f.seek(size - tail_len)
        tail = f.read(tail_len)
        # Il footer varia per versione: cerchiamo il magic nel tail e leggiamo
        # version/index_offset/index_size che lo seguono (layout stabile).
        pos = tail.rfind(struct.pack('<I', PAK_MAGIC))
        if pos < 0:
            return report('FAIL', path, 'magic pak 0x5A6F12E1 non trovato nel footer')
        try:
            version, idx_off, idx_size = struct.unpack_from('<IQQ', tail, pos + 4)
        except struct.error:
            return report('FAIL', path, 'footer troncato dopo il magic')
        if not (1 <= version <= 12) or idx_off + idx_size > size:
            return report('FAIL', path, f'footer incoerente: v{version}, index {idx_off}+{idx_size} vs file {size}')
        # encrypted flag: u8 subito PRIMA del magic (v4+), guid prima ancora (v7+)
        encrypted = tail[pos - 1] == 1 if pos >= 1 else False
        if encrypted:
            return report('WARN', path, f'pak v{version} con INDICE CRIPTATO: serve la chiave AES, censimento impossibile')
        f.seek(idx_off)
        idx = f.read(idx_size)

    try:
        mount, off = _fstring(idx, 0)
        (count,) = struct.unpack_from('<I', idx, off)
        off += 4
        names = []
        if version >= 10:
            # PathHashIndex header: seed u64, has_phi u32 [+off/size/hash],
            # has_fdi u32 [+off/size/hash], encoded entries...
            off += 8
            (has_phi,) = struct.unpack_from('<I', idx, off); off += 4
            if has_phi:
                off += 8 + 8 + 20
            (has_fdi,) = struct.unpack_from('<I', idx, off); off += 4
            fdi_off = fdi_size = 0
            if has_fdi:
                fdi_off, fdi_size = struct.unpack_from('<QQ', idx, off)
                off += 8 + 8 + 20
            if not has_fdi or fdi_off + fdi_size > size:
                return report('WARN', path,
                              f'pak v{version} "{mount}": {count} entry ma FullDirectoryIndex assente/incoerente '
                              f'(has_fdi={has_fdi}) — servono più campioni')
            with open(path, 'rb') as f:
                f.seek(fdi_off)
                fdi = f.read(fdi_size)
            (dir_count,) = struct.unpack_from('<I', fdi, 0)
            p = 4
            for _ in range(dir_count):
                dname, p = _fstring(fdi, p)
                (fcount,) = struct.unpack_from('<I', fdi, p); p += 4
                for _ in range(fcount):
                    fname, p = _fstring(fdi, p)
                    p += 4  # offset nelle encoded entries
                    names.append(dname + fname)
            layout = f'v{version} PathHash+FullDirectoryIndex ({dir_count} directory)'
        else:
            # Indice classico v1-v9: per-entry FString path + record entry
            for _ in range(count):
                nm, off = _fstring(idx, off)
                names.append(nm)
                # entry: offset u64, size u64, uncompressed u64, compression u32, sha1 20
                (_eo, _es, _eu, comp) = struct.unpack_from('<QQQI', idx, off)
                off += 28 + 20
                if version >= 3 and comp != 0:
                    (nblocks,) = struct.unpack_from('<I', idx, off)
                    off += 4 + nblocks * 16
                off += 1  # encrypted u8
                if version >= 3:
                    off += 4  # compression block size
            layout = f'v{version} indice classico'
        fonts = [n for n in names
                 if n.lower().endswith(('.ufont', '.ttf', '.otf'))
                 or ('font' in n.lower() and n.lower().endswith(('.uasset', '.uexp')))]
        msg = f'pak {layout}, mount "{mount}", {len(names)}/{count} path letti'
        if fonts:
            msg += f' — CANDIDATI FONT ({len(fonts)}): ' + ', '.join(fonts[:8])
        else:
            msg += ' — nessun asset font nell\'elenco (il font può stare in un altro pak)'
        if len(names) >= count * 0.99:
            report('PASS', path, msg + ' → layout indice CONFERMATO: pronto per il port Rust (ADR-001 prereq 1)')
        else:
            report('WARN', path, msg + ' → indice letto solo in parte: layout da rifinire')
    except (struct.error, IndexError) as e:
        report('WARN', path, f'pak v{version}: indice non decodificato ({e}) — layout da studiare su questo campione')


# ─── main ──────────────────────────────────────────────────────────────────

def main():
    if not os.path.isdir(SAMPLES):
        print(f'Cartella campioni non trovata: {SAMPLES}')
        print('Crea .samples/ e copia i file come da .samples/README.md')
        sys.exit(1)

    found = False
    for dirpath, _dirs, files in os.walk(SAMPLES):
        for name in files:
            p = os.path.join(dirpath, name)
            low = name.lower()
            if low == 'global-metadata.dat':
                found = True; check_global_metadata(p)
            elif low.endswith('.utoc'):
                found = True; check_utoc(p)
            elif low.endswith('.assets') or low == 'resources.assets':
                found = True; check_serialized_file(p)
            elif low == 'data.win':
                found = True; check_data_win(p)
            elif low.endswith('.pak'):
                found = True; check_pak(p)

    if not found:
        print('Nessun file riconosciuto in .samples/ — vedi .samples/README.md per cosa copiare.')
        sys.exit(1)

    print(f'\nRisultato: {ok} PASS · {warn} WARN · {fail} FAIL')
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
