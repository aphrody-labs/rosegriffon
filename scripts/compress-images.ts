/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import sharp from "sharp";

const TARGET_DIR = "/home/ubuntu/rg/packages/assets/public";

interface CompressStats {
	file: string;
	originalSize: number;
	compressedSize: number;
	savedBytes: number;
	savedPercent: number;
}

async function walkDir(dir: string, callback: (filePath: string) => Promise<void>) {
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			await walkDir(fullPath, callback);
		} else if (entry.isFile()) {
			await callback(fullPath);
		}
	}
}

async function compressImage(filePath: string): Promise<CompressStats | null> {
	const ext = extname(filePath).toLowerCase();
	const supportedExtensions = [".png", ".jpg", ".jpeg", ".webp"];
	if (!supportedExtensions.includes(ext)) {
		return null;
	}

	const originalStats = statSync(filePath);
	const originalSize = originalStats.size;

	if (originalSize === 0) return null;

	try {
		const imageBuffer = readFileSync(filePath);
		let sharpInstance = sharp(imageBuffer);
		let compressedBuffer: Buffer;

		if (ext === ".webp") {
			// Optimise WebP
			compressedBuffer = await sharpInstance
				.webp({ quality: 80, effort: 6 })
				.toBuffer();
		} else if (ext === ".png") {
			// Optimise PNG
			compressedBuffer = await sharpInstance
				.png({ quality: 80, compressionLevel: 9, effort: 10 })
				.toBuffer();
		} else {
			// Optimise JPEG
			compressedBuffer = await sharpInstance
				.jpeg({ quality: 80, mozjpeg: true })
				.toBuffer();
		}

		const compressedSize = compressedBuffer.length;

		// Si l'image compressée est plus petite, on l'écrit sur le disque
		if (compressedSize < originalSize) {
			writeFileSync(filePath, compressedBuffer);
			const savedBytes = originalSize - compressedSize;
			const savedPercent = (savedBytes / originalSize) * 100;
			return {
				file: filePath.replace(TARGET_DIR, ""),
				originalSize,
				compressedSize,
				savedBytes,
				savedPercent,
			};
		}
	} catch (err) {
		console.error(`[Compress] Erreur lors de la compression de ${filePath}:`, err);
	}

	return null;
}

async function main() {
	console.log(`[Image Compress] Démarrage du scan de ${TARGET_DIR}...`);
	if (!existsSync(TARGET_DIR)) {
		console.error(`[Image Compress] Dossier cible inexistant : ${TARGET_DIR}`);
		process.exit(1);
	}

	const results: CompressStats[] = [];
	let totalOriginalBytes = 0;
	let totalSavedBytes = 0;

	await walkDir(TARGET_DIR, async (filePath) => {
		const stats = statSync(filePath);
		totalOriginalBytes += stats.size;

		const result = await compressImage(filePath);
		if (result) {
			results.push(result);
			totalSavedBytes += result.savedBytes;
			console.log(
				`[Optimisé] ${result.file} : ${(result.originalSize / 1024).toFixed(1)} KB -> ${(result.compressedSize / 1024).toFixed(1)} KB (-${result.savedPercent.toFixed(1)}%)`
			);
		}
	});

	console.log("\n--- Bilan de la compression ---");
	console.log(`Fichiers optimisés : ${results.length}`);
	console.log(`Poids total initial : ${(totalOriginalBytes / (1024 * 1024)).toFixed(2)} MB`);
	console.log(`Espace total économisé : ${(totalSavedBytes / (1024 * 1024)).toFixed(2)} MB`);
	if (totalOriginalBytes > 0) {
		const finalPercent = (totalSavedBytes / totalOriginalBytes) * 100;
		console.log(`Réduction globale : -${finalPercent.toFixed(2)}%`);
	}
}

main().catch((err) => {
	console.error("[Image Compress] Échec critique :", err);
	process.exit(1);
});
