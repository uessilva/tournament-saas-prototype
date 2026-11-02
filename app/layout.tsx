import type { Metadata, Viewport } from "next";

import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "@/app/globals.css";

import { LanguageProvider } from "@/lib/i18n/client";
import { getServerLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Summer Cup 2026",
    template: "%s · Summer Cup 2026",
  },
  description:
    "Hub público e administração local do Summer Cup 2026. Futebol Sub-12 e Tênis Open.",
};

export const viewport: Viewport = {
  themeColor: "#176b46",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <LanguageProvider initialLocale={locale}>
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition-transform focus:translate-y-0"
          >
            Pular para o conteúdo / Skip to content
          </a>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
