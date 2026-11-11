/**
 * @file vfs_formats.cpp
 * @brief Implementation of standardized C/C++ VFS formats consumer.
 */

#include "iecode/vfs_formats.h"
#include <cstring>

static const iecode_format_descriptor_t kUnknownDescriptor = {
    0,
    "?",
    "0x00000000",
    "NONE",
    ".bin",
    "application/octet-stream",
    "system",
    false,
    false,
    false,
    "Unknown or unmapped file format"
};

static const iecode_format_descriptor_t kFormatCatalog[28] = {
    {
        1,
        "G4TX",
        "0x58543447",
        "G4TX",
        ".g4tx",
        "image/x-level5-g4tx",
        "texture",
        false,
        false,
        true,
        "Level-5 Texture Container (DDS BCn textures + atlas sprite subregions)"
    },
    {
        2,
        "G4MD",
        "0x444D3447",
        "G4MD",
        ".g4md",
        "model/x-level5-g4md",
        "model",
        false,
        false,
        true,
        "Level-5 3D Model Data (meshes, bone indices, vertex buffers, materials)"
    },
    {
        3,
        "G4MG",
        "0x474D3447",
        "G4MG",
        ".g4mg",
        "model/x-level5-g4mg",
        "model",
        false,
        false,
        true,
        "Level-5 Model Group (collection of submeshes and LOD levels)"
    },
    {
        4,
        "G4MT",
        "0x544D3447",
        "G4MT",
        ".g4mt",
        "model/x-level5-g4mt",
        "model",
        false,
        false,
        true,
        "Level-5 Motion Table (animation tracks, keyframes, bone curves)"
    },
    {
        5,
        "G4SK",
        "0x4B533447",
        "G4SK",
        ".g4sk",
        "model/x-level5-g4sk",
        "model",
        false,
        false,
        true,
        "Level-5 Skeleton Definition (bone hierarchy, inverse bind poses)"
    },
    {
        6,
        "G4PK",
        "0x4B503447",
        "G4PK",
        ".g4pk",
        "application/x-level5-g4pk",
        "container",
        false,
        false,
        true,
        "Level-5 Package Container (multi-file archive for character / stadium)"
    },
    {
        7,
        "G4RA",
        "0x41523447",
        "G4RA",
        ".g4ra",
        "application/x-level5-g4ra",
        "container",
        false,
        false,
        true,
        "Level-5 Resource Archive (compact asset bundle)"
    },
    {
        8,
        "AGI",
        "0x20494741",
        "AGI ",
        ".agi",
        "application/x-level5-agi",
        "animation",
        false,
        false,
        true,
        "Level-5 Animation Graphic Interface"
    },
    {
        9,
        "OBJB",
        "0x424A424F",
        "OBJB",
        ".objb",
        "application/x-level5-objb",
        "database",
        false,
        false,
        true,
        "Level-5 Object Binary (game world object definitions)"
    },
    {
        10,
        "col",
        "0x4C435850",
        "PXCL",
        ".pxcl",
        "application/x-level5-pxcl",
        "physics",
        false,
        false,
        true,
        "Level-5 Physics Collision Mesh"
    },
    {
        11,
        "cfg.bin",
        "0x4E424452",
        "RDBN",
        ".cfg.bin",
        "application/x-level5-rdbn",
        "database",
        false,
        true,
        true,
        "Level-5 Relational Database Binary (cfg.bin, T2B strings, row dictionaries)"
    },
    {
        12,
        "mevbin",
        "0x5356454D",
        "MEVS",
        ".mevbin",
        "application/x-level5-mevs",
        "script",
        false,
        false,
        true,
        "Level-5 Motion Event Script Binary (cinematics, QTE sequences)"
    },
    {
        13,
        "G4CM",
        "0x4D433447",
        "G4CM",
        ".g4cm",
        "application/x-level5-g4cm",
        "camera",
        false,
        false,
        false,
        "Level-5 Camera Path / Trajectory Data"
    },
    {
        14,
        "CPK",
        "0x204B5043",
        "CPK ",
        ".cpk",
        "application/x-crifs-cpk",
        "container",
        true,
        true,
        true,
        "CRI Middleware File System Archive (CPK header, TOC, ETOC, ITOC)"
    },
    {
        15,
        "AWB",
        "0x32534641",
        "AFS2",
        ".afs2",
        "audio/x-cri-afs2",
        "audio",
        false,
        false,
        false,
        "CRI Audio Waveform Batch (AFS2 container of HCA audio streams)"
    },
    {
        16,
        "@UTF",
        "0x46545540",
        "@UTF",
        ".utf",
        "application/x-cri-utf",
        "database",
        true,
        false,
        false,
        "CRI Universal Table Format (schema, column layout, typed rows)"
    },
    {
        17,
        "DDS",
        "0x20534444",
        "DDS ",
        ".dds",
        "image/vnd-ms.dds",
        "texture",
        false,
        false,
        false,
        "DirectDraw Surface texture container (BC1/BC3/BC7 compression)"
    },
    {
        18,
        "PNG",
        "0x474E5089",
        "PNG\\r",
        ".png",
        "image/png",
        "texture",
        true,
        false,
        true,
        "Portable Network Graphics lossless image"
    },
    {
        19,
        "WAV",
        "0x46464952",
        "RIFF",
        ".wav",
        "audio/wav",
        "audio",
        false,
        false,
        false,
        "RIFF Waveform Audio format"
    },
    {
        20,
        "XPCK",
        "0x4B435058",
        "XPCK",
        ".xpck",
        "application/x-level5-xpck",
        "container",
        false,
        false,
        true,
        "Level-5 Legacy Package Archive (Inazuma Eleven GO / Strikers series)"
    },
    {
        21,
        "XFSA",
        "0x41534658",
        "XFSA",
        ".xfsa",
        "application/x-level5-xfsa",
        "container",
        false,
        false,
        true,
        "Level-5 Virtual File System Archive"
    },
    {
        22,
        "CRILAYLA",
        "0x4C495243",
        "CRILAYLA",
        ".crilayla",
        "application/x-cri-layla",
        "compression",
        false,
        false,
        true,
        "CRI Layla LZSS-variant byte compression stream"
    },
    {
        23,
        "ACB",
        "0x42434140",
        "@ACB",
        ".acb",
        "audio/x-cri-acb",
        "audio",
        true,
        true,
        false,
        "CRI Atom Cue Sheet Binary"
    },
    {
        24,
        "USM",
        "0x44495243",
        "CRID",
        ".usm",
        "video/x-cri-usm",
        "video",
        true,
        true,
        false,
        "CRI Sofdec2 Video Container (USM stream with encrypted video/audio payloads)"
    },
    {
        25,
        "G4NV",
        "0x4D56414E",
        "NAVM",
        ".g4nv",
        "application/x-level5-g4nv",
        "ai",
        false,
        false,
        false,
        "Level-5 Navigation Mesh / Pathfinding Geometry"
    },
    {
        26,
        "COL",
        "0x004C4F43",
        "COL\\0",
        ".col",
        "application/x-level5-col",
        "physics",
        false,
        false,
        false,
        "Level-5 Collision Mesh (binary vertex/index collision data)"
    },
    {
        27,
        "COLS",
        "0x534C4F43",
        "COLS",
        ".cols",
        "application/x-level5-cols",
        "physics",
        false,
        false,
        false,
        "Level-5 Collision Set (composite multi-body collision configuration)"
    },
    {
        28,
        "LIVE",
        "0x9DCE66C3",
        "LIVE",
        ".live",
        "application/x-level5-live",
        "system",
        false,
        true,
        false,
        "Level-5 Lives Save Container (CRC32-keyed XOR cipher, 0xEEFF blobs)"
    }
};

