// Format: XFSA (.fa / embarqué) — archive packée Level-5 (génération 3DS/Switch).
//   Magic ASCII "XFSA" (little-endian), en-tête 0x48 octets, puis trois tables
//   (folder hash table, file hash table, name table) et un bloc de données.
//   Les entrées référencent les noms par hash CRC32 ; offsets/tailles packés et
//   scalés (multipliés par 4) dans des champs bit-packés.
// Source: Kuriimu2 Level5 XFSA layout (public)
//   (plugin_level5 / Level5.Archive — X-Fsa / Xfsa). Champs marqués "// inféré"
//   lorsqu'ils ne sont pas formellement documentés mais déduits de la structure.

using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace IECODE.Core.Formats.Level5;

/// <summary>
/// En-tête XFSA (0x48 octets). Tous les champs sont little-endian.
/// Décrit l'emplacement et la taille des trois tables (dossiers, fichiers, noms)
/// ainsi que le décalage du bloc de données.
/// </summary>
public readonly record struct XfsaHeader(
    uint Magic,                 // 0x00 "XFSA" (0x41534658 en LE)
    uint HeaderSizeOrVersion,   // 0x04 taille d'en-tête / version (0x48 observé)
    uint FolderHashOffset,      // 0x08 offset de la table de hash des dossiers
    uint FolderHashCount,       // 0x0C nombre de dossiers
    uint FileHashOffset,        // 0x10 offset de la table de hash des fichiers
    uint FileHashCount,         // 0x14 nombre de fichiers
    uint NameOffset,            // 0x18 offset de la table des noms
    uint DataOffset             // 0x1C offset du bloc de données (// inféré : aligné)
);

/// <summary>
/// Entrée « dossier » de la table de hash des dossiers XFSA (0x10 octets).
/// </summary>
public readonly record struct XfsaFolderEntry(
    uint NameHash,        // 0x00 CRC32 du nom de dossier
    ushort FirstFileIndex,// 0x04 index de la première entrée fichier du dossier
    ushort FileCount,     // 0x06 nombre de fichiers dans le dossier
    uint FileHashStart,   // 0x08 (// inféré) base de hash des fichiers du dossier
    uint NameOffset       // 0x0C offset du nom dans la table des noms
);

/// <summary>
/// Entrée « fichier » de la table de hash des fichiers XFSA (0x10 octets).
/// Le champ « TmpName » bit-packé encode l'offset du nom (24 bits hauts) et le
/// haut de l'offset de données (8 bits bas). Offset/taille sont scalés ×4.
/// </summary>
public readonly record struct XfsaFileEntry(
    uint NameHashCrc32,   // 0x00 CRC32 du nom de fichier
    uint TmpName,         // 0x04 bit-packé : (nameOffset << 8) | (offset >> 32-bits hauts)
    uint TmpOffset,       // 0x08 bit-packé : offset bas (scalé ×4)
    uint TmpSize          // 0x0C bit-packé : (size << 5) | (offset middle bits)
);

/// <summary>
/// Entrée de fichier résolue et aplatie : nom (ou hash si non résolu), offset
/// absolu dans le bloc de données et taille en octets.
/// </summary>
public readonly record struct XfsaFile(
    string Name,          // nom résolu via la table des noms, sinon "0x{hash:X8}"
    uint NameHash,        // CRC32 du nom
    long Offset,          // offset absolu (DataOffset + offset packé scalé)
    long Size             // taille en octets
);

/// <summary>
/// Lecteur de l'archive Level-5 XFSA. Parse l'en-tête et les tables d'entrées,
/// expose la liste à plat des fichiers (nom résolu si possible, sinon hash) et
/// permet d'extraire les octets de chaque entrée.
/// </summary>
public sealed class XfsaParser
{
    /// <summary>Magic "XFSA" en little-endian (0x41534658).</summary>
    public const uint MAGIC = 0x41534658;

    /// <summary>Taille minimale d'en-tête XFSA (0x48 octets).</summary>
    public const int HEADER_SIZE = 0x48;

    private const int FOLDER_ENTRY_SIZE = 0x10;
    private const int FILE_ENTRY_SIZE = 0x10;

    // Source: Kuriimu2 Level5 XFSA — offset et taille sont stockés scalés (×4)
    //   pour permettre des archives > 4 Go avec des champs 32 bits.
    private const int OFFSET_SCALE = 4;

    private readonly byte[] _data;

    /// <summary>En-tête parsé.</summary>
    public XfsaHeader Header { get; }

    /// <summary>Entrées « dossier » brutes.</summary>
    public IReadOnlyList<XfsaFolderEntry> Folders { get; }

    /// <summary>Entrées « fichier » brutes (non résolues).</summary>
    public IReadOnlyList<XfsaFileEntry> FileEntries { get; }

    /// <summary>Fichiers à plat, résolus (nom/offset/taille).</summary>
    public IReadOnlyList<XfsaFile> Files { get; }

