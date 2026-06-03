using System.Buffers.Binary;
using System.Runtime.InteropServices;

namespace IECODE.Core.Formats.Level5;

/// <summary>
/// Parser pour la géométrie G4MG (Level-5 Mesh Geometry) d'Inazuma Eleven Victory Road.
///
/// IMPORTANT — les .g4mg réels sont SANS EN-TÊTE : aucun magic « G4MG », pas de header
/// de 64 octets. L'offset 0 est directement de la donnée vertex (float, ex. 0x3F800000 = 1.0f).
/// TOUTES les métadonnées géométriques (offsets/comptes des buffers vertex et index, stride,
/// table d'attributs, table des sous-mailles) vivent dans le fichier compagnon .g4md de
/// même basename. On ne peut donc PAS décoder un .g4mg seul — il faut le .g4md associé.
///
/// Référence : loader Noesis inazuma_switch.py (AFGRocha), seul loader IEVR public, recoupé
/// octet par octet sur des fichiers réels (chr/_uniform, chr/_face, menu).
/// </summary>
public static class G4mgParser
{
    // Structs de base pour vecteurs
    public readonly record struct Vector2(float X, float Y);
    public readonly record struct Vector3(float X, float Y, float Z);

    /// <summary>
    /// Entrée de mesh décrivant une sous-maille extraite (compatibilité ascendante avec
    /// les convertisseurs GLB existants). Les offsets/comptes sont dérivés du .g4md, jamais devinés.
    /// </summary>
    public sealed class MeshEntry
    {
        public required string Name { get; init; }
        public required int VertexCount { get; init; }
        public required int IndexCount { get; init; }
        public required int VertexBufferOffset { get; init; }
        public required int IndexBufferOffset { get; init; }
        public required int MaterialIndex { get; init; }
        public required VertexFormat Format { get; init; }
        public uint RawFormat { get; init; }

        /// <summary>Pas du vertex en octets, dérivé du .g4md (jamais codé en dur).</summary>
        public int VertexStride { get; init; }

        // Bounding box
        public Vector3 BBoxMin { get; init; }
        public Vector3 BBoxMax { get; init; }
    }

    /// <summary>
    /// Format de vertex (indicatif). Le décodage réel se fait via le stride et la table
    /// d'attributs du .g4md ; ces flags servent seulement aux convertisseurs hérités.
    /// </summary>
    [Flags]
    public enum VertexFormat : uint
    {
        None = 0,
        Position = 0x00000001,      // float3 (12 bytes)
        Normal = 0x00000008,        // float3 (12 bytes)
        UV0 = 0x00000010,           // float2 (8 bytes)
        UV1 = 0x00000020,           // float2 (8 bytes)
        Color = 0x00000040,         // byte4 (4 bytes)
        BoneWeights = 0x00000002,   // byte4 (4 bytes)
        BoneIndices = 0x00000004,   // byte4 (4 bytes)
        Tangent = 0x00000080,       // float3 (12 bytes)
        Binormal = 0x00000100,      // float3 (12 bytes)

        Static = Position | Normal | UV0,
        Skinned = Position | Normal | UV0 | BoneWeights | BoneIndices,
        Full = Position | Normal | UV0 | UV1 | Tangent | Binormal,
        Level5_24Byte = 0x10000000,
    }

    /// <summary>
    /// Vertex « statique » historique (position float3 + normale float3 + UV float2 = 32 octets).
    /// Conservé pour les convertisseurs existants ; le décodage réel passe par le stride du .g4md.
    /// </summary>
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public readonly struct Vertex
    {
        public readonly float PositionX;
        public readonly float PositionY;
        public readonly float PositionZ;
        public readonly float NormalX;
        public readonly float NormalY;
        public readonly float NormalZ;
        public readonly float U;
        public readonly float V;

        public Vertex(float px, float py, float pz, float nx, float ny, float nz, float u, float v)
        {
            PositionX = px; PositionY = py; PositionZ = pz;
            NormalX = nx; NormalY = ny; NormalZ = nz;
            U = u; V = v;
        }

        public Vector3 Position => new(PositionX, PositionY, PositionZ);
        public Vector3 Normal => new(NormalX, NormalY, NormalZ);
        public Vector2 UV => new(U, V);
    }

    /// <summary>Vertex avec skinning (40 octets), conservé pour les convertisseurs hérités.</summary>
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public readonly struct SkinnedVertex
    {
        public readonly Vertex BaseVertex;
        public readonly byte Weight0;
        public readonly byte Weight1;
        public readonly byte Weight2;
        public readonly byte Weight3;
        public readonly byte BoneIndex0;
        public readonly byte BoneIndex1;
        public readonly byte BoneIndex2;
        public readonly byte BoneIndex3;
    }

