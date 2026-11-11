#ifdef IECODE_HAS_TINYGLTF
// stb_image et stb_image_write deja inclus dans d'autres TU
#define TINYGLTF_NO_STB_IMAGE_WRITE
#define TINYGLTF_NO_STB_IMAGE
#define TINYGLTF_NO_INCLUDE_STB_IMAGE
#define TINYGLTF_NO_INCLUDE_STB_IMAGE_WRITE
// Même raison que dans model_export.cpp : vcpkg installe nlohmann sous `nlohmann/json.hpp`,
// pas à la racine comme le suppose l'inclusion automatique de tiny_gltf.h.
#define TINYGLTF_NO_INCLUDE_JSON
#include <nlohmann/json.hpp>

#include <tiny_gltf.h>
#endif

#include "iecode/converters/model_import.h"
#include "iecode/formats/level5/g4md.h"
#include "iecode/formats/level5/g4mg.h"
#include "iecode/types.h"

#include <spdlog/spdlog.h>

#include <cstring>
#include <fstream>

namespace iecode::converters {

#ifdef IECODE_HAS_TINYGLTF

// ── Constantes ─────────────────────────────────────────────────────

static constexpr uint32_t G4MG_MAGIC_LE = 0x474D3447;
static constexpr uint32_t G4MD_MAGIC_LE = 0x444D3447;
static constexpr size_t G4MG_HEADER_SIZE = 0x40;
static constexpr size_t G4MD_HEADER_SIZE = 0xA0;
static constexpr size_t G4MD_SUBMESH_SIZE = 0x50;

// ── Helpers ────────────────────────────────────────────────────────

// Validate the complete accessor range before creating pointers or allocating.
static std::optional<std::span<const uint8_t>> accessor_bytes(const tinygltf::Model& model,
                                                              const tinygltf::Accessor& accessor,
                                                              size_t element_size, size_t& stride) {
    if (accessor.sparse.isSparse || accessor.bufferView < 0 ||
        static_cast<size_t>(accessor.bufferView) >= model.bufferViews.size() ||
        accessor.count == 0 || accessor.count > UINT16_MAX)
        return std::nullopt;
    const auto& view = model.bufferViews[static_cast<size_t>(accessor.bufferView)];
    if (view.buffer < 0 || static_cast<size_t>(view.buffer) >= model.buffers.size())
        return std::nullopt;
    const auto& buffer = model.buffers[static_cast<size_t>(view.buffer)].data;
    stride = view.byteStride ? view.byteStride : element_size;
    if (stride < element_size || view.byteOffset > buffer.size() ||
        view.byteLength > buffer.size() - view.byteOffset || accessor.byteOffset > view.byteLength)
        return std::nullopt;
    const size_t available = view.byteLength - accessor.byteOffset;
    if (available < element_size || accessor.count - 1 > (available - element_size) / stride)
        return std::nullopt;
    return std::span<const uint8_t>(buffer).subspan(view.byteOffset + accessor.byteOffset,
                                                    available);
}

static std::vector<float> read_accessor_float(const tinygltf::Model& model, int accessor_idx,
                                              int expected_components) {
    if (accessor_idx < 0 || static_cast<size_t>(accessor_idx) >= model.accessors.size())
        return {};
    const auto& accessor = model.accessors[static_cast<size_t>(accessor_idx)];
    if (accessor.componentType != TINYGLTF_COMPONENT_TYPE_FLOAT ||
        (expected_components == 3 && accessor.type != TINYGLTF_TYPE_VEC3) ||
        (expected_components == 2 && accessor.type != TINYGLTF_TYPE_VEC2))
        return {};
    size_t stride = 0;
    auto bytes =
        accessor_bytes(model, accessor, static_cast<size_t>(expected_components) * 4, stride);
    if (!bytes)
        return {};
    std::vector<float> result(accessor.count * static_cast<size_t>(expected_components));
    for (size_t i = 0; i < accessor.count; ++i)
        for (int c = 0; c < expected_components; ++c) {
            const uint32_t bits =
                read_u32_le(bytes->data() + i * stride + static_cast<size_t>(c) * 4);
            std::memcpy(
                &result[i * static_cast<size_t>(expected_components) + static_cast<size_t>(c)],
                &bits, 4);
        }
    return result;
}

static std::vector<uint16_t> read_indices_u16(const tinygltf::Model& model, int accessor_idx) {
    if (accessor_idx < 0 || static_cast<size_t>(accessor_idx) >= model.accessors.size())
        return {};
    const auto& accessor = model.accessors[static_cast<size_t>(accessor_idx)];
    if (accessor.type != TINYGLTF_TYPE_SCALAR)
        return {};
    size_t width = 0;
    switch (accessor.componentType) {
        case TINYGLTF_COMPONENT_TYPE_UNSIGNED_BYTE:
            width = 1;
            break;
        case TINYGLTF_COMPONENT_TYPE_UNSIGNED_SHORT:
            width = 2;
            break;
        case TINYGLTF_COMPONENT_TYPE_UNSIGNED_INT:
            width = 4;
            break;
        default:
            return {};
    }
    size_t stride = 0;
    auto bytes = accessor_bytes(model, accessor, width, stride);
    if (!bytes)
        return {};
    std::vector<uint16_t> result(accessor.count);
    for (size_t i = 0; i < accessor.count; ++i) {
        const auto* src = bytes->data() + i * stride;
        const uint32_t value = width == 4   ? read_u32_le(src)
                               : width == 2 ? read_u16_le(src)
                                            : src[0];
        if (value > UINT16_MAX)
            return {};
        result[i] = static_cast<uint16_t>(value);
    }
    return result;
}

/// Serialise le header G4MG.
static std::vector<uint8_t> serialize_g4mg(int mesh_count, int sub_mesh_count, int content_size) {
    std::vector<uint8_t> data(G4MG_HEADER_SIZE, 0);
    auto* p = data.data();

    write_u32_le(p + 0x00, G4MG_MAGIC_LE);
    write_u16_le(p + 0x04, static_cast<uint16_t>(G4MG_HEADER_SIZE));  // header_size
    write_u16_le(p + 0x06, 0x0001);                                   // file_type
    write_u32_le(p + 0x08, 0x00010000);                               // version
    write_u32_le(p + 0x0C, static_cast<uint32_t>(content_size));      // content_size
    write_u32_le(p + 0x20, static_cast<uint32_t>(mesh_count));
    write_u16_le(p + 0x24, static_cast<uint16_t>(sub_mesh_count));
    write_u16_le(p + 0x26, 0x0001);  // vertex_format_version

    return data;
}

/// Serialise un G4MD complet avec les donnees de vertex et d'index.
static std::vector<uint8_t> serialize_g4md(const std::vector<std::vector<float>>& positions,
                                           const std::vector<std::vector<float>>& normals,
                                           const std::vector<std::vector<float>>& uvs,
                                           const std::vector<std::vector<uint16_t>>& indices) {
    const size_t mesh_count = positions.size();

    if (mesh_count > 500)
        return {};
    const size_t data_start_aligned = G4MD_HEADER_SIZE + mesh_count * G4MD_SUBMESH_SIZE;
    // The parser resolves 16-bit offsets in units of four bytes.
    if (data_start_aligned / 4 > UINT16_MAX)
        return {};
    // Preparer les buffers de donnees
    std::vector<uint8_t> vertex_buffer;
    std::vector<uint8_t> index_buffer;

    struct SubmeshInfo {
        uint32_t vertex_count;
        uint32_t index_count;
        uint32_t index_buf_offset;  // Byte offset within the shared index buffer.
    };
    uint32_t total_vertices = 0;
    uint32_t total_indices = 0;
    std::vector<SubmeshInfo> submesh_infos;

    for (size_t mi = 0; mi < mesh_count; ++mi) {
        const auto& pos = positions[mi];
        const auto& nrm = normals[mi];
        const auto& uv = uvs[mi];
        const auto& idx = indices[mi];

        const size_t vert_count = pos.size() / 3;
        const size_t idx_count = idx.size();

        SubmeshInfo info = {};
        if (vert_count > UINT16_MAX || total_vertices > UINT16_MAX - vert_count ||
            idx_count > INT32_MAX || total_indices > UINT32_MAX - idx_count)
            return {};
        info.vertex_count = static_cast<uint32_t>(vert_count);
        info.index_count = static_cast<uint32_t>(idx_count);

        // Ecrire les vertices
        for (size_t vi = 0; vi < vert_count; ++vi) {
            // Position (float3, 12 octets)
            uint8_t tmp[4];
            for (int c = 0; c < 3; ++c) {
                float val = (vi * 3 + static_cast<size_t>(c) < pos.size())
                                ? pos[vi * 3 + static_cast<size_t>(c)]
                                : 0.0f;
                std::memcpy(tmp, &val, 4);
                vertex_buffer.insert(vertex_buffer.end(), tmp, tmp + 4);
            }
            // Normal (float3, 12 octets)
            for (int c = 0; c < 3; ++c) {
                float val = (vi * 3 + static_cast<size_t>(c) < nrm.size())
                                ? nrm[vi * 3 + static_cast<size_t>(c)]
                                : 0.0f;
                std::memcpy(tmp, &val, 4);
                vertex_buffer.insert(vertex_buffer.end(), tmp, tmp + 4);
            }
            // UV0 (float2, 8 octets)
            for (int c = 0; c < 2; ++c) {
                float val = (vi * 2 + static_cast<size_t>(c) < uv.size())
                                ? uv[vi * 2 + static_cast<size_t>(c)]
                                : 0.0f;
                std::memcpy(tmp, &val, 4);
                vertex_buffer.insert(vertex_buffer.end(), tmp, tmp + 4);
            }
        }

        // Aligner le vertex buffer sur 4 octets
        while (vertex_buffer.size() % 4 != 0)
            vertex_buffer.push_back(0);

        info.index_buf_offset = static_cast<uint32_t>(index_buffer.size());

        // Ecrire les indices (u16)
        for (const auto& i : idx) {
            uint8_t tmp[2];
            if (i >= vert_count)
                return {};
            write_u16_le(tmp, static_cast<uint16_t>(i + total_vertices));
            index_buffer.insert(index_buffer.end(), tmp, tmp + 2);
        }
        total_vertices += info.vertex_count;
        total_indices += info.index_count;

        submesh_infos.push_back(info);
    }

    if ((data_start_aligned + vertex_buffer.size()) / 4 > UINT16_MAX)
        return {};
    // Taille totale du fichier
    const size_t total_size = data_start_aligned + vertex_buffer.size() + index_buffer.size();

    std::vector<uint8_t> output(total_size, 0);
    auto* p = output.data();

    // Match the 0xA0 header and 0x50 submesh records consumed by g4md_parse.
    write_u32_le(p + 0x00, G4MD_MAGIC_LE);
    write_u16_le(p + 0x04, static_cast<uint16_t>(G4MD_HEADER_SIZE));
    write_u16_le(p + 0x06, 1);
    write_u16_le(p + 0x20, static_cast<uint16_t>(mesh_count));
    write_u32_le(p + 0x50, total_vertices);
    write_u32_le(p + 0x54, total_indices);
    write_u32_le(p + 0x58, static_cast<uint32_t>(vertex_buffer.size()));
    write_u32_le(p + 0x5C, static_cast<uint32_t>(index_buffer.size()));
    write_u16_le(p + 0x60, static_cast<uint16_t>(G4MD_HEADER_SIZE / 4));

    for (size_t i = 0; i < mesh_count; ++i) {
        const auto& info = submesh_infos[i];
        auto* sm = p + G4MD_HEADER_SIZE + i * G4MD_SUBMESH_SIZE;
        // Identity affine transform (three rows of four floats).
        for (size_t diagonal : {0u, 5u, 10u})
            write_u32_le(sm + diagonal * 4, 0x3f800000);
        write_u32_le(sm + 0x30, info.vertex_count);
        write_u32_le(sm + 0x34, info.index_count);
        write_u32_le(sm + 0x38, 6);  // Triangle list, not a vertex attribute mask.
        write_u32_le(sm + 0x3C, info.index_buf_offset);
    }

    // ── Donnees vertex + index ─────────────────────────────────────
    std::memcpy(p + data_start_aligned, vertex_buffer.data(), vertex_buffer.size());
    std::memcpy(p + data_start_aligned + vertex_buffer.size(), index_buffer.data(),
                index_buffer.size());

    return output;
}

// ── import_glb ─────────────────────────────────────────────────────

std::optional<ModelImportResult> import_glb(const std::filesystem::path& glb_path,
                                            const ModelImportOptions& options) {
    if (!std::filesystem::exists(glb_path)) {
        spdlog::error("import_glb: fichier introuvable '{}'", glb_path.string());
        return std::nullopt;
    }

    // Charger le GLB via tinygltf
    tinygltf::Model model;
    tinygltf::TinyGLTF loader;
    std::string err, warn;

    bool ok = loader.LoadBinaryFromFile(&model, &err, &warn, glb_path.string());
    if (!warn.empty())
        spdlog::warn("import_glb: {}", warn);
    if (!ok) {
        spdlog::error("import_glb: echec du chargement '{}' — {}", glb_path.string(), err);
        return std::nullopt;
    }

    if (model.meshes.empty()) {
        spdlog::error("import_glb: aucun mesh dans le GLB");
        return std::nullopt;
    }

    // Extraire les donnees de chaque mesh/primitive
    std::vector<std::vector<float>> all_positions;
    std::vector<std::vector<float>> all_normals;
    std::vector<std::vector<float>> all_uvs;
    std::vector<std::vector<uint16_t>> all_indices;

    int total_vertices = 0;
    int total_indices = 0;

    for (const auto& mesh : model.meshes) {
        for (const auto& prim : mesh.primitives) {
            // Positions
            int pos_idx = -1;
            int norm_idx = -1;
            int uv_idx = -1;

            auto it = prim.attributes.find("POSITION");
            if (it != prim.attributes.end())
                pos_idx = it->second;

            it = prim.attributes.find("NORMAL");
            if (it != prim.attributes.end())
                norm_idx = it->second;

            it = prim.attributes.find("TEXCOORD_0");
            if (it != prim.attributes.end())
                uv_idx = it->second;

            if (pos_idx < 0) {
                spdlog::warn("import_glb: primitive sans POSITION, ignoree");
                continue;
            }

            auto positions = read_accessor_float(model, pos_idx, 3);
            auto normals = read_accessor_float(model, norm_idx, 3);
            auto uvs = read_accessor_float(model, uv_idx, 2);

            const size_t vert_count = positions.size() / 3;
            if (positions.empty() || (norm_idx >= 0 && normals.size() != positions.size()) ||
                (uv_idx >= 0 && uvs.size() != vert_count * 2) ||
                (prim.mode != -1 && prim.mode != TINYGLTF_MODE_TRIANGLES)) {
                spdlog::error("import_glb: unsupported or malformed vertex accessor/primitive");
                return std::nullopt;
            }

            // Generer des normales nulles si absentes
            if (normals.empty()) {
                normals.resize(vert_count * 3, 0.0f);
            }
            // Generer des UVs nulles si absentes
            if (uvs.empty()) {
                uvs.resize(vert_count * 2, 0.0f);
            }

            // Indices
            auto indices = read_indices_u16(model, prim.indices);
            if (prim.indices >= 0 && indices.empty())
                return std::nullopt;
            if (indices.empty()) {
                // Pas d'indices — generer un draw sequentiel
                indices.resize(vert_count);
                for (size_t i = 0; i < vert_count; ++i) {
                    indices[i] = static_cast<uint16_t>(i);
                }
            }

            if (indices.size() % 3 != 0)
                return std::nullopt;
            if (total_vertices > UINT16_MAX - vert_count)
                return std::nullopt;
            total_vertices += static_cast<int>(vert_count);
            total_indices += static_cast<int>(indices.size());

            all_positions.push_back(std::move(positions));
            all_normals.push_back(std::move(normals));
            all_uvs.push_back(std::move(uvs));
            all_indices.push_back(std::move(indices));
        }
    }

    if (all_positions.empty()) {
        spdlog::error("import_glb: aucune primitive valide");
        return std::nullopt;
    }

    spdlog::info("import_glb: {} primitive(s), {} vertices, {} indices", all_positions.size(),
                 total_vertices, total_indices);

    // Calculer content_size pour G4MG (approximation)
    const int content_size = total_vertices * 32 + total_indices * 2;

    ModelImportResult result;
    result.g4mg_data = serialize_g4mg(static_cast<int>(all_positions.size()),
                                      static_cast<int>(all_positions.size()), content_size);

    if (options.export_g4md) {
        result.g4md_data = serialize_g4md(all_positions, all_normals, all_uvs, all_indices);
        if (result.g4md_data.empty()) {
            spdlog::error("import_glb: geometry exceeds G4MD limits or contains invalid indices");
            return std::nullopt;
        }
    }

    return result;
}

#else  // !IECODE_HAS_TINYGLTF

std::optional<ModelImportResult> import_glb(const std::filesystem::path& /*glb_path*/,
                                            const ModelImportOptions& /*options*/) {
    spdlog::error("import_glb: tinygltf non disponible (recompiler avec feature render)");
    return std::nullopt;
}

#endif  // IECODE_HAS_TINYGLTF

// ── import_glb_to_g4mg ─────────────────────────────────────────────

bool import_glb_to_g4mg(const std::filesystem::path& glb_path,
                        const std::filesystem::path& g4mg_path,
                        const std::filesystem::path& g4md_path_in,
                        const ModelImportOptions& options) {
    auto result = import_glb(glb_path, options);
    if (!result)
        return false;

    // Creer les repertoires parents
    auto create_parent = [](const std::filesystem::path& p) {
        const auto parent = p.parent_path();
        if (!parent.empty()) {
            std::error_code ec;
            std::filesystem::create_directories(parent, ec);
        }
    };

    // Ecrire G4MG
    create_parent(g4mg_path);
    {
        std::ofstream out(g4mg_path, std::ios::binary);
        if (!out) {
            spdlog::error("import_glb_to_g4mg: impossible d'ouvrir '{}'", g4mg_path.string());
            return false;
        }
        out.write(reinterpret_cast<const char*>(result->g4mg_data.data()),
                  static_cast<std::streamsize>(result->g4mg_data.size()));
        if (!out.good())
            return false;
    }

    // Ecrire G4MD
    if (options.export_g4md && !result->g4md_data.empty()) {
        auto g4md_path = g4md_path_in;
        if (g4md_path.empty()) {
            g4md_path = g4mg_path;
            g4md_path.replace_extension(".g4md");
        }
        create_parent(g4md_path);
        std::ofstream out(g4md_path, std::ios::binary);
        if (!out) {
            spdlog::error("import_glb_to_g4mg: impossible d'ouvrir '{}'", g4md_path.string());
            return false;
        }
        out.write(reinterpret_cast<const char*>(result->g4md_data.data()),
                  static_cast<std::streamsize>(result->g4md_data.size()));
        if (!out.good())
            return false;

        spdlog::info("import_glb_to_g4mg: '{}' + '{}' crees", g4mg_path.string(),
                     g4md_path.string());
    } else {
        spdlog::info("import_glb_to_g4mg: '{}' cree", g4mg_path.string());
    }

    return true;
}

}  // namespace iecode::converters
