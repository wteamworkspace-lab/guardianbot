'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserPlus,
  UsersRound,
  Trash2,
  Info,
  Loader2,
  Globe,
  PlusCircle
} from 'lucide-react';
import { useToast } from '../../components/ToastProvider';

export default function WhitelistPage() {
  const { toast, confirmModal } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('admin'); // 'admin' | 'links'

  // Admin Whitelist States
  const [whitelist, setWhitelist] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingWhitelist, setIsLoadingWhitelist] = useState(true);
  const [whitelistForm, setWhitelistForm] = useState({ mid: '', name: '', role: 'admin' });

  // Link Whitelist States
  const [linkWhitelists, setLinkWhitelists] = useState([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [linkForm, setLinkForm] = useState({ pattern: '', description: '', groupId: 'global' });

  const fetchWhitelist = async () => {
    setIsLoadingWhitelist(true);
    try {
      const res = await fetch('/api/whitelist');
      const json = await res.json();
      setWhitelist(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingWhitelist(false);
    }
  };

  const fetchLinkWhitelists = async () => {
    setIsLoadingLinks(true);
    try {
      const res = await fetch('/api/link-whitelist');
      const json = await res.json();
      setLinkWhitelists(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const json = await res.json();
      setGroups(json.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchWhitelist();
    fetchLinkWhitelists();
    fetchGroups();
  }, []);

  const fetchGroupMembers = async (groupId) => {
    if (!groupId) {
      setGroupMembers([]);
      return;
    }
    setIsLoadingMembers(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const json = await res.json();
      if (json.success) {
        setGroupMembers(json.data || []);
      } else {
        toast.error('โหลดรายชื่อสมาชิกไม่สำเร็จ: ' + json.message);
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการโหลดสมาชิก: ' + err.message);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleQuickAddAdmin = async (member) => {
    try {
      const res = await fetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mid: member.mid,
          name: member.displayName,
          role: 'admin'
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchWhitelist();
        toast.success(`แต่งตั้ง "${member.displayName}" เป็นแอดมินเรียบร้อยแล้ว`);
      } else {
        toast.error(json.message || 'แต่งตั้งไม่สำเร็จ');
      }
    } catch (err) {
      toast.error('เพิ่มไม่สำเร็จ: ' + err.message);
    }
  };

  const handleAddWhitelist = async (e) => {
    e.preventDefault();
    if (!whitelistForm.mid) return;
    try {
      const res = await fetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(whitelistForm)
      });
      const json = await res.json();
      if (json.success) {
        setWhitelistForm({ mid: '', name: '', role: 'admin' });
        fetchWhitelist();
        toast.success('เพิ่มผู้ดูแลเข้าสู่ Whitelist เรียบร้อยแล้ว');
      } else {
        toast.error(json.message || 'เพิ่มไม่สำเร็จ');
      }
    } catch (err) {
      toast.error('เพิ่มไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDeleteWhitelist = async (mid, name) => {
    const confirmed = await confirmModal({
      title: 'ลบผู้ดูแลออกจาก Whitelist',
      message: `คุณต้องการลบ "${name || 'ผู้ดูแลนี้'}" ออกจาก Whitelist ใช่หรือไม่?`,
      confirmText: 'ลบรายชื่อ',
      cancelText: 'ยกเลิก',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await fetch(`/api/whitelist/${mid}`, { method: 'DELETE' });
      fetchWhitelist();
      toast.success('ลบผู้ดูแลออกจาก Whitelist แล้ว');
    } catch (err) {
      toast.error('ลบไม่สำเร็จ: ' + err.message);
    }
  };

  const handleAddLink = async (e) => {
    e.preventDefault();
    if (!linkForm.pattern) return;
    try {
      const res = await fetch('/api/link-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkForm)
      });
      const json = await res.json();
      if (json.success) {
        setLinkForm({ pattern: '', description: '', groupId: 'global' });
        fetchLinkWhitelists();
        toast.success('เพิ่มโดเมนเข้าสู่ Link Whitelist เรียบร้อยแล้ว');
      } else {
        toast.error(json.message || 'เพิ่มไม่สำเร็จ');
      }
    } catch (err) {
      toast.error('เพิ่มไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDeleteLink = async (id, pattern) => {
    const confirmed = await confirmModal({
      title: 'ลบลิงก์ที่อนุญาต',
      message: `คุณต้องการลบโดเมน "${pattern || 'นี้'}" ออกจากรายการที่อนุญาตใช่หรือไม่?`,
      confirmText: 'ลบลิงก์',
      cancelText: 'ยกเลิก',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await fetch(`/api/link-whitelist/${id}`, { method: 'DELETE' });
      fetchLinkWhitelists();
      toast.success('ลบลิงก์ออกจากรายการแล้ว');
    } catch (err) {
      toast.error('ลบไม่สำเร็จ: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Sub-Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-line" />
            <span>ระบบสิทธิ์ยกเว้น (Whitelist Manager)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            จัดการแอดมินที่ไม่ถูกเตะ และกำหนดรายชื่อลิงก์/เว็บไซต์ที่อนุญาตให้สมาชิกทั่วไปส่งได้
          </p>
        </div>

        {/* Sub Tabs Toggle */}
        <div className="flex items-center p-1 bg-slate-200/70 rounded-xl space-x-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('admin')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition ${
              activeSubTab === 'admin'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-line" />
            <span>1. ผู้ดูแล (Admin Whitelist)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('links')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition ${
              activeSubTab === 'links'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-sky-500" />
            <span>2. ลิงก์ที่อนุญาต (Link Whitelist)</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: ADMIN WHITELIST */}
      {/* =================================================================== */}
      {activeSubTab === 'admin' && (
        <div className="space-y-6">
          {/* Guide Banner */}
          <div className="light-card rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-emerald-50/70 to-slate-50 border border-emerald-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">💡 วิธีเพิ่มผู้ดูแล (Admin Whitelist)</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  เลือกสมาชิกจากกลุ่มด้านล่างเพื่อแต่งตั้งใน 1-คลิก หรือพิมพ์คำสั่งในกลุ่ม LINE เพื่อแต่งตั้งทันที
                </p>
                <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-700">
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-medium">
                    👑 พิมพ์ <code className="text-line font-bold font-mono">#เพิ่มแอดมิน @แท็กชื่อเพื่อน</code> ในกลุ่ม LINE
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column: Quick Picker & Manual Form */}
            <div className="space-y-4 sm:space-y-6">
              {/* Quick Picker */}
              <div className="light-card rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm border-t-4 border-t-line">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <UsersRound className="w-4 h-4 text-line" />
                  <span>เลือกจากสมาชิกในกลุ่ม LINE</span>
                </h3>
                <p className="text-[11px] text-slate-500">เลือกกลุ่มเพื่อดึงรายชื่อสมาชิกมาแต่งตั้งเป็นแอดมินใน 1-คลิก</p>

                <div>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => fetchGroupMembers(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-line focus:bg-white font-medium"
                  >
                    <option value="">-- เลือกกลุ่ม LINE --</option>
                    {groups.map(g => {
                      const id = g.groupId || g.group_id;
                      return (
                        <option key={id} value={id}>
                          {g.groupName || 'กลุ่ม LINE'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {isLoadingMembers && (
                  <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-line" />
                    <span>กำลังโหลดรายชื่อสมาชิก...</span>
                  </div>
                )}

                {groupMembers.length > 0 && (
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                    {groupMembers.map((m) => (
                      <div key={m.mid} className="flex items-center justify-between pt-2">
                        <div className="flex items-center space-x-2 overflow-hidden min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 overflow-hidden shrink-0">
                            {m.pictureUrl ? <img src={m.pictureUrl} alt="User" className="w-full h-full object-cover" /> : (m.displayName ? m.displayName[0] : 'U')}
                          </div>
                          <p className="text-xs font-medium text-slate-800 truncate">{m.displayName}</p>
                        </div>
                        <button
                          onClick={() => handleQuickAddAdmin(m)}
                          className="px-2.5 py-1 rounded-lg bg-line/10 hover:bg-line text-line hover:text-white text-[11px] font-semibold transition shrink-0 active:scale-95 ml-2"
                        >
                          ➕ ตั้งเป็นแอดมิน
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual Form */}
              <div className="light-card rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <UserPlus className="w-4 h-4 text-slate-700" />
                  <span>เพิ่มด้วยการกรอก ID</span>
                </h3>

                <form onSubmit={handleAddWhitelist} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LINE User ID *</label>
                    <input
                      type="text"
                      value={whitelistForm.mid}
                      onChange={(e) => setWhitelistForm({ ...whitelistForm, mid: e.target.value })}
                      placeholder="เช่น u123456..."
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-line focus:bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อผู้ดูแล (บันทึกช่วยจำ)</label>
                    <input
                      type="text"
                      value={whitelistForm.name}
                      onChange={(e) => setWhitelistForm({ ...whitelistForm, name: e.target.value })}
                      placeholder="เช่น แอดมินบอล"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-line focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">สิทธิ์ (Role)</label>
                    <select
                      value={whitelistForm.role}
                      onChange={(e) => setWhitelistForm({ ...whitelistForm, role: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-line focus:bg-white font-medium"
                    >
                      <option value="admin">Admin (ผู้ดูแลหลัก)</option>
                      <option value="moderator">Moderator (ผู้ช่วยดูแล)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition active:scale-95"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>เพิ่มเข้าสู่ Whitelist</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Whitelist Table / Mobile Cards */}
            <div className="light-card rounded-2xl p-4 sm:p-6 md:col-span-2 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>รายชื่อผู้ได้รับสิทธิ์ยกเว้น (Admin Whitelist)</span>
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold shrink-0">
                  {whitelist.length} คน
                </span>
              </div>

              {isLoadingWhitelist ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-line mx-auto mb-2" />
                  กำลังโหลดรายชื่อ Whitelist...
                </div>
              ) : whitelist.length === 0 ? (
                <div className="p-6 text-center text-slate-400">ยังไม่มีรายชื่อผู้ดูแลใน Whitelist</div>
              ) : (
                <>
                  {/* Mobile Card List (Visible on Mobile only) */}
                  <div className="block md:hidden space-y-2.5">
                    {whitelist.map((item) => (
                      <div key={item.id || item.mid} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 shadow-sm">
                            {item.name ? item.name[0] : 'A'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{item.name || 'Admin'}</p>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${
                              item.role === 'owner'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {item.role === 'owner' ? '👑 Owner (บอทหลัก)' : '🛡️ Admin'}
                            </span>
                          </div>
                        </div>

                        {item.role !== 'owner' ? (
                          <button
                            onClick={() => handleDeleteWhitelist(item.mid, item.name)}
                            className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-100 bg-white transition shrink-0 active:scale-95"
                            title="ลบออกจาก Whitelist"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium shrink-0">บอทหลัก</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (Visible on Desktop only) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3 font-semibold">ชื่อผู้ดูแล</th>
                          <th className="p-3 font-semibold">สิทธิ์</th>
                          <th className="p-3 text-right font-semibold">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {whitelist.map((item) => (
                          <tr key={item.id || item.mid} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-semibold text-slate-900 flex items-center space-x-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                {item.name ? item.name[0] : 'A'}
                              </div>
                              <span>{item.name || 'Admin'}</span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                                item.role === 'owner'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {item.role === 'owner' ? '👑 Owner' : '🛡️ Admin'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {item.role !== 'owner' ? (
                                <button
                                  onClick={() => handleDeleteWhitelist(item.mid, item.name)}
                                  className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition active:scale-95"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[10px] font-medium">บอทหลัก</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: LINK WHITELIST (ALLOWED URLS & DOMAINS) */}
      {/* =================================================================== */}
      {activeSubTab === 'links' && (
        <div className="space-y-6">
          {/* Guide Banner for Link Whitelist */}
          <div className="light-card rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-sky-50/70 to-slate-50 border border-sky-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">💡 โดเมนที่อนุญาต (Link Whitelist) ทำงานอย่างไร?</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  ระบบ Anti-Link จะยอมให้สมาชิกทั่วไปส่งข้อความที่มีลิงก์ได้ หากลิงก์นั้นตรงกับชื่อโดเมนที่คุณเพิ่มไว้ในนี้
                </p>
                <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-700">
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                    ✅ ตัวอย่าง: <code className="text-sky-600 font-bold font-mono">youtube.com</code>, <code className="text-sky-600 font-bold font-mono">tiktok.com</code>, <code className="text-sky-600 font-bold font-mono">google.com</code>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Add Link Form */}
            <div className="light-card rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm h-fit">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-sky-600" />
                <span>เพิ่มโดเมนที่อนุญาต</span>
              </h3>

              <form onSubmit={handleAddLink} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อโดเมน / Keyword *</label>
                  <input
                    type="text"
                    value={linkForm.pattern}
                    onChange={(e) => setLinkForm({ ...linkForm, pattern: e.target.value })}
                    placeholder="เช่น youtube.com หรือ shopee.co.th"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">คำอธิบาย (บันทึกช่วยจำ)</label>
                  <input
                    type="text"
                    value={linkForm.description}
                    onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                    placeholder="เช่น วิดีโอเพลง YouTube"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ขอบเขตการอนุญาต</label>
                  <select
                    value={linkForm.groupId}
                    onChange={(e) => setLinkForm({ ...linkForm, groupId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white font-medium"
                  >
                    <option value="global">🌐 ทุกกลุ่มที่บอทดูแล (Global)</option>
                    {groups.map(g => {
                      const id = g.groupId || g.group_id;
                      return (
                        <option key={id} value={id}>
                          👥 เฉพาะกลุ่ม: {g.groupName || 'กลุ่ม LINE'}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-sky-500/20 transition active:scale-95"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>เพิ่มเข้าสู่ Link Whitelist</span>
                </button>
              </form>
            </div>

            {/* Link Whitelist Table / Mobile Cards */}
            <div className="light-card rounded-2xl p-4 sm:p-6 md:col-span-2 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>รายชื่อโดเมน/ลิงก์ที่อนุญาต (Allowed Links)</span>
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold shrink-0">
                  {linkWhitelists.length} รายการ
                </span>
              </div>

              {isLoadingLinks ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-600 mx-auto mb-2" />
                  กำลังโหลดรายชื่อ Link Whitelist...
                </div>
              ) : linkWhitelists.length === 0 ? (
                <div className="p-6 text-center text-slate-400">ยังไม่มีรายชื่อลิงก์ที่ได้รับอนุญาต</div>
              ) : (
                <>
                  {/* Mobile Card List (Visible on Mobile only) */}
                  <div className="block md:hidden space-y-3">
                    {linkWhitelists.map((item) => {
                      const targetGroup = groups.find(g => (g.groupId || g.group_id) === item.group_id);
                      const groupLabel = item.group_id === 'global' || !item.group_id ? '🌐 ทุกกลุ่ม' : (targetGroup?.groupName || 'กลุ่มเฉพาะ');

                      return (
                        <div key={item.id || item.pattern} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-mono font-bold text-sky-700 text-sm flex items-center space-x-1.5 min-w-0">
                              <Globe className="w-4 h-4 text-sky-500 shrink-0" />
                              <span className="truncate">{item.pattern}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteLink(item.id || item.pattern, item.pattern)}
                              className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-100 bg-white transition shrink-0 active:scale-95"
                              title="ลบออกจาก Link Whitelist"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs">
                            <p className="text-slate-600 truncate">{item.description || 'ไม่มีคำอธิบาย'}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
                              item.group_id === 'global' || !item.group_id
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                              {groupLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table (Visible on Desktop only) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3 font-semibold">โดเมน / รูปแบบลิงก์</th>
                          <th className="p-3 font-semibold">คำอธิบาย</th>
                          <th className="p-3 font-semibold">ขอบเขตกลุ่ม</th>
                          <th className="p-3 text-right font-semibold">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {linkWhitelists.map((item) => {
                          const targetGroup = groups.find(g => (g.groupId || g.group_id) === item.group_id);
                          const groupLabel = item.group_id === 'global' || !item.group_id ? '🌐 ทุกกลุ่ม' : (targetGroup?.groupName || 'กลุ่มเฉพาะ');

                          return (
                            <tr key={item.id || item.pattern} className="hover:bg-slate-50/80 transition">
                              <td className="p-3 font-mono font-bold text-sky-700 flex items-center space-x-1.5">
                                <Globe className="w-3.5 h-3.5 text-sky-500" />
                                <span>{item.pattern}</span>
                              </td>
                              <td className="p-3 text-slate-700">{item.description || '-'}</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                                  item.group_id === 'global' || !item.group_id
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}>
                                  {groupLabel}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteLink(item.id || item.pattern, item.pattern)}
                                  className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition active:scale-95"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
        </div>
      )}

    </div>
  );
}
