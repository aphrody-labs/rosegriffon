#!/usr/bin/env python3
"""
Extract all AOB patterns, hook definitions, and injection payloads
from InazumaElevenVRSaveEditor (.NET assembly).
"""

import argparse
import struct
import json
import os
import dnfile

parser = argparse.ArgumentParser(description="Extract bounded IEVR Save Editor hook evidence from a managed PE")
parser.add_argument("assembly", nargs="?", type=str, default="var/ievrsaveeditor/app_extracted.dll",
                    help="input managed assembly (default: %(default)s)")
parser.add_argument("--output", default="var/ievrsaveeditor/re_dump/hooks_extracted.json",
                    help="JSON output path (default: %(default)s)")
parser.add_argument("--max-array-length", type=int, default=2000,
                    help="maximum field bytes included per candidate array")
args = parser.parse_args()
if args.max_array_length < 1:
    parser.error("--max-array-length must be positive")
pe_path = os.path.abspath(args.assembly)
output_path = os.path.abspath(args.output)
try:
    dn = dnfile.dnPE(pe_path)
except (OSError, ValueError) as exc:
    parser.error(f"cannot parse managed PE {pe_path}: {exc}")

with open(pe_path, "rb") as f:
    raw_pe = f.read()

# Map FieldRva: field_row_index -> (rva, file offset)
file_size = len(raw_pe)


def rva_to_offset(rva, size=1):
    if not isinstance(rva, int) or rva <= 0 or size < 0:
        return None
    for section in dn.sections:
        raw_size = int(section.SizeOfRawData)
        virtual_size = int(section.Misc_VirtualSize) or raw_size
        span = min(raw_size, virtual_size)
        if section.VirtualAddress <= rva and rva + size <= section.VirtualAddress + span:
            offset = int(section.PointerToRawData) + rva - int(section.VirtualAddress)
            if offset >= 0 and offset + size <= file_size:
                return offset
    return None


field_rvas = {}
if hasattr(dn.net.mdtables, "FieldRva"):
    for fr in dn.net.mdtables.FieldRva.rows:
        rid = fr.Field.row_index
        rva = fr.Rva
        foff = rva_to_offset(rva)
        if foff is not None:
            field_rvas[rid] = (rva, foff)

def get_il_bytes(rva):
    if rva == 0:
        return b""
    foff = rva_to_offset(rva)
    if foff is None:
        return b""
    b0 = raw_pe[foff]
    if (b0 & 3) == 2:  # tiny
        sz = b0 >> 2
        if foff + 1 + sz > file_size:
            return b""
        return raw_pe[foff + 1 : foff + 1 + sz]
    elif (b0 & 3) == 3:  # fat
        if foff + 12 > file_size:
            return b""
        flags_sz = struct.unpack_from("<H", raw_pe, foff)[0]
        hdr_sz = (flags_sz >> 12) * 4
        if hdr_sz < 12 or foff + hdr_sz > file_size:
            return b""
        code_sz = struct.unpack_from("<I", raw_pe, foff + 4)[0]
        if foff + hdr_sz + code_sz > file_size:
            return b""
        return raw_pe[foff + hdr_sz : foff + hdr_sz + code_sz]
    return b""


def analyze_method(m_row):
    rva = m_row.Rva
    name = str(m_row.Name)
    il = get_il_bytes(rva)
    if not il:
        return None

    # Best-effort byte sweep; this is not a full CIL decoder.
    us_stream = dn.net.user_strings
    strings_found = []
    byte_arrays = []
    ints_found = []

    i = 0
    while i < len(il):
        op = il[i]
        # ldc.i4.s
        if op == 0x1F:
            if i + 2 > len(il):
                break
            val = struct.unpack_from("<b", il, i + 1)[0]
            ints_found.append(val)
            i += 2
        # ldc.i4
        elif op == 0x20:
            if i + 5 > len(il):
                break
            val = struct.unpack_from("<i", il, i + 1)[0]
            ints_found.append(val)
            i += 5
        # ldc.i4.0 .. ldc.i4.8
        elif 0x15 <= op <= 0x1E:
            ints_found.append(op - 0x16)
            i += 1
        # ldstr
        elif op == 0x72:
            if i + 5 > len(il):
                break
            tok = struct.unpack_from("<I", il, i + 1)[0]
            s_off = tok & 0xFFFFFF
            try:
                s = us_stream.get(s_off)
                if s and s.value:
                    strings_found.append(s.value)
            except Exception:
                pass
            i += 5
        # ldtoken (field)
        elif op == 0xD0:
            if i + 5 > len(il):
                break
            tok = struct.unpack_from("<I", il, i + 1)[0]
            table = tok >> 24
            rid = tok & 0xFFFFFF
            if table == 4 and rid in field_rvas:
                rva_f, foff = field_rvas[rid]
                # Look back in ints_found for array length if possible
                arr_len = ints_found[-1] if ints_found and 0 < ints_found[-1] < 2000 else 64
                arr_len = min(arr_len, args.max_array_length, max(0, file_size - foff))
                if not arr_len:
                    i += 5
                    continue
                data = raw_pe[foff : foff + arr_len]
                byte_arrays.append(
                    {
                        "field_rid": rid,
                        "rva": hex(rva_f),
                        "len": arr_len,
                        "hex": data.hex(),
                        "bytes": " ".join(f"{b:02X}" for b in data),
                    }
                )
            i += 5
        else:
            i += 1

    return {
        "name": name,
        "decoder": "bounded-opcode-scan (heuristic, not a full CIL disassembler)",
        "rva": hex(rva),
        "il_size": len(il),
        "strings": strings_found,
        "byte_arrays": byte_arrays,
        "ints": ints_found[-10:] if ints_found else [],
    }


target_services = [
    "MemoryEditorService",
    "BadgeSlotService",
    "CustomPassivesService",
    "CustomPassivesSummonService",
    "PlayerLevelService",
    "PlayerSpiritsService",
    "UnlimitedSpiritsService",
]

report = {}
for row in dn.net.mdtables.TypeDef.rows:
    tname = str(row.TypeName)
    if any(t == tname for t in target_services):
        full_name = f"{str(row.TypeNamespace)}.{tname}"
        report[full_name] = []
        for m in row.MethodList:
            info = analyze_method(m.row)
            if info and (info["strings"] or info["byte_arrays"]):
                report[full_name].append(info)

os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as out:
    json.dump(report, out, indent=2)

print(f"Extracted hook data for {len(report)} services from {pe_path} to {output_path}.")
for sname, methods in report.items():
    print(f"\n=== {sname} ({len(methods)} methods) ===")
    for m in methods:
        if any(k in m["name"] for k in ["Inject", "Hook", "Enable", "Apply", "Set"]):
            print(f"  * {m['name']} (IL={m['il_size']})")
            for s in m["strings"]:
                if any(
                    x in s.lower()
                    for x in ["failed", "aob", "hook", "inject", "pattern", "nie.exe"]
                ):
                    print(f"      str: {s.strip()}")
            for b in m["byte_arrays"]:
                print(f"      arr (len {b['len']}): {b['bytes']}")
