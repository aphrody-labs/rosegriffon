#pragma once

/**
 * @file vfs_formats.h
 * @brief Standardized 28 VFS formats consumer interface for C and C++.
 *
 * Exposes canonical format IDs, metadata descriptors, header detection,
 * and format validation adhering to the cross-language specification.
 */

#include "iecode/export.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Canonical 28 VFS format discriminants matching Rust aphrody-nie-formats.
 */
typedef enum iecode_format_id {
    IECODE_FORMAT_UNKNOWN = 0,
    IECODE_FORMAT_G4TX = 1,
    IECODE_FORMAT_G4MD = 2,
    IECODE_FORMAT_G4MG = 3,
    IECODE_FORMAT_G4MT = 4,
    IECODE_FORMAT_G4SK = 5,
    IECODE_FORMAT_G4PK = 6,
    IECODE_FORMAT_G4RA = 7,
    IECODE_FORMAT_AGI = 8,
    IECODE_FORMAT_OBJB = 9,
    IECODE_FORMAT_COL = 10,
    IECODE_FORMAT_CFGBIN = 11,
    IECODE_FORMAT_MEVS = 12,
    IECODE_FORMAT_G4CM = 13,
    IECODE_FORMAT_CPK = 14,
    IECODE_FORMAT_AWB = 15,
    IECODE_FORMAT_UTF = 16,
    IECODE_FORMAT_DDS = 17,
    IECODE_FORMAT_PNG = 18,
    IECODE_FORMAT_RIFF = 19,
    IECODE_FORMAT_XPCK = 20,
    IECODE_FORMAT_XFSA = 21,
    IECODE_FORMAT_CRILAYLA = 22,
    IECODE_FORMAT_ACB = 23,
    IECODE_FORMAT_USM = 24,
    IECODE_FORMAT_G4NV = 25,
    IECODE_FORMAT_COL_MESH = 26,
    IECODE_FORMAT_COLS = 27,
    IECODE_FORMAT_LIVE = 28,
    IECODE_FORMAT_COUNT = 28
} iecode_format_id_t;

/**
 * @brief Standardized format descriptor metadata.
 */
typedef struct iecode_format_descriptor {
    uint32_t id;
    const char* name;
    const char* magic_hex;
    const char* magic_ascii;
    const char* extension;
    const char* mime_type;
    const char* category;
    bool is_big_endian;
    bool encryption_supported;
    bool compression_supported;
    const char* description;
} iecode_format_descriptor_t;

/**
 * @brief Detect format from buffer header bytes.
 */
IECODE_EXPORT iecode_format_id_t iecode_vfs_detect(const uint8_t* data, size_t size);

/**
 * @brief Get format descriptor by format ID (1..28).
 */
IECODE_EXPORT const iecode_format_descriptor_t* iecode_vfs_get_descriptor(iecode_format_id_t id);

/**
 * @brief Return total number of standard formats (28).
 */
IECODE_EXPORT size_t iecode_vfs_format_count(void);

/**
 * @brief Return pointer to static array containing all 28 format descriptors.
 */
IECODE_EXPORT const iecode_format_descriptor_t* iecode_vfs_get_catalog(void);

/**
 * @brief Validate that the data matches the expected format ID.
 */
IECODE_EXPORT bool iecode_vfs_validate(iecode_format_id_t expected_id, const uint8_t* data, size_t size);

/**
 * @brief Return format short name.
 */
IECODE_EXPORT const char* iecode_vfs_format_name(iecode_format_id_t id);

/**
 * @brief Return primary file extension (including leading dot).
 */
IECODE_EXPORT const char* iecode_vfs_format_extension(iecode_format_id_t id);

/**
 * @brief Return standardized MIME type.
 */
IECODE_EXPORT const char* iecode_vfs_format_mime_type(iecode_format_id_t id);

#ifdef __cplusplus
}
#endif
