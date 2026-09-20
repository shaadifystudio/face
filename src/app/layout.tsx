import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shaadify Face — Your wedding. Your moments. Instantly found.',
  description: 'AI-powered wedding photo discovery for photographers and their clients.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}