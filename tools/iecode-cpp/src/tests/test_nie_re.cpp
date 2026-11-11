#include "iecode/nie_re.h"
#include <gtest/gtest.h>
#include <cstring>

TEST(NieReTest, GetAuthoritativeMapMetadata) {
    const auto* map = iecode_nie_re_get_map();
    ASSERT_NE(map, nullptr);

    EXPECT_STREQ(map->target_binary, "nie.exe");
    EXPECT_STREQ(map->internal_name, "nie1v2.exe");
    EXPECT_STREQ(map->architecture, "x86_64");
    EXPECT_STREQ(map->format, "PE32+");
    EXPECT_STREQ(map->base_address_hex, "0x140000000");
    EXPECT_EQ(map->base_address, 0x140000000ULL);
    EXPECT_EQ(map->total_functions_count, 117068u);
    EXPECT_EQ(map->total_strings_count, 72151u);
}

TEST(NieReTest, CryptoConstantsAll7Present) {
    EXPECT_EQ(iecode_nie_crypto_constant_count(), 7u);

    const auto* viola = iecode_nie_crypto_constant_by_name("VIOLA_FIXED_KEY");
    ASSERT_NE(viola, nullptr);
    EXPECT_EQ(viola->int_value, 0x1717E18Eu);
    EXPECT_STREQ(viola->hex_value, "0x1717E18E");
    EXPECT_TRUE(viola->verified_in_game_dump);

    const auto* crc = iecode_nie_crypto_constant_by_name("LEVEL5_CRC32_POLYNOMIAL");
    ASSERT_NE(crc, nullptr);
    EXPECT_EQ(crc->int_value, 0xEDB88320u);

    const auto* live = iecode_nie_crypto_constant_by_name("LIVES_SAVE_HEADER_MAGIC");
    ASSERT_NE(live, nullptr);
    EXPECT_EQ(live->int_value, 0x9DCE66C3u);

    const auto* steam = iecode_nie_crypto_constant_by_name("STEAM_APP_ID");
    ASSERT_NE(steam, nullptr);
    EXPECT_EQ(steam->int_value, 2799860u);
}

TEST(NieReTest, CriticalOffsetsAll8Present) {
    EXPECT_EQ(iecode_nie_critical_offset_count(), 8u);

    const auto* game_tick = iecode_nie_critical_offset_by_symbol("GameTickLoop");
    ASSERT_NE(game_tick, nullptr);
    EXPECT_EQ(game_tick->runtime_pc, 0x1406d5840ULL);
    EXPECT_STREQ(game_tick->subsystem, "game-loop");

    const auto* crand_next = iecode_nie_critical_offset_by_symbol("CRand_MT19937_Next");
    ASSERT_NE(crand_next, nullptr);
    EXPECT_EQ(crand_next->runtime_pc, 0x14081c200ULL);
    EXPECT_STREQ(crand_next->subsystem, "prng");

    const auto* cpk_decrypt = iecode_nie_critical_offset_by_symbol("CriFsStreamDecryptBlock");
    ASSERT_NE(cpk_decrypt, nullptr);
    EXPECT_EQ(cpk_decrypt->runtime_pc, 0x1405a1120ULL);
}

TEST(NieReTest, RttiClassesAll8Present) {
    EXPECT_EQ(iecode_nie_rtti_class_count(), 8u);

    const auto* obj = iecode_nie_rtti_class_by_index(0);
    ASSERT_NE(obj, nullptr);
    EXPECT_STREQ(obj->name, "Object");
    EXPECT_STREQ(obj->namespace_name, "Level5::Engine");

    const auto* chara = iecode_nie_rtti_class_by_index(1);
    ASSERT_NE(chara, nullptr);
    EXPECT_STREQ(chara->name, "CharaController");
    EXPECT_EQ(chara->base_class_count, 1u);
    EXPECT_STREQ(chara->base_classes[0], "Level5::Engine::Object");
}

TEST(NieReTest, MemoryStructuresAll3Present) {
    EXPECT_EQ(iecode_nie_memory_structure_count(), 3u);

    const auto* bone = iecode_nie_memory_structure_by_index(0);
    ASSERT_NE(bone, nullptr);
    EXPECT_STREQ(bone->name, "BonePalette");
    EXPECT_EQ(bone->size_bytes, 1536u);
    EXPECT_STREQ(bone->size_hex, "0x600");

    const auto* glyph = iecode_nie_memory_structure_by_index(1);
    ASSERT_NE(glyph, nullptr);
    EXPECT_STREQ(glyph->name, "FontGlyph");
    EXPECT_EQ(glyph->size_bytes, 12u);

    const auto* rdbn = iecode_nie_memory_structure_by_index(2);
    ASSERT_NE(rdbn, nullptr);
    EXPECT_STREQ(rdbn->name, "RdbnHeader");
    EXPECT_EQ(rdbn->size_bytes, 80u);
    EXPECT_STREQ(rdbn->size_hex, "0x50");
}
