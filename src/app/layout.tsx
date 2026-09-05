import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope } from "next/font/google";
import "./globals.css";

const fuenteTitulo = Plus_Jakarta_Sans({
  variable: "--fuente-titulo",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const fuenteCuerpo = Manrope({
  variable: "--fuente-cuerpo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pedidos Helado Artesanal",
  description: "Sistema de pedidos, recibos y rótulos para helado artesanal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${fuenteTitulo.variable} ${fuenteCuerpo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
