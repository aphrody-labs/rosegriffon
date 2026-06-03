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
        int stride = G4mgParser.GetVertexStride(mesh.Format);
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
    {
        int stride = G4mgParser.GetVertexStride(format);
        int count = stride > 0 ? vertexData.Length / stride : 0;
        var result = new G4mgParser.Vertex[count];

        for (int i = 0; i < count; i++)
        {
            var s = vertexData.Slice(i * stride, stride);

            float px = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s));
            float py = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s[4..]));
            float pz = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s[8..]));

            float nx = 0f, ny = 0f, nz = 1f;
            int off = 12;

            if (format.HasFlag(G4mgParser.VertexFormat.Normal))
            {
                nx = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s[off..]));
                ny = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s[(off + 4)..]));
                nz = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s[(off + 8)..]));

                float lenSq = nx * nx + ny * ny + nz * nz;
                if (lenSq < 1e-6f) { nx = 0; ny = 0; nz = 1; }
                else { float l = MathF.Sqrt(lenSq); nx /= l; ny /= l; nz /= l; }

                off += 12;
            }

            float u = 0f, v = 0f;
            if (format.HasFlag(G4mgParser.VertexFormat.UV0))
            {
                u = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s[off..]));
                v = Sanitize(BinaryPrimitives.ReadSingleLittleEndian(s[(off + 4)..]));
            }

            result[i] = new G4mgParser.Vertex(px, py, pz, nx, ny, nz, u, v);
        }

        return result;
    }

    public static ushort[] ParseIndices(ReadOnlySpan<byte> indexData)
        => MemoryMarshal.Cast<byte, ushort>(indexData).ToArray();

    private static float Sanitize(float f) => float.IsFinite(f) ? f : 0f;
}
