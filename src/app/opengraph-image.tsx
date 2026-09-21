import { ImageResponse } from "next/og";

export const alt = "TAPEBASE – społecznościowa baza muzyki";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "space-between", background: "#09090b", color: "#fafafa",
      padding: "72px 84px", fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 38, fontWeight: 900, letterSpacing: 2 }}>
        <span style={{ color: "#22d3ee", marginRight: 6 }}>▌</span>
        <span style={{ color: "#ef4444", marginRight: 18 }}>▌</span>
        TAPEBASE
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ maxWidth: 940, fontSize: 72, lineHeight: 1.05, fontWeight: 900 }}>
          Oceniaj albumy i artystów.
        </div>
        <div style={{ marginTop: 28, fontSize: 34, color: "#a1a1aa" }}>
          Recenzje · rankingi · playlisty · odkrywanie muzyki
        </div>
      </div>
      <div style={{ fontSize: 26, color: "#71717a" }}>tapebase.pl</div>
    </div>,
    size,
  );
}