static inline bool starts_with(const uint8_t* data, size_t size, const char* prefix, size_t prefix_len) {
    return size >= prefix_len && std::memcmp(data, prefix, prefix_len) == 0;
}

iecode_format_id_t iecode_vfs_detect(const uint8_t* data, size_t size) {
    if (!data || size < 4) {
        return IECODE_FORMAT_UNKNOWN;
    }

    if (starts_with(data, size, "CRILAYLA", 8)) return IECODE_FORMAT_CRILAYLA;
    if (starts_with(data, size, "CPK ", 4)) return IECODE_FORMAT_CPK;
    if (starts_with(data, size, "@UTF", 4)) return IECODE_FORMAT_UTF;
    if (starts_with(data, size, "AFS2", 4)) return IECODE_FORMAT_AWB;
    if (starts_with(data, size, "CRID", 4)) return IECODE_FORMAT_USM;
    if (starts_with(data, size, "@ACB", 4)) return IECODE_FORMAT_ACB;
    if (starts_with(data, size, "G4MG", 4)) return IECODE_FORMAT_G4MG;
    if (starts_with(data, size, "G4MD", 4)) return IECODE_FORMAT_G4MD;
    if (starts_with(data, size, "G4TX", 4)) return IECODE_FORMAT_G4TX;
    if (starts_with(data, size, "G4MT", 4)) return IECODE_FORMAT_G4MT;
    if (starts_with(data, size, "G4SK", 4)) return IECODE_FORMAT_G4SK;
    if (starts_with(data, size, "G4PK", 4)) return IECODE_FORMAT_G4PK;
    if (starts_with(data, size, "G4RA", 4)) return IECODE_FORMAT_G4RA;
    if (starts_with(data, size, "G4CM", 4)) return IECODE_FORMAT_G4CM;
    if (starts_with(data, size, "AGI ", 4)) return IECODE_FORMAT_AGI;
    if (starts_with(data, size, "OBJB", 4)) return IECODE_FORMAT_OBJB;
    if (starts_with(data, size, "MEVS", 4)) return IECODE_FORMAT_MEVS;
    if (starts_with(data, size, "NAVM", 4)) return IECODE_FORMAT_G4NV;
    if (starts_with(data, size, "PXCL", 4)) return IECODE_FORMAT_COL;
    if (starts_with(data, size, "COLS", 4)) return IECODE_FORMAT_COLS;
    if (starts_with(data, size, "COL\0", 4)) return IECODE_FORMAT_COL_MESH;
    if (starts_with(data, size, "DDS ", 4)) return IECODE_FORMAT_DDS;
    if (size >= 8 && static_cast<uint8_t>(data[0]) == 0x89 &&
        data[1] == 'P' && data[2] == 'N' && data[3] == 'G' &&
        data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A) {
        return IECODE_FORMAT_PNG;
    }
    if (starts_with(data, size, "RIFF", 4)) return IECODE_FORMAT_RIFF;
    if (starts_with(data, size, "XPCK", 4)) return IECODE_FORMAT_XPCK;
    if (starts_with(data, size, "XFSA", 4)) return IECODE_FORMAT_XFSA;
    if (starts_with(data, size, "RDBN", 4)) return IECODE_FORMAT_CFGBIN;

    // Check LIVE magic: 0x9DCE66C3 (LE: C3 66 CE 9D)
    if (data[0] == 0xC3 && data[1] == 0x66 && data[2] == 0xCE && data[3] == 0x9D) {
        return IECODE_FORMAT_LIVE;
    }

    return IECODE_FORMAT_UNKNOWN;
}

const iecode_format_descriptor_t* iecode_vfs_get_descriptor(iecode_format_id_t id) {
    if (id >= 1 && id <= 28) {
        return &kFormatCatalog[id - 1];
    }
    return &kUnknownDescriptor;
}

size_t iecode_vfs_format_count(void) {
    return 28;
}

const iecode_format_descriptor_t* iecode_vfs_get_catalog(void) {
    return kFormatCatalog;
}

bool iecode_vfs_validate(iecode_format_id_t expected_id, const uint8_t* data, size_t size) {
    return iecode_vfs_detect(data, size) == expected_id;
}

const char* iecode_vfs_format_name(iecode_format_id_t id) {
    return iecode_vfs_get_descriptor(id)->name;
}

const char* iecode_vfs_format_extension(iecode_format_id_t id) {
    return iecode_vfs_get_descriptor(id)->extension;
}

const char* iecode_vfs_format_mime_type(iecode_format_id_t id) {
    return iecode_vfs_get_descriptor(id)->mime_type;
}
