import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 60,
        background: "linear-gradient(135deg, #a14b3f 0%, #2f6e9c 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "white",
        fontWeight: "bold",
      }}
    >
      <div style={{ fontSize: 80, marginBottom: 20 }}>Rose Griffon</div>
      <div style={{ fontSize: 40 }}>Association Inazuma Eleven France</div>
    </div>,
    {
      ...size,
    }
  );
}
