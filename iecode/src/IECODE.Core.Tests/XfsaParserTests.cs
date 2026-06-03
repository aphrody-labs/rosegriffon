using System;
using System.Buffers.Binary;
using System.Linq;
using System.Text;
using IECODE.Core.Formats.Level5;
using Xunit;

namespace IECODE.Core.Tests;

/// <summary>
/// Tests du parser XFSA (archive packée Level-5) contre des buffers SYNTHÉTIQUES
/// construits à la main qui reproduisent l'en-tête et les tables implémentés.
/// Aucun fichier de jeu réel n'est requis.
/// </summary>
public class XfsaParserTests
{
    private const int HeaderSize = 0x48;
    private const int FolderEntrySize = 0x10;
    private const int FileEntrySize = 0x10;
    private const int OffsetScale = 4;

    /// <summary>
    /// Construit une archive XFSA synthétique d'un seul dossier et deux fichiers
    /// ("a.bin" et "b.bin") avec des charges utiles distinctes.
    /// </summary>
    private static byte[] BuildArchive(out long[] expectedOffsets, out long[] expectedSizes, out string[] names)
    {
        names = new[] { "a.bin", "b.bin" };

        // Charges utiles.
        byte[] payloadA = Enumerable.Repeat((byte)0xAA, 8).ToArray();
        byte[] payloadB = Enumerable.Repeat((byte)0xBB, 12).ToArray();

        // Disposition : header | folder table | file table | name table | data.
        uint folderOff = HeaderSize;
        uint folderCount = 1;
        uint fileOff = folderOff + folderCount * FolderEntrySize;
        uint fileCount = 2;
        uint nameOff = fileOff + fileCount * FileEntrySize;

        // Table des noms : NUL-terminés.
        var nameBytes = new System.Collections.Generic.List<byte>();
        int nameOffA = nameBytes.Count;
        nameBytes.AddRange(Encoding.UTF8.GetBytes(names[0])); nameBytes.Add(0);
        int nameOffB = nameBytes.Count;
        nameBytes.AddRange(Encoding.UTF8.GetBytes(names[1])); nameBytes.Add(0);
        // Nom du dossier (racine vide).
        int folderNameOff = nameBytes.Count;
        nameBytes.Add(0);

        // Aligne le début des données sur 4.
        uint dataOff = (uint)(nameOff + nameBytes.Count);
        dataOff = (dataOff + 3u) & ~3u;

        // Offsets packés (scalés ×4) RELATIFS à dataOff.
        // packedOffset = absoluteRelative / OffsetScale.
        long absRelA = 0;                      // premier fichier au début du bloc data
        long absRelB = ((absRelA + payloadA.Length) + 3) & ~3; // aligné 4
        uint packedOffA = (uint)(absRelA / OffsetScale);
        uint packedOffB = (uint)(absRelB / OffsetScale);

        expectedOffsets = new long[] { dataOff + absRelA, dataOff + absRelB };
        expectedSizes = new long[] { payloadA.Length, payloadB.Length };

        uint totalSize = (uint)(dataOff + absRelB + payloadB.Length);
        var buf = new byte[totalSize];

        // En-tête.
        WriteU32(buf, 0x00, XfsaParser.MAGIC);
        WriteU32(buf, 0x04, (uint)HeaderSize);
        WriteU32(buf, 0x08, folderOff);
        WriteU32(buf, 0x0C, folderCount);
        WriteU32(buf, 0x10, fileOff);
        WriteU32(buf, 0x14, fileCount);
        WriteU32(buf, 0x18, nameOff);
        WriteU32(buf, 0x1C, dataOff);

        // Entrée dossier.
        WriteU32(buf, (int)folderOff + 0x00, Crc32("")); // hash du nom racine
        BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan((int)folderOff + 0x04), 0); // FirstFileIndex
        BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan((int)folderOff + 0x06), 2); // FileCount
        WriteU32(buf, (int)folderOff + 0x08, 0);
        WriteU32(buf, (int)folderOff + 0x0C, (uint)folderNameOff);

        // Entrées fichier. TmpName = (nameOffset << 8) | topByte(0).
        WriteFileEntry(buf, (int)fileOff + 0 * FileEntrySize, Crc32(names[0]), (uint)nameOffA, packedOffA, (uint)payloadA.Length);
        WriteFileEntry(buf, (int)fileOff + 1 * FileEntrySize, Crc32(names[1]), (uint)nameOffB, packedOffB, (uint)payloadB.Length);

        // Table des noms.
        nameBytes.CopyTo(buf, (int)nameOff);

        // Données.
        payloadA.CopyTo(buf, (int)(dataOff + absRelA));
        payloadB.CopyTo(buf, (int)(dataOff + absRelB));

        return buf;
    }

    private static void WriteFileEntry(byte[] buf, int at, uint hash, uint nameOffset, uint packedOffset, uint size)
    {
        WriteU32(buf, at + 0x00, hash);
        WriteU32(buf, at + 0x04, nameOffset << 8);   // top byte = 0 -> packedOffset = TmpOffset
        WriteU32(buf, at + 0x08, packedOffset);
        WriteU32(buf, at + 0x0C, size << 5);         // size occupe les 27 bits hauts
    }

    private static void WriteU32(byte[] buf, int at, uint value)
        => BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(at), value);

    /// <summary>CRC32 standard (polynôme 0xEDB88320) — utilisé pour les hash de noms XFSA.</summary>
    private static uint Crc32(string s)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(s);
        uint crc = 0xFFFFFFFF;
        foreach (byte b in bytes)
        {
            crc ^= b;
            for (int i = 0; i < 8; i++)
                crc = (crc >> 1) ^ (0xEDB88320u & (uint)(-(crc & 1)));
        }
        return ~crc;
    }

    [Fact]
    public void IsXfsa_AcceptsMagic_RejectsOthers()
    {
        Assert.True(XfsaParser.IsXfsa(new byte[] { (byte)'X', (byte)'F', (byte)'S', (byte)'A', 0, 0 }));
        Assert.False(XfsaParser.IsXfsa(new byte[] { (byte)'X', (byte)'P', (byte)'C', (byte)'K' }));
        Assert.False(XfsaParser.IsXfsa(new byte[] { 0x00, 0x01 }));
    }

    [Fact]
    public void Parse_ReadsHeaderAndCounts()
    {
        var buf = BuildArchive(out var offs, out var sizes, out var names);
        var arc = XfsaParser.Parse(buf);

        Assert.Equal(XfsaParser.MAGIC, arc.Header.Magic);
        Assert.Equal((uint)HeaderSize, arc.Header.HeaderSizeOrVersion);
        Assert.Equal(1u, arc.Header.FolderHashCount);
        Assert.Equal(2u, arc.Header.FileHashCount);
        Assert.Single(arc.Folders);
        Assert.Equal(2, arc.Files.Count);
    }

    [Fact]
    public void Parse_ResolvesNamesOffsetsAndSizes()
    {
        var buf = BuildArchive(out var offs, out var sizes, out var names);
        var arc = XfsaParser.Parse(buf);

        for (int i = 0; i < 2; i++)
        {
            Assert.Equal(names[i], arc.Files[i].Name);
            Assert.Equal(offs[i], arc.Files[i].Offset);
            Assert.Equal(sizes[i], arc.Files[i].Size);
            Assert.Equal(Crc32(names[i]), arc.Files[i].NameHash);
        }
    }

    [Fact]
    public void Extract_ReturnsCorrectBytes()
    {
        var buf = BuildArchive(out var offs, out var sizes, out var names);
        var arc = XfsaParser.Parse(buf);

        var a = arc.Extract(0).ToArray();
        Assert.Equal(8, a.Length);
        Assert.All(a, b => Assert.Equal(0xAA, b));

        var b = arc.Extract(1).ToArray();
        Assert.Equal(12, b.Length);
        Assert.All(b, x => Assert.Equal(0xBB, x));

        var all = arc.ExtractAll().ToList();
        Assert.Equal(2, all.Count);
        Assert.Equal("a.bin", all[0].Name);
    }

    [Fact]
    public void Parse_RejectsBadMagic()
    {
        var bad = new byte[XfsaParser.HEADER_SIZE];
        BinaryPrimitives.WriteUInt32LittleEndian(bad, 0xDEADBEEF);
        Assert.Throws<System.IO.InvalidDataException>(() => XfsaParser.Parse(bad));
    }
}
