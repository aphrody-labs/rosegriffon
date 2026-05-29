import { type Image, loadImage, type SKRSContext2D } from "@aphrody-code/canvas";

export function roundedRect(
	ctx: SKRSContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
): void {
	const radius = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + w - radius, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
	ctx.lineTo(x + w, y + h - radius);
	ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
	ctx.lineTo(x + radius, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

export function fillRoundedRect(
	ctx: SKRSContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
	fill: string
): void {
	ctx.save();
	ctx.fillStyle = fill;
	roundedRect(ctx, x, y, w, h, r);
	ctx.fill();
	ctx.restore();
}

export function strokeRoundedRect(
	ctx: SKRSContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
	stroke: string,
	lineWidth = 1
): void {
	ctx.save();
	ctx.strokeStyle = stroke;
	ctx.lineWidth = lineWidth;
	roundedRect(ctx, x, y, w, h, r);
	ctx.stroke();
	ctx.restore();
}

export interface WrapOptions {
	maxWidth: number;
	maxLines?: number;
	lineHeight: number;
	ellipsis?: string;
}

export function wrapText(ctx: SKRSContext2D, text: string, opts: WrapOptions): string[] {
	const words = (text ?? "").split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const candidate = current.length === 0 ? word : `${current} ${word}`;
		if (ctx.measureText(candidate).width <= opts.maxWidth) {
			current = candidate;
			continue;
		}
		if (current.length > 0) lines.push(current);
		current = word;
		if (opts.maxLines && lines.length >= opts.maxLines) break;
	}
	if (current.length > 0 && (!opts.maxLines || lines.length < opts.maxLines)) {
		lines.push(current);
	}
	if (opts.maxLines && lines.length >= opts.maxLines) {
		const ellipsis = opts.ellipsis ?? "…";
		let last = lines[opts.maxLines - 1] ?? "";
		while (last.length > 0 && ctx.measureText(`${last}${ellipsis}`).width > opts.maxWidth) {
			last = last.slice(0, -1);
		}
		lines[opts.maxLines - 1] = `${last.trimEnd()}${ellipsis}`;
		return lines.slice(0, opts.maxLines);
	}
	return lines;
}

export function fillWrappedText(
	ctx: SKRSContext2D,
	text: string,
	x: number,
	y: number,
	opts: WrapOptions
): number {
	const lines = wrapText(ctx, text, opts);
	for (let i = 0; i < lines.length; i++) {
		ctx.fillText(lines[i]!, x, y + i * opts.lineHeight);
	}
	return lines.length;
}

export function ellipsize(
	ctx: SKRSContext2D,
	text: string,
	maxWidth: number,
	ellipsis = "…"
): string {
	if (ctx.measureText(text).width <= maxWidth) return text;
	let s = text;
	while (s.length > 0 && ctx.measureText(`${s}${ellipsis}`).width > maxWidth) {
		s = s.slice(0, -1);
	}
	return `${s.trimEnd()}${ellipsis}`;
}

export async function drawCircularImage(
	ctx: SKRSContext2D,
	src: string,
	cx: number,
	cy: number,
	radius: number
): Promise<boolean> {
	try {
		const img = await loadImage(src);
		ctx.save();
		ctx.beginPath();
		ctx.arc(cx, cy, radius, 0, Math.PI * 2);
		ctx.closePath();
		ctx.clip();
		ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
		ctx.restore();
		return true;
	} catch {
		return false;
	}
}

export async function drawCoveredImage(
	ctx: SKRSContext2D,
	src: string,
	x: number,
	y: number,
	w: number,
	h: number,
	radius = 0
): Promise<boolean> {
	try {
		const img = await loadImage(src);
		ctx.save();
		if (radius > 0) {
			roundedRect(ctx, x, y, w, h, radius);
			ctx.clip();
		}
		const ratio = Math.max(w / img.width, h / img.height);
		const nw = img.width * ratio;
		const nh = img.height * ratio;
		const nx = x + (w - nw) / 2;
		const ny = y + (h - nh) / 2;
		ctx.drawImage(img, nx, ny, nw, nh);
		ctx.restore();
		return true;
	} catch {
		return false;
	}
}

export function fallbackInitial(name: string | null | undefined): string {
	const t = (name ?? "?").trim();
	if (t.length === 0) return "?";
	return t[0]!.toUpperCase();
}

export type { Image };
