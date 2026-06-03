// Format: XPCK (.xc / .xi / embarqué) — archive Level-5 (conteneur de sous-fichiers).
// Source: Kuriimu2 Level5.Xpck layout (public).
//
// En-tête XPCK (little-endian). Disposition reprise fidèlement de Kuriimu2
// (plugin Level5, classe Xpck/XpckHeader) :
//
//   0x00  char[4]  magic            "XPCK" (0x4B435058 en LE)
//   0x04  u16      fileCountFlags   bits 0..11 = nombre de fichiers (& 0x0FFF) ;
//                                   bits 12..15 = flags (ignorés ici)
//   0x06  u16      fileInfoOffByte  offset packé de la table FILEINFO (>> stocké, << 2 pour octets)
//   0x08  u16      fileInfoSizeByte taille packée de la table FILEINFO (<< 2 pour octets)
//   0x0A  u16      filenameOffByte  offset packé de la table FILENAME (<< 2 pour octets)
//   0x0C  u16      filenameSizeByte taille packée de la table FILENAME (<< 2 pour octets)
//   0x0E  u16      dataOffByte      offset packé du blob DATA (<< 2 pour octets)
//   0x10  u16      dataSizeByte     taille packée du blob DATA (<< 2 pour octets)
//   0x12  u32      dataOffset       offset absolu du blob DATA (octets, redondant)
//   0x16  u32      dataSize         taille absolue du blob DATA (octets, redondant)
//
// Les champs « packés » (u16) sont multipliés par 4 (<< 2) pour retrouver la valeur
// en octets : Kuriimu2 stocke ces grandeurs divisées par 4 pour tenir sur 16 bits
// (les tables et le blob sont alignés sur 4 octets). Les champs absolus dataOffset/
// dataSize (u32) confirment l'emplacement du blob DATA.
//
// Table FILEINFO — un enregistrement de 12 octets par fichier :
//   0x00  u16  crc32         hash CRC32 du nom (Level-5)
//   0x02  u16  nameOffset    offset du nom (NUL-terminé) dans la table FILENAME
//   0x04  u32  fileOffset    offset du fichier, relatif au début du blob DATA
//   0x08  u32  fileSize      taille du fichier en octets
//
// Table FILENAME : chaîne de noms NUL-terminés (ASCII), indexée par nameOffset.

using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace IECODE.Core.Formats.Level5;

/// <summary>Une entrée d'archive XPCK : nom (si résoluble), position et taille dans le blob DATA.</summary>
public readonly record struct XpckEntry(
    string Name,
    ushort NameCrc32,
    ushort NameOffset,
    uint FileOffset,   // relatif au début du blob DATA
    uint FileSize
);

/// <summary>
/// Lecteur d'archive XPCK (conteneur Level-5). Lit l'en-tête, la table FILEINFO et la
/// table FILENAME, expose la liste des entrées et permet d'extraire les octets d'un fichier.
/// </summary>
public sealed class XpckParser
{
    /// <summary>Magic "XPCK" en little-endian (0x4B435058).</summary>
    public const uint MAGIC = 0x4B435058;

    /// <summary>Taille minimale de l'en-tête XPCK en octets.</summary>
    public const int HeaderSize = 0x1A;

    /// <summary>Taille d'un enregistrement FILEINFO en octets.</summary>
    public const int FileInfoEntrySize = 0x0C;

    private readonly byte[] _data;

    /// <summary>Nombre de fichiers déclarés (12 bits de poids faible de fileCountFlags).</summary>
    public int FileCount { get; }

    /// <summary>Offset absolu du blob DATA dans le fichier (octets).</summary>
    public uint DataOffset { get; }

    /// <summary>Taille absolue du blob DATA (octets).</summary>
    public uint DataSize { get; }

    /// <summary>Offset absolu de la table FILEINFO (octets).</summary>
    public uint FileInfoOffset { get; }

    /// <summary>Offset absolu de la table FILENAME (octets).</summary>
    public uint FilenameOffset { get; }

    /// <summary>Liste des entrées de l'archive.</summary>
    public IReadOnlyList<XpckEntry> Entries { get; }

    private XpckParser(
        byte[] data,
        int fileCount,
        uint dataOffset,
        uint dataSize,
        uint fileInfoOffset,
        uint filenameOffset,
        IReadOnlyList<XpckEntry> entries)
    {
        _data = data;
        FileCount = fileCount;
        DataOffset = dataOffset;
        DataSize = dataSize;
        FileInfoOffset = fileInfoOffset;
        FilenameOffset = filenameOffset;
        Entries = entries;
    }

    /// <summary>Teste la présence du magic "XPCK" en tête de buffer.</summary>
    public static bool IsXpck(ReadOnlySpan<byte> data)
        => data.Length >= 4 && BinaryPrimitives.ReadUInt32LittleEndian(data) == MAGIC;

