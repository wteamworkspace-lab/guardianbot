import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized (Server-side).');
    } catch (e) {
        console.error('❌ Failed to initialize Supabase client:', e.message);
    }
}

// Local cache / fallback store for instant offline resilience
const localCacheDir = path.join(__dirname, '../data');
if (!fs.existsSync(localCacheDir)) {
    fs.mkdirSync(localCacheDir, { recursive: true });
}
const localCacheFile = path.join(localCacheDir, 'local_store.json');

function loadLocalStore() {
    try {
        if (fs.existsSync(localCacheFile)) {
            return JSON.parse(fs.readFileSync(localCacheFile, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading local cache:', e.message);
    }
    return {
        bot_settings: { id: 'config', status: 'offline', auth_token: null },
        group_settings: {},
        whitelists: [],
        link_whitelists: [],
        audit_logs: []
    };
}

function saveLocalStore(data) {
    try {
        fs.writeFileSync(localCacheFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing local cache:', e.message);
    }
}

let localStore = loadLocalStore();

const db = {
    // -------------------------------------------------------------------------
    // Multi-Bot Management (public.line_bots)
    // -------------------------------------------------------------------------
    async getAllBots() {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('line_bots')
                    .select('*')
                    .order('created_at', { ascending: true });
                if (!error && data && data.length > 0) {
                    localStore.line_bots = data;
                    saveLocalStore(localStore);
                    return data;
                }
            } catch (err) {}
        }
        if (localStore.line_bots && localStore.line_bots.length > 0) {
            return localStore.line_bots;
        }
        // Fallback migration: check single bot_settings
        if (localStore.bot_settings?.auth_token) {
            const singleBot = {
                mid: localStore.bot_settings.bot_mid || 'default_bot',
                display_name: localStore.bot_settings.bot_name || 'น้องฝันดี',
                picture_url: localStore.bot_settings.bot_picture_url || null,
                auth_token: localStore.bot_settings.auth_token,
                is_active: true
            };
            return [singleBot];
        }
        return [];
    },

    async getBotByMid(mid) {
        if (!mid) return null;
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('line_bots')
                    .select('*')
                    .eq('mid', mid)
                    .single();
                if (!error && data) return data;
            } catch (err) {}
        }
        return (localStore.line_bots || []).find(b => b.mid === mid) || null;
    },

    async saveBot(bot) {
        if (!bot || !bot.mid || !bot.auth_token) return null;
        const record = {
            mid: bot.mid,
            display_name: bot.displayName || bot.display_name || 'LINE Bot',
            picture_url: bot.pictureUrl || bot.picture_url || null,
            auth_token: bot.authToken || bot.auth_token,
            is_active: bot.isActive !== undefined ? bot.isActive : (bot.is_active !== undefined ? bot.is_active : true),
            updated_at: new Date().toISOString()
        };

        if (!localStore.line_bots) localStore.line_bots = [];
        const idx = localStore.line_bots.findIndex(b => b.mid === bot.mid);
        if (idx >= 0) {
            localStore.line_bots[idx] = { ...localStore.line_bots[idx], ...record };
        } else {
            localStore.line_bots.push(record);
        }
        saveLocalStore(localStore);

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('line_bots')
                    .upsert(record, { onConflict: 'mid' })
                    .select()
                    .single();
                if (!error && data) return data;
            } catch (err) {
                console.warn('⚠️ Supabase saveBot error:', err.message);
            }
        }
        return record;
    },

    async deleteBot(mid) {
        if (!mid) return false;
        if (localStore.line_bots) {
            localStore.line_bots = localStore.line_bots.filter(b => b.mid !== mid);
            saveLocalStore(localStore);
        }

        if (supabase) {
            try {
                await supabase.from('line_bots').delete().eq('mid', mid);
            } catch (err) {}
        }
        return true;
    },

    async toggleBot(mid, isActive) {
        if (!mid) return false;
        if (localStore.line_bots) {
            const b = localStore.line_bots.find(x => x.mid === mid);
            if (b) b.is_active = isActive;
            saveLocalStore(localStore);
        }

        if (supabase) {
            try {
                await supabase.from('line_bots').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('mid', mid);
            } catch (err) {}
        }
        return true;
    },

    // -------------------------------------------------------------------------
    // Bot Settings & Fallback
    // -------------------------------------------------------------------------
    async getBotSettings() {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('bot_settings')
                    .select('*')
                    .eq('id', 'config')
                    .single();
                if (!error && data) {
                    localStore.bot_settings = { ...localStore.bot_settings, ...data };
                    saveLocalStore(localStore);
                    return data;
                }
            } catch (err) {}
        }
        return localStore.bot_settings;
    },

    async saveBotSettings(settings) {
        localStore.bot_settings = { ...localStore.bot_settings, ...settings, updated_at: new Date().toISOString() };
        saveLocalStore(localStore);

        if (supabase) {
            try {
                const { error } = await supabase
                    .from('bot_settings')
                    .upsert({ id: 'config', ...localStore.bot_settings });
                if (error) {
                    console.warn('⚠️ Supabase saveBotSettings warning (Check if SQL table is created):', error.message);
                }
            } catch (err) {
                console.warn('⚠️ Supabase saveBotSettings error:', err.message);
            }
        }
        return localStore.bot_settings;
    },

    // -------------------------------------------------------------------------
    // Group Protection Settings
    // -------------------------------------------------------------------------
    async getAllGroupSettings() {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('group_settings').select('*');
                if (!error && data) {
                    data.forEach(g => { localStore.group_settings[g.group_id] = g; });
                    saveLocalStore(localStore);
                    return data;
                }
            } catch (e) {}
        }
        return Object.values(localStore.group_settings);
    },

    async getGroupSettings(groupId) {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('group_settings')
                    .select('*')
                    .eq('group_id', groupId)
                    .single();
                if (!error && data) {
                    localStore.group_settings[groupId] = data;
                    saveLocalStore(localStore);
                    return data;
                }
            } catch (e) {}
        }

        if (localStore.group_settings[groupId]) {
            return localStore.group_settings[groupId];
        }

        // Return default group settings
        const defaultSettings = {
            group_id: groupId,
            group_name: 'LINE Group',
            group_picture_url: null,
            anti_link: true,
            anti_invite: true,
            anti_kick: true,
            silent_kick: false,
            kick_message: '🛡️ Guardian Bot: สมาชิกรายนี้ถูกเตะเนื่องจากละเมิดกฎของกลุ่ม',
            is_active: true
        };
        localStore.group_settings[groupId] = defaultSettings;
        saveLocalStore(localStore);
        return defaultSettings;
    },

    async saveGroupSettings(groupId, updates) {
        const current = await this.getGroupSettings(groupId);
        const merged = {
            ...current,
            ...updates,
            group_id: groupId,
            updated_at: new Date().toISOString()
        };

        localStore.group_settings[groupId] = merged;
        saveLocalStore(localStore);

        if (supabase) {
            try {
                const { data, error } = await supabase.from('group_settings').upsert(merged).select().single();
                if (!error && data) {
                    localStore.group_settings[groupId] = data;
                    saveLocalStore(localStore);
                    return data;
                }
                if (error) console.warn('⚠️ Supabase saveGroupSettings:', error.message);
            } catch (e) {}
        }
        return merged;
    },

    async removeGroupSettings(groupId) {
        delete localStore.group_settings[groupId];
        saveLocalStore(localStore);

        if (supabase) {
            try {
                await supabase.from('group_settings').delete().eq('group_id', groupId);
            } catch (e) {
                console.warn('⚠️ Supabase removeGroupSettings:', e.message);
            }
        }
        return true;
    },

    // -------------------------------------------------------------------------
    // Admin Whitelist
    // -------------------------------------------------------------------------
    async getWhitelist() {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('whitelists').select('*').order('created_at', { ascending: false });
                if (!error && data) {
                    const uniqueMap = new Map();
                    data.forEach(item => {
                        if (!uniqueMap.has(item.mid)) {
                            uniqueMap.set(item.mid, item);
                        }
                    });
                    const uniqueList = Array.from(uniqueMap.values());
                    localStore.whitelists = uniqueList;
                    saveLocalStore(localStore);
                    return uniqueList;
                }
            } catch (e) {}
        }
        return localStore.whitelists;
    },

    async isWhitelisted(mid, groupId = 'global') {
        if (!mid) return false;

        // Mutual Bot Protection: Any registered bot is automatically 100% whitelisted
        if (localStore.line_bots?.some(b => b.mid === mid)) return true;
        if (localStore.bot_settings?.bot_mid === mid) return true;

        // Check local store
        const isLocal = localStore.whitelists.some(w => w.mid === mid && (w.group_id === 'global' || w.group_id === groupId));
        if (isLocal) return true;

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('whitelists')
                    .select('id')
                    .eq('mid', mid)
                    .limit(1);
                if (!error && data && data.length > 0) return true;
            } catch (e) {}
        }
        return false;
    },

    async addWhitelist(mid, name = 'Admin', role = 'admin', groupId = 'global') {
        const entry = {
            id: Date.now().toString(),
            mid,
            name,
            role,
            group_id: groupId,
            created_at: new Date().toISOString()
        };

        const existingIdx = localStore.whitelists.findIndex(w => w.mid === mid);
        if (existingIdx >= 0) {
            localStore.whitelists[existingIdx] = { ...localStore.whitelists[existingIdx], name, role, group_id: groupId };
        } else {
            localStore.whitelists.push(entry);
        }
        saveLocalStore(localStore);

        if (supabase) {
            try {
                const { data: existing } = await supabase.from('whitelists').select('id').eq('mid', mid).limit(1);
                if (existing && existing.length > 0) {
                    const { data } = await supabase.from('whitelists').update({ name, role, group_id: groupId }).eq('mid', mid).select().single();
                    if (data) return data;
                } else {
                    const { data } = await supabase.from('whitelists').insert({
                        mid,
                        name,
                        role,
                        group_id: groupId
                    }).select().single();
                    if (data) return data;
                }
            } catch (e) {}
        }
        return entry;
    },

    async removeWhitelist(mid) {
        localStore.whitelists = localStore.whitelists.filter(w => w.mid !== mid);
        saveLocalStore(localStore);

        if (supabase) {
            try {
                await supabase.from('whitelists').delete().eq('mid', mid);
            } catch (e) {}
        }
        return true;
    },

    // -------------------------------------------------------------------------
    // Link Whitelist (Allowed Domains & URLs)
    // -------------------------------------------------------------------------
    async getLinkWhitelists() {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('link_whitelists').select('*').order('created_at', { ascending: false });
                if (!error && data) {
                    localStore.link_whitelists = data;
                    saveLocalStore(localStore);
                    return data;
                }
            } catch (e) {}
        }
        return localStore.link_whitelists || [];
    },

    async isLinkWhitelisted(urlStr, groupId = 'global') {
        if (!urlStr) return false;
        const links = await this.getLinkWhitelists();
        const cleanUrl = urlStr.trim().toLowerCase().replace(/^https?:\/\//, '');

        return links.some(item => {
            if (item.group_id && item.group_id !== 'global' && item.group_id !== groupId) {
                return false;
            }
            const cleanPattern = item.pattern.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
            return cleanUrl.includes(cleanPattern) || cleanUrl.startsWith(cleanPattern);
        });
    },

    async addLinkWhitelist(pattern, description = '', groupId = 'global') {
        const cleanPattern = pattern.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const entry = {
            id: Date.now().toString(),
            pattern: cleanPattern,
            description,
            group_id: groupId || 'global',
            created_at: new Date().toISOString()
        };

        if (!localStore.link_whitelists) localStore.link_whitelists = [];
        const exists = localStore.link_whitelists.some(l => l.pattern === cleanPattern && l.group_id === (groupId || 'global'));
        if (!exists) {
            localStore.link_whitelists.unshift(entry);
            saveLocalStore(localStore);
        }

        if (supabase) {
            try {
                const { data: existing } = await supabase.from('link_whitelists').select('id').eq('pattern', cleanPattern).limit(1);
                if (!existing || existing.length === 0) {
                    const { data } = await supabase.from('link_whitelists').insert({
                        pattern: cleanPattern,
                        description,
                        group_id: groupId || 'global'
                    }).select().single();
                    if (data) return data;
                }
            } catch (e) {}
        }
        return entry;
    },

    async removeLinkWhitelist(idOrPattern) {
        if (localStore.link_whitelists) {
            localStore.link_whitelists = localStore.link_whitelists.filter(l => l.id !== idOrPattern && l.pattern !== idOrPattern);
            saveLocalStore(localStore);
        }

        if (supabase) {
            try {
                const { error } = await supabase.from('link_whitelists').delete().eq('id', idOrPattern);
                if (error) {
                    await supabase.from('link_whitelists').delete().eq('pattern', idOrPattern);
                }
            } catch (e) {}
        }
        return true;
    },

    // -------------------------------------------------------------------------
    // Audit Logs
    // -------------------------------------------------------------------------
    async logIncident({ groupId, groupName, userMid, userName, botMid, botName, actionType, reason, details }) {
        const logItem = {
            id: Date.now().toString(),
            group_id: groupId || 'unknown',
            group_name: groupName || 'Group',
            user_mid: userMid || 'unknown',
            user_name: userName || 'User',
            bot_mid: botMid || null,
            bot_name: botName || null,
            action_type: actionType,
            reason: reason || '',
            details: details || '',
            created_at: new Date().toISOString()
        };

        localStore.audit_logs.unshift(logItem);
        if (localStore.audit_logs.length > 200) {
            localStore.audit_logs = localStore.audit_logs.slice(0, 200);
        }
        saveLocalStore(localStore);

        if (supabase) {
            try {
                await supabase.from('audit_logs').insert({
                    group_id: groupId || 'unknown',
                    group_name: groupName || 'Group',
                    user_mid: userMid || 'unknown',
                    user_name: userName || 'User',
                    bot_mid: botMid || null,
                    bot_name: botName || null,
                    action_type: actionType,
                    reason: reason || '',
                    details: details || ''
                });
            } catch (e) {}
        }
        return logItem;
    },

    async getAuditLogs(limit = 50) {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('audit_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(limit);
                if (!error && data && data.length > 0) {
                    return data;
                }
            } catch (e) {}
        }
        return localStore.audit_logs.slice(0, limit);
    },

    // -------------------------------------------------------------------------
    // BackOffice Admin User Authentication
    // -------------------------------------------------------------------------
    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    },

    createToken(payload) {
        const secret = process.env.SUPABASE_ANON_KEY || 'guardian_secret_key_2026';
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
        const signature = crypto.createHmac('sha256', secret).update(`${header}.${data}`).digest('base64url');
        return `${header}.${data}.${signature}`;
    },

    verifyToken(token) {
        if (!token || typeof token !== 'string') return null;
        const secret = process.env.SUPABASE_ANON_KEY || 'guardian_secret_key_2026';
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [header, data, signature] = parts;
        const expected = crypto.createHmac('sha256', secret).update(`${header}.${data}`).digest('base64url');
        if (signature !== expected) return null;
        try {
            const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
            if (payload.exp && payload.exp < Date.now()) return null;
            return payload;
        } catch (e) {
            return null;
        }
    },

    async verifyAdminLogin(username, password) {
        if (!username || !password) return { success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
        const passHash = this.hashPassword(password);
        const defaultPass = process.env.DASHBOARD_PASS || 'admin1234';

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('admin_users')
                    .select('*')
                    .eq('username', username.trim().toLowerCase())
                    .single();

                if (data) {
                    if (data.password_hash === passHash) {
                        const token = this.createToken({ id: data.id, username: data.username, displayName: data.display_name });
                        return {
                            success: true,
                            token,
                            user: { username: data.username, displayName: data.display_name }
                        };
                    } else {
                        return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
                    }
                }
            } catch (e) {}
        }

        // Fallback / First run check with default credentials
        if (username.trim().toLowerCase() === 'admin' && (password === defaultPass || passHash === this.hashPassword(defaultPass))) {
            // Save admin to Supabase if available
            if (supabase) {
                try {
                    await supabase.from('admin_users').upsert({
                        username: 'admin',
                        password_hash: passHash,
                        display_name: 'Administrator'
                    });
                } catch (e) {}
            }

            const token = this.createToken({ id: 'admin-root', username: 'admin', displayName: 'Administrator' });
            return {
                success: true,
                token,
                user: { username: 'admin', displayName: 'Administrator' }
            };
        }

        return { success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' };
    },

    async changeAdminPassword(username, oldPassword, newPassword) {
        if (!username || !oldPassword || !newPassword) return { success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
        if (newPassword.length < 6) return { success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' };

        const loginRes = await this.verifyAdminLogin(username, oldPassword);
        if (!loginRes.success) return { success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' };

        const newHash = this.hashPassword(newPassword);
        if (supabase) {
            try {
                await supabase.from('admin_users').update({
                    password_hash: newHash,
                    updated_at: new Date().toISOString()
                }).eq('username', username.trim().toLowerCase());
                return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว' };
            } catch (e) {
                return { success: false, message: e.message };
            }
        }
        return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว' };
    }
};

export default db;