    /// <summary>Taille totale du conteneur.</summary>
    public long FileSize => _data.LongLength;

    private XfsaParser(
        byte[] data,
        XfsaHeader header,
        IReadOnlyList<XfsaFolderEntry> folders,
        IReadOnlyList<XfsaFileEntry> fileEntries,
        IReadOnlyList<XfsaFile> files)
    {
        _data = data;
        Header = header;
        Folders = folders;
        FileEntries = fileEntries;
        Files = files;
    }

    /// <summary>
    /// Vérifie la présence du magic "XFSA" en tête du buffer.
    /// </summary>
    public static bool IsXfsa(ReadOnlySpan<byte> data)
        => data.Length >= 4 && BinaryPrimitives.ReadUInt32LittleEndian(data) == MAGIC;

    /// <summary>Parse une archive XFSA depuis un chemin de fichier.</summary>
    public static XfsaParser Parse(string filePath)
        => Parse(File.ReadAllBytes(filePath));

    /// <summary>
    /// Parse une archive XFSA depuis un buffer complet en mémoire.
    /// </summary>
    public static XfsaParser Parse(byte[] data)
    {
        if (data is null) throw new ArgumentNullException(nameof(data));
        ReadOnlySpan<byte> span = data;

        if (span.Length < HEADER_SIZE)
            throw new InvalidDataException($"Archive XFSA trop courte : {span.Length} octets (min {HEADER_SIZE})");

        if (!IsXfsa(span))
            throw new InvalidDataException(
                $"Magic XFSA invalide : 0x{BinaryPrimitives.ReadUInt32LittleEndian(span):X8} (attendu 0x{MAGIC:X8})");

        var header = new XfsaHeader(
            Magic: BinaryPrimitives.ReadUInt32LittleEndian(span[0x00..]),
            HeaderSizeOrVersion: BinaryPrimitives.ReadUInt32LittleEndian(span[0x04..]),
            FolderHashOffset: BinaryPrimitives.ReadUInt32LittleEndian(span[0x08..]),
            FolderHashCount: BinaryPrimitives.ReadUInt32LittleEndian(span[0x0C..]),
            FileHashOffset: BinaryPrimitives.ReadUInt32LittleEndian(span[0x10..]),
            FileHashCount: BinaryPrimitives.ReadUInt32LittleEndian(span[0x14..]),
            NameOffset: BinaryPrimitives.ReadUInt32LittleEndian(span[0x18..]),
            DataOffset: BinaryPrimitives.ReadUInt32LittleEndian(span[0x1C..]));

        var folders = ReadFolders(span, header);
        var fileEntries = ReadFileEntries(span, header);
        var files = ResolveFiles(span, header, fileEntries);

        return new XfsaParser(data, header, folders, fileEntries, files);
    }

    private static List<XfsaFolderEntry> ReadFolders(ReadOnlySpan<byte> span, in XfsaHeader header)
    {
        var folders = new List<XfsaFolderEntry>();
        long baseOff = header.FolderHashOffset;
        for (uint i = 0; i < header.FolderHashCount; i++)
        {
            long off = baseOff + (long)i * FOLDER_ENTRY_SIZE;
            if (off + FOLDER_ENTRY_SIZE > span.Length)
                throw new InvalidDataException($"Entrée dossier {i} hors limites (offset 0x{off:X})");

            var e = span[(int)off..];
            folders.Add(new XfsaFolderEntry(
                NameHash: BinaryPrimitives.ReadUInt32LittleEndian(e[0x00..]),
                FirstFileIndex: BinaryPrimitives.ReadUInt16LittleEndian(e[0x04..]),
                FileCount: BinaryPrimitives.ReadUInt16LittleEndian(e[0x06..]),
                FileHashStart: BinaryPrimitives.ReadUInt32LittleEndian(e[0x08..]),
                NameOffset: BinaryPrimitives.ReadUInt32LittleEndian(e[0x0C..])));
        }
        return folders;
    }

    private static List<XfsaFileEntry> ReadFileEntries(ReadOnlySpan<byte> span, in XfsaHeader header)
    {
        var entries = new List<XfsaFileEntry>();
        long baseOff = header.FileHashOffset;
        for (uint i = 0; i < header.FileHashCount; i++)
        {
            long off = baseOff + (long)i * FILE_ENTRY_SIZE;
            if (off + FILE_ENTRY_SIZE > span.Length)
                throw new InvalidDataException($"Entrée fichier {i} hors limites (offset 0x{off:X})");

            var e = span[(int)off..];
            entries.Add(new XfsaFileEntry(
                NameHashCrc32: BinaryPrimitives.ReadUInt32LittleEndian(e[0x00..]),
                TmpName: BinaryPrimitives.ReadUInt32LittleEndian(e[0x04..]),
                TmpOffset: BinaryPrimitives.ReadUInt32LittleEndian(e[0x08..]),
                TmpSize: BinaryPrimitives.ReadUInt32LittleEndian(e[0x0C..])));
        }
        return entries;
    }

