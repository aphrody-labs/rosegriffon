import { readdir, mkdir, stat, writeFile } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

const SOURCE_DIR = "/home/ubuntu/rg/packages/assets/public";
const DEST_DIRS = [
  "/var/www/cdn/static/azalee/public",
  "/var/www/cdn/static/website/public",
];

async function getFiles(dir: string): Promise<string[]> {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = join(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}

/**
 * Synchronise les assets statiques partagés du monorepo vers le CDN.
 * Génère des versions pré-compressées Gzip (.gz) et Brotli (.br) pour les types de fichiers compressibles.
 */
export async function syncCdnAssets(): Promise<{ success: boolean; error?: string }> {
  console.log("[Cron CDN] Démarrage de la synchronisation des assets CDN...");
  try {
    const files = await getFiles(SOURCE_DIR);
    console.log(`[Cron CDN] ${files.length} assets trouvés pour la synchronisation.`);

    let copyCount = 0;
    let skipCount = 0;

    for (const file of files) {
      const relPath = relative(SOURCE_DIR, file);
      const fileContent = await Bun.file(file).arrayBuffer();
      const buffer = Buffer.from(fileContent);

      for (const destDir of DEST_DIRS) {
        const destPath = join(destDir, relPath);
        const destParentDir = dirname(destPath);

        // Crée le dossier parent si nécessaire
        await mkdir(destParentDir, { recursive: true });

        // Vérifie si le fichier existe déjà et est identique
        let shouldCopy = true;
        try {
          const destStat = await stat(destPath);
          const srcStat = await stat(file);
          if (destStat.size === srcStat.size) {
            shouldCopy = false;
          }
        } catch {
          // Le fichier n'existe pas encore
        }

        if (shouldCopy) {
          // Copie du fichier
          await writeFile(destPath, buffer);
          copyCount++;

          // Pré-compression pour les fichiers texte, SVG, polices, etc.
          const ext = destPath.split(".").pop()?.toLowerCase();
          const compressibleExtensions = ["js", "css", "html", "svg", "json", "txt", "ttf", "xml", "webmanifest"];
          if (ext && compressibleExtensions.includes(ext)) {
            try {
              // Gzip (niveau 9)
              const gzContent = gzipSync(buffer, { level: 9 });
              await writeFile(`${destPath}.gz`, gzContent);

              // Brotli (qualité 11)
              const brContent = brotliCompressSync(buffer, {
                params: {
                  [constants.BROTLI_PARAM_QUALITY]: 11,
                },
              });
              await writeFile(`${destPath}.br`, brContent);
            } catch (compressErr) {
              console.warn(`[Cron CDN] Warning: Impossible de pré-compresser ${relPath}:`, compressErr);
            }
          }
        } else {
          skipCount++;
        }
      }
    }
    console.log(`[Cron CDN] Synchronisation terminée. ${copyCount} fichiers copiés, ${skipCount} ignorés.`);
    return { success: true };
  } catch (err: any) {
    console.error("[Cron CDN] Erreur lors de la synchronisation CDN :", err);
    return { success: false, error: err.message || String(err) };
  }
}
