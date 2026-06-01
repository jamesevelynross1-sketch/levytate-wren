import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PAGABO Apprenticeship Hub | LevyTate",
    template: "%s | LevyTate",
  },
  description:
    "A PAGABO-branded internal apprenticeship hub powered by LevyTate.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
