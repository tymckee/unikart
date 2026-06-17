import { ImageResponse } from "next/og";
import { wheelDataUri } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1d1d1f",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={118} height={118} src={wheelDataUri("#ffffff", 4, 8)} alt="" />
      </div>
    ),
    { ...size },
  );
}
