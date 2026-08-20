'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';
import Navbar from './Navbar';

export default function AuthWrapper({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Login page does not need auth check
    if (pathname === '/login') {
      setIsChecking(false);
      setIsAuthenticated(false);
      return;
    }

    const token = localStorage.getItem('guardian_token');
    if (!token) {
      setIsChecking(false);
      setIsAuthenticated(false);
      router.replace('/login');
      return;
    }

    // Verify token with server
    fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('guardian_token');
          localStorage.removeItem('guardian_user');
          setIsAuthenticated(false);
          router.replace('/login');
        }
      })
      .catch(() => {
        // Fallback for offline/cached session
        const stored = localStorage.getItem('guardian_user');
        if (stored) {
          setIsAuthenticated(true);
        } else {
          router.replace('/login');
        }
      })
      .finally(() => {
        setIsChecking(false);
      });
  }, [pathname, router]);

  // If on /login, render without Navbar, without main py-8, and without footer
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // If checking authentication, show glowing loading screen
  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-line text-white flex items-center justify-center mb-4 shadow-xl shadow-line/25 ring-4 ring-emerald-50">
          <ShieldCheck className="w-8 h-8 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-line" />
          <span>กำลังตรวจสอบสิทธิ์เข้าถึง (Authenticating)...</span>
        </div>
      </div>
    );
  }

  // If not authenticated and not on /login, block rendering
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated pages layout
  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <p>Guardian Bot &bull; High-Performance LINE Group Protection System (Next.js + Tailwind CSS)</p>
      </footer>
    </>
  );
}
