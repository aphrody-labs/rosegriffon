/**
 * @file test_vfs_formats.cpp
 * @brief Unit tests for C/C++ VFS formats consumer.
 */

#include <gtest/gtest.h>
#include "iecode/vfs_formats.h"
#include <array>
#include <cstring>

TEST(VfsFormatsTest, FormatCount) {
    EXPECT_EQ(iecode_vfs_format_count(), 28u);
}

TEST(VfsFormatsTest, CatalogLookup) {
    const auto* g4tx = iecode_vfs_get_descriptor(IECODE_FORMAT_G4TX);
    ASSERT_NE(g4tx, nullptr);
    EXPECT_EQ(g4tx->id, 1u);
    EXPECT_STREQ(g4tx->name, "G4TX");
    EXPECT_STREQ(g4tx->extension, ".g4tx");
    EXPECT_STREQ(g4tx->mime_type, "image/x-level5-g4tx");
    EXPECT_STREQ(g4tx->category, "texture");
    EXPECT_FALSE(g4tx->is_big_endian);
    EXPECT_TRUE(g4tx->compression_supported);

    const auto* cpk = iecode_vfs_get_descriptor(IECODE_FORMAT_CPK);
    ASSERT_NE(cpk, nullptr);
    EXPECT_EQ(cpk->id, 14u);
    EXPECT_STREQ(cpk->name, "CPK");
    EXPECT_STREQ(cpk->extension, ".cpk");
    EXPECT_STREQ(cpk->category, "container");
    EXPECT_TRUE(cpk->is_big_endian);
    EXPECT_TRUE(cpk->encryption_supported);

    const auto* live = iecode_vfs_get_descriptor(IECODE_FORMAT_LIVE);
    ASSERT_NE(live, nullptr);
    EXPECT_EQ(live->id, 28u);
    EXPECT_STREQ(live->name, "LIVE");
    EXPECT_STREQ(live->extension, ".live");
    EXPECT_TRUE(live->encryption_supported);

    const auto* unk = iecode_vfs_get_descriptor(IECODE_FORMAT_UNKNOWN);
    ASSERT_NE(unk, nullptr);
    EXPECT_EQ(unk->id, 0u);
    EXPECT_STREQ(unk->name, "?");
}

TEST(VfsFormatsTest, DetectKnownMagics) {
    // G4TX
    const uint8_t g4tx_data[8] = {'G', '4', 'T', 'X', 0, 0, 0, 0};
    EXPECT_EQ(iecode_vfs_detect(g4tx_data, sizeof(g4tx_data)), IECODE_FORMAT_G4TX);

    // CPK
    const uint8_t cpk_data[8] = {'C', 'P', 'K', ' ', 0, 0, 0, 0};
    EXPECT_EQ(iecode_vfs_detect(cpk_data, sizeof(cpk_data)), IECODE_FORMAT_CPK);

    // RDBN (cfg.bin)
    const uint8_t rdbn_data[8] = {'R', 'D', 'B', 'N', 0, 0, 0, 0};
    EXPECT_EQ(iecode_vfs_detect(rdbn_data, sizeof(rdbn_data)), IECODE_FORMAT_CFGBIN);

    // CRILAYLA
    const uint8_t layla_data[12] = {'C', 'R', 'I', 'L', 'A', 'Y', 'L', 'A', 0, 0, 0, 0};
    EXPECT_EQ(iecode_vfs_detect(layla_data, sizeof(layla_data)), IECODE_FORMAT_CRILAYLA);

    // LIVE (0x9DCE66C3 LE)
    const uint8_t live_data[8] = {0xC3, 0x66, 0xCE, 0x9D, 0, 0, 0, 0};
    EXPECT_EQ(iecode_vfs_detect(live_data, sizeof(live_data)), IECODE_FORMAT_LIVE);

    // Unknown
    const uint8_t unk_data[4] = {0x01, 0x02, 0x03, 0x04};
    EXPECT_EQ(iecode_vfs_detect(unk_data, sizeof(unk_data)), IECODE_FORMAT_UNKNOWN);

    // Buffer too short
    const uint8_t short_data[2] = {'G', '4'};
    EXPECT_EQ(iecode_vfs_detect(short_data, sizeof(short_data)), IECODE_FORMAT_UNKNOWN);
}

TEST(VfsFormatsTest, Validate) {
    const uint8_t g4tx_data[8] = {'G', '4', 'T', 'X', 0, 0, 0, 0};
    EXPECT_TRUE(iecode_vfs_validate(IECODE_FORMAT_G4TX, g4tx_data, sizeof(g4tx_data)));
    EXPECT_FALSE(iecode_vfs_validate(IECODE_FORMAT_CPK, g4tx_data, sizeof(g4tx_data)));
}

TEST(VfsFormatsTest, HelperAccessors) {
    EXPECT_STREQ(iecode_vfs_format_name(IECODE_FORMAT_G4TX), "G4TX");
    EXPECT_STREQ(iecode_vfs_format_extension(IECODE_FORMAT_G4TX), ".g4tx");
    EXPECT_STREQ(iecode_vfs_format_mime_type(IECODE_FORMAT_G4TX), "image/x-level5-g4tx");
}
