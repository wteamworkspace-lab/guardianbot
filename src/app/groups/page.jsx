'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  UsersRound,
  MessageSquare,
  Link2Off,
  UserX,
  ShieldOff,
  BellOff,
  Trash2,
  Loader2
} from 'lucide-react';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchGroups = async (sync = false) => {
    if (sync) setIsSyncing(true);
    else setIsLoading(true);

    try {
      const url = sync ? '/api/groups/sync' : '/api/groups';
      const method = sync ? 'POST' : 'GET';
      const res = await fetch(url, { method });
      const json = await res.json();
      setGroups(json.data || []);
    } catch (err) {
      console.error('Error loading groups:', err);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const deleteGroup = async (groupId, groupName) => {
    if (!confirm(`คุณต้องการลบข้อมูลกลุ่ม "${groupName || 'กลุ่มนี้'}" ออกจากระบบใช่หรือไม่?`)) return;
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setGroups(prev => prev.filter(g => (g.groupId || g.group_id) !== groupId));
      } else {
        alert('ลบกลุ่มไม่สำเร็จ: ' + (data.message || 'Error'));
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการลบกลุ่ม: ' + err.message);
    }
  };

  const toggleGroupSetting = async (groupId, key, value) => {
    setGroups(prev => prev.map(g => {
      const id = g.groupId || g.group_id;
      return id === groupId ? { ...g, [key]: value } : g;
    }));

    try {
      await fetch(`/api/groups/${groupId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
    } catch (err) {
      alert('บันทึกการตั้งค่าไม่สำเร็จ: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-line" />
            <span>จัดการกลุ่ม & ตั้งค่าระบบความปลอดภัย</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            เลือกเปิด/ปิด Anti-Link, Anti-Invite, Anti-Kick แยกตามกลุ่มที่บอทเข้าร่วม
          </p>
        </div>
        <button
          onClick={() => fetchGroups(true)}
          disabled={isSyncing || isLoading}
          className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-2 transition border border-slate-200 shadow-sm self-start sm:self-auto active:scale-95"
        >
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin text-line" /> : <RefreshCw className="w-4 h-4 text-slate-600" />}
          <span>ซิงค์รายชื่อกลุ่มใหม่</span>
        </button>
      </div>

      {isLoading ? (
        <div className="light-card rounded-2xl p-12 text-center text-slate-400 space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-line mx-auto" />
          <p className="text-sm text-slate-600 font-medium">กำลังโหลดรายชื่อกลุ่ม...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="light-card rounded-2xl p-12 text-center text-slate-500 space-y-3 shadow-sm">
          <UsersRound className="w-12 h-12 mx-auto text-slate-400" />
          <h4 className="text-base font-bold text-slate-800">ยังไม่พบกลุ่ม LINE ที่บอทเข้าร่วม</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            1. เชิญบัญชี LINE บอทของคุณเข้ากลุ่มที่ต้องการดูแล<br />
            2. กดปุ่ม <strong>"ซิงค์รายชื่อกลุ่มใหม่"</strong> ด้านบนเพื่อโหลดรายชื่อกลุ่ม
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groups.map((g) => {
            const gId = g.groupId || g.group_id;
            return (
              <div key={gId} className="light-card rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden shadow-inner">
                      {g.pictureUrl ? (
                        <img src={g.pictureUrl} alt="Group" className="w-full h-full object-cover" />
                      ) : (
                        <MessageSquare className="w-6 h-6 text-line" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{g.groupName || 'กลุ่ม LINE'}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">ID: {gId}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={g.is_active !== false}
                        onChange={(e) => toggleGroupSetting(gId, 'is_active', e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>

                    <button
                      onClick={() => deleteGroup(gId, g.groupName)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="ลบกลุ่มนี้ออกจากระบบ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Protection Toggles */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  {/* Anti-Link */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                        <Link2Off className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Anti-Link (เตะคนส่งลิงก์)</p>
                        <p className="text-[11px] text-slate-500">เตะสมาชิกที่ไม่ใช่แอดมินเมื่อส่ง URL/ลิงก์</p>
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={g.anti_link !== false}
                        onChange={(e) => toggleGroupSetting(gId, 'anti_link', e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  {/* Anti-Invite */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                        <UserX className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Anti-Invite (เตะคนชวนมั่ว)</p>
                        <p className="text-[11px] text-slate-500">ยกเลิกคำเชิญ + เตะคนชวนที่ไม่ใช่แอดมิน</p>
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={g.anti_invite !== false}
                        onChange={(e) => toggleGroupSetting(gId, 'anti_invite', e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  {/* Anti-Kick */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                        <ShieldOff className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Anti-Kick (เตะคนเตะมั่ว)</p>
                        <p className="text-[11px] text-slate-500">เตะคนเตะสมาชิกอื่นออกทันที (Kick-back)</p>
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={g.anti_kick !== false}
                        onChange={(e) => toggleGroupSetting(gId, 'anti_kick', e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  {/* Silent Kick (Anti-Ban Safe Mode) */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                        <BellOff className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Silent Kick (เตะเงียบ ไม่ส่งข้อความ)</p>
                        <p className="text-[11px] text-slate-500">เตะออกทันทีโดยไม่พิมพ์แจ้งเตือนในแชต (ลดโอกาสโดนแบน)</p>
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={g.silent_kick === true}
                        onChange={(e) => toggleGroupSetting(gId, 'silent_kick', e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
