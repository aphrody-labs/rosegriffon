using System.CommandLine;
using IECODE.Core;
using IECODE.Core.Cdn;

namespace IECODE.CLI.Commands;

/// <summary>
/// Commande cdn - sert n'importe quel fichier du jeu À LA DEMANDE depuis les CPK, sans dump.
/// Résout via cpk_list (index O(1)) puis extrait le seul fichier voulu d'un reader chaud.
/// </summary>
public static class CdnCommand
{
    public static Command Create()
    {
        var command = new Command("cdn", "Sert/résout des fichiers du jeu à la demande depuis les CPK (sans dump)");

        var gameOption = new Option<string?>(
            aliases: ["--game", "-g"],
            description: "Chemin du jeu (défaut : installation détectée)");

        // ── get : extraire un fichier ───────────────────────────────────────────
        var getCommand = new Command("get", "Extrait un fichier par son chemin logique (ex: data/common/...)");
        var pathArg = new Argument<string>("path", "Chemin logique du fichier (data/...) ou chemin azalee menu si --format png");
        getCommand.AddArgument(pathArg);
        getCommand.AddOption(gameOption);
        var outOption = new Option<string?>(["--output", "-o"], "Écrire le contenu vers ce fichier (sinon : métadonnées seules)");
        getCommand.AddOption(outOption);
        var formatOption = new Option<string?>(["--format", "-f"], "Format de sortie : 'raw' (défaut, octets natifs) ou 'png' (icône menu azalee, G4TX→PNG lossless)");
        getCommand.AddOption(formatOption);
        getCommand.SetHandler(GetAsync, pathArg, gameOption, outOption, formatOption);
        command.AddCommand(getCommand);

        // ── export : matérialiser le sous-arbre menu azalee en PNG ──────────────
        var exportCommand = new Command("export", "Exporte le sous-arbre dx11/menu/** en PNG lossless (arborescence nginx azalee)");
        var exportOutArg = new Argument<string>("output", "Dossier de sortie (neuf ; jamais sous la prod)");
        exportCommand.AddArgument(exportOutArg);
        exportCommand.AddOption(gameOption);
        var filterOption = new Option<string?>(["--filter"], () => null, "Sous-chaîne de chemin conteneur (ex: face, telop_waza/fr)");
        exportCommand.AddOption(filterOption);
        var overwriteOption = new Option<bool>(["--overwrite"], () => false, "Réécrire les PNG déjà présents (sinon reprise idempotente)");
        exportCommand.AddOption(overwriteOption);
        exportCommand.SetHandler(ExportAsync, exportOutArg, gameOption, filterOption, overwriteOption);
        command.AddCommand(exportCommand);

        // ── ls : lister/compter les fichiers servables ──────────────────────────
        var lsCommand = new Command("ls", "Liste les fichiers servables (manifest), filtrable par sous-chaîne");
        var filterArg = new Argument<string?>("filter", () => null, "Sous-chaîne de chemin (optionnelle)");
        lsCommand.AddArgument(filterArg);
        lsCommand.AddOption(gameOption);
        var limitOption = new Option<int>(["--limit", "-n"], () => 50, "Nb max de lignes affichées");
        lsCommand.AddOption(limitOption);
        lsCommand.SetHandler(Ls, filterArg, gameOption, limitOption);
        command.AddCommand(lsCommand);

        return command;
    }

