'use client';

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useToast } from '../../components/ToastProvider';

export default function LogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async (isManual = false) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/logs?limit=50');
      const json = await res.json();
      setLogs(json.data || []);
      if (isManual) toast.success('รีเฟรชประวัติกิจกรรมเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      if (isManual) toast.error('เกิดข้อผิดพลาดในการโหลดประวัติ: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-line" />
            <span>ประวัติการตรวจจับและเตะผู้กระทำผิด (Audit Logs)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            บันทึกเหตุการณ์ทุกครั้งที่มีการเตะคนส่งลิงก์ เชิญมั่ว หรือเตะคนอื่น
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={isLoading}
          className="w-full sm:w-auto px-4 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center space-x-2 transition border border-slate-200 shadow-sm active:scale-95 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
          <span>รีเฟรชประวัติ</span>
        </button>
      </div>

      <div className="light-card rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-line mx-auto mb-2" />
            กำลังโหลดประวัติ...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            ยังไม่มีประวัติการกระทำผิด (ระบบกำลังเฝ้าระวัง 24 ชม.)
          </div>
        ) : (
          <>
            {/* Mobile Card Feed (Visible on Mobile only) */}
            <div className="block md:hidden space-y-3">
              {logs.map((l) => {
                let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                let badgeText = l.action_type;
                if (l.action_type === 'anti_link') {
                  badgeClass = 'bg-red-50 text-red-700 border-red-200';
                  badgeText = '🔗 Anti-Link (เตะคนส่งลิงก์)';
                } else if (l.action_type === 'anti_invite') {
                  badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                  badgeText = '👥 Anti-Invite (เตะคนชวนมั่ว)';
                } else if (l.action_type === 'anti_kick') {
                  badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                  badgeText = '⚡ Anti-Kick (เตะคนเตะมั่ว)';
                }

                const timeStr = new Date(l.created_at).toLocaleString('th-TH');

                return (
                  <div key={l.id || Math.random()} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 shadow-sm">
                    {/* Header: Action Badge & Time */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${badgeClass}`}>
                        {badgeText}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {timeStr}
                      </span>
                    </div>

                    {/* Group & User Info */}
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-400 font-medium shrink-0">กลุ่ม:</span>
                        <span className="font-bold text-slate-900 truncate">{l.group_name || 'Group'}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-400 font-medium shrink-0">ผู้กระทำผิด:</span>
                        <span className="font-semibold text-slate-800 truncate">{l.user_name || 'Unknown User'}</span>
                      </div>
                      {l.bot_name && (
                        <div className="flex items-center space-x-1.5 text-emerald-700 font-medium text-[11px]">
                          <span className="text-slate-400">บอทผู้ดูแล:</span>
                          <span className="truncate">🤖 {l.bot_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Reason / Details */}
                    {(l.reason || l.details) && (
                      <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs space-y-0.5 break-all">
                        {l.reason && <p className="font-semibold text-slate-800">{l.reason}</p>}
                        {l.details && <p className="text-[11px] text-slate-500">{l.details}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (Visible on Desktop only) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 font-semibold">วัน-เวลา</th>
                    <th className="p-3.5 font-semibold">กลุ่ม</th>
                    <th className="p-3.5 font-semibold">ประเภทเหตุการณ์</th>
                    <th className="p-3.5 font-semibold">ผู้กระทำผิด</th>
                    <th className="p-3.5 font-semibold">บอทที่ดำเนินการ</th>
                    <th className="p-3.5 font-semibold">สาเหตุ / รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((l) => {
                    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                    let badgeText = l.action_type;
                    if (l.action_type === 'anti_link') {
                      badgeClass = 'bg-red-50 text-red-700 border-red-200';
                      badgeText = '🔗 Anti-Link';
                    } else if (l.action_type === 'anti_invite') {
                      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                      badgeText = '👥 Anti-Invite';
                    } else if (l.action_type === 'anti_kick') {
                      badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                      badgeText = '⚡ Anti-Kick';
                    }

                    const timeStr = new Date(l.created_at).toLocaleString('th-TH');

                    return (
                      <tr key={l.id || Math.random()} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{timeStr}</td>
                        <td className="p-3.5 font-semibold text-slate-900">{l.group_name || 'Group'}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${badgeClass}`}>
                            {badgeText}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900">{l.user_name || 'Unknown User'}</div>
                        </td>
                        <td className="p-3.5">
                          <span className="text-emerald-700 font-medium">🤖 {l.bot_name || 'Guardian Bot'}</span>
                        </td>
                        <td className="p-3.5 text-slate-600">
                          <div className="font-medium text-slate-800">{l.reason || '-'}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{l.details || ''}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
