import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'WhatsApp CRM — Inbox client', template: '%s — WhatsApp CRM' },
  description:
    'Une boîte de réception WhatsApp claire, rapide et pensée pour le mobile — propulsée par Kamtech.',
  applicationName: 'WhatsApp CRM',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#25D366',
};

const themeInitScript = `
try {
  var theme = localStorage.getItem('whatsapp-crm-theme');
  if (theme !== 'light' && theme !== 'dark') theme = 'dark';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
} catch (e) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className="antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