    /// <summary>
    /// Attribut de vertex tel que décrit dans la table d'attributs du .g4md (8 octets) :
    /// vtype (1=position, 2=normale, 8=couleur, 10=UV…), offset dans le vertex, datatype
    /// (2/3=float, 12=ubyte, 14=ushort, 18/20=short). Exposé brut — on ne fabrique pas de
    /// valeurs décodées qu'on ne peut pas vérifier (normales/UV packées SNORM16, etc.).
    /// </summary>
    public readonly record struct VertexAttribute(byte VType, int Offset, uint DataType);

    /// <summary>
    /// Géométrie réelle d'une sous-maille extraite d'un .g4mg piloté par le .g4md.
    /// Seules les positions (float3 à +0 de chaque vertex) et les indices sont décodés —
    /// confirmé sur fichiers réels. La table d'attributs est exposée brute pour le tail
    /// packé (normale/UV SNORM16) sans inventer de valeurs.
    /// </summary>
    public sealed class SubmeshGeometry
    {
        public required string Name { get; init; }
        public required int VertexCount { get; init; }
        public required int VertexStride { get; init; }
        public required int VertexBufferOffset { get; init; }
        public required int IndexBufferOffset { get; init; }
        public required bool Index32 { get; init; }
        public required int MaterialIndex { get; init; }

        /// <summary>Positions décodées (float3 à +0 de chaque vertex stride-aligné).</summary>
        public required IReadOnlyList<Vector3> Positions { get; init; }

        /// <summary>Indices locaux à la sous-maille (u16 ou u32 selon la règle &gt; 65535).</summary>
        public required IReadOnlyList<uint> Indices { get; init; }

        /// <summary>Attributs bruts du layout vertex (peut être vide si non résoluble).</summary>
        public required IReadOnlyList<VertexAttribute> Attributes { get; init; }
    }

    /// <summary>
    /// Extrait la géométrie réelle d'un .g4mg headerless en se servant de la table des
    /// sous-mailles déjà parsée d'un .g4md compagnon. Pour chaque sous-maille on lit :
    /// - les positions : float3 à l'offset 0 de chaque vertex (stride dérivé du .g4md) ;
    /// - les indices : u16 par défaut, u32 si VertexCount &gt; 65535 (règle confirmée).
    /// Les offsets de vertex/index sont des offsets OCTETS ; les indices sont LOCAUX à la
    /// sous-maille (base 0 par sous-maille, vérifié sur chr/_uniform et chr/_face réels).
    /// </summary>
    /// <param name="g4mgData">Octets bruts du .g4mg (sans en-tête).</param>
    /// <param name="g4md">Parser .g4md déjà chargé (Submeshes + FaceDataBase requis).</param>
    public static List<SubmeshGeometry> ExtractGeometry(ReadOnlySpan<byte> g4mgData, G4mdParser g4md)
    {
        ArgumentNullException.ThrowIfNull(g4md);

        var attributes = ReadVertexAttributes(g4md);
        int faceDataBase = (int)g4md.Header.FaceDataBase;

        // Stride : préférer le champ +0x2E de la sous-maille ; sinon le dériver du layout
        // global (région vertex = [0, faceDataBase) divisée par le nombre total de vertices).
        int totalVerts = 0;
        foreach (var sm in g4md.Submeshes)
            totalVerts += sm.VertexCount;
        int derivedStride = (faceDataBase > 0 && totalVerts > 0) ? faceDataBase / totalVerts : 0;

        var result = new List<SubmeshGeometry>(g4md.Submeshes.Count);

        foreach (var sm in g4md.Submeshes)
        {
            if (sm.VertexCount <= 0)
                continue;

            int stride = sm.VertexStride > 0 ? sm.VertexStride : derivedStride;
            if (stride < 12)
                continue; // pas de place pour une position float3 : sous-maille ignorée

            int vOffset = sm.VertexBufferOffset;
            int vEnd = vOffset + sm.VertexCount * stride;
            if (vOffset < 0 || vEnd > g4mgData.Length)
                continue;

            // Positions : float3 little-endian à +0 de chaque vertex.
            var positions = new List<Vector3>(sm.VertexCount);
            for (int i = 0; i < sm.VertexCount; i++)
            {
                int p = vOffset + i * stride;
                float x = BinaryPrimitives.ReadSingleLittleEndian(g4mgData[p..]);
                float y = BinaryPrimitives.ReadSingleLittleEndian(g4mgData[(p + 4)..]);
                float z = BinaryPrimitives.ReadSingleLittleEndian(g4mgData[(p + 8)..]);
                positions.Add(new Vector3(Sanitize(x), Sanitize(y), Sanitize(z)));
            }

            // Indices : offset face = faceDataBase + IndexBufferOffset (octets).
            bool index32 = sm.VertexCount > 65535;
            int idxSize = index32 ? 4 : 2;
            int iOffset = faceDataBase + sm.IndexBufferOffset;
            int iEnd = iOffset + sm.IndexCount * idxSize;

            var indices = new List<uint>(Math.Max(0, sm.IndexCount));
            if (sm.IndexCount > 0 && iOffset >= 0 && iEnd <= g4mgData.Length)
            {
                for (int i = 0; i < sm.IndexCount; i++)
                {
                    int p = iOffset + i * idxSize;
                    uint v = index32
                        ? BinaryPrimitives.ReadUInt32LittleEndian(g4mgData[p..])
                        : BinaryPrimitives.ReadUInt16LittleEndian(g4mgData[p..]);
                    indices.Add(v);
                }
            }

            result.Add(new SubmeshGeometry
            {
                Name = sm.Name,
                VertexCount = sm.VertexCount,
                VertexStride = stride,
                VertexBufferOffset = vOffset,
                IndexBufferOffset = iOffset,
                Index32 = index32,
                MaterialIndex = sm.MaterialIndex,
                Positions = positions,
                Indices = indices,
                Attributes = attributes,
            });
        }

        return result;
    }

