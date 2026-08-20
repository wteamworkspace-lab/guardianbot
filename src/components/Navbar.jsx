'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  UsersRound,
  Shield,
  History,
  LogOut,
  KeyRound,
  User,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useToast } from './ToastProvider';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [statusData, setStatusData] = useState({
    status: 'offline',
    profile: null,
    uptime: 0
  });

  // Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (pathname === '/login') return;

    // Check authentication
    const token = localStorage.getItem('guardian_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Verify token
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
        } else {
          localStorage.removeItem('guardian_token');
          localStorage.removeItem('guardian_user');
          router.push('/login');
        }
      })
      .catch(() => {
        // Offline resilience: try reading stored user
        const stored = localStorage.getItem('guardian_user');
        if (stored) {
          try { setCurrentUser(JSON.parse(stored)); } catch (e) {}
        }
      });
  }, [pathname, router]);

  useEffect(() => {
    if (pathname === '/login') return;

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
  }, [pathname]);

  if (pathname === '/login') {
    return null;
  }

  const { toast, confirmModal } = useToast();

  const handleLogout = async () => {
    const confirmed = await confirmModal({
      title: 'ออกจากระบบ BackOffice',
      message: 'คุณต้องการออกจากระบบจัดการ (BackOffice) ใช่หรือไม่?',
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก',
      type: 'danger'
    });

    if (confirmed) {
      localStorage.removeItem('guardian_token');
      localStorage.removeItem('guardian_user');
      toast.info('ออกจากระบบจัดการเรียบร้อยแล้ว');
      router.push('/login');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMessage({ type: '', text: '' });

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassMessage({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
      return;
    }

    if (newPassword.length < 6) {
      setPassMessage({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassMessage({ type: 'error', text: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน' });
      return;
    }

    setPassLoading(true);
    try {
      const token = localStorage.getItem('guardian_token');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();

      if (data.success) {
        setPassMessage({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว!' });
        setTimeout(() => {
          setShowPasswordModal(false);
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setPassMessage({ type: '', text: '' });
        }, 1500);
      } else {
        setPassMessage({ type: 'error', text: data.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
      }
    } catch (err) {
      setPassMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' });
    } finally {
      setPassLoading(false);
    }
  };

  const isOnline = statusData.status === 'online';
  const isWaitingAuth = statusData.status === 'waiting_qr' || statusData.status === 'waiting_pin';

  const navItems = [
    { href: '/', label: 'ภาพรวม & เข้าสู่ระบบ', icon: LayoutDashboard },
    { href: '/groups', label: 'จัดการกลุ่ม & ตั้งค่าความปลอดภัย', icon: UsersRound },
    { href: '/whitelist', label: 'ผู้ดูแลระบบ (Whitelist)', icon: Shield },
    { href: '/logs', label: 'ประวัติกิจกรรม (Audit Logs)', icon: History },
  ];

  return (
    <>
      <header className="border-b border-slate-200 bg-white/95 sticky top-0 z-50 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top Bar */}
          <div className="h-14 sm:h-16 flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center space-x-2.5 sm:space-x-3 group min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-line flex items-center justify-center shadow-md shadow-line/20 group-hover:scale-105 transition-transform shrink-0">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">Guardian Bot</h1>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate hidden xs:block">LINE Group Protection</p>
              </div>
            </Link>

            {/* Right Controls: Bot Status & Admin Account */}
            <div className="flex items-center space-x-2 shrink-0">
              {/* Live Status Badge */}
              <div className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold shadow-sm border ${
                isOnline
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : isWaitingAuth
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${
                  isOnline ? 'bg-emerald-500' : isWaitingAuth ? 'bg-amber-500 animate-ping' : 'bg-red-500'
                }`}></span>
                <span className="truncate max-w-[90px] xs:max-w-none">
                  {isOnline
                    ? 'ออนไลน์'
                    : isWaitingAuth
                    ? (statusData.status === 'waiting_pin' ? 'กรอกรหัส PIN' : 'รอสแกน QR')
                    : 'ออฟไลน์'}
                </span>
              </div>

              {/* Admin Actions */}
              <div className="flex items-center space-x-1 sm:space-x-2 pl-1.5 sm:pl-2 border-l border-slate-200">
                <button
                  onClick={() => setShowPasswordModal(true)}
                  title="เปลี่ยนรหัสผ่านแอดมิน"
                  className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1.5 text-xs font-medium border border-slate-200 active:scale-95"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden lg:inline">เปลี่ยนรหัส</span>
                </button>

                <button
                  onClick={handleLogout}
                  title="ออกจากระบบจัดการ"
                  className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition flex items-center gap-1.5 text-xs font-medium border border-rose-200 active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">ออกระบบ</span>
                </button>
              </div>
            </div>
          </div>

          {/* Path Navigation Links (Horizontal Smooth Touch Scroll) */}
          <nav className="flex space-x-1.5 sm:space-x-2 pb-2.5 sm:pb-3 overflow-x-auto pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm flex items-center space-x-1.5 sm:space-x-2 transition font-medium whitespace-nowrap shrink-0 active:scale-95 ${
                    isActive
                      ? 'bg-line text-white font-semibold shadow-md shadow-line/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

        </div>
      </header>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setPassMessage({ type: '', text: '' });
              }}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">เปลี่ยนรหัสผ่านแอดมิน</h3>
                <p className="text-xs text-slate-500">สำหรับเข้าสู่ระบบ BackOffice แดชบอร์ด</p>
              </div>
            </div>

            {passMessage.text && (
              <div className={`mb-4 p-3 rounded-xl flex items-start gap-2 text-xs font-medium ${
                passMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}>
                {passMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <span>{passMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  รหัสผ่านเดิม
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="รหัสผ่านปัจจุบัน"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-line focus:ring-1 focus:ring-line transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="รหัสผ่านใหม่"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-line focus:ring-1 focus:ring-line transition"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  ยืนยันรหัสผ่านใหม่
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-line focus:ring-1 focus:ring-line transition"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={passLoading}
                  className="flex-1 py-2.5 px-4 bg-line hover:bg-line/90 text-white rounded-xl text-sm font-medium shadow-md shadow-line/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {passLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'บันทึกรหัสผ่าน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
