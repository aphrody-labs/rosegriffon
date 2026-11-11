#!/usr/bin/env python3
"""Find RIP-relative references to an address in a PE's `.text`.

Why this exists
---------------
Locating a string is easy; finding the code that USES it is the anchor, and x64 reaches its
data through `lea reg, [rip+disp32]`. This scans `.text` for any 4-byte displacement whose
RIP-relative target is the address you asked about, without assuming a particular instruction
encoding: it reports candidates with their surrounding bytes so the caller can judge.

It is deliberately a CANDIDATE finder. A 4-byte displacement can coincide, so every hit must be
confirmed by disassembling around it — `nie disasm` and the uemu oracle are what prove a
function, not this.

Usage
-----
    python3 scripts/re/xref.py --exe dist/nie.exe --target 0x1412345678
    python3 scripts/re/xref.py --exe dist/nie.exe --string OnEnter
"""

from __future__ import annotations

import argparse
import struct


def sections(data: bytes):
    if len(data) < 0x40 or data[:2] != b"MZ":
        raise ValueError("not a valid PE: missing DOS header")
    pe = struct.unpack_from("<I", data, 0x3C)[0]
    if pe > len(data) - 24 or data[pe : pe + 4] != b"PE\0\0":
        raise ValueError("not a valid PE: missing PE header")
    machine = struct.unpack_from("<H", data, pe + 4)[0]
    count = struct.unpack_from("<H", data, pe + 6)[0]
    optional = struct.unpack_from("<H", data, pe + 20)[0]
    if machine != 0x8664 or optional < 32 or pe + 24 + optional > len(data):
        raise ValueError("expected an x86-64 PE32+ image with a complete optional header")
    if struct.unpack_from("<H", data, pe + 24)[0] != 0x20B:
        raise ValueError("expected a PE32+ optional header")
    base = struct.unpack_from("<Q", data, pe + 24 + 24)[0]
    table = pe + 24 + optional
    if count > (len(data) - table) // 40:
        raise ValueError("truncated PE section table")
    out = []
    for index in range(count):
        head = table + index * 40
        name = data[head : head + 8].rstrip(b"\0").decode("ascii", errors="replace")
        vsize, rva, rsize, raw = struct.unpack_from("<IIII", data, head + 8)
        if rsize and (raw > len(data) or rsize > len(data) - raw):
            raise ValueError(f"section {name!r} exceeds the file")
        out.append((name, rva, vsize, raw, rsize))
    return base, out


def find_string(data: bytes, base: int, secs, needle: str) -> list[int]:
    """Addresses of an exact NUL-terminated occurrence of `needle`."""
    pattern = needle.encode() + b"\0"
    hits, start = [], 0
    while True:
        at = data.find(pattern, start)
        if at < 0:
            return hits
        start = at + 1
        # Refuse a match that is only the TAIL of a longer string.
        if at > 0 and data[at - 1] not in (0, 0x20):
            continue
        for _name, rva, vsize, raw, rsize in secs:
            if raw <= at and at + len(pattern) <= raw + rsize:
                hits.append(base + rva + (at - raw))
                break


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--exe", required=True)
    parser.add_argument("--target", help="address to find references to (hex)")
    parser.add_argument("--string", help="find the string first, then its references")
    parser.add_argument("--context", type=int, default=8, help="bytes of context to print")
    parser.add_argument(
        "--calls",
        action="store_true",
        help="look for direct `call rel32` (E8) to the target instead of data references",
    )
    args = parser.parse_args()
    if args.context < 0:
        parser.error("--context must be nonnegative")

    data = open(args.exe, "rb").read()
    try:
        base, secs = sections(data)
    except ValueError as error:
        parser.error(str(error))

    targets: list[int] = []
    if args.string:
        targets = find_string(data, base, secs, args.string)
        print(f"{args.string!r} : {len(targets)} occurrence(s)")
        for address in targets:
            print(f"  0x{address:X}")
    if args.target:
        targets.append(int(args.target, 16))
    if not targets:
        raise SystemExit("rien a chercher")

    text = next((s for s in secs if s[0] == ".text"), None)
    if text is None:
        parser.error("PE has no .text section")
    _name, rva, _vsize, raw, rsize = text
    wanted = set(targets)

    if args.calls:
        # `call rel32` : E8 dd, la cible se compte depuis la FIN de l'instruction (5 octets).
        # An E8 byte can also be embedded in data or another instruction.
        print("\ncandidats d'appels directs (E8 rel32), a confirmer par desassemblage :")
        total = 0
        for offset in range(raw, raw + rsize - 5 + 1):
            if data[offset] != 0xE8:
                continue
            rel = struct.unpack_from("<i", data, offset + 1)[0]
            site = base + rva + (offset - raw)
            if site + 5 + rel in wanted:
                print(f"  0x{site:X}  ->  0x{site + 5 + rel:X}")
                total += 1
        print(f"{total} appelant(s)")
        return
    print("\nreferences RIP-relatives dans .text :")
    found = 0
    for offset in range(raw, raw + rsize - 4 + 1):
        disp = struct.unpack_from("<i", data, offset)[0]
        # L'adresse d'un `lea reg,[rip+disp]` se compte depuis la FIN de l'instruction ; la
        # longueur n'est pas connue sans desassembler, donc on essaie les fins plausibles.
        instruction_address = base + rva + (offset - raw)
        for tail in (4, 5, 6, 7, 8):
            if instruction_address + tail + disp in wanted:
                start = max(raw, offset - args.context)
                blob = " ".join(f"{b:02X}" for b in data[start : min(raw + rsize, offset + 4 + args.context)])
                print(
                    f"  @0x{instruction_address - (offset - start):X}  disp=0x{disp:X} fin=+{tail}  {blob}"
                )
                found += 1
                break
    print(f"{found} candidat(s) — a confirmer par desassemblage, jamais tel quel")


if __name__ == "__main__":
    main()
