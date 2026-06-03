using System.CommandLine;
using System.CommandLine.Invocation;
using System.Numerics;
using IECODE.Core.Formats.Level5;
using SharpGLTF.Geometry;
using SharpGLTF.Geometry.VertexTypes;
using SharpGLTF.Materials;
using SharpGLTF.Scenes;

namespace IECODE.CLI.Commands;

/// <summary>
/// Commande de parsing/conversion des fichiers G4MG (géométrie Level-5).
///
/// Les .g4mg sont SANS en-tête : aucun magic, pas de header. La métadonnée géométrique
/// (offsets/comptes vertex et index, stride, sous-mailles) vit dans le .g4md compagnon de
/// même basename. Sans .g4md → erreur explicite + code de sortie non nul.
/// </summary>
public static class G4mgCommand
{
    public static Command Create()
    {
        var command = new Command("g4mg", "Parse and convert G4MG geometry files (headerless, requires companion .g4md)");

        // Sous-commande : info
        var infoCommand = new Command("info", "Inspect G4MG geometry via its companion .g4md");
        var infoFileArg = new Argument<string>("file", "Path to G4MG file");
        infoCommand.AddArgument(infoFileArg);
        infoCommand.SetHandler((InvocationContext ctx) =>
        {
            string file = ctx.ParseResult.GetValueForArgument(infoFileArg);
            ctx.ExitCode = Info(file);
        });
        command.AddCommand(infoCommand);

        // Sous-commande : to-glb
        var toGlbCommand = new Command("to-glb", "Convert G4MG to GLB (positions + indices)");
        var fileArg = new Argument<string>("file", "Path to G4MG file");
        toGlbCommand.AddArgument(fileArg);
        var outputOption = new Option<string?>(["--output", "-o"], "Output GLB file");
        toGlbCommand.AddOption(outputOption);
        toGlbCommand.SetHandler((InvocationContext ctx) =>
        {
            string file = ctx.ParseResult.GetValueForArgument(fileArg);
            string? output = ctx.ParseResult.GetValueForOption(outputOption);
            ctx.ExitCode = ConvertToGlb(file, output);
        });
        command.AddCommand(toGlbCommand);

        return command;
    }

    /// <summary>
    /// Charge le .g4mg et son .g4md compagnon, ou écrit une erreur claire et renvoie un code non nul.
    /// </summary>
    private static bool TryLoad(string g4mgPath, out byte[] g4mgData, out G4mdParser g4md)
    {
        g4mgData = [];
        g4md = new G4mdParser();

        if (!File.Exists(g4mgPath))
        {
            Console.Error.WriteLine($"File not found: {g4mgPath}");
            return false;
        }

        string g4mdPath = Path.ChangeExtension(g4mgPath, ".g4md");
        if (!File.Exists(g4mdPath))
        {
            Console.Error.WriteLine(
                $"G4MG headerless: companion .g4md required, none found at {g4mdPath}");
            return false;
        }

        g4mgData = File.ReadAllBytes(g4mgPath);
        g4md.Parse(g4mdPath);
        return true;
    }

