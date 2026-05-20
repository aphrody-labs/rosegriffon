import { ImageResponse } from "next/og";

export const size = {
  height: 630,
  width: 1200,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #a14b3f 0%, #2f6e9c 100%)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        fontSize: 60,
        fontWeight: "bold",
        height: "100%",
        justifyContent: "center",
        width: "100%",
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
