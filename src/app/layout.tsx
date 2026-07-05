import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/providers/PostHogProvider";

// Match the landing's typography: Space Grotesk (display) + JetBrains Mono (data).
// Only the weights actually used in the app are requested — 700 is never applied
// (no `font-bold` / weight-700 anywhere), so we skip two webfont downloads.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Mercury — a calm hiring workspace",
  description:
    "Turn an inbox of job applications into a clean, skimmable, human-controlled hiring board. Every applicant stays visible. Every filter is yours.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg-deep font-sans text-text">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
