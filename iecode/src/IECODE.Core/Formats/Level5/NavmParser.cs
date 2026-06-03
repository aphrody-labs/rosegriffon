using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;

namespace IECODE.Core.Formats.Level5;

/// <summary>
/// Parser pour le format G4NV (extension .g4nv) — navigation mesh Level-5.
///
/// Le magic réel n'est PAS "G4NV" mais "NAVM" (0x4E41564D), suivi d'un en-tête
/// Level-5 standard de type cfg.bin/T2B (headerSize u16 + typeId u16) puis d'une
/// table de comptes/offsets de sections, et enfin des données du maillage de
/// navigation (nœuds, arêtes, polygones, liens de connectivité).
///
/// Structure validée sur s28g001b.g4nv (4640 octets) :
///   0x00  char[4]  magic         "NAVM"
///   0x04  u16      headerSize    0x0060 (96)
///   0x06  u16      typeId        0x0066
///   0x08  u16      reserved0     0x0000
///   0x0A  u16      align         0x0018 (24)
///   0x0C  u32      dataSize      0x000011C0 (offset de fin de section données)
///   0x10  u8[16]   padding (zéros)
///   0x20  u32[5]   sectionCounts  {120, 102, 30, 40, 51}
///   ...   données du navmesh (arrays d'indices u32)
/// </summary>
public sealed class NavmParser
{
    /// <summary>Magic "NAVM" en little-endian.</summary>
    public const uint MAGIC = 0x4D56414E;

    public struct NavmHeader
    {
        public uint Magic;
        public ushort HeaderSize;
        public ushort TypeId;
        public ushort Reserved0;
        public ushort Align;
        public uint DataSize;
    }

    public NavmHeader Header { get; private set; }

    /// <summary>
    /// Table de comptes/offsets de sections lue à partir de l'offset 0x20.
    /// Pour s28g001b : {120, 102, 30, 40, 51}.
    /// </summary>
    public IReadOnlyList<uint> SectionCounts { get; private set; } = Array.Empty<uint>();

    /// <summary>Taille totale du fichier en octets.</summary>
    public long FileSize { get; private set; }

    public static bool IsNavm(ReadOnlySpan<byte> data)
        => data.Length >= 4 && BinaryPrimitives.ReadUInt32LittleEndian(data) == MAGIC;

    public static NavmParser Parse(string filePath)
    {
        var data = File.ReadAllBytes(filePath);
        return Parse(data);
    }

    public static NavmParser Parse(ReadOnlySpan<byte> span)
    {
        if (span.Length < 0x20)
            throw new InvalidDataException($"Fichier G4NV trop court : {span.Length} octets");

        if (!IsNavm(span))
            throw new InvalidDataException(
                $"Magic G4NV/NAVM invalide : 0x{BinaryPrimitives.ReadUInt32LittleEndian(span):X8} (attendu 0x{MAGIC:X8})");

        var parser = new NavmParser { FileSize = span.Length };

        var header = new NavmHeader
        {
            Magic = BinaryPrimitives.ReadUInt32LittleEndian(span[0..]),
            HeaderSize = BinaryPrimitives.ReadUInt16LittleEndian(span[4..]),
            TypeId = BinaryPrimitives.ReadUInt16LittleEndian(span[6..]),
            Reserved0 = BinaryPrimitives.ReadUInt16LittleEndian(span[8..]),
            Align = BinaryPrimitives.ReadUInt16LittleEndian(span[10..]),
            DataSize = BinaryPrimitives.ReadUInt32LittleEndian(span[12..]),
        };
        parser.Header = header;

        // Table de sections à 0x20 : 5 u32 connus (nœuds, arêtes, polys, liens, ...).
        const int sectionTableOffset = 0x20;
        const int sectionCount = 5;
        var counts = new uint[sectionCount];
        for (int i = 0; i < sectionCount; i++)
        {
            int off = sectionTableOffset + i * 4;
            if (off + 4 <= span.Length)
                counts[i] = BinaryPrimitives.ReadUInt32LittleEndian(span[off..]);
        }
        parser.SectionCounts = counts;

        return parser;
    }

    /// <summary>Nombre de nœuds (1ère entrée de la table de sections).</summary>
    public uint NodeCount => SectionCounts.Count > 0 ? SectionCounts[0] : 0;

    /// <summary>Nombre d'arêtes/liens (2e entrée de la table de sections).</summary>
    public uint EdgeCount => SectionCounts.Count > 1 ? SectionCounts[1] : 0;

    public string GetSummary()
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"G4NV (NAVM) navigation mesh");
        sb.AppendLine($"  Magic       : NAVM (0x{Header.Magic:X8})");
        sb.AppendLine($"  HeaderSize  : {Header.HeaderSize} (0x{Header.HeaderSize:X})");
        sb.AppendLine($"  TypeId      : 0x{Header.TypeId:X4}");
        sb.AppendLine($"  Align       : {Header.Align}");
        sb.AppendLine($"  DataSize    : {Header.DataSize} (0x{Header.DataSize:X})");
        sb.AppendLine($"  FileSize    : {FileSize}");
        sb.Append("  Sections    : [");
        for (int i = 0; i < SectionCounts.Count; i++)
        {
            if (i > 0) sb.Append(", ");
            sb.Append(SectionCounts[i]);
        }
        sb.AppendLine("]");
        sb.AppendLine($"  Nodes (est.): {NodeCount}");
        sb.AppendLine($"  Edges (est.): {EdgeCount}");
        return sb.ToString();
    }
}
