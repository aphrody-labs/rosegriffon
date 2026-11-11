#pragma once

/**
 * @file crand.h
 * @brief Authoritative port of the Inazuma Eleven: Victory Road PRNG (lives::CRand / nie.exe:0x14081c200).
 *
 * Canonical 32-bit Mersenne Twister MT19937 with Lemire bounded rejection.
 * Byte-exact cross-language parity with Rust aphrody-nie-core, .NET 10 IECODE.Core,
 * Python niepy, and Bun / TypeScript Inagle.
 */

#include "iecode/export.h"
#include <array>
#include <cstddef>
#include <cstdint>

#ifdef __cplusplus
namespace iecode::crypto {

class IECODE_EXPORT CRand {
public:
    static constexpr size_t STATE_N = 624;
    static constexpr size_t STATE_M = 397;
    static constexpr uint32_t MATRIX_A = 0x9908B0DFu;
    static constexpr uint32_t UPPER_MASK = 0x80000000u;
    static constexpr uint32_t LOWER_MASK = 0x7FFFFFFFu;
    static constexpr uint32_t INIT_MULT = 1812433253u; // 0x6C078965
    static constexpr uint32_t DEFAULT_SEED = 5489u;

    explicit CRand(uint32_t seed = DEFAULT_SEED) noexcept;
    static CRand from_u64(uint64_t seed) noexcept;

    [[nodiscard]] uint32_t next_u32() noexcept;
    [[nodiscard]] uint32_t bounded(uint32_t bound) noexcept;
    [[nodiscard]] float next_f32() noexcept;

private:
    void generate() noexcept;

    std::array<uint32_t, STATE_N> mt_{};
    size_t index_{STATE_N};
};

} // namespace iecode::crypto

extern "C" {
#endif

typedef struct iecode_crand iecode_crand_t;

IECODE_EXPORT iecode_crand_t* iecode_crand_create(uint32_t seed);
IECODE_EXPORT iecode_crand_t* iecode_crand_create_u64(uint64_t seed);
IECODE_EXPORT uint32_t iecode_crand_next_u32(iecode_crand_t* rng);
IECODE_EXPORT uint32_t iecode_crand_bounded(iecode_crand_t* rng, uint32_t bound);
IECODE_EXPORT float iecode_crand_next_f32(iecode_crand_t* rng);
IECODE_EXPORT void iecode_crand_destroy(iecode_crand_t* rng);

#ifdef __cplusplus
}
#endif
