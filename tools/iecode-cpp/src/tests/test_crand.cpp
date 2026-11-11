#include "iecode/crypto/crand.h"
#include <gtest/gtest.h>

TEST(CRandTest, DefaultSeedCanonicalSequence) {
    // Exact MT19937 seed 5489 reference sequence
    iecode::crypto::CRand rng(5489);

    EXPECT_EQ(rng.next_u32(), 3499211612u);
    EXPECT_EQ(rng.next_u32(), 581869302u);
    EXPECT_EQ(rng.next_u32(), 3890346734u);
}

TEST(CRandTest, FromU64DeterministicFolding) {
    uint64_t seed64 = 0x123456789ABCDEF0ULL;
    uint32_t folded = static_cast<uint32_t>(seed64 ^ (seed64 >> 32));

    auto rng1 = iecode::crypto::CRand::from_u64(seed64);
    iecode::crypto::CRand rng2(folded);

    for (int i = 0; i < 10; ++i) {
        EXPECT_EQ(rng1.next_u32(), rng2.next_u32());
    }
}

TEST(CRandTest, BoundedRejectionInRange) {
    iecode::crypto::CRand rng(12345);
    const uint32_t bound = 17;

    for (int i = 0; i < 100; ++i) {
        uint32_t val = rng.bounded(bound);
        EXPECT_LT(val, bound);
    }
}

TEST(CRandTest, BoundedZeroReturnsRawNext) {
    iecode::crypto::CRand rng1(42);
    iecode::crypto::CRand rng2(42);

    uint32_t raw = rng1.next_u32();
    uint32_t bounded_zero = rng2.bounded(0);

    EXPECT_EQ(raw, bounded_zero);
}

TEST(CRandTest, NextF32InRange) {
    iecode::crypto::CRand rng(9999);

    for (int i = 0; i < 100; ++i) {
        float f = rng.next_f32();
        EXPECT_GE(f, 0.0f);
        EXPECT_LT(f, 1.0f);
    }
}

TEST(CRandTest, CAbiExports) {
    iecode_crand_t* rng = iecode_crand_create(5489);
    ASSERT_NE(rng, nullptr);

    EXPECT_EQ(iecode_crand_next_u32(rng), 3499211612u);
    EXPECT_EQ(iecode_crand_next_u32(rng), 581869302u);
    EXPECT_EQ(iecode_crand_next_u32(rng), 3890346734u);

    uint32_t b = iecode_crand_bounded(rng, 10);
    EXPECT_LT(b, 10u);

    float f = iecode_crand_next_f32(rng);
    EXPECT_GE(f, 0.0f);
    EXPECT_LT(f, 1.0f);

    iecode_crand_destroy(rng);
}
