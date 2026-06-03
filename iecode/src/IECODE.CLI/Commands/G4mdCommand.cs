using System.CommandLine;
using IECODE.Core.Converters;
using IECODE.Core.Formats.Level5;
using IECODE.Core.Logging;

namespace IECODE.CLI.Commands;

/// <summary>
/// Commands for G4MD (Level-5 Model Data) files.
/// </summary>
public static class G4mdCommand
{
    public static Command Create()
    {
        var command = new Command("g4md", "Parse and convert G4MD model files");

        command.AddCommand(CreateInfoCommand());
        command.AddCommand(CreateToGlbCommand());

        return command;
    }

    // -------------------------------------------------------------------------
    // g4md info <file> [-o <json>]
    // -------------------------------------------------------------------------

    private static Command CreateInfoCommand()
    {
        var cmd = new Command("info", "Display G4MD file information");
        var fileArg = new Argument<string>("file", "Path to G4MD file");
        var outputOpt = new Option<string?>(["--output", "-o"], "Output JSON file");
        cmd.AddArgument(fileArg);
        cmd.AddOption(outputOpt);

        cmd.SetHandler((string file, string? output) =>
        {
            if (!File.Exists(file))
            {
                Console.Error.WriteLine($"File not found: {file}");
                return;
            }

            var parser = new G4mdParser();
            parser.Parse(file);

            Console.WriteLine($"G4MD: {Path.GetFileName(file)}");
            Console.WriteLine($"  Magic:        0x{parser.Header.Magic:X8}");
            Console.WriteLine($"  HeaderSize:   {parser.Header.HeaderSize}");
            Console.WriteLine($"  TypeId:       {parser.Header.TypeId}");
            Console.WriteLine($"  SubmeshCount: {parser.Header.SubmeshCount}");
            Console.WriteLine($"  TotalCount:   {parser.Header.TotalCount}");
            Console.WriteLine($"  Submeshes ({parser.Submeshes.Count}):");

            foreach (var mesh in parser.Submeshes)
            {
                Console.WriteLine($"    {mesh.Name}");
                Console.WriteLine($"      Indices:  {mesh.IndexCount}  @ 0x{mesh.IndexBufferOffset:X}  ({mesh.IndexBufferSize} bytes)");
                Console.WriteLine($"      Vertices: {mesh.VertexCount} @ 0x{mesh.VertexBufferOffset:X}");
                Console.WriteLine($"      Material: {mesh.MaterialIndex}");
            }

            if (output != null)
            {
                var json = IECODE.CLI.JsonContext.Default.G4mdHeader != null
                    ? System.Text.Json.JsonSerializer.Serialize(parser.Header, IECODE.CLI.JsonContext.Default.G4mdHeader)
                    : System.Text.Json.JsonSerializer.Serialize(parser.Header);
                File.WriteAllText(output, json);
                Console.WriteLine($"Header exported to: {output}");
            }

        }, fileArg, outputOpt);

        return cmd;
    }

    // -------------------------------------------------------------------------
    // g4md to-glb <file> [-o <output.glb>]
    // -------------------------------------------------------------------------

    private static Command CreateToGlbCommand()
    {
        var cmd = new Command("to-glb", "Convert G4MD + associated G4MG to GLB");
        var fileArg = new Argument<string>("file", "Path to G4MD file");
        var outputOpt = new Option<string?>(["--output", "-o"], "Output GLB file (default: next to input)");
        cmd.AddArgument(fileArg);
        cmd.AddOption(outputOpt);

        cmd.SetHandler((string file, string? output) =>
        {
            if (!File.Exists(file))
            {
                Console.Error.WriteLine($"File not found: {file}");
                return;
            }

            output ??= Path.ChangeExtension(file, ".glb");

            try
            {
                var converter = new AssetConverterFacade();
                converter.ConvertG4md(file, output);
                Console.WriteLine($"OK: {output}");
            }
            catch (Exception ex)
            {
                LogService.Instance.Error("G4md", ex.Message);
                Console.Error.WriteLine($"Error: {ex.Message}");
            }

        }, fileArg, outputOpt);

        return cmd;
    }
}