    private static async Task GetAsync(string path, string? gamePath, string? output, string? format)
    {
        using var game = new IEVRGame(gamePath);
        if (!game.IsValid)
        {
            Console.Error.WriteLine($"Erreur : jeu introuvable à {game.GamePath}");
            Environment.ExitCode = 1;
            return;
        }

        using var cdn = CdnFileService.FromGame(game);

        // ── format png : icône menu azalee (G4TX → PNG lossless) ────────────────
        if (string.Equals(format, "png", StringComparison.OrdinalIgnoreCase))
        {
            var pngSvc = new MenuPngService(cdn);
            MenuPng? rendered;
            try
            {
                rendered = await pngSvc.RenderAsync(path);
            }
            catch (KeyNotFoundException ex)
            {
                Console.Error.WriteLine($"Conteneur trouvé mais texture absente : {ex.Message}");
                Environment.ExitCode = 1;
                return;
            }
            if (rendered is not { } png)
            {
                Console.Error.WriteLine($"404 — conteneur menu introuvable pour : {path}");
                Environment.ExitCode = 1;
                return;
            }

            Console.WriteLine($"  Azalee     : {png.AzaleePath}");
            Console.WriteLine($"  Dimensions : {png.Width}×{png.Height} (PNG lossless, mip-0)");
            Console.WriteLine($"  Taille PNG : {png.Bytes.LongLength:N0} octets");
            Console.WriteLine($"  ETag       : {png.ETag}");
            if (!string.IsNullOrEmpty(output))
            {
                await File.WriteAllBytesAsync(output, png.Bytes);
                Console.WriteLine($"  → écrit    : {Path.GetFullPath(output)}");
            }
            return;
        }

        var file = await cdn.ReadAsync(path);
        if (file is not { } f)
        {
            Console.Error.WriteLine($"404 — introuvable dans cpk_list : {path}");
            Environment.ExitCode = 1;
            return;
        }

        Console.WriteLine($"  Chemin     : {f.Path}");
        Console.WriteLine($"  Taille     : {f.Size:N0} octets");
        Console.WriteLine($"  Media-type : {f.MediaType}");
        Console.WriteLine($"  ETag       : {f.ETag}");

        if (!string.IsNullOrEmpty(output))
        {
            await File.WriteAllBytesAsync(output, f.Bytes);
            Console.WriteLine($"  → écrit    : {Path.GetFullPath(output)}");
        }
    }

    private static async Task ExportAsync(string output, string? gamePath, string? filter, bool overwrite)
    {
        using var game = new IEVRGame(gamePath);
        if (!game.IsValid)
        {
            Console.Error.WriteLine($"Erreur : jeu introuvable à {game.GamePath}");
            Environment.ExitCode = 1;
            return;
        }

        using var cdn = CdnFileService.FromGame(game);
        var exporter = new MenuBatchExporter(cdn);

        var sw = System.Diagnostics.Stopwatch.StartNew();
        var progress = new Progress<MenuExportProgress>(p =>
        {
            if (p.Done % 250 == 0 || p.Done == p.Total)
                Console.Error.Write($"\r  {p.Done:N0}/{p.Total:N0} conteneurs — {p.PngWritten:N0} PNG…   ");
        });

        var report = await exporter.ExportAsync(output, filter, overwrite, progress: progress);
        sw.Stop();
        Console.Error.WriteLine();
        Console.WriteLine($"  Conteneurs : {report.Containers:N0}" + (string.IsNullOrEmpty(filter) ? "" : $" (filtre « {filter} »)"));
        Console.WriteLine($"  PNG écrits : {report.PngWritten:N0}");
        Console.WriteLine($"  Échecs     : {report.Failed:N0}");
        Console.WriteLine($"  Octets     : {report.BytesWritten:N0}");
        Console.WriteLine($"  Sortie     : {report.OutputRoot}");
        Console.WriteLine($"  Durée      : {sw.Elapsed.TotalSeconds:N1}s");
        if (report.Failed > 0) Environment.ExitCode = 2;
    }

    private static void Ls(string? filter, string? gamePath, int limit)
    {
        using var game = new IEVRGame(gamePath);
        if (!game.IsValid)
        {
            Console.Error.WriteLine($"Erreur : jeu introuvable à {game.GamePath}");
            Environment.ExitCode = 1;
            return;
        }

        using var cdn = CdnFileService.FromGame(game);
        var all = cdn.All;
        if (!string.IsNullOrEmpty(filter))
            all = all.Where(l => l.Path.Contains(filter, StringComparison.OrdinalIgnoreCase));

        int shown = 0, total = 0;
        long bytes = 0;
        foreach (var loc in all)
        {
            total++;
            bytes += loc.Size;
            if (shown < limit)
            {
                Console.WriteLine($"  {loc.Size,12:N0}  {loc.CpkName,-20}  {loc.Path}");
                shown++;
            }
        }

        Console.WriteLine();
        Console.WriteLine($"  {total:N0} fichier(s) servable(s), {bytes:N0} octets (build {(string.IsNullOrEmpty(cdn.BuildId) ? "?" : cdn.BuildId)})");
        if (total > shown)
            Console.WriteLine($"  … {total - shown:N0} non affichés (--limit {limit})");
    }
}
