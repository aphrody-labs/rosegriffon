using System;
using System.Buffers.Binary;
using System.IO;
using System.Runtime.InteropServices;
using IECODE.Core.Logging;

namespace IECODE.Core.Formats.Level5;

/// <summary>
/// Reader for G4MG vertex and index buffers.
/// All overloads share a single Stream-based implementation to avoid re-opening files.
/// </summary>
public static class G4mgReader
{
    // -------------------------------------------------------------------------
    // Vertex buffer
    // -------------------------------------------------------------------------

    public static byte[] ReadVertexBuffer(string filePath, G4mgParser.MeshEntry mesh)
    {
        using var fs = File.OpenRead(filePath);
        return ReadVertexBuffer(fs, mesh);
    }

    public static byte[] ReadVertexBuffer(Stream stream, G4mgParser.MeshEntry mesh)
    {
        // Stride réel dérivé du .g4md (jamais codé en dur) ; repli sur la table de format hérité.
        int stride = mesh.VertexStride > 0 ? mesh.VertexStride : G4mgParser.GetVertexStride(mesh.Format);
        int bufferSize = mesh.VertexCount * stride;

        if (mesh.VertexBufferOffset + bufferSize > stream.Length)
            LogService.Instance.Warn("G4mgReader",
                $"Vertex buffer out of bounds for '{mesh.Name}': end=0x{mesh.VertexBufferOffset + bufferSize:X} > length=0x{stream.Length:X}");

        var buffer = new byte[Math.Min(bufferSize, (int)(stream.Length - mesh.VertexBufferOffset))];
        stream.Seek(mesh.VertexBufferOffset, SeekOrigin.Begin);
        _ = stream.Read(buffer, 0, buffer.Length);
        return buffer;
    }

    // -------------------------------------------------------------------------
    // Index buffer
    // -------------------------------------------------------------------------

    public static byte[] ReadIndexBuffer(string filePath, G4mgParser.MeshEntry mesh)
    {
        using var fs = File.OpenRead(filePath);
        return ReadIndexBuffer(fs, mesh);
    }

    public static byte[] ReadIndexBuffer(Stream stream, G4mgParser.MeshEntry mesh)
    {
        int bufferSize = mesh.IndexCount * sizeof(ushort);

        if (mesh.IndexBufferOffset + bufferSize > stream.Length)
            LogService.Instance.Warn("G4mgReader",
                $"Index buffer out of bounds for '{mesh.Name}': end=0x{mesh.IndexBufferOffset + bufferSize:X} > length=0x{stream.Length:X}");

        var buffer = new byte[Math.Min(bufferSize, (int)(stream.Length - mesh.IndexBufferOffset))];
        stream.Seek(mesh.IndexBufferOffset, SeekOrigin.Begin);
        _ = stream.Read(buffer, 0, buffer.Length);
        return buffer;
    }

    // -------------------------------------------------------------------------
    // Parsing
    // -------------------------------------------------------------------------

    public static G4mgParser.Vertex[] ParseVertices(ReadOnlySpan<byte> vertexData, G4mgParser.VertexFormat format)
        => ParseVertices(vertexData, G4mgParser.GetVertexStride(format));

    /// <summary>
    /// Décode les vertices à partir d'un stride explicite (dérivé du .g4md). Seule la position
    /// (float3 à +0 de chaque vertex) est décodée — confirmée sur fichiers réels. La normale et
    /// l'UV du tail sont packées (SNORM16) et NON fabriquées ici : normale par défaut (0,0,1),
    /// UV (0,0). On expose seulement ce qu'on peut vérifier.
    /// </summary>
    public static G4mgParser.Vertex[] ParseVertices(ReadOnlySpan<byte> vertexData, int stride)
    {
        int count = stride >= 12 ? vertexData.Length / stride : 0;
        var result = new G4mgParser.Vertex[count];

        for (int i = 0; i < count; i++)
        {
            var s = vertexData.Slice(i * stride, stride);

            float px = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s));
            float py = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s[4..]));
            float pz = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s[8..]));

            // Normale/UV packées SNORM16 dans le tail : non décodées (valeurs non fabriquées).
            result[i] = new G4mgParser.Vertex(px, py, pz, 0f, 0f, 1f, 0f, 0f);
        }

        return result;
    }

    public static ushort[] ParseIndices(ReadOnlySpan<byte> indexData)
        => MemoryMarshal.Cast<byte, ushort>(indexData).ToArray();

    private static float Sanitize(float f) => float.IsFinite(f) ? f : 0f;
}
