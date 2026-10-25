import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppFrame } from '@/components/AppFrame';
import { ToastHost } from '@/components/ui/ToastHost';

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap';

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
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>
        <AppFrame>{children}</AppFrame>
        <ToastHost />
      </body>
    </html>
  );
}
