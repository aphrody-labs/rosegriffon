import { Buffer } from "node:buffer";
import crypto from "node:crypto";

import axios from "axios";
import type { Attachment } from "discord.js";
import sharp from "sharp";

import { coreManagerConfig } from "@/configs";
import { discordBotProfile } from "@/configs/discord-profile";
import { Service } from "@/decorators";
import type { ImageRepository } from "@/entities";
import { Image } from "@/entities";
import { Database } from "@/services";
import { SupabaseImageStorage } from "@/services/SupabaseImageStorage";
import type { EntityManager } from "@mikro-orm/core";

/** Cloisonne les images issues des flux Discord (attachments/emojis) dans le bucket Supabase Storage. */
const STORAGE_FOLDER = "discord";

@Service()
export class CustomImagesUpload {
	private imageRepo: ImageRepository;

	constructor(
		private db: Database,
		private imageStorage: SupabaseImageStorage
	) {
		this.imageRepo = this.db.get(Image);
	}

	async hashAttachmentStream(url: string): Promise<{ hash: string; buffer: Buffer }> {
		const res = await axios.get(url, { responseType: "stream" });
		const hash = crypto.createHash("md5");

		const chunks: Buffer[] = [];

		return new Promise((resolve, reject) => {
			res.data.on("data", (chunk: Buffer) => {
				hash.update(chunk);
				chunks.push(chunk);
			});
			res.data.on("end", () => {
				const digest = hash.digest("hex");
				const buffer = Buffer.concat(chunks);
				resolve({ hash: digest, buffer });
			});
			res.data.on("error", reject);
		});
	}

	async uploadImageBuffer(buffer: Buffer, mimeType: string): Promise<string[]> {
		const { id, url } = await this.imageStorage.uploadImageBuffer(buffer, mimeType, STORAGE_FOLDER);

		return [id, url];
	}

	async processAttachment(
		attachment: Attachment,
		uploadEmoji: boolean,
		overrideEmoji: boolean,
		em: EntityManager,
		emojiName?: string,
		emojiId?: string
	): Promise<string | { url: string; emoji?: string }> {
		// Only process images (png, jpg, jpeg)
		const ext = attachment.name ? attachment.name.split(".").pop()?.toLowerCase() : "";
		const mimeType =
			ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;

		if (!mimeType) throw new Error("Unsupported file type.");

		// Step 1: stream & hash
		const { hash, buffer } = await this.hashAttachmentStream(attachment.url);

		// Step 2: check DB for existing hash
		const existing = await em.getRepository(Image).findOne({ hash });
		if (existing) {
			// Already stored, return existing URL
			return existing.url;
		}

		// Step 3: upload since new image
		const [fileName, uploadedUrl] = await this.uploadImageBuffer(buffer, mimeType);

		// Step 4: store new record in DB
		const newImage = new Image();
		newImage.deleteHash = "";
		newImage.fileName = fileName;
		newImage.size = buffer.length;
		newImage.tags = [];
		newImage.hash = hash;
		newImage.url = uploadedUrl;

		em.persist(newImage);

		// Step 5: delete emoji if override is true
		if (overrideEmoji && emojiId) this.deleteEmoji(emojiId).catch((err) => console.error(err));

		// Step 6: optionally upload as emoji
		return uploadEmoji && emojiName !== undefined
			? await this.uploadAsEmoji(buffer, mimeType, emojiName, uploadedUrl)
			: uploadedUrl;
	}

	async deleteDistantImage(image: Image) {
		return this.imageStorage.deleteImage(image.fileName, STORAGE_FOLDER);
	}

	async ensureBufferSize(imageBuffer: Buffer) {
		let buffer = await sharp(imageBuffer)
			.resize(128, 128, { fit: "inside" })
			.png({ compressionLevel: 9, palette: true })
			.toBuffer();

		if (buffer.length > 256 * 1024) {
			buffer = await sharp(imageBuffer)
				.resize(128, 128, { fit: "inside" })
				.jpeg({ quality: 80 })
				.toBuffer();
		}

		if (buffer.length > 256 * 1024) {
			throw new Error(
				`Emoji too large even after compression (${(buffer.length / 1024).toFixed(1)} KB)`
			);
		}

		return buffer;
	}

	async uploadAsEmoji(
		buffer: Buffer,
		mimeType: string,
		name: string,
		fallbackUrl: string
	): Promise<{ url: string; emojiId: string }> {
		const newBuffer = await this.ensureBufferSize(buffer);

		const base64 = `data:${mimeType};base64,${newBuffer.toString("base64")}`;
		const token = discordBotProfile.token;

		const res = await axios.post(
			`https://discord.com/api/v10/applications/${coreManagerConfig.botId}/emojis`,
			{
				name,
				image: base64,
			},
			{
				headers: {
					Authorization: `Bot ${token}`,
					"Content-Type": "application/json",
				},
			}
		);

		const emojiData = res.data; // { id, name }
		const emojiId = `${emojiData.id}`;

		return { url: fallbackUrl, emojiId };
	}

	async deleteEmoji(emojiId: string): Promise<void> {
		const url = `https://discord.com/api/v10/applications/${coreManagerConfig.botId}/emojis/${emojiId}`;

		const token = discordBotProfile.token;

		await axios.delete(url, {
			headers: {
				Authorization: `Bot ${token}`,
			},
		});
	}

	async editEmoji(emojiId: string, newName: string): Promise<void> {
		const url = `https://discord.com/api/v10/applications/${coreManagerConfig.botId}/emojis/${emojiId}`;

		await axios.patch(
			url,
			{ name: newName },
			{
				headers: {
					Authorization: `Bot ${discordBotProfile.token}`,
					"Content-Type": "application/json",
				},
			}
		);
	}

	async fetchImageAsBuffer(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
		// Download image as arraybuffer, auto-detect content-type
		const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
		const buffer = Buffer.from(response.data);
		const mimeType = (response.headers["content-type"] as string | undefined) || "image/png"; // fallback

		return { buffer, mimeType };
	}
}
