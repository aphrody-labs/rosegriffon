// Format: AFS2 (.awb) — CRI Audio Wave Bank
// Source: RE des samples réels (data/common/sound_asset/{ja,en}/*.awb)
//   ev48_*.awb : magic "AFS2", version 02, offset_size 04, align 0x20 @0x0C,
//   id table (id_size = offset_size) @0x10, offset table (count+1 entrées) ensuite,
//   blocs HCA concaténés alignés sur `align`. Validé : 10 blocs, tous magic "HCA\0".

using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;

namespace IECODE.Core.Formats.Criware;

/// <summary>
/// Entrée d'un AWB : un bloc audio brut (HCA ou ADX) référencé par son identifiant CRI.
/// </summary>
public readonly record struct AwbEntry(
    int Index,      // position dans la table (0..count-1)
    uint Id,        // identifiant CRI (lié au Waveform de l'ACB)
    long Offset,    // offset absolu (aligné) du bloc dans le fichier
    int Size        // taille du bloc en octets
);

/// <summary>
/// En-tête AFS2 décodé.
/// </summary>
public readonly record struct AwbHeader(
    byte Version,
    byte OffsetSize,   // largeur en octets des entrées des tables d'id/offset (2 ou 4)
    ushort Align,      // alignement des blocs de données
    ushort Subkey,     // sous-clé de chiffrement (0 = non chiffré)
    int EntryCount
);

/// <summary>
/// Lecteur AOT-compatible du format AFS2 (.awb). Extrait les blocs audio bruts (HCA/ADX).
/// </summary>
public static class AwbReader
{
    public const uint MAGIC = 0x32534641; // "AFS2" little-endian

    /// <summary>Vrai si les données commencent par le magic AFS2.</summary>
    public static bool IsAwb(ReadOnlySpan<byte> data)
        => data.Length >= 4 && BinaryPrimitives.ReadUInt32LittleEndian(data) == MAGIC;

    /// <summary>
    /// Parse l'en-tête AFS2.
    /// </summary>
    public static AwbHeader ParseHeader(ReadOnlySpan<byte> data)
    {
        if (!IsAwb(data))
            throw new InvalidDataException($"Magic AFS2 invalide: 0x{(data.Length >= 4 ? BinaryPrimitives.ReadUInt32LittleEndian(data) : 0):X8}");
        if (data.Length < 0x10)
            throw new InvalidDataException("AWB tronqué (en-tête < 16 octets)");

        byte version = data[0x04];
        byte offsetSize = data[0x05];
        ushort align = BinaryPrimitives.ReadUInt16LittleEndian(data[0x0C..0x0E]);
        ushort subkey = BinaryPrimitives.ReadUInt16LittleEndian(data[0x0E..0x10]);
        int count = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[0x08..0x0C]);

        // Garde-fous : offset_size doit valoir 2 ou 4, align ne peut être nul.
        if (offsetSize is not (2 or 4))
            throw new InvalidDataException($"AWB offset_size inattendu: {offsetSize}");
        if (align == 0) align = 0x20;
        if (count < 0 || count > 0x100000)
            throw new InvalidDataException($"AWB entry_count aberrant: {count}");

        return new AwbHeader(version, offsetSize, align, subkey, count);
    }

    /// <summary>
    /// Parse la table complète d'un AWB et retourne la liste des blocs (offset/taille).
    /// </summary>
    public static IReadOnlyList<AwbEntry> ParseEntries(ReadOnlySpan<byte> data)
    {
        var h = ParseHeader(data);
        int n = h.EntryCount;
        var entries = new AwbEntry[n];

        // Table d'identifiants : id_size = offset_size, démarre à 0x10.
        int idSize = h.OffsetSize;
        int idTablePos = 0x10;
        int offTablePos = idTablePos + n * idSize;

        // Table d'offsets : (count + 1) entrées de offset_size octets.
        // La dernière entrée marque la fin du dernier bloc (== EOF).
        static long ReadEntry(ReadOnlySpan<byte> d, int offsetSize, int pos, int p) =>
            offsetSize == 4
                ? BinaryPrimitives.ReadUInt32LittleEndian(d.Slice(pos + p * 4, 4))
                : BinaryPrimitives.ReadUInt16LittleEndian(d.Slice(pos + p * 2, 2));

        long Align(long v) => (v + h.Align - 1) / h.Align * h.Align;

        for (int i = 0; i < n; i++)
        {
            uint id = (uint)ReadEntry(data, h.OffsetSize, idTablePos, i);
            long rawStart = ReadEntry(data, h.OffsetSize, offTablePos, i);
            long rawEnd = ReadEntry(data, h.OffsetSize, offTablePos, i + 1);
            long start = Align(rawStart);
            // La fin n'est PAS alignée : c'est l'offset brut suivant.
            int size = (int)(rawEnd - start);
            if (size < 0) size = 0;
            entries[i] = new AwbEntry(i, id, start, size);
        }

        return entries;
    }

    /// <summary>
    /// Extrait le bloc audio brut (HCA/ADX) à l'index donné.
    /// </summary>
    public static byte[] ExtractBlock(ReadOnlySpan<byte> data, in AwbEntry entry)
        => data.Slice((int)entry.Offset, entry.Size).ToArray();

    /// <summary>
    /// Charge un AWB depuis le disque et retourne ses entrées.
    /// </summary>
    public static IReadOnlyList<AwbEntry> ParseFile(string path)
        => ParseEntries(File.ReadAllBytes(path));
}
