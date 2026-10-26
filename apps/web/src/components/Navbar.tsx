'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, useTransition } from 'react';
import api from '@/lib/api';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/analyze', label: 'Analyze' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-black/75 backdrop-blur-2xl border-b border-white/[0.08] transition-all">
      <div className="max-w-6xl mx-auto px-6 h-13 flex items-center justify-between">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 group text-sm tracking-tight text-white"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] transition-transform group-hover:scale-125" />
            <span className="font-semibold text-[15px] tracking-tight text-white">
              GapCheck
            </span>
          </Link>

          {/* Desktop Navigation Segmented Control */}
          <nav className="hidden md:flex items-center p-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs px-3.5 py-1 rounded-full transition-all duration-200 ${
                    isActive
                      ? 'text-white font-medium bg-white/[0.12] shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-3">
          {token ? (
            <>
              <button
                onClick={handleLogout}
                className="text-xs text-neutral-400 hover:text-white transition-colors px-2.5 py-1.5 cursor-pointer"
              >
                Sign out
              </button>
              <Link
                href="/analyze"
                className="text-xs font-medium px-4 py-1.5 rounded-full bg-white text-black hover:bg-neutral-200 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] active:scale-[0.98]"
              >
                New analysis
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={handleDemoLogin}
                className="text-xs text-neutral-400 hover:text-white transition-colors px-2.5 py-1.5 cursor-pointer"
              >
                Try Demo
              </button>
              <Link
                href="/login"
                className="text-xs text-neutral-300 hover:text-white transition-colors px-2.5 py-1.5"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="text-xs font-medium px-4 py-1.5 rounded-full bg-white text-black hover:bg-neutral-200 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] active:scale-[0.98]"
              >
                Create account
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg border border-white/[0.08]"
            aria-label="Toggle navigation menu"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/[0.08] bg-black/95 backdrop-blur-2xl px-6 py-4 space-y-3">
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm py-2 px-3 rounded-lg ${
                  pathname === link.href
                    ? 'text-white bg-white/[0.08] font-medium'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-2">
            {token ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left text-xs py-2 px-3 text-neutral-400 hover:text-white"
              >
                Sign out
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-left text-xs py-2 px-3 text-neutral-300 hover:text-white"
                >
                  Log in
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleDemoLogin();
                  }}
                  className="w-full text-left text-xs py-2 px-3 text-neutral-400 hover:text-white"
                >
                  Try Demo
                </button>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center text-xs font-medium py-2.5 rounded-full bg-white text-black hover:bg-neutral-200"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
