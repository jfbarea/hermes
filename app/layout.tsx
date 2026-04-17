import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hermes",
  description: "Generador de borradores de email para tutores PIR",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
