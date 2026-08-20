'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  UsersRound,
  Shield,
  History
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [statusData, setStatusData] = useState({
    status: 'offline',
    profile: null,
    uptime: 0
  });

  useEffect(() => {
    let eventSource;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('status', (e) => {
        try {
          const data = JSON.parse(e.data);
          setStatusData(data);
        } catch (err) {}
      });
    } catch (e) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const isOnline = statusData.status === 'online';
  const isWaitingAuth = statusData.status === 'waiting_qr' || statusData.status === 'waiting_pin';

  const navItems = [
    { href: '/', label: 'ภาพรวม & เข้าสู่ระบบ', icon: LayoutDashboard },
    { href: '/groups', label: 'จัดการกลุ่ม & ตั้งค่าความปลอดภัย', icon: UsersRound },
    { href: '/whitelist', label: 'ผู้ดูแลระบบ (Whitelist)', icon: Shield },
    { href: '/logs', label: 'ประวัติกิจกรรม (Audit Logs)', icon: History },
  ];

  return (
    <header className="border-b border-slate-200 bg-white/95 sticky top-0 z-50 backdrop-blur shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Bar */}
        <div className="h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-line flex items-center justify-center shadow-md shadow-line/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Guardian Bot</h1>
              <p className="text-xs text-slate-500">LINE Group Protection & BackOffice</p>
            </div>
          </Link>

          {/* Live Status Badge */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm border ${
              isOnline
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isWaitingAuth
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-emerald-500' : isWaitingAuth ? 'bg-amber-500 animate-ping' : 'bg-red-500'
              }`}></span>
              <span>
                {isOnline
                  ? 'ออนไลน์ (Online)'
                  : isWaitingAuth
                  ? (statusData.status === 'waiting_pin' ? 'กรุณากรอกรหัส PIN ใน LINE' : 'รอการสแกน QR Code')
                  : 'ออฟไลน์ (Offline)'}
              </span>
            </div>
          </div>
        </div>

        {/* Path Navigation Links */}
        <nav className="flex space-x-2 pb-3 overflow-x-auto pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-xl text-sm flex items-center space-x-2 transition font-medium whitespace-nowrap ${
                  isActive
                    ? 'bg-line text-white font-semibold shadow-md shadow-line/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

      </div>
    </header>
  );
}
