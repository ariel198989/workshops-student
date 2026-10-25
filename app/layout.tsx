import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppFrame } from '@/components/AppFrame';
import { ToastHost } from '@/components/ui/ToastHost';

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap';

export const metadata: Metadata = {
  title: 'Workshops OS · Corewise',
  description: 'קונסולת ניהול לסדנאות ראייה ממוחשבת של Corewise',
  icons: { icon: ['/favicon.ico', '/icon-192.png'], apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#F6F8FA',
  width: 'device-width',
  initialScale: 1,
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
