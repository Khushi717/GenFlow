import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';

export const metadata: Metadata = {
  title: 'GenFlow | Work Smarter, Flow Faster',
  description: 'Manage tasks, summarize documents, generate emails, and schedule meetings with ease. The all-in-one AI assistant designed for peak performance.',
  metadataBase: new URL('http://localhost:3000'),
  openGraph: {
    title: 'GenFlow | Work Smarter, Flow Faster',
    description: 'The all-in-one AI assistant designed for peak performance.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-on-surface antialiased overflow-x-hidden selection:bg-primary/30">
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