    /// <summary>
    /// Lit la PREMIÈRE table d'attributs de vertex du .g4md (8 octets/attribut). Position
    /// vérifiée sur fichiers réels : <c>submesh_info + submesh_count * 0x50 + 8</c> (chaque record
    /// de sous-maille occupe 0x50 octets, suivis d'un bloc bornes de 8 octets avant la table).
    /// Le 1er attribut réel est toujours vtype=1 (position), offset=0, datatype float.
    ///
    /// LIMITE HONNÊTE : si vlayout_count &gt; (attributs de la 1re table), il existe plusieurs
    /// layouts indexés par <c>Submesh.LayoutNum</c> ; on n'expose ici que le 1er layout (les
    /// suivants ne sont pas démêlés de façon vérifiée). Les positions restant à +0, cela
    /// n'affecte pas l'extraction des positions/indices, seulement l'info d'attributs.
    /// </summary>
    private static List<VertexAttribute> ReadVertexAttributes(G4mdParser g4md)
    {
        var attrs = new List<VertexAttribute>();
        var data = g4md.RawData;
        if (data.Length == 0)
            return attrs;

        int submeshInfo = g4md.Header.SubmeshInfo;
        int submeshCount = g4md.Header.SubmeshCount;
        if (submeshInfo <= 0 || submeshCount <= 0)
            return attrs;

        int tableOffset = submeshInfo + submeshCount * 0x50 + 8;

        // Le 1er attribut doit être vtype=1 (position) offset=0 ; sinon on n'a pas la bonne table.
        if (tableOffset + 8 > data.Length || data[tableOffset] != 1)
            return attrs;

        // Lit le 1er layout. Un enregistrement vtype=0 marque la fin de la table (séparateur
        // observé sur les fichiers réels avant le layout suivant). Plafond de sécurité à 16.
        for (int i = 0; i < 16; i++)
        {
            int o = tableOffset + i * 8;
            if (o + 8 > data.Length)
                break;
            byte vtype = data[o];
            if (vtype == 0)
                break;
            ushort off = BinaryPrimitives.ReadUInt16LittleEndian(data.AsSpan(o + 1));
            uint dt = BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(o + 4));
            attrs.Add(new VertexAttribute(vtype, off, dt));
        }

