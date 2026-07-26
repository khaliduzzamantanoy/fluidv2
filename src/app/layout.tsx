import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FLUID — One-Time VPS Deployment Assistant',
  description: 'Automated single-project VPS setup wizard with GitHub integration, PM2, Nginx, and Certbot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-gray-100 antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
