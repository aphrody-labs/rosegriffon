import { ImageResponse } from "@vercel/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

/**
 * GET /api/og/character?id=...
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");
		const name = searchParams.get("name") || "Personnage";
		const element = searchParams.get("element") || "neutral";
		const rarity = searchParams.get("rarity") || "N";
		const imageUrl = searchParams.get("image");

		// Element colors mapping
		const elementColors: Record<string, string> = {
			fire: "#ef4444",
			wood: "#22c55e",
			wind: "#3b82f6",
			earth: "#f59e0b",
			neutral: "#94a3b8",
		};

		const accentColor = elementColors[element.toLowerCase()] || elementColors.neutral;

		return new ImageResponse(
			(
				<div
					style={{
						height: "100%",
						width: "100%",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "#1a120d",
						backgroundImage: "radial-gradient(circle at 50% 50%, #2d1f14 0%, #1a120d 100%)",
						padding: "40px",
						fontFamily: "sans-serif",
					}}
				>
					<div
						style={{
							position: "absolute",
							top: "20px",
							right: "20px",
							display: "flex",
							alignItems: "center",
							backgroundColor: "rgba(0,0,0,0.3)",
							padding: "8px 16px",
							borderRadius: "100px",
							border: `1px solid ${accentColor}`,
						}}
					>
						<span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold" }}>Azalée IE Wiki</span>
					</div>

					<div
						style={{
							display: "flex",
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "flex-start",
							width: "100%",
							gap: "40px",
						}}
					>
						{imageUrl && (
							<div
								style={{
									display: "flex",
									borderRadius: "28px",
									overflow: "hidden",
									border: `4px solid ${accentColor}`,
									boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
								}}
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={imageUrl} alt={name} width="300" height="300" style={{ objectFit: "cover" }} />
							</div>
						)}

						<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
								<div
									style={{
										width: "12px",
										height: "12px",
										borderRadius: "50%",
										backgroundColor: accentColor,
										marginRight: "12px",
									}}
								/>
								<span style={{ color: accentColor, fontSize: "24px", fontWeight: "bold", textTransform: "uppercase" }}>
									{element} · {rarity}
								</span>
							</div>
							<h1
								style={{
									fontSize: "64px",
									fontWeight: "900",
									color: "#fff",
									margin: "0 0 20px 0",
									lineHeight: "1.1",
									textShadow: "0 4px 10px rgba(0,0,0,0.5)",
								}}
							>
								{name}
							</h1>
							<p style={{ fontSize: "24px", color: "#bba998", margin: 0, lineHeight: "1.5" }}>
								Découvrez les statistiques, techniques et talents de {name} sur Azalée, le wiki francophone de Victory
								Road.
							</p>
						</div>
					</div>

					<div
						style={{
							position: "absolute",
							bottom: "20px",
							left: "40px",
							display: "flex",
							alignItems: "center",
							gap: "10px",
						}}
					>
						<div style={{ width: "40px", height: "4px", backgroundColor: accentColor }} />
						<span style={{ color: "#6b5d52", fontSize: "16px" }}>rosegriffon.fr</span>
					</div>
				</div>
			),
			{
				width: 1200,
				height: 630,
			},
		);
	} catch (e: any) {
		console.error(`[OG Error] ${e.message}`);
		return new Response("Failed to generate image", { status: 500 });
	}
}
