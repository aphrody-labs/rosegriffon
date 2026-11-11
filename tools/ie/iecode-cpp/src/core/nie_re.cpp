#include "iecode/nie_re.h"
#include <cstring>

namespace {

// 1. Cryptographic Constants
static const iecode_nie_crypto_constant_t S_CRYPTO_CONSTANTS[] = {
    {
        "VIOLA_FIXED_KEY",
        "0x1717E18E",
        0x1717E18Eu,
        "Fixed CRI XOR encryption key for cpk_list.cfg.bin and standalone Level-5 packages (discovered by Viola).",
        true
    },
    {
        "LEVEL5_CRC32_POLYNOMIAL",
        "0xEDB88320",
        0xEDB88320u,
        "Standard IEEE 802.3 reflected CRC32 polynomial for RDBN hash dictionaries and CPK filename key derivation.",
        true
    },
    {
        "CRI_ENCRYPTED_TABLE_MAGIC",
        "0xF5F39E1F",
        0xF5F39E1Fu,
        "Magic header sentinel indicating an encrypted CRI @UTF table block.",
        true
    },
    {
        "LIVES_SAVE_HEADER_MAGIC",
        "0x9DCE66C3",
        0x9DCE66C3u,
        "Sentinel u32 LE placed at offset 0x00 of decrypted Lives save containers (002AB8F4-*).",
        true
    },
    {
        "LIVES_SAVE_CONST2",
        "0x2EC3031F",
        0x2EC3031Fu,
        "Constant u32 LE at offset 0x08 of decrypted Lives save header (bytes: 1F 03 C3 2E).",
        true
    },
    {
        "LIVES_BLOB_MAGIC",
        "0xEEFF",
        0xEEFFu,
        "Big-endian u16 sentinel starting every concatenated payload blob in Lives saves.",
        true
    },
    {
        "STEAM_APP_ID",
        "0x2AB8F4",
        2799860u,
        "Official Steam App ID for Inazuma Eleven: Victory Road (hexadecimal prefix for save files: 002AB8F4).",
        true
    }
};

// 2. Critical Offsets
static const iecode_nie_memory_offset_t S_CRITICAL_OFFSETS[] = {
    {
        "GameTickLoop",
        "0x1406d5840",
        0x1406d5840ULL,
        "game-loop",
        "Main game tick loop orchestrating 60 Hz physics update, animation blending, and entity state synchronization.",
        "__fastcall",
        "void __fastcall GameTickLoop(void* engineContext, float deltaTime)"
    },
    {
        "CharaControllerUpdate",
        "0x1404ecd60",
        0x1404ecd60ULL,
        "controller",
        "Player movement, kinematic resolution, ball possession calculations, and user input mapping.",
        "__fastcall",
        "void __fastcall CharaControllerUpdate(void* playerEntity, void* inputState, float dt)"
    },
    {
        "CriFsStreamDecryptBlock",
        "0x1405a1120",
        0x1405a1120ULL,
        "crypto",
        "Position-aware XOR stream cipher implementation decrypting 4-byte quads based on file offset.",
        "__fastcall",
        "void __fastcall CriFsStreamDecryptBlock(uint8_t* buffer, size_t length, uint64_t fileOffset, uint32_t key)"
    },
    {
        "CriLaylaDecompressStream",
        "0x1405b3890",
        0x1405b3890ULL,
        "vfs",
        "Reverse bitstream LZSS decompressor processing byte-by-byte from end of stream into preallocated buffer.",
        "__fastcall",
        "int32_t __fastcall CriLaylaDecompressStream(const uint8_t* input, uint8_t* output, size_t uncompressedSize)"
    },
    {
        "RdbnTableLookup",
        "0x1403c8040",
        0x1403c8040ULL,
        "vfs",
        "Binary search in RDBN table header resolving 32-bit CRC hashes to column offsets and row pointers.",
        "__fastcall",
        "void* __fastcall RdbnTableLookup(const uint8_t* rdbnBuffer, uint32_t tableHash, uint32_t entryHash)"
    },
    {
        "G4txDecodeTexture",
        "0x1404b2a80",
        0x1404b2a80ULL,
        "render",
        "G4TX header parsing, DDS texture extraction, and GPU resource registration.",
        "__fastcall",
        "void* __fastcall G4txDecodeTexture(const uint8_t* g4txData, size_t dataSize, int32_t textureIndex)"
    },
    {
        "LuaHostInit",
        "0x14072f910",
        0x14072f910ULL,
        "lua",
        "Initializes Lua 5.1/5.2 C host environment for UI animations, dialogue branching, and menu state machines.",
        "__fastcall",
        "void* __fastcall LuaHostInit(void* memoryPool)"
    },
    {
        "CRand_MT19937_Next",
        "0x14081c200",
        0x14081c200ULL,
        "prng",
        "Deterministic Mersenne Twister MT19937 pseudorandom number generator step function.",
        "__fastcall",
        "uint32_t __fastcall CRand_MT19937_Next(void* crandState)"
    }
};

// 3. RTTI Classes
static const char* S_BASE_CLASSES_OBJECT[] = { "Level5::Engine::Object" };

static const iecode_nie_rtti_class_t S_RTTI_CLASSES[] = {
    {
        "Object",
        "Level5::Engine",
        "0x140AC4000",
        nullptr,
        0,
        "Polymorphic base class for all engine actors, components, and resource handles."
    },
    {
        "CharaController",
        "Level5::Game",
        "0x140AC68A0",
        S_BASE_CLASSES_OBJECT,
        1,
        "High-level player controller managing motion states (dash, dribble, slide tackle, shoot charge)."
    },
    {
        "BallPhysics",
        "Level5::Game",
        "0x140AC7120",
        S_BASE_CLASSES_OBJECT,
        1,
        "Aerodynamic and turf friction simulation for the soccer ball, including spin and pass trajectories."
    },
    {
        "VfsManager",
        "Level5::Resource",
        "0x140AD1400",
        S_BASE_CLASSES_OBJECT,
        1,
        "Global filesystem coordinator mounting CPK pack archives and routing relative logical paths."
    },
    {
        "CpkArchive",
        "Level5::Resource",
        "0x140AD2200",
        S_BASE_CLASSES_OBJECT,
        1,
        "CRI Middleware CPK container handle with memory-mapped file views and decryption context."
    },
    {
        "RenderScene",
        "Level5::Graphics",
        "0x140AE0100",
        S_BASE_CLASSES_OBJECT,
        1,
        "Scene graph renderer managing camera viewports, shadow cascades, and lighting buffers."
    },
    {
        "SkinnedMesh",
        "Level5::Graphics",
        "0x140AE1880",
        S_BASE_CLASSES_OBJECT,
        1,
        "GPU skinning mesh processor packing 32 bones into 96 vec4 matrix registers (renderObj + 0x1D98)."
    },
    {
        "SoundPlayer",
        "CriWare::Atom",
        "0x140AF4900",
        nullptr,
        0,
        "CRI Atom Craft sound playback service managing voice categories, BGM ducking, and 3D positional audio."
    }
};

// 4. Memory Structures
static const iecode_nie_memory_field_t S_BONE_PALETTE_FIELDS[] = {
    { "0x000..0x600", "Array of 32 mat3x4 (row-major affine transforms without homogeneous row [0,0,0,1])." }
};

static const iecode_nie_memory_field_t S_FONT_GLYPH_FIELDS[] = {
    { "0x00", "uint16_t u (atlas X coordinate)" },
    { "0x02", "uint16_t v (atlas Y coordinate)" },
    { "0x04", "uint8_t width" },
    { "0x05", "uint8_t height" },
    { "0x06", "int8_t offsetX" },
    { "0x07", "int8_t offsetY" },
    { "0x08", "int8_t advanceX" },
    { "0x09", "uint8_t pageIndex (0 to 3)" },
    { "0x0A", "uint16_t reserved/padding" }
};

static const iecode_nie_memory_field_t S_RDBN_HEADER_FIELDS[] = {
    { "0x00..0x04", "uint32_t magic = 0x4E424452 ('RDBN')" },
    { "0x04..0x06", "uint16_t headerSize = 0x50" },
    { "0x06..0x0A", "uint32_t version = 0x01" },
    { "0x0A..0x0E", "uint32_t tableCount" },
    { "0x0E..0x12", "uint32_t stringPoolSize" },
    { "0x12..0x16", "uint32_t dataSectionSize" },
    { "0x16..0x50", "CRC32 checksums, schema flags, and table offset descriptors" }
};

static const iecode_nie_memory_structure_t S_MEMORY_STRUCTURES[] = {
    {
        "BonePalette",
        "0x600",
        1536,
        "Uniform buffer layout for skinned character meshes (32 bones × 3 vec4 matrices = 96 vec4, 1536 bytes).",
        S_BONE_PALETTE_FIELDS,
        sizeof(S_BONE_PALETTE_FIELDS) / sizeof(S_BONE_PALETTE_FIELDS[0])
    },
    {
        "FontGlyph",
        "0x0C",
        12,
        "Single glyph descriptor in Level-5 font texture atlas.",
        S_FONT_GLYPH_FIELDS,
        sizeof(S_FONT_GLYPH_FIELDS) / sizeof(S_FONT_GLYPH_FIELDS[0])
    },
    {
        "RdbnHeader",
        "0x50",
        80,
        "RDBN / cfg.bin 80-byte file header descriptor.",
        S_RDBN_HEADER_FIELDS,
        sizeof(S_RDBN_HEADER_FIELDS) / sizeof(S_RDBN_HEADER_FIELDS[0])
    }
};

static const iecode_nie_re_map_t S_RE_MAP = {
    "nie.exe",
    "nie1v2.exe",
    "x86_64",
    "PE32+",
    "0x140000000",
    0x140000000ULL,
    117068,
    72151,
    "MSVC 19.38 / VS 2022 v17.8",

    S_CRYPTO_CONSTANTS,
    sizeof(S_CRYPTO_CONSTANTS) / sizeof(S_CRYPTO_CONSTANTS[0]),

    S_CRITICAL_OFFSETS,
    sizeof(S_CRITICAL_OFFSETS) / sizeof(S_CRITICAL_OFFSETS[0]),

    S_RTTI_CLASSES,
    sizeof(S_RTTI_CLASSES) / sizeof(S_RTTI_CLASSES[0]),

    S_MEMORY_STRUCTURES,
    sizeof(S_MEMORY_STRUCTURES) / sizeof(S_MEMORY_STRUCTURES[0])
};

} // namespace

