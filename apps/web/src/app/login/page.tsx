'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar, { notifyAuthChanged } from '@/components/Navbar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    isExpired ? 'Your session has expired. Please log in again.' : null
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      await api.login(email.trim(), password);
      notifyAuthChanged();
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      await api.loginDemo();
      notifyAuthChanged();
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch demo.';
      setError(msg);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Sign in to GapCheck
        </h1>
        <p className="text-xs text-neutral-400">
          Access your pre-application audits and reports
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-300">Email</label>
          <Input
            type="email"
            placeholder="student@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || demoLoading}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-neutral-300">Password</label>
          </div>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || demoLoading}
            autoComplete="current-password"
            required
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full mt-2"
          disabled={loading || demoLoading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/[0.08]" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-mono">
          <span className="bg-black px-2 text-neutral-500">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="md"
        className="w-full text-xs text-neutral-300"
        onClick={handleDemoLogin}
        disabled={loading || demoLoading}
      >
        {demoLoading ? 'Loading demo...' : 'Explore Sample Profile (Demo)'}
      </Button>

      <div className="text-center text-xs text-neutral-400 pt-2">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-white hover:underline font-medium">
          Create an account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col antialiased selection:bg-white/20 selection:text-white">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-6">
        <Suspense fallback={<div className="text-xs text-neutral-400">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
