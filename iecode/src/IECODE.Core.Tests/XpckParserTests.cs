using System;
using System.Buffers.Binary;
using System.IO;
using System.Text;
using IECODE.Core.Formats.Level5;
using Xunit;

namespace IECODE.Core.Tests;

/// <summary>
/// Tests du parser XPCK (archive Level-5) contre des buffers SYNTHÉTIQUES construits
/// à la main : aucun fichier de jeu réel n'est présent sur cette machine. Les fixtures
/// reproduisent fidèlement la disposition d'en-tête implémentée (Kuriimu2 Level5.Xpck).
/// </summary>
public class XpckParserTests
{
    /// <summary>
    /// Construit une archive XPCK minimale valide : en-tête + table FILEINFO + table
    /// FILENAME + blob DATA. Les noms et contenus sont fournis par l'appelant.
    /// </summary>
    private static byte[] BuildXpck((string name, byte[] data)[] files)
    {
        // Disposition : [en-tête 0x1A] [FILEINFO] [FILENAME] [DATA], chaque section alignée sur 4.
        const int headerSize = 0x1A;

        int fileInfoOffset = Align4(headerSize);
        int fileInfoSize = files.Length * 12;

        int filenameOffset = Align4(fileInfoOffset + fileInfoSize);
        // Table de noms : chaque nom NUL-terminé, on note l'offset de chacun.
        var nameBytes = new System.Collections.Generic.List<byte>();
        var nameOffsets = new int[files.Length];
        for (int i = 0; i < files.Length; i++)
        {
            nameOffsets[i] = nameBytes.Count;
            nameBytes.AddRange(Encoding.ASCII.GetBytes(files[i].name));
            nameBytes.Add(0);
        }
        int filenameSize = nameBytes.Count;

        int dataOffset = Align4(filenameOffset + filenameSize);
        // Concatène les contenus dans le blob DATA, offsets relatifs au blob.
        var dataBytes = new System.Collections.Generic.List<byte>();
        var dataFileOffsets = new int[files.Length];
        for (int i = 0; i < files.Length; i++)
        {
            dataFileOffsets[i] = dataBytes.Count;
            dataBytes.AddRange(files[i].data);
        }
        int dataSize = dataBytes.Count;

        int total = dataOffset + dataSize;
        var buf = new byte[total];

        // En-tête.
        BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(0x00), XpckParser.MAGIC);
        BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan(0x04), (ushort)(files.Length & 0x0FFF));
        BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan(0x06), (ushort)(fileInfoOffset >> 2));
        BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan(0x08), (ushort)(fileInfoSize >> 2));
        BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan(0x0A), (ushort)(filenameOffset >> 2));
        BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan(0x0C), (ushort)(filenameSize >> 2));
        BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan(0x0E), (ushort)(dataOffset >> 2));
        BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan(0x10), (ushort)(dataSize >> 2));
        BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(0x12), (uint)dataOffset);
        BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(0x16), (uint)dataSize);

        // Table FILEINFO.
        for (int i = 0; i < files.Length; i++)
        {
            int p = fileInfoOffset + i * 12;
            BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan(p), (ushort)(0x1000 + i)); // crc32 factice
            BinaryPrimitives.WriteUInt16LittleEndian(buf.AsSpan(p + 0x02), (ushort)nameOffsets[i]);
            BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(p + 0x04), (uint)dataFileOffsets[i]);
            BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(p + 0x08), (uint)files[i].data.Length);
        }

        // Table FILENAME.
        nameBytes.CopyTo(buf, filenameOffset);

        // Blob DATA.
        dataBytes.CopyTo(buf, dataOffset);

        return buf;
    }

    private static int Align4(int v) => (v + 3) & ~3;

    [Fact]
    public void IsXpck_AcceptsAndRejectsMagic()
    {
        Assert.True(XpckParser.IsXpck(new byte[] { (byte)'X', (byte)'P', (byte)'C', (byte)'K', 0 }));
        Assert.False(XpckParser.IsXpck(new byte[] { (byte)'X', (byte)'P', (byte)'C', (byte)'X' }));
        Assert.False(XpckParser.IsXpck(new byte[] { 0x00, 0x01 })); // trop court
    }

    [Fact]
    public void Parse_ReadsHeaderAndEntries()
    {
        var files = new[]
        {
            ("a.bin", new byte[] { 0xDE, 0xAD, 0xBE, 0xEF }),
            ("longername.dat", new byte[] { 0x01, 0x02, 0x03 }),
        };
        var buf = BuildXpck(files);

        var xpck = XpckParser.Parse(buf);

        Assert.Equal(2, xpck.FileCount);
        Assert.Equal(2, xpck.Entries.Count);

        Assert.Equal("a.bin", xpck.Entries[0].Name);
        Assert.Equal((uint)4, xpck.Entries[0].FileSize);
        Assert.Equal((uint)0, xpck.Entries[0].FileOffset);

        Assert.Equal("longername.dat", xpck.Entries[1].Name);
        Assert.Equal((uint)3, xpck.Entries[1].FileSize);
        Assert.Equal((uint)4, xpck.Entries[1].FileOffset); // après les 4 octets du premier

        // Cohérence du blob DATA absolu.
        Assert.Equal((uint)7, xpck.DataSize);
        Assert.True(xpck.DataOffset >= XpckParser.HeaderSize);
    }

    [Fact]
    public void Extract_ReturnsExactFileBytes()
    {
        var first = new byte[] { 0xDE, 0xAD, 0xBE, 0xEF };
        var second = new byte[] { 0x01, 0x02, 0x03 };
        var buf = BuildXpck(new[] { ("a.bin", first), ("b.bin", second) });

        var xpck = XpckParser.Parse(buf);

        Assert.Equal(first, xpck.Extract(0));
        Assert.Equal(second, xpck.Extract(1));
        Assert.Equal(second, xpck.Extract(xpck.Entries[1]));
    }

    [Fact]
    public void Parse_RejectsBadMagic()
    {
        var buf = BuildXpck(new[] { ("a.bin", new byte[] { 0x00 }) });
        buf[0] = (byte)'Y'; // casse le magic
        Assert.Throws<InvalidDataException>(() => XpckParser.Parse(buf));
    }

    [Fact]
    public void Parse_RejectsTruncatedHeader()
    {
        Assert.Throws<InvalidDataException>(() => XpckParser.Parse(new byte[] { (byte)'X', (byte)'P', (byte)'C', (byte)'K' }));
    }

    [Fact]
    public void Parse_HandlesSingleFileArchive()
    {
        var payload = Encoding.ASCII.GetBytes("hello xpck");
        var buf = BuildXpck(new[] { ("solo.txt", payload) });

        var xpck = XpckParser.Parse(buf);

        Assert.Single(xpck.Entries);
        Assert.Equal("solo.txt", xpck.Entries[0].Name);
        Assert.Equal(payload, xpck.Extract(0));
    }
}
