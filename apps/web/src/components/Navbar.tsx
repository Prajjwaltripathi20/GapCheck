'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, LayoutDashboard, Search, Sparkles, LogOut, GitBranch } from 'lucide-react';
import api from '@/lib/api';
import { useSyncExternalStore, useTransition } from 'react';

const authListeners = new Set<() => void>();

export function notifyAuthChanged() {
  authListeners.forEach((cb) => cb());
}

function subscribeAuth(callback: () => void) {
  authListeners.add(callback);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', callback);
  }
  return () => {
    authListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', callback);
    }
  };
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const token = useSyncExternalStore(
    subscribeAuth,
    () => api.getToken(),
    () => null
  );

  const handleDemoLogin = async () => {
    try {
      await api.loginDemo();
      notifyAuthChanged();
      startTransition(() => {
        router.push('/dashboard');
      });
    } catch (err) {
      console.error('Demo login error:', err);
    }
  };

  const handleLogout = () => {
    api.logout();
    notifyAuthChanged();
    router.push('/');
  };

  return (
    <nav className="glass sticky top-0 z-50 border-b border-[#2a2a3a] px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              Gap<span className="text-indigo-400">Check</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v1.0
              </span>
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1 bg-[#12121a]/80 border border-[#2a2a3a] p-1 rounded-xl">
          <Link
            href="/analyze"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              pathname === '/analyze'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Audit Engine
          </Link>
          <Link
            href="/dashboard"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              pathname === '/dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Readiness Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDemoLogin}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-300 border border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-500/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            One-Click Demo
          </button>

          {token && (
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <GitBranch className="w-4 h-4" />
          </a>
        </div>
      </div>
    </nav>
  );
}