    /// <summary>Parse une archive XPCK depuis un chemin de fichier.</summary>
    public static XpckParser Parse(string filePath)
        => Parse(File.ReadAllBytes(filePath));

    /// <summary>Parse une archive XPCK depuis ses octets bruts.</summary>
    public static XpckParser Parse(byte[] data)
    {
        if (data is null) throw new ArgumentNullException(nameof(data));

        var span = (ReadOnlySpan<byte>)data;
        if (span.Length < HeaderSize)
            throw new InvalidDataException($"Fichier XPCK trop court : {span.Length} octets (en-tête {HeaderSize})");

        if (!IsXpck(span))
            throw new InvalidDataException(
                $"Magic XPCK invalide : 0x{BinaryPrimitives.ReadUInt32LittleEndian(span):X8} (attendu 0x{MAGIC:X8})");

        ushort fileCountFlags = BinaryPrimitives.ReadUInt16LittleEndian(span[0x04..]);
        int fileCount = fileCountFlags & 0x0FFF;

        // Champs packés (u16, valeur en octets = champ << 2).
        uint fileInfoOffset = (uint)BinaryPrimitives.ReadUInt16LittleEndian(span[0x06..]) << 2;
        uint fileInfoSize = (uint)BinaryPrimitives.ReadUInt16LittleEndian(span[0x08..]) << 2;
        uint filenameOffset = (uint)BinaryPrimitives.ReadUInt16LittleEndian(span[0x0A..]) << 2;
        uint filenameSize = (uint)BinaryPrimitives.ReadUInt16LittleEndian(span[0x0C..]) << 2;
        // dataOff/dataSize packés (0x0E/0x10) redondants avec les u32 absolus ci-dessous.

        uint dataOffset = BinaryPrimitives.ReadUInt32LittleEndian(span[0x12..]);
        uint dataSize = BinaryPrimitives.ReadUInt32LittleEndian(span[0x16..]);

        if (fileInfoOffset + (uint)(fileCount * FileInfoEntrySize) > (uint)span.Length)
            throw new InvalidDataException(
                $"Table FILEINFO hors limites : offset 0x{fileInfoOffset:X} + {fileCount} entrées > {span.Length}");

        var entries = new List<XpckEntry>(fileCount);
        for (int i = 0; i < fileCount; i++)
        {
            int p = (int)fileInfoOffset + i * FileInfoEntrySize;
            ushort crc32 = BinaryPrimitives.ReadUInt16LittleEndian(span[p..]);
            ushort nameOffset = BinaryPrimitives.ReadUInt16LittleEndian(span[(p + 0x02)..]);
            uint fileOffset = BinaryPrimitives.ReadUInt32LittleEndian(span[(p + 0x04)..]);
            uint fileSize = BinaryPrimitives.ReadUInt32LittleEndian(span[(p + 0x08)..]);

            string name = ReadName(span, filenameOffset, filenameSize, nameOffset);
            entries.Add(new XpckEntry(name, crc32, nameOffset, fileOffset, fileSize));
        }

        return new XpckParser(data, fileCount, dataOffset, dataSize, fileInfoOffset, filenameOffset, entries);
    }

    /// <summary>
    /// Lit un nom NUL-terminé dans la table FILENAME. Renvoie une chaîne vide si
    /// l'offset sort des bornes de la table.
    /// </summary>
    private static string ReadName(ReadOnlySpan<byte> span, uint filenameOffset, uint filenameSize, ushort nameOffset)
    {
        long start = filenameOffset + nameOffset;
        if (start < 0 || start >= span.Length)
            return string.Empty;

        // Borne haute : fin de la table FILENAME (si connue), sinon fin du buffer.
        long tableEnd = filenameSize > 0 ? filenameOffset + filenameSize : span.Length;
        if (tableEnd > span.Length) tableEnd = span.Length;

        int end = (int)start;
        while (end < tableEnd && span[end] != 0)
            end++;

        return Encoding.ASCII.GetString(span[(int)start..end]);
    }

    /// <summary>Extrait les octets d'une entrée depuis le blob DATA.</summary>
    public byte[] Extract(XpckEntry entry)
    {
        long start = DataOffset + entry.FileOffset;
        long end = start + entry.FileSize;
        if (start < 0 || end > _data.Length)
            throw new InvalidDataException(
                $"Entrée '{entry.Name}' hors limites : [0x{start:X}..0x{end:X}] > {_data.Length}");

        var result = new byte[entry.FileSize];
        Array.Copy(_data, start, result, 0, entry.FileSize);
        return result;
    }

    /// <summary>Extrait les octets de l'entrée à l'index donné.</summary>
    public byte[] Extract(int index)
    {
        if (index < 0 || index >= Entries.Count)
            throw new ArgumentOutOfRangeException(nameof(index));
        return Extract(Entries[index]);
    }
}
