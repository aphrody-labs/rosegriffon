#pragma once

/**
 * @file nie_re.h
 * @brief Authoritative reverse-engineering specification for nie.exe (Inazuma Eleven: Victory Road).
 *
 * Exposes binary anchors, function addresses, RTTI classes, cryptographic keys,
 * and memory structures discovered across Ghidra, .pdata analyses, and runtime debugging.
 * Cross-language parity with Rust aphrody-nie-re, TypeScript @rosegriffon/inagle,
 * .NET 10 IECODE.Core, and Python niepy.
 */

#include "iecode/export.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct iecode_nie_crypto_constant {
    const char* name;
    const char* hex_value;
    uint32_t int_value;
    const char* usage;
    bool verified_in_game_dump;
} iecode_nie_crypto_constant_t;

typedef struct iecode_nie_memory_offset {
    const char* symbol;
    const char* address_hex;
    uint64_t runtime_pc;
    const char* subsystem;
    const char* description;
    const char* calling_convention;
    const char* signature;
} iecode_nie_memory_offset_t;

typedef struct iecode_nie_rtti_class {
    const char* name;
    const char* namespace_name;
    const char* vtable_offset_hex;
    const char* const* base_classes;
    size_t base_class_count;
    const char* description;
} iecode_nie_rtti_class_t;

typedef struct iecode_nie_memory_field {
    const char* offset_range;
    const char* description;
} iecode_nie_memory_field_t;

typedef struct iecode_nie_memory_structure {
    const char* name;
    const char* size_hex;
    size_t size_bytes;
    const char* description;
    const iecode_nie_memory_field_t* fields;
    size_t field_count;
} iecode_nie_memory_structure_t;

typedef struct iecode_nie_re_map {
    const char* target_binary;
    const char* internal_name;
    const char* architecture;
    const char* format;
    const char* base_address_hex;
    uint64_t base_address;
    size_t total_functions_count;
    size_t total_strings_count;
    const char* compiler;

    const iecode_nie_crypto_constant_t* crypto_constants;
    size_t crypto_constant_count;

    const iecode_nie_memory_offset_t* critical_offsets;
    size_t critical_offset_count;

    const iecode_nie_rtti_class_t* rtti_classes;
    size_t rtti_class_count;

    const iecode_nie_memory_structure_t* memory_structures;
    size_t memory_structure_count;
} iecode_nie_re_map_t;

IECODE_EXPORT const iecode_nie_re_map_t* iecode_nie_re_get_map(void);
IECODE_EXPORT size_t iecode_nie_crypto_constant_count(void);
IECODE_EXPORT const iecode_nie_crypto_constant_t* iecode_nie_crypto_constant_by_index(size_t index);
IECODE_EXPORT const iecode_nie_crypto_constant_t* iecode_nie_crypto_constant_by_name(const char* name);

IECODE_EXPORT size_t iecode_nie_critical_offset_count(void);
IECODE_EXPORT const iecode_nie_memory_offset_t* iecode_nie_critical_offset_by_index(size_t index);
IECODE_EXPORT const iecode_nie_memory_offset_t* iecode_nie_critical_offset_by_symbol(const char* symbol);

IECODE_EXPORT size_t iecode_nie_rtti_class_count(void);
IECODE_EXPORT const iecode_nie_rtti_class_t* iecode_nie_rtti_class_by_index(size_t index);

IECODE_EXPORT size_t iecode_nie_memory_structure_count(void);
IECODE_EXPORT const iecode_nie_memory_structure_t* iecode_nie_memory_structure_by_index(size_t index);

#ifdef __cplusplus
}
#endif
