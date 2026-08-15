import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/providers";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MealWorks",
  description: "Office café menu, matched to your diet.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

/** Prevents flash of wrong theme before React hydrates (incl. schedule). */
const themeInitScript = `(function(){try{var k='mealworks-theme';var raw=localStorage.getItem(k);var pref='system';var from='20:00',to='07:00';if(raw==='light'||raw==='dark'||raw==='system'||raw==='schedule'){pref=raw;}else if(raw){try{var o=JSON.parse(raw);if(o&&(o.preference==='light'||o.preference==='dark'||o.preference==='system'||o.preference==='schedule'))pref=o.preference;if(o&&o.schedule){if(o.schedule.darkFrom)from=String(o.schedule.darkFrom);if(o.schedule.darkTo)to=String(o.schedule.darkTo);}}catch(e){}}function mins(t){var m=/^(\\d{1,2}):(\\d{2})/.exec(String(t||''));if(!m)return null;var h=+m[1],n=+m[2];if(h<0||h>23||n<0||n>59)return null;return h*60+n;}function darkNow(){var now=new Date(),cur=now.getHours()*60+now.getMinutes();var a=mins(from),b=mins(to);if(a==null||b==null||a===b)return false;if(a<b)return cur>=a&&cur<b;return cur>=a||cur<b;}var d;if(pref==='light'||pref==='dark')d=pref;else if(pref==='schedule')d=darkNow()?'dark':'light';else d=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var r=document.documentElement;r.setAttribute('data-theme',d);r.style.colorScheme=d;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="light">
      <body className={`${fraunces.variable} ${jakarta.variable} antialiased`}>
        <Script
          id="mealworks-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
