'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  QrCode,
  Scan,
  LogOut,
  Database,
  Info,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

export default function DashboardPage() {
  const { toast, confirmModal } = useToast();
  const [statusData, setStatusData] = useState({
    status: 'offline',
    profile: null,
    qrDataUrl: null,
    qrUrl: null,
    pinCode: null,
    uptime: 0,
    groupCount: 0
  });

  const [isStartingLogin, setIsStartingLogin] = useState(false);

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

  const handleStartQRLogin = async () => {
    setIsStartingLogin(true);
    try {
      const res = await fetch('/api/login/qr', { method: 'POST' });
      const json = await res.json();
      if (!json.success) toast.error(json.message);
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsStartingLogin(false);
    }
  };

  const handleCancelLogin = async () => {
    try {
      await fetch('/api/login/cancel', { method: 'POST' });
      toast.info('ยกเลิกการสร้าง QR Code เรียบร้อย');
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirmModal({
      title: 'ออกจากระบบ LINE',
      message: 'คุณต้องการออกจากระบบ LINE หรือไม่? (บอทจะหยุดทำงานและกลับสู่สถานะออฟไลน์)',
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await fetch('/api/logout', { method: 'POST' });
      toast.success('ออกจากระบบ LINE เรียบร้อยแล้ว');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error('ออกจากระบบไม่สำเร็จ: ' + err.message);
    }
  };

  const isOnline = statusData.status === 'online';
  const isWaitingAuth = statusData.status === 'waiting_qr' || statusData.status === 'waiting_pin';

  return (
    <div className="space-y-6">
      
      {/* Bot Profile & Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Status Card */}
        <div className="light-card rounded-2xl p-4 sm:p-6 md:col-span-2 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center space-x-3.5 sm:space-x-4 min-w-0">
              <div className="relative shrink-0">
                {statusData.profile?.pictureUrl ? (
                  <img
                    src={statusData.profile.pictureUrl}
                    alt="Bot Avatar"
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 border-2 border-slate-200 object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 border-2 border-emerald-400/50 flex items-center justify-center shadow-md shadow-emerald-500/20">
                    <ShieldCheck className="w-8 h-8 sm:w-9 sm:h-9 text-line drop-shadow-[0_0_10px_rgba(6,199,85,0.6)]" />
                  </div>
                )}
                <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white ${
                  isOnline ? 'bg-emerald-500' : isWaitingAuth ? 'bg-amber-500' : 'bg-red-500'
                }`}></span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                  {statusData.profile?.displayName || 'LINE Guardian Bot'}
                </h2>
                <div className="flex items-center space-x-2 mt-1.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold border ${
                    isOnline
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : isWaitingAuth
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    {isOnline ? 'Online (ทำงาน 24 ชม.)' : isWaitingAuth ? 'รอเข้าสู่ระบบ...' : 'Offline (ไม่ได้ล็อกอิน)'}
                  </span>
                </div>
              </div>
            </div>

            {isOnline && (
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100 hover:border-red-300 text-xs font-bold flex items-center justify-center space-x-2 transition shadow-sm active:scale-95 shrink-0"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span>ออกจากระบบ / สลับบัญชี</span>
              </button>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3.5 border border-slate-100 text-center sm:text-left">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">กลุ่มที่ดูแล</p>
              <p className="text-base sm:text-xl font-bold text-slate-900 mt-0.5 sm:mt-1">{statusData.groupCount || 0} กลุ่ม</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3.5 border border-slate-100 text-center sm:text-left">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">เวลาทำงาน</p>
              <p className="text-base sm:text-xl font-bold text-emerald-600 mt-0.5 sm:mt-1">{statusData.uptime || 0}s</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3.5 border border-slate-100 text-center sm:text-left">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">ฐานข้อมูล</p>
              <p className="text-base sm:text-xl font-bold text-sky-600 mt-0.5 sm:mt-1 truncate">Supabase</p>
            </div>
          </div>
        </div>

        {/* Database Helper */}
        <div className="light-card rounded-2xl p-4 sm:p-6 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-sm">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Supabase Connected</span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              ระบบบันทึกข้อมูล Token, การตั้งค่าความปลอดภัย และประวัติ Logs ลงฐานข้อมูล Supabase ฝั่ง Server-side อัตโนมัติ
            </p>
          </div>
          <div className="bg-emerald-50/60 rounded-xl p-3 sm:p-3.5 border border-emerald-100 text-xs text-slate-700 space-y-1">
            <p className="font-semibold text-emerald-900 flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-600" />
              <span>คำแนะนำสร้างตาราง:</span>
            </p>
            <p className="text-slate-600 text-[11px] sm:text-xs">เปิดไฟล์ <code className="text-emerald-700 font-bold font-mono">supabase_schema.sql</code> แล้วนำไป Run ใน Supabase ได้ทันทีครับ</p>
          </div>
        </div>

      </div>

      {/* First-Time QR Code Login Box */}
      <div className="light-card rounded-2xl p-4 sm:p-6 md:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
              <QrCode className="w-5 h-5 text-line shrink-0" />
              <span>เข้าสู่ระบบ LINE บอท (First-Time QR Login)</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">สแกน QR Code ครั้งเดียวเพื่อรับ Token ระบบจะบันทึกและจำรหัสไว้ตลอดไป</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {isWaitingAuth && (
              <button
                onClick={handleCancelLogin}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition shadow-sm active:scale-95"
              >
                <span>ยกเลิกการสแกน</span>
              </button>
            )}
            <button
              onClick={handleStartQRLogin}
              disabled={isStartingLogin || isOnline || isWaitingAuth}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition shadow-md active:scale-95 ${
                isOnline || isWaitingAuth
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-line hover:bg-line-dark text-white shadow-line/25'
              }`}
            >
              {isStartingLogin ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังสร้าง QR...</span>
                </>
              ) : (
                <>
                  <Scan className="w-4 h-4" />
                  <span>เริ่มเข้าสู่ระบบด้วย QR Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* QR Display Container */}
        {isWaitingAuth && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-50/80 rounded-2xl p-6 border border-slate-200">
            <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-inner">
                {statusData.qrDataUrl ? (
                  <img src={statusData.qrDataUrl} alt="QR Code" className="w-56 h-56 object-contain" />
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-line mb-2" />
                    <span className="text-xs">กำลังขอ QR Code จาก LINE...</span>
                  </div>
                )}
              </div>
              <p className="text-xs font-medium text-slate-500 mt-3 text-center">เปิดกล้องหรือแอป LINE เพื่อสแกน QR Code นี้</p>
            </div>

            {/* Step-by-Step Instructions & PIN Code */}
            <div className="space-y-5">
              <div className="space-y-2">
                <h4 className="text-base font-bold text-slate-900">ขั้นตอนการยืนยันตัวตน:</h4>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>เปิดแอป <strong>LINE</strong> ในมือถือของคุณ (ใช้บัญชีที่ต้องการเป็นบอท)</li>
                  <li>กดปุ่มสแกน QR Code แล้วส่องที่ภาพทางซ้ายมือ</li>
                  <li>หากหน้าจอ LINE ในมือถือขึ้นให้ใส่ <strong>รหัส PIN 4 หลัก</strong> ให้กรอกรหัสด้านล่างนี้:</li>
                </ol>
              </div>

              {/* PIN Box */}
              <div className="bg-white border-2 border-line rounded-2xl p-5 text-center shadow-md">
                <p className="text-xs font-bold uppercase tracking-wider text-line">รหัส PIN ยืนยันตัวตน (Verification PIN)</p>
                <p className="text-4xl font-extrabold text-slate-900 tracking-widest mt-2 font-mono">
                  {statusData.pinCode || 'รอสแกน...'}
                </p>
                <p className="text-xs text-slate-500 mt-1">กรอกรหัสนี้ในแอป LINE เมื่อระบบถามหา</p>
              </div>

              <div className="flex items-center space-x-2 text-xs font-medium text-slate-500">
                <div className="w-3.5 h-3.5 border-2 border-line border-t-transparent rounded-full animate-spin"></div>
                <span>กำลังรอการสแกนและยืนยันตัวตน...</span>
              </div>
            </div>
          </div>
        )}

        {/* Logged in success alert */}
        {isOnline && (
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-emerald-900">บอทออนไลน์พร้อมทำงาน 24 ชั่วโมงแล้ว!</h4>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              ระบบบันทึก Token เรียบร้อยแล้ว คุณสามารถไปที่เมนู <strong>"จัดการกลุ่ม & ตั้งค่าความปลอดภัย"</strong> เพื่อเปิดระบบกันกลุ่มได้ทันที
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
