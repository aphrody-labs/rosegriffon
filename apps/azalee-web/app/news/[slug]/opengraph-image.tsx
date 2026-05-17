import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgImageProps {
	params: Promise<{ slug: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
	announcement: "Annonce",
	event: "Événement",
	critique: "Critique",
	community: "Communauté",
};

function formatDate(dateString: string): string {
	try {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat("fr-FR", {
			day: "numeric",
			month: "long",
			year: "numeric",
		}).format(date);
	} catch {
		return "";
	}
}

export default async function Image({ params }: OgImageProps) {
	const { slug } = await params;

	let title = "Azalee - Actualités Inazuma Eleven";
	let category: string | null = null;
	let authorName = "Azalée";
	let featuredImageUrl: string | null = null;
	let publishedAt: string | null = null;

	try {
		const supabase = await createClient();
		const { data } = await (supabase as any)
			.from("articles")
			.select("title, category, featured_image_url, published_at, author_id")
			.eq("slug", slug)
			.eq("app", "azalee")
			.single();

		if (data) {
			title = data.title || title;
			category = data.category || null;
			featuredImageUrl = data.featured_image_url || null;
			publishedAt = data.published_at || null;
			authorName = data.author?.full_name || "Azalée";
		}
	} catch {
		// Fallback gracieux
	}

	const categoryLabel = category ? CATEGORY_LABELS[category] || category : null;
	const dateLabel = publishedAt ? formatDate(publishedAt) : null;

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				position: "relative",
				overflow: "hidden",
				fontFamily: "sans-serif",
				background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
			}}
		>
			{/* Image de fond avec overlay */}
			{featuredImageUrl && (
				<>
					{/* img natif requis pour ImageResponse — next/image non supporté dans Edge runtime */}
					<img
						src={featuredImageUrl}
						alt=""
						style={{
							position: "absolute",
							inset: 0,
							width: "100%",
							height: "100%",
							objectFit: "cover",
						}}
					/>
					{/* Overlay sombre 60% */}
					<div
						style={{
							position: "absolute",
							inset: 0,
							background:
								"linear-gradient(135deg, rgba(26,26,46,0.85) 0%, rgba(22,33,62,0.75) 50%, rgba(26,26,46,0.90) 100%)",
							display: "flex",
						}}
					/>
				</>
			)}

			{/* Contenu principal */}
			<div
				style={{
					position: "relative",
					zIndex: 1,
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					width: "100%",
					height: "100%",
					padding: "48px 60px",
				}}
			>
				{/* En-tête : logo + badge catégorie */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
						}}
					>
						<div
							style={{
								fontSize: 28,
								fontWeight: 900,
								color: "#F2A93B",
								letterSpacing: "-0.5px",
								display: "flex",
							}}
						>
							Azalee
						</div>
						<div
							style={{
								fontSize: 13,
								color: "#8899aa",
								display: "flex",
								alignSelf: "flex-end",
								paddingBottom: 2,
							}}
						>
							Rose Griffon
						</div>
					</div>

					{categoryLabel && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								padding: "6px 18px",
								borderRadius: 99,
								background: "rgba(242, 169, 59, 0.18)",
								border: "1px solid rgba(242, 169, 59, 0.35)",
								color: "#F2A93B",
								fontSize: 14,
								fontWeight: 700,
								letterSpacing: "0.5px",
								textTransform: "uppercase",
							}}
						>
							{categoryLabel}
						</div>
					)}
				</div>

				{/* Titre principal */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 16,
						maxWidth: 900,
					}}
				>
					<div
						style={{
							fontSize: title.length > 80 ? 42 : title.length > 50 ? 52 : 64,
							fontWeight: 900,
							color: "#ffffff",
							lineHeight: 1.1,
							letterSpacing: "-1px",
							display: "-webkit-box",
							WebkitLineClamp: 3,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
						}}
					>
						{title}
					</div>
				</div>

				{/* Pied de page : auteur + date + watermark */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
						{/* Auteur */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "8px 16px",
								borderRadius: 99,
								background: "rgba(255,255,255,0.08)",
								border: "1px solid rgba(255,255,255,0.12)",
							}}
						>
							<div
								style={{
									width: 28,
									height: 28,
									borderRadius: "50%",
									background: "linear-gradient(135deg, #F2A93B, #E53935)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "white",
									fontSize: 14,
									fontWeight: 700,
								}}
							>
								{authorName.charAt(0).toUpperCase()}
							</div>
							<span
								style={{
									color: "#ccddee",
									fontSize: 15,
									fontWeight: 600,
									display: "flex",
								}}
							>
								{authorName}
							</span>
						</div>

						{/* Date */}
						{dateLabel && (
							<div
								style={{
									color: "#8899aa",
									fontSize: 14,
									display: "flex",
								}}
							>
								{dateLabel}
							</div>
						)}
					</div>

					{/* Watermark */}
					<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
						<div
							style={{
								fontSize: 13,
								fontWeight: 700,
								color: "#F2A93B",
								display: "flex",
							}}
						>
							azalee.rosegriffon.fr
						</div>
					</div>
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
