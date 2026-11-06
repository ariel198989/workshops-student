import type { Metadata, Viewport } from 'next';
import { Rubik, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { AppFrame } from '@/components/AppFrame';
import { ToastHost } from '@/components/ui/ToastHost';

// Self-hosted at build time by next/font: no render-blocking request to fonts.googleapis.com.
// Both families are variable fonts, so one file per subset covers every weight the app uses
// (Rubik 400-900, Space Grotesk 500 and 700). globals.css reads them through these variables.
const rubik = Rubik({ subsets: ['hebrew', 'latin'], display: 'swap', variable: '--font-rubik' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'Workshops Student · Corewise',
  description: 'צילום, תיוג ואימון מודל ראייה ממוחשבת עם הקבוצה שלכם',
  manifest: '/manifest.webmanifest',
  icons: { icon: ['/favicon.ico', '/icon-192.png'], apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'Workshops', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${spaceGrotesk.variable}`}>
      <body>
        <AppFrame>{children}</AppFrame>
        <ToastHost />
      </body>
    </html>
  );
}