    private static int Info(string g4mgPath)
    {
        if (!TryLoad(g4mgPath, out var g4mgData, out var g4md))
            return 1;

        Console.WriteLine($"G4MG: {Path.GetFileName(g4mgPath)} ({g4mgData.Length} bytes, headerless)");
        Console.WriteLine($"Companion G4MD: submeshes={g4md.Header.SubmeshCount} materials={g4md.Header.MaterialCount} " +
                          $"vlayout={g4md.Header.VLayoutCount} faceDataBase=0x{g4md.Header.FaceDataBase:X}");

        var geometry = G4mgParser.ExtractGeometry(g4mgData, g4md);
        if (geometry.Count == 0)
        {
            Console.Error.WriteLine("No submesh geometry extracted.");
            return 1;
        }

        foreach (var g in geometry)
        {
            Console.WriteLine($"  {g.Name}: V={g.VertexCount} I={g.Indices.Count} stride={g.VertexStride} " +
                              $"index32={g.Index32} vOff=0x{g.VertexBufferOffset:X} iOff=0x{g.IndexBufferOffset:X}");

            if (g.Positions.Count > 0)
            {
                var p = g.Positions[0];
                Console.WriteLine($"    vtx0 pos = ({p.X:0.####}, {p.Y:0.####}, {p.Z:0.####})");
            }
            if (g.Indices.Count >= 6)
            {
                Console.WriteLine($"    idx[0..6] = [{string.Join(", ", g.Indices.Take(6))}]");
            }
            if (g.Attributes.Count > 0)
            {
                var a = g.Attributes
                    .Select(x => $"vtype={x.VType}@{x.Offset}/dt{x.DataType}");
                Console.WriteLine($"    attrs = {string.Join(", ", a)}");
            }
        }

        return 0;
    }

    private static int ConvertToGlb(string g4mgPath, string? outputPath)
    {
        if (!TryLoad(g4mgPath, out var g4mgData, out var g4md))
            return 1;

        outputPath = string.IsNullOrEmpty(outputPath) ? Path.ChangeExtension(g4mgPath, ".glb") : outputPath;
        Console.WriteLine($"Converting: {Path.GetFileName(g4mgPath)} -> {Path.GetFileName(outputPath)}");

        var glb = BuildGlb(g4mgData, g4md, out int totalTris, line => Console.WriteLine($"  {line}"));
        if (glb is null)
        {
            Console.Error.WriteLine("No submesh geometry extracted; nothing to export.");
            return 1;
        }

        File.WriteAllBytes(outputPath, glb);
        Console.WriteLine($"OK: {outputPath} ({totalTris} triangles)");
        return 0;
    }

    /// <summary>
    /// Construit les octets GLB depuis les données g4mg + son g4md déjà parsé.
    /// Réutilisable hors fichier (ex: export par lot depuis les CPK). Renvoie null si
    /// aucune géométrie n'est extraite. Seule la position est décodée honnêtement
    /// (normale/UV packées SNORM16 non fabriquées).
    /// </summary>
    public static byte[]? BuildGlb(ReadOnlySpan<byte> g4mgData, G4mdParser g4md, out int totalTris, Action<string>? log = null)
    {
        totalTris = 0;
        var geometry = G4mgParser.ExtractGeometry(g4mgData, g4md);
        if (geometry.Count == 0)
            return null;

        var scene = new SceneBuilder();
        var material = new MaterialBuilder("Default").WithDoubleSide(true).WithMetallicRoughnessShader();

        foreach (var g in geometry)
        {
            log?.Invoke($"{g.Name}: V={g.VertexCount} I={g.Indices.Count} stride={g.VertexStride}");

            var meshBuilder = new MeshBuilder<VertexPosition>(g.Name);
            var primitive = meshBuilder.UsePrimitive(material);

            var verts = new VertexPosition[g.Positions.Count];
            for (int i = 0; i < g.Positions.Count; i++)
                verts[i] = new VertexPosition(g.Positions[i].X, g.Positions[i].Y, g.Positions[i].Z);

            for (int i = 0; i + 2 < g.Indices.Count; i += 3)
            {
                uint i0 = g.Indices[i], i1 = g.Indices[i + 1], i2 = g.Indices[i + 2];
                if (i0 >= verts.Length || i1 >= verts.Length || i2 >= verts.Length)
                    continue;
                primitive.AddTriangle(verts[i0], verts[i1], verts[i2]);
                totalTris++;
            }

            scene.AddRigidMesh(meshBuilder, Matrix4x4.Identity);
        }

        var model = scene.ToGltf2();
        using var ms = new MemoryStream();
        model.WriteGLB(ms);
        return ms.ToArray();
    }
}