    private static List<XfsaFile> ResolveFiles(
        ReadOnlySpan<byte> span, in XfsaHeader header, IReadOnlyList<XfsaFileEntry> entries)
    {
        var files = new List<XfsaFile>(entries.Count);
        long nameTableBase = header.NameOffset;

        foreach (var e in entries)
        {
            // Source: Kuriimu2 Level5 XFSA — décodage des champs bit-packés.
            //   nameOffset      = TmpName >> 8                 (24 bits hauts)
            //   offset (scalé)  = ((TmpName & 0xFF) << 32) déplacé en pratique sur 32 bits :
            //                     on combine le bit haut de TmpName avec TmpOffset.
            //   size            = TmpSize >> 5                 (27 bits hauts)
            uint nameOffset = e.TmpName >> 8;

            // Offset packé : 8 bits hauts viennent du bas de TmpName, 24/32 bits de TmpOffset.
            // En pratique (archives < 4 Go) l'offset tient dans TmpOffset ; le bit haut de
            // TmpName étend la plage. On reconstruit puis on applique le scale ×4.
            long packedOffset = ((long)(e.TmpName & 0xFF) << 32) | e.TmpOffset; // // inféré (extension haute)
            long absoluteOffset = header.DataOffset + packedOffset * OFFSET_SCALE;

            long size = (long)(e.TmpSize >> 5); // 27 bits de taille

            string name = ReadName(span, nameTableBase + nameOffset, e.NameHashCrc32);

            files.Add(new XfsaFile(
                Name: name,
                NameHash: e.NameHashCrc32,
                Offset: absoluteOffset,
                Size: size));
        }
        return files;
    }

    /// <summary>
    /// Lit un nom NUL-terminé dans la table des noms. Retourne la forme
    /// hexadécimale du hash si l'offset est invalide ou le nom vide.
    /// </summary>
    private static string ReadName(ReadOnlySpan<byte> span, long nameAbsOffset, uint hash)
    {
        if (nameAbsOffset < 0 || nameAbsOffset >= span.Length)
            return $"0x{hash:X8}";

        int start = (int)nameAbsOffset;
        int end = start;
        while (end < span.Length && span[end] != 0) end++;
        if (end == start)
            return $"0x{hash:X8}";

        return Encoding.UTF8.GetString(span[start..end]);
    }

    /// <summary>
    /// Extrait les octets bruts d'une entrée fichier (par index dans <see cref="Files"/>).
    /// </summary>
    public ReadOnlyMemory<byte> Extract(int index)
    {
        if (index < 0 || index >= Files.Count)
            throw new ArgumentOutOfRangeException(nameof(index));
        return Extract(Files[index]);
    }

    /// <summary>
    /// Extrait les octets bruts correspondant à une entrée fichier résolue.
    /// </summary>
    public ReadOnlyMemory<byte> Extract(XfsaFile file)
    {
        if (file.Offset < 0 || file.Size < 0 || file.Offset + file.Size > _data.LongLength)
            throw new InvalidDataException(
                $"Entrée '{file.Name}' hors limites : offset 0x{file.Offset:X}, taille {file.Size}, archive {_data.LongLength}");
        return new ReadOnlyMemory<byte>(_data, (int)file.Offset, (int)file.Size);
    }

    /// <summary>
    /// Extrait tous les fichiers sous forme (nom, octets).
    /// </summary>
    public IEnumerable<(string Name, ReadOnlyMemory<byte> Data)> ExtractAll()
    {
        foreach (var f in Files)
            yield return (f.Name, Extract(f));
    }

    /// <summary>Résumé textuel de l'archive (diagnostic).</summary>
    public string GetSummary()
    {
        var sb = new StringBuilder();
        sb.AppendLine("XFSA Level-5 archive");
        sb.AppendLine($"  Magic       : XFSA (0x{Header.Magic:X8})");
        sb.AppendLine($"  Header/Ver  : 0x{Header.HeaderSizeOrVersion:X8}");
        sb.AppendLine($"  Folders     : {Header.FolderHashCount} @0x{Header.FolderHashOffset:X}");
        sb.AppendLine($"  Files       : {Header.FileHashCount} @0x{Header.FileHashOffset:X}");
        sb.AppendLine($"  NameTable   : @0x{Header.NameOffset:X}");
        sb.AppendLine($"  DataOffset  : @0x{Header.DataOffset:X}");
        sb.AppendLine($"  FileSize    : {FileSize}");
        foreach (var f in Files)
            sb.AppendLine($"    {f.Name}  off=0x{f.Offset:X}  size={f.Size}  hash=0x{f.NameHash:X8}");
        return sb.ToString();
    }
}
