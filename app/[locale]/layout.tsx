import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import { routing } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { RoleBadge } from "@/components/shared/role-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ThemeProvider } from "@/hooks/useTheme";
import { TablesProvider } from "@/hooks/useTables";
import { CartProvider } from "@/hooks/useCart";
import { OrdersProvider } from "@/hooks/useOrders";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/get-current-role";
import "../globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "PhaDinCoffee",
  description: "Order ahead, track your order, and earn loyalty points.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PhaDinCoffee",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#b3341f",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const supabase = await createClient();
  const role = await getCurrentRole(supabase);

  return (
    <html
      lang={locale}
      className={`${beVietnamPro.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("phadincoffee-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <TablesProvider>
              <CartProvider>
                <OrdersProvider>
                  <div id="header-actions-stack" className="fixed top-2 right-2 z-50 flex items-center gap-2">
                    <RoleBadge role={role} />
                    <ThemeToggle />
                    <LanguageSwitcher />
                  </div>
                  {children}
                </OrdersProvider>
              </CartProvider>
            </TablesProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
