'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';

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

  // If on /login, render without protection
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // If checking authentication, show glowing loading screen
  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 ring-4 ring-emerald-500/20 shadow-lg shadow-emerald-500/20">
          <ShieldCheck className="w-8 h-8 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>กำลังตรวจสอบสิทธิ์เข้าถึง (Authenticating)...</span>
        </div>
      </div>
    );
  }

  // If not authenticated and not on /login, block rendering
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