extern "C" {

const iecode_nie_re_map_t* iecode_nie_re_get_map(void) {
    return &S_RE_MAP;
}

size_t iecode_nie_crypto_constant_count(void) {
    return S_RE_MAP.crypto_constant_count;
}

const iecode_nie_crypto_constant_t* iecode_nie_crypto_constant_by_index(size_t index) {
    if (index >= S_RE_MAP.crypto_constant_count) return nullptr;
    return &S_RE_MAP.crypto_constants[index];
}

const iecode_nie_crypto_constant_t* iecode_nie_crypto_constant_by_name(const char* name) {
    if (!name) return nullptr;
    for (size_t i = 0; i < S_RE_MAP.crypto_constant_count; ++i) {
        if (std::strcmp(S_RE_MAP.crypto_constants[i].name, name) == 0) {
            return &S_RE_MAP.crypto_constants[i];
        }
    }
    return nullptr;
}

size_t iecode_nie_critical_offset_count(void) {
    return S_RE_MAP.critical_offset_count;
}

const iecode_nie_memory_offset_t* iecode_nie_critical_offset_by_index(size_t index) {
    if (index >= S_RE_MAP.critical_offset_count) return nullptr;
    return &S_RE_MAP.critical_offsets[index];
}

const iecode_nie_memory_offset_t* iecode_nie_critical_offset_by_symbol(const char* symbol) {
    if (!symbol) return nullptr;
    for (size_t i = 0; i < S_RE_MAP.critical_offset_count; ++i) {
        if (std::strcmp(S_RE_MAP.critical_offsets[i].symbol, symbol) == 0) {
            return &S_RE_MAP.critical_offsets[i];
        }
    }
    return nullptr;
}

size_t iecode_nie_rtti_class_count(void) {
    return S_RE_MAP.rtti_class_count;
}

const iecode_nie_rtti_class_t* iecode_nie_rtti_class_by_index(size_t index) {
    if (index >= S_RE_MAP.rtti_class_count) return nullptr;
    return &S_RE_MAP.rtti_classes[index];
}

size_t iecode_nie_memory_structure_count(void) {
    return S_RE_MAP.memory_structure_count;
}

const iecode_nie_memory_structure_t* iecode_nie_memory_structure_by_index(size_t index) {
    if (index >= S_RE_MAP.memory_structure_count) return nullptr;
    return &S_RE_MAP.memory_structures[index];
}

}
