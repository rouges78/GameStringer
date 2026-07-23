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

    if not found:
        print('Nessun file riconosciuto in .samples/ — vedi .samples/README.md per cosa copiare.')
        sys.exit(1)

    print(f'\nRisultato: {ok} PASS · {warn} WARN · {fail} FAIL')
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