        return attrs;
    }

    private static float Sanitize(float f) => float.IsFinite(f) ? f : 0f;

    /// <summary>
    /// Pont de compatibilité : convertit la géométrie extraite en <see cref="MeshEntry"/>
    /// pour les convertisseurs GLB existants. Pilotée par le .g4md (offsets/comptes/stride réels).
    /// </summary>
    public static List<MeshEntry> ParseRawGeometry(ReadOnlySpan<byte> g4mgData, G4mdParser g4md)
    {
        var geometry = ExtractGeometry(g4mgData, g4md);
        var meshes = new List<MeshEntry>(geometry.Count);

        foreach (var g in geometry)
        {
            meshes.Add(new MeshEntry
            {
                Name = g.Name,
                VertexCount = g.VertexCount,
                IndexCount = g.Indices.Count,
                VertexBufferOffset = g.VertexBufferOffset,
                IndexBufferOffset = g.IndexBufferOffset,
                MaterialIndex = g.MaterialIndex,
                Format = VertexFormat.Position,
                RawFormat = 0,
                VertexStride = g.VertexStride,
                BBoxMin = new Vector3(0, 0, 0),
                BBoxMax = new Vector3(0, 0, 0),
            });
        }

        return meshes;
    }

    /// <summary>
    /// Surcharge historique acceptant la liste de sous-mailles directement.
    /// </summary>
    public static List<MeshEntry> ParseRawGeometry(ReadOnlySpan<byte> g4mgData, List<G4mdParser.Submesh> submeshes, int faceDataBase = 0)
    {
        // Construit un parser léger porteur des sous-mailles pour réutiliser ExtractGeometry.
        var shim = new G4mdParser();
        shim.SetSubmeshesForExtraction(submeshes, faceDataBase);
        return ParseRawGeometry(g4mgData, shim);
    }

    /// <summary>
    /// Les .g4mg réels sont sans en-tête : impossible de les décoder seuls. Cette méthode
    /// existait pour un format fictif (magic « G4MG » + header 64 octets) qui n'a jamais
    /// correspondu aux fichiers réels. On lève une erreur explicite renvoyant vers la voie
    /// supportée (extraction pilotée par le .g4md compagnon).
    /// </summary>
    public static List<MeshEntry> ParseMeshes(string filePath)
        => throw new NotSupportedException(
            $"G4MG sans en-tête : '{filePath}' ne peut pas être décodé seul. " +
            "Le .g4md compagnon (même basename) est requis ; utiliser G4mgParser.ExtractGeometry / ParseRawGeometry.");

    /// <inheritdoc cref="ParseMeshes(string)"/>
    public static List<MeshEntry> ParseMeshes(ReadOnlySpan<byte> data)
        => throw new NotSupportedException(
            "G4MG sans en-tête : géométrie brute non décodable sans le .g4md compagnon. " +
            "Utiliser G4mgParser.ExtractGeometry / ParseRawGeometry avec le .g4md associé.");

    /// <summary>
    /// Lit les indices (uint16) bruts à un offset donné (utilitaire bas niveau hérité).
    /// </summary>
    public static ushort[] ReadIndices(ReadOnlySpan<byte> data, int offset, int count)
    {
        var indexData = data.Slice(offset, count * sizeof(ushort));
        return MemoryMarshal.Cast<byte, ushort>(indexData).ToArray();
    }

    /// <summary>
    /// Exporte une sous-maille extraite au format OBJ (positions + faces uniquement).
    /// Honnête : on n'écrit que ce qu'on décode réellement (positions et indices).
    /// </summary>
    public static void ExportToObj(SubmeshGeometry mesh, string outputPath)
    {
        using var writer = new StreamWriter(outputPath);

        writer.WriteLine($"# G4MG Submesh: {mesh.Name}");
        writer.WriteLine($"# Vertices: {mesh.Positions.Count}");
        writer.WriteLine($"# Faces: {mesh.Indices.Count / 3}");
        writer.WriteLine();

        foreach (var p in mesh.Positions)
            writer.WriteLine($"v {p.X} {p.Y} {p.Z}");

        writer.WriteLine();

        for (int i = 0; i + 2 < mesh.Indices.Count; i += 3)
        {
            long i0 = mesh.Indices[i] + 1;
            long i1 = mesh.Indices[i + 1] + 1;
            long i2 = mesh.Indices[i + 2] + 1;
            writer.WriteLine($"f {i0} {i1} {i2}");
        }
    }

    /// <summary>
    /// Calcule le stride hérité d'un <see cref="VertexFormat"/> (utilisé par les readers
    /// hérités). Le stride réel doit venir du .g4md ; cette table est purement indicative.
    /// </summary>
    public static int GetVertexStride(VertexFormat format)
    {
        int stride = 0;
        if (format.HasFlag(VertexFormat.Position)) stride += 12;
        if (format.HasFlag(VertexFormat.Normal)) stride += 12;
        if (format.HasFlag(VertexFormat.UV0)) stride += 8;
        if (format.HasFlag(VertexFormat.UV1)) stride += 8;
        if (format.HasFlag(VertexFormat.Color)) stride += 4;
        if (format.HasFlag(VertexFormat.BoneWeights)) stride += 4;
        if (format.HasFlag(VertexFormat.BoneIndices)) stride += 4;
        if (format.HasFlag(VertexFormat.Tangent)) stride += 12;
        if (format.HasFlag(VertexFormat.Binormal)) stride += 12;
        return stride;
    }
}
