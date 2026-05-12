import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'camiBOT — Discord tournaments',
  description: 'Hostea torneos directamente en tu servidor de Discord.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={GeistMono.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
