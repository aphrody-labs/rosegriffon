import { ImageResponse } from "next/og";

// Image metadata
export const size = {
  height: 32,
  width: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#a14b3f",
        color: "white",
        display: "flex",
        fontSize: 24,
        fontWeight: "bold",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      RG
    </div>,
    {
      ...size,
    }
  );
}
