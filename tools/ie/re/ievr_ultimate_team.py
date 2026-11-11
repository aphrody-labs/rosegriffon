#!/usr/bin/env python3
"""IEVR Ultimate Team import/export and read-only container inspection tools.

Provides reverse-engineered cryptographic primitives and inspection utilities for:
1. Web Team Export: Decrypt and inspect exported squad/lineup files from https://ievr-ultimate-team.fly.dev/
2. Mod Packages: Inspect and extract metadata from .utmod (UTMOD2) containers.
3. Save Container: inspect the IEVR PC save header and derive the CRC-32 value
   encoded by the encrypted magic bytes. This does not recover the save key or
   verify the rest of the container.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import struct
import sys
import uuid
import zlib
from pathlib import Path

# Public default used by UTLauncher. Store user overrides in an environment
# variable so custom passphrases do not leak into command histories.
TEAM_EXPORT_PASSPHRASE = "Rmfr4Dic6EAQaSgmLF__S64v7AgTNXb3q7-BLsBO5_0"
TEAM_EXPORT_ITERATIONS = 210000
UTMOD2_MAGIC = b"UTMOD2\r\n\x1a"
SAVE_MAGIC = 0x9DCE66C3


def _decode_b64(payload: dict, key: str, expected_length: int | None = None) -> bytes:
    value = payload.get(key)
    if not isinstance(value, str):
        raise ValueError(f"team export field {key!r} must be a base64 string")
    try:
        decoded = base64.b64decode(value, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise ValueError(f"team export field {key!r} is not valid base64") from exc
    if expected_length is not None and len(decoded) != expected_length:
        raise ValueError(f"team export field {key!r} must decode to {expected_length} bytes")
    return decoded


def decrypt_team_export(payload_json: str | dict, passphrase: str = TEAM_EXPORT_PASSPHRASE) -> dict:
    """Decrypt an encrypted lineup exported from https://ievr-ultimate-team.fly.dev/."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes

    if isinstance(payload_json, str):
        try:
            payload = json.loads(payload_json)
        except json.JSONDecodeError as exc:
            raise ValueError("team export is not valid JSON") from exc
    else:
        payload = payload_json
    if not isinstance(payload, dict):
        raise ValueError("team export must be a JSON object")

    salt = _decode_b64(payload, "salt", 16)
    iv = _decode_b64(payload, "iv", 12)
    ciphertext = _decode_b64(payload, "datos")
    if len(ciphertext) < 16:
        raise ValueError("team export ciphertext is shorter than the AES-GCM tag")

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=TEAM_EXPORT_ITERATIONS,
    )
    key = kdf.derive(passphrase.encode("utf-8"))
    aesgcm = AESGCM(key)
    try:
        plaintext = aesgcm.decrypt(iv, ciphertext, None)
        result = json.loads(plaintext.decode("utf-8"))
    except (InvalidTag, ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("team export authentication or JSON decoding failed") from exc
    if not isinstance(result, dict):
        raise ValueError("decrypted team export must contain a JSON object")
    return result


def encrypt_team_export(team_data: dict, passphrase: str = TEAM_EXPORT_PASSPHRASE) -> dict:
    """Encrypt a team lineup dictionary into the format expected by UTLauncher."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes

    if not isinstance(team_data, dict):
        raise ValueError("team data must be a JSON object")
    if not passphrase:
        raise ValueError("passphrase must not be empty")
    salt = os.urandom(16)
    iv = os.urandom(12)

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=TEAM_EXPORT_ITERATIONS,
    )
    key = kdf.derive(passphrase.encode("utf-8"))
    aesgcm = AESGCM(key)
    plaintext = json.dumps(team_data, indent=2).encode("utf-8")
    ciphertext = aesgcm.encrypt(iv, plaintext, None)

    return {
        "v": 1,
        "alg": "AES-256-GCM+PBKDF2-SHA256",
        "salt": base64.b64encode(salt).decode("ascii"),
        "iv": base64.b64encode(iv).decode("ascii"),
        "datos": base64.b64encode(ciphertext).decode("ascii"),
    }


def inspect_utmod(path: Path) -> dict:
    """Inspect a .utmod package file header and extract package GUID."""
    if not path.is_file():
        raise ValueError(f"not a regular file: {path}")
    with path.open("rb") as f:
        header = f.read(64)

    if len(header) < 25 or header[:9] != UTMOD2_MAGIC:
        raise ValueError(f"Invalid UTMOD magic: expected {UTMOD2_MAGIC!r}")

    pkg_bytes = header[9:25]
    pkg_guid = uuid.UUID(bytes_le=pkg_bytes)
    file_size = path.stat().st_size

    return {
        "magic": "UTMOD2",
        "package_id_guid": str(pkg_guid),
        "package_id_hex": pkg_bytes.hex(),
        "file_size": file_size,
    }


def inspect_save(path: Path) -> dict:
    """Read the save header and derive the CRC value encoded by its magic."""
    if not path.is_file():
        raise ValueError(f"not a regular file: {path}")
    size = path.stat().st_size
    if size < 0x800:
        raise ValueError("Save file smaller than 0x800-byte header")

    # The encrypted first four bytes expose this CRC target.
    # In IEVR PC save, the container is XORed with a keystream derived from CRC-32(key_le32, aligned_offset)
    # At offset 0, the first 4 bytes of keystream XOR encrypted_magic == 0x9DCE66C3
    with path.open("rb") as f:
        raw_first4 = f.read(4)
    if len(raw_first4) != 4:
        raise ValueError("Save file ended before the magic field")
    keystream_first4 = bytes(a ^ b for a, b in zip(raw_first4, struct.pack("<I", SAVE_MAGIC)))

    # Untranspose CRC bytes
    crc = 0
    for lane, val in enumerate(keystream_first4):
        shift = lane * 2
        crc |= ((val >> 6) & 3) << shift
        crc |= ((val >> 4) & 3) << (shift + 8)
        crc |= ((val >> 2) & 3) << (shift + 16)
        crc |= (val & 3) << (shift + 24)

    # Derive the CRC target only. This script does not solve for a key preimage.
    return {
        "path": str(path),
        "size": size,
        "derived_crc": f"0x{crc:08X}",
        "raw_magic_bytes": raw_first4.hex(),
        "verified": False,
    }


def main():
    parser = argparse.ArgumentParser(description="IEVR Ultimate Team RE and Interop CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # team-decrypt
    p_td = subparsers.add_parser("team-decrypt", help="Decrypt an exported team JSON")
    p_td.add_argument("file", type=Path, help="Path to encrypted team JSON")
    p_td.add_argument("--passphrase-env", default="IEVR_UT_EXPORT_PASSPHRASE",
                      help="Environment variable containing an override passphrase")

    p_te = subparsers.add_parser("team-encrypt", help="Encrypt a team JSON for UTLauncher")
    p_te.add_argument("input", type=Path, help="Path to a plaintext team JSON object")
    p_te.add_argument("output", type=Path, help="Destination encrypted export JSON")
    p_te.add_argument("--passphrase-env", default="IEVR_UT_EXPORT_PASSPHRASE",
                      help="Environment variable containing an override passphrase")

    # utmod-info
    p_um = subparsers.add_parser("utmod-info", help="Inspect a .utmod package")
    p_um.add_argument("file", type=Path, help="Path to .utmod file")

    # save-info
    p_si = subparsers.add_parser("save-info", help="Inspect an IEVR save file")
    p_si.add_argument("file", type=Path, help="Path to save file")

    args = parser.parse_args()

    def passphrase_from_env(name: str) -> str:
        return os.environ.get(name) or TEAM_EXPORT_PASSPHRASE

    try:
        if args.command == "team-decrypt":
            data = json.loads(args.file.read_text(encoding="utf-8"))
            decrypted = decrypt_team_export(data, passphrase_from_env(args.passphrase_env))
            print(json.dumps(decrypted, indent=2))

        elif args.command == "team-encrypt":
            team_data = json.loads(args.input.read_text(encoding="utf-8"))
            encrypted = encrypt_team_export(team_data, passphrase_from_env(args.passphrase_env))
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(encrypted, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps({"output": str(args.output), "encrypted": True}, indent=2))

        elif args.command == "utmod-info":
            info = inspect_utmod(args.file)
            print(json.dumps(info, indent=2))

        elif args.command == "save-info":
            info = inspect_save(args.file)
            print(json.dumps(info, indent=2))
    except (OSError, ValueError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
