import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Thermal Intelligence — GIS Command",
  description: "NASA FIRMS VIIRS • Facility Baselines • AI Explainability (SIH26162 • NTRD)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-500.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-700.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@latest/latin-400.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@latest/latin-600.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
