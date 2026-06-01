import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ENQUIRY_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: {
    default: "MPR Consulting | Apprenticeship Strategy Advisory",
    template: "%s | MPR Consulting",
  },
  description:
    "Independent apprenticeship, workforce capability and funded training advisory for employers.",
  other: {
    "contact:email": ENQUIRY_EMAIL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
