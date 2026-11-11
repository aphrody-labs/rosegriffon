#include "iecode/compression/crilayla.h"

#include <algorithm>
#include <cstring>
#include <gtest/gtest.h>
#include <string>

using namespace iecode::compression;

TEST(CriLayla, DetectMagic) {
    const uint8_t valid[] = {'C', 'R', 'I', 'L', 'A', 'Y', 'L', 'A', 0, 0, 0, 0, 0, 0, 0, 0};
    EXPECT_TRUE(is_crilayla(valid));

    const uint8_t invalid[] = {'C', 'R', 'I', 'L', 'A', 'Y', 'L', 'B'};
    EXPECT_FALSE(is_crilayla(invalid));
}

TEST(CriLayla, TooShort) {
    const uint8_t tiny[] = {'C', 'R', 'I', 'L'};
    EXPECT_FALSE(is_crilayla(tiny));
}

TEST(CriLayla, EmptyReturnsEmpty) {
    EXPECT_TRUE(crilayla_decompress({}).empty());
}

TEST(CriLayla, InvalidMagicReturnsEmpty) {
    const uint8_t bad[] = {0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                           0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
    EXPECT_TRUE(crilayla_decompress(bad).empty());
}

TEST(CriLayla, HeaderTooShort) {
    const uint8_t short_header[] = {'C', 'R', 'I',  'L',  'A', 'Y',
                                    'L', 'A', 0x00, 0x00, 0x00};  // only 11 bytes
    EXPECT_TRUE(crilayla_decompress(short_header).empty());
}

namespace {
std::vector<uint8_t> crilayla_fixture(uint32_t output_size, std::vector<uint8_t> compressed) {
    std::vector<uint8_t> data(16 + compressed.size() + 256, 0);
    std::memcpy(data.data(), "CRILAYLA", 8);
    for (int i = 0; i < 4; ++i) {
        data[8 + i] = static_cast<uint8_t>(output_size >> (8 * i));
        data[12 + i] = static_cast<uint8_t>(compressed.size() >> (8 * i));
    }
    std::memcpy(data.data() + 16, compressed.data(), compressed.size());
    std::fill(data.end() - 256, data.end(), 0x5a);
    return data;
}
}  // namespace

TEST(CriLayla, RejectsExhaustedLiteralAndReference) {
    EXPECT_TRUE(crilayla_decompress(crilayla_fixture(32, {0})).empty());
    EXPECT_TRUE(crilayla_decompress(crilayla_fixture(32, {0x80})).empty());
    EXPECT_TRUE(crilayla_decompress(crilayla_fixture(32, {0, 0x80})).empty());
}

TEST(CriLayla, PreservesPrefixAndValidLiteral) {
    // Reverse-byte bitstream: flag 0, literal 0x41, then padding.
    const auto output = crilayla_decompress(crilayla_fixture(1, {0x80, 0x20}));
    ASSERT_EQ(output.size(), 257u);
    EXPECT_EQ(output.back(), 0x41);
    EXPECT_TRUE(std::all_of(output.begin(), output.end() - 1, [](uint8_t b) { return b == 0x5a; }));
}

TEST(CriLayla, ValidReferenceUsesMinimumDistanceThree) {
    // Three literals written backwards, then a length-three distance-three reference.
    std::vector<uint8_t> bits;
    auto append = [&](uint32_t value, int count) {
        for (int i = count - 1; i >= 0; --i)
            bits.push_back((value >> i) & 1);
    };
    for (uint8_t literal : {'c', 'b', 'a'}) {
        append(0, 1);
        append(literal, 8);
    }
    append(1, 1);
    append(0, 13);
    append(0, 2);
    while (bits.size() % 8)
        bits.push_back(0);
    std::vector<uint8_t> bytes(bits.size() / 8, 0);
    for (size_t i = 0; i < bits.size(); ++i)
        bytes[i / 8] |= bits[i] << (7 - i % 8);
    std::reverse(bytes.begin(), bytes.end());
    const auto output = crilayla_decompress(crilayla_fixture(6, bytes));
    ASSERT_EQ(output.size(), 262u);
    EXPECT_EQ(std::string(output.begin() + 256, output.end()), "abcabc");
}
