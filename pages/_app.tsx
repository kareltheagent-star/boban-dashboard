import type { AppProps } from 'next/app';
import Head from 'next/head';
import Link from 'next/link';
import '../styles/globals.css';
import { AuthGate } from '../components/AuthGate';

export default function BobanDashboardApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Boban Dashboard</title>
      </Head>
      <AuthGate>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex">
          <aside className="w-56 border-r border-slate-800 px-4 py-4 flex flex-col gap-4">
            <div className="font-mono text-sm text-slate-400">Boban Ops</div>
            <nav className="space-y-2 text-sm">
              <div>
                <Link href="/" className="hover:text-sky-400">Status</Link>
              </div>
              <div>
                <Link href="/backlog" className="hover:text-sky-400">Backlog</Link>
              </div>
              <div>
                <Link href="/learning" className="hover:text-sky-400">Learning</Link>
              </div>
            </nav>
          </aside>
          <main className="flex-1 px-4 py-4 max-w-5xl mx-auto">
            <Component {...pageProps} />
          </main>
        </div>
      </AuthGate>
    </>
  );
}
