import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SolarPropose — Solar Proposal Automation",
  description: "Generate professional solar proposals with satellite imagery and rooftop analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
