import type { AppProps } from 'next/app';
import Head from 'next/head';
import Link from 'next/link';
import '../styles/globals.css';
import { AuthGate } from '../components/AuthGate';

const requiredPassword = process.env.DASHBOARD_PASSWORD || 'change-me';

export default function BobanDashboardApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Boban Dashboard</title>
      </Head>
      <AuthGate requiredPassword={requiredPassword}>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="font-mono text-sm text-slate-400">Boban Status Dashboard</div>
            <nav className="space-x-4 text-sm">
              <Link href="/" className="hover:text-sky-400">Status</Link>
              <Link href="/backlog" className="hover:text-sky-400">Backlog</Link>
              <Link href="/learning" className="hover:text-sky-400">Learning</Link>
            </nav>
          </header>
          <main className="px-4 py-4 max-w-5xl mx-auto">
            <Component {...pageProps} />
          </main>
        </div>
      </AuthGate>
    </>
  );
}
