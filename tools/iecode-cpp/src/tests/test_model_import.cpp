#include "iecode/converters/model_import.h"
#include "iecode/formats/level5/g4md.h"
#include "iecode/types.h"

#include <chrono>
#include <fstream>
#include <gtest/gtest.h>
#include <string>

#ifdef IECODE_HAS_TINYGLTF
namespace {
struct GlbFixture {
    std::filesystem::path path =
        std::filesystem::temp_directory_path() /
        ("iecode-model-import-" +
         std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()) + ".glb");
    explicit GlbFixture(bool malformed = false) {
        std::string json =
            R"({"asset":{"version":"2.0"},"buffers":[{"byteLength":42}],"bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":36},{"buffer":0,"byteOffset":36,"byteLength":6}],"accessors":[{"bufferView":0,"componentType":5126,"count":3,"type":"VEC3","min":[0,0,0],"max":[1,1,0]},{"bufferView":1,"componentType":5123,"count":3,"type":"SCALAR"}],"meshes":[{"primitives":[{"attributes":{"POSITION":0},"indices":1},{"attributes":{"POSITION":0},"indices":1}]}]})";
        if (malformed)
            json.replace(json.find("\"byteLength\":36"), 15, "\"byteLength\":12");
        while (json.size() % 4)
            json.push_back(' ');
        std::vector<uint8_t> data(12 + 8 + json.size() + 8 + 44, 0);
        iecode::write_u32_le(data.data(), 0x46546c67);
        iecode::write_u32_le(data.data() + 4, 2);
        iecode::write_u32_le(data.data() + 8, static_cast<uint32_t>(data.size()));
        iecode::write_u32_le(data.data() + 12, static_cast<uint32_t>(json.size()));
        iecode::write_u32_le(data.data() + 16, 0x4e4f534a);
        std::copy(json.begin(), json.end(), data.begin() + 20);
        auto* chunk = data.data() + 20 + json.size();
        iecode::write_u32_le(chunk, 44);
        iecode::write_u32_le(chunk + 4, 0x004e4942);
        iecode::write_u32_le(chunk + 8 + 12, 0x3f800000);  // second vertex x=1
        iecode::write_u32_le(chunk + 8 + 28, 0x3f800000);  // third vertex y=1
        iecode::write_u16_le(chunk + 8 + 38, 1);
        iecode::write_u16_le(chunk + 8 + 40, 2);
        std::ofstream out(path, std::ios::binary);
        out.write(reinterpret_cast<const char*>(data.data()),
                  static_cast<std::streamsize>(data.size()));
    }
    ~GlbFixture() { std::filesystem::remove(path); }
};
}  // namespace

TEST(ModelImport, MultiplePrimitivesRoundTripMetadataAndIndices) {
    GlbFixture fixture;
    const auto result = iecode::converters::import_glb(fixture.path);
    ASSERT_TRUE(result);
    const auto parsed = iecode::level5::g4md_parse(result->g4md_data);
    ASSERT_TRUE(parsed);
    EXPECT_EQ(parsed->header.header_size, 0xA0);
    ASSERT_EQ(parsed->submeshes.size(), 2u);
    EXPECT_EQ(parsed->total_vertex_count(), 6u);
    EXPECT_EQ(parsed->total_index_count(), 6u);
    EXPECT_EQ(parsed->vertex_buffer_size(), 192u);
    EXPECT_EQ(parsed->index_buffer_size(), 12u);
    EXPECT_EQ(parsed->submeshes[0].vertex_count, 3);
    EXPECT_EQ(parsed->submeshes[1].index_offset, 6);
    EXPECT_EQ(parsed->submeshes[0].primitive_type, 6u);
    EXPECT_FLOAT_EQ(parsed->submeshes[0].matrix[0], 1.0f);
    const size_t index_base = 0xA0 + 2 * 0x50 + parsed->vertex_buffer_size();
    for (uint16_t i = 0; i < 6; ++i)
        EXPECT_EQ(iecode::read_u16_le(result->g4md_data.data() + index_base + i * 2), i);
    auto overflowing = result->g4md_data;
    iecode::write_u32_le(overflowing.data() + 0xA0 + 0x34, 0x7fffffff);
    EXPECT_FALSE(iecode::level5::g4md_parse(overflowing));
    auto truncated = result->g4md_data;
    truncated.resize(0xA0 + 0x50);
    EXPECT_FALSE(iecode::level5::g4md_parse(truncated));
}

TEST(ModelImport, RejectsTruncatedAccessor) {
    GlbFixture fixture(true);
    EXPECT_FALSE(iecode::converters::import_glb(fixture.path));
}
#endif
