#include "iecode/crypto/crand.h"

namespace iecode::crypto {

CRand::CRand(uint32_t seed) noexcept {
    mt_[0] = seed;
    for (uint32_t i = 1; i < STATE_N; ++i) {
        uint32_t prev = mt_[i - 1];
        mt_[i] = (INIT_MULT * (prev ^ (prev >> 30)) + i);
    }
    index_ = STATE_N; // Force regeneration on first draw
}

CRand CRand::from_u64(uint64_t seed) noexcept {
    return CRand(static_cast<uint32_t>(seed ^ (seed >> 32)));
}

void CRand::generate() noexcept {
    for (size_t i = 0; i < STATE_N; ++i) {
        uint32_t y = (mt_[i] & UPPER_MASK) | (mt_[(i + 1) % STATE_N] & LOWER_MASK);
        uint32_t next = mt_[(i + STATE_M) % STATE_N] ^ (y >> 1);
        if ((y & 1) != 0) {
            next ^= MATRIX_A;
        }
        mt_[i] = next;
    }
    index_ = 0;
}

uint32_t CRand::next_u32() noexcept {
    if (index_ >= STATE_N) {
        generate();
    }

    uint32_t y = mt_[index_++];

    // Canonical MT19937 tempering (d = 0xFFFFFFFF, verified in nie.exe:0x1402bf031)
    y ^= y >> 11;
    y ^= (y << 7) & 0x9D2C5680u;
    y ^= (y << 15) & 0xEFC60000u;
    y ^= y >> 18;

    return y;
}

uint32_t CRand::bounded(uint32_t bound) noexcept {
    if (bound == 0) {
        return next_u32();
    }

    uint64_t product = static_cast<uint64_t>(next_u32()) * static_cast<uint64_t>(bound);
    uint32_t low = static_cast<uint32_t>(product);

    if (low < bound) {
        uint32_t threshold = static_cast<uint32_t>((0u - bound) % bound);
        while (low < threshold) {
            product = static_cast<uint64_t>(next_u32()) * static_cast<uint64_t>(bound);
            low = static_cast<uint32_t>(product);
        }
    }

    return static_cast<uint32_t>(product >> 32);
}

float CRand::next_f32() noexcept {
    uint32_t bits = next_u32() >> 8;
    return static_cast<float>(bits) / 16777216.0f;
}

} // namespace iecode::crypto

// C-ABI Implementations
struct iecode_crand {
    iecode::crypto::CRand inner;
};

extern "C" {

iecode_crand_t* iecode_crand_create(uint32_t seed) {
    return new (std::nothrow) iecode_crand{iecode::crypto::CRand(seed)};
}

iecode_crand_t* iecode_crand_create_u64(uint64_t seed) {
    return new (std::nothrow) iecode_crand{iecode::crypto::CRand::from_u64(seed)};
}

uint32_t iecode_crand_next_u32(iecode_crand_t* rng) {
    return rng ? rng->inner.next_u32() : 0;
}

uint32_t iecode_crand_bounded(iecode_crand_t* rng, uint32_t bound) {
    return rng ? rng->inner.bounded(bound) : 0;
}

float iecode_crand_next_f32(iecode_crand_t* rng) {
    return rng ? rng->inner.next_f32() : 0.0f;
}

void iecode_crand_destroy(iecode_crand_t* rng) {
    delete rng;
}

}
