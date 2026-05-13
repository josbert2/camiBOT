import type { Metadata } from 'next';
import Script from 'next/script';
import { GeistMono } from 'geist/font/mono';
import { Nav } from '@/components/nav';
import './globals.css';

const SITE_URL = process.env.AUTH_URL ?? 'https://tournify.josbert.dev';
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC ?? '/stats-script.js';
const SITE_NAME = 'Tournify';
const SITE_DESC =
  'Hostea torneos competitivos directamente en tu servidor de Discord. Single elim, doble elim, round robin, teams 2v2/3v3, leaderboards, brackets en vivo.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Torneos de Discord`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  authors: [{ name: 'Jayce la Senna' }],
  keywords: [
    'discord bot',
    'torneos discord',
    'tournament bot',
    'single elimination',
    'double elimination',
    'round robin',
    'bracket',
    'esports',
    'gaming',
    'leaderboard',
    'camibot',
    'tournify',
  ],
  category: 'gaming',
  alternates: {
    canonical: '/',
    languages: { 'es-CL': '/' },
  },
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Torneos de Discord`,
    description: SITE_DESC,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Torneos de Discord`,
    description: SITE_DESC,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={GeistMono.variable}>
      <head>
        <meta name="theme-color" content="#0a0c0d" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: SITE_NAME,
              applicationCategory: 'GameApplication',
              operatingSystem: 'Discord',
              description: SITE_DESC,
              url: SITE_URL,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Nav />
        {children}
        {UMAMI_WEBSITE_ID && (
          <Script
            async
            defer
            src={UMAMI_SRC}
            data-website-id={UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
