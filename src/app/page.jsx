'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  QrCode,
  Scan,
  LogOut,
  Database,
  Info,
  CheckCircle2,
  Loader2,
  Trash2,
  Users,
  Clock,
  Power,
  X,
  Bot
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

export default function DashboardPage() {
  const { toast, confirmModal } = useToast();
  const [bots, setBots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Bot Modal & QR States
  const [showAddBotModal, setShowAddBotModal] = useState(false);
  const [qrData, setQrData] = useState({
    status: 'idle', // 'idle' | 'starting' | 'waiting_qr' | 'waiting_pin' | 'online'
    qrDataUrl: null,
    qrUrl: null,
    pinCode: null,
    error: null
  });

  const fetchBots = async () => {
    try {
      const res = await fetch('/api/bots');
      const json = await res.json();
      if (json.success) {
        setBots(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching bots:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();

    let eventSource;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('bots_update', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.bots) {
            setBots(data.bots);
          }
          if (data.registered) {
            toast.success(`🎉 เพิ่มบอท "${data.registered.displayName}" เข้าสู่ระบบเรียบร้อยแล้ว!`);
            setShowAddBotModal(false);
            setQrData({ status: 'idle', qrDataUrl: null, qrUrl: null, pinCode: null, error: null });
          }
        } catch (err) {}
      });

      eventSource.addEventListener('qr_status', (e) => {
        try {
          const data = JSON.parse(e.data);
          setQrData({
            status: data.status,
            qrDataUrl: data.qrDataUrl,
            qrUrl: data.qrUrl,
            pinCode: data.pinCode,
            error: data.error
          });

          if (data.status === 'online') {
            setShowAddBotModal(false);
            fetchBots();
          }
        } catch (err) {}
      });
    } catch (e) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleOpenAddBot = async () => {
    setShowAddBotModal(true);
    setQrData({ status: 'starting', qrDataUrl: null, qrUrl: null, pinCode: null, error: null });
    try {
      const res = await fetch('/api/bots/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'new_bot_' + Date.now() })
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || 'ไม่สามารถเริ่มสร้าง QR ได้');
        setQrData(prev => ({ ...prev, status: 'idle', error: json.message }));
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
      setQrData(prev => ({ ...prev, status: 'idle', error: err.message }));
    }
  };

  const handleCancelAddBot = async () => {
    try {
      await fetch('/api/bots/cancel-qr', { method: 'POST' });
    } catch (e) {}
    setShowAddBotModal(false);
    setQrData({ status: 'idle', qrDataUrl: null, qrUrl: null, pinCode: null, error: null });
  };

  const handleRemoveBot = async (mid, name) => {
    const confirmed = await confirmModal({
      title: 'ลบบัญชีบอทออกจากระบบ',
      message: `คุณต้องการลบบอท "${name || 'บอทนี้'}" ออกจากระบบใช่หรือไม่? (บอทจะออกจากระบบและหยุดทำงานทันที)`,
      confirmText: 'ลบบัญชีบอท',
      cancelText: 'ยกเลิก',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/bots/${mid}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(`ลบบอท "${name || 'บอท'}" ออกจากระบบเรียบร้อยแล้ว`);
        setBots(prev => prev.filter(b => b.mid !== mid));
      } else {
        toast.error('ลบบอทไม่สำเร็จ: ' + json.message);
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const handleToggleBot = async (mid, name, currentActive) => {
    const nextActive = !currentActive;
    try {
      const res = await fetch(`/api/bots/${mid}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive })
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${nextActive ? 'เปิดใช้งาน' : 'หยุดทำงานชั่วคราว'} บอท "${name}" แล้ว`);
        setBots(prev => prev.map(b => b.mid === mid ? { ...b, isActive: nextActive, status: nextActive ? 'online' : 'offline' } : b));
      } else {
        toast.error('ไม่สามารถเปลี่ยนสถานะได้: ' + json.message);
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const totalBots = bots.length;
  const onlineBots = bots.filter(b => b.status === 'online').length;
  const totalGroups = bots.reduce((sum, b) => sum + (b.groupCount || 0), 0);

  return (
    <div className="space-y-6">

      {/* Header with Fleet Stats and Add Bot Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Bot className="w-6 h-6 text-line" />
            <span>กองทัพบอทผู้ดูแล (Multi-Bot Fleet)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            จัดการบัญชีบอท LINE ทั้งหมด สามารถรันพร้อมกันได้หลายตัวเพื่อช่วยกันเฝ้ากลุ่มเดียวกัน หรือแยกดูแลคนละกลุ่ม
          </p>
        </div>

        <button
          onClick={handleOpenAddBot}
          className="px-4 py-2.5 rounded-xl bg-line hover:bg-line/90 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-md shadow-line/20 transition active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>➕ เพิ่มบอทตัวใหม่</span>
        </button>
      </div>

      {/* System Overview 3 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="light-card rounded-2xl p-4 sm:p-5 flex items-center space-x-3.5 shadow-sm border-l-4 border-l-line">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-line flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">บอทที่ออนไลน์อยู่</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              {onlineBots} <span className="text-xs text-slate-400 font-normal">/ {totalBots} บอท</span>
            </h3>
          </div>
        </div>

        <div className="light-card rounded-2xl p-4 sm:p-5 flex items-center space-x-3.5 shadow-sm border-l-4 border-l-sky-500">
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">กลุ่มที่ได้รับการดูแลรวม</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              {totalGroups} <span className="text-xs text-slate-400 font-normal">กลุ่ม</span>
            </h3>
          </div>
        </div>

        <div className="light-card rounded-2xl p-4 sm:p-5 flex items-center space-x-3.5 shadow-sm border-l-4 border-l-indigo-500">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">ฐานข้อมูล & Cloud Server</p>
            <h3 className="text-lg sm:text-xl font-bold text-emerald-600 mt-0.5 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Online 24 ชม.</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Bot Cards Fleet List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>รายชื่อบอททั้งหมดในระบบ ({bots.length})</span>
          </h3>
        </div>

        {isLoading ? (
          <div className="light-card rounded-2xl p-12 text-center text-slate-400 space-y-3 shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-line mx-auto" />
            <p className="text-sm text-slate-600 font-medium">กำลังโหลดรายชื่อบอท...</p>
          </div>
        ) : bots.length === 0 ? (
          <div className="light-card rounded-2xl p-10 text-center text-slate-500 space-y-4 shadow-sm border-dashed border-2 border-slate-200">
            <Bot className="w-12 h-12 mx-auto text-slate-400" />
            <div>
              <h4 className="text-base font-bold text-slate-800">ยังไม่มีบอทในระบบ</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                กดปุ่ม <strong>"➕ เพิ่มบอทตัวใหม่"</strong> ด้านบนเพื่อสแกน QR Code นำเข้าบอทตัวแรกได้ทันที
              </p>
            </div>
            <button
              onClick={handleOpenAddBot}
              className="px-5 py-2.5 rounded-xl bg-line hover:bg-line/90 text-white text-xs font-bold inline-flex items-center space-x-2 shadow-md shadow-line/20 transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>เริ่มเพิ่มบอทด้วย QR Code</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {bots.map((b) => {
              const isOnline = b.status === 'online';
              const isActive = b.isActive !== false;

              return (
                <div
                  key={b.mid}
                  className="light-card rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm hover:shadow-md transition border border-slate-100 relative group"
                >
                  {/* Bot Profile Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="relative shrink-0">
                        {b.pictureUrl ? (
                          <img
                            src={b.pictureUrl}
                            alt="Bot"
                            className="w-14 h-14 rounded-2xl bg-slate-100 border-2 border-slate-200 object-cover shadow-sm"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950 border border-emerald-500/30 flex items-center justify-center shadow-sm">
                            <Bot className="w-7 h-7 text-line" />
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            isOnline ? 'bg-emerald-500' : isActive ? 'bg-amber-500' : 'bg-slate-400'
                          }`}
                        ></span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-base truncate">{b.displayName}</h4>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isOnline
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isActive
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {isOnline ? '🟢 Online' : isActive ? '🟡 รอเชื่อมต่อ' : '⏸️ พักการทำงาน'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delete Bot Button */}
                    <button
                      onClick={() => handleRemoveBot(b.mid, b.displayName)}
                      className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-100 bg-white transition shrink-0 active:scale-95 shadow-sm"
                      title="ลบบอทออกจากระบบ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Metrics Bar */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5">
                      <p className="text-[10px] text-slate-500 flex items-center space-x-1 font-medium">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>กลุ่มที่ดูแล</span>
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{b.groupCount || 0} กลุ่ม</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5">
                      <p className="text-[10px] text-slate-500 flex items-center space-x-1 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>เวลาทำงาน</span>
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {isOnline ? `${b.uptime || 0}s` : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Footer Controls: Toggle Active */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">
                      {isActive ? 'สถานะ: เปิดทำงาน' : 'สถานะ: ปิดพักชั่วคราว'}
                    </span>
                    <button
                      onClick={() => handleToggleBot(b.mid, b.displayName, isActive)}
                      className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 transition active:scale-95 ${
                        isActive
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isActive ? 'พักบอท' : 'เปิดทำงาน'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Bot Modal (QR Code) */}
      {showAddBotModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl shadow-slate-900/25 border border-slate-200 space-y-5 animate-scale-up ring-1 ring-slate-900/5 relative">
            {/* Close Button */}
            <button
              onClick={handleCancelAddBot}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-line flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">เพิ่มบอท LINE ตัวใหม่</h3>
                <p className="text-xs text-slate-500">สแกน QR Code ด้วยแอป LINE เพื่อเพิ่มบอทเข้าสู่กองทัพ</p>
              </div>
            </div>

            {/* QR Content */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-center space-y-4">
              {qrData.status === 'starting' && (
                <div className="py-10 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-line mx-auto" />
                  <p className="text-xs text-slate-600 font-medium">กำลังสร้างรหัส QR Code จาก LINE Gateway...</p>
                </div>
              )}

              {qrData.status === 'waiting_qr' && qrData.qrDataUrl && (
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded-2xl inline-block shadow-md border border-slate-100">
                    <img src={qrData.qrDataUrl} alt="LINE QR Code" className="w-48 h-48 sm:w-52 sm:h-52 mx-auto" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800 flex items-center justify-center space-x-1.5">
                      <Scan className="w-4 h-4 text-line" />
                      <span>เปิดแอป LINE ในมือถือ แล้วสแกน QR Code นี้</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      หลังจากสแกนแล้ว ให้กดปุ่ม "เข้าสู่ระบบ (Log in)" ในมือถือ
                    </p>
                  </div>
                </div>
              )}

              {qrData.status === 'waiting_pin' && (
                <div className="py-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <Info className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 font-medium">กรอกรหัส PIN นี้ในมือถือของคุณ:</p>
                    <div className="text-3xl font-black text-slate-900 tracking-widest my-2 font-mono bg-white py-2 px-4 rounded-xl border border-slate-200 inline-block shadow-sm">
                      {qrData.pinCode || '------'}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">กรอกรหัสยืนยันตัวตนในแอป LINE ภายใน 2 นาที</p>
                </div>
              )}

              {qrData.error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {qrData.error}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancelAddBot}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition active:scale-95"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
