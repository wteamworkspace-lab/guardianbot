import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import db from './db.js';

class BotGuardian extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.status = 'offline';
        this.qrUrl = null;
        this.qrDataUrl = null;
        this.pinCode = null;
        this.profile = null;
        this.startTime = null;
        this.cachedGroups = new Map();

        // Anti-ban Kick Queue with 1000-1500ms jitter delay
        this.actionQueue = [];
        this.isProcessingQueue = false;

        // Dedup Op Revisions to prevent duplicate loops
        this.processedRevisions = new Set();
    }

    enqueueKick({ chatMid, targetUserMid, groupSettings, senderName, actionType, reason, details }) {
        this.actionQueue.push({
            chatMid,
            targetUserMid,
            groupSettings,
            senderName,
            actionType,
            reason,
            details,
            enqueuedAt: Date.now()
        });

        if (!this.isProcessingQueue) {
            this.processActionQueue().catch(err => console.error('Queue processing error:', err));
        }
    }

    async processActionQueue() {
        if (this.isProcessingQueue || this.actionQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.actionQueue.length > 0) {
            const action = this.actionQueue.shift();
            try {
                if (this.client) {
                    await this.client.base.talk.deleteOtherFromChat({
                        request: {
                            chatMid: action.chatMid,
                            targetUserMids: [action.targetUserMid]
                        }
                    });
                    console.log(`⚡ [Safe Kick] Kicked user ${action.targetUserMid} from group ${action.chatMid}`);
                }

                // Silent Kick check: only send chat warning if silent_kick is FALSE
                if (!action.groupSettings?.silent_kick && action.groupSettings?.kick_message && this.client) {
                    try {
                        const warnText = `🛡️ [Guardian Bot] ${action.groupSettings.kick_message}\n👤 สมาชิก: ${action.senderName || 'User'}\n🚫 สาเหตุ: ${action.reason}`;
                        const chat = await this.client.getChat(action.chatMid);
                        if (chat) {
                            await chat.sendMessage(warnText);
                            console.log(`📢 [Kick Warning Sent] Message delivered to group ${action.chatMid}`);
                        }
                    } catch (e) {
                        console.warn('Could not send kick warning message:', e.message);
                    }
                }

                // Log incident to database
                const groupInfo = this.cachedGroups.get(action.chatMid);
                const groupName = groupInfo ? groupInfo.groupName : 'LINE Group';
                await db.logIncident({
                    groupId: action.chatMid,
                    groupName,
                    userMid: action.targetUserMid,
                    userName: action.senderName || 'Offender',
                    actionType: action.actionType,
                    reason: action.reason,
                    details: action.details
                });
            } catch (err) {
                console.error(`❌ Kick action error for ${action.targetUserMid}:`, err.message);
            }

            // Anti-ban Delay Throttle: Random delay between 1000ms - 1500ms if more actions pending
            if (this.actionQueue.length > 0) {
                const delayMs = Math.floor(Math.random() * 501) + 1000; // 1000 to 1500 ms
                console.log(`⏱️ [Anti-Ban Queue] Delaying ${delayMs}ms before executing next kick...`);
                await new Promise(r => setTimeout(r, delayMs));
            }
        }

        this.isProcessingQueue = false;
    }

    async init() {
        const settings = await db.getBotSettings();
        if (settings && settings.auth_token) {
            console.log('🔑 Found saved Auth Token in database. Attempting automatic login...');
            this.loginWithToken(settings.auth_token).catch(err => {
                console.warn('⚠️ Auto-login with saved token failed:', err.message);
                this.updateStatus('offline', { error: 'Saved token expired. Please login with QR.' });
            });
        } else {
            console.log('ℹ️ No saved Auth Token found. Ready for QR Login from BackOffice.');
            this.updateStatus('offline');
        }
    }

    updateStatus(newStatus, extra = {}) {
        this.status = newStatus;
        if (newStatus === 'offline' || newStatus === 'online') {
            this.qrUrl = null;
            this.qrDataUrl = null;
            this.pinCode = null;
        }
        if (newStatus === 'online') {
            this.startTime = Date.now();
        }

        db.saveBotSettings({
            status: this.status,
            pin_code: this.pinCode,
            bot_mid: this.profile?.mid || null,
            bot_name: this.profile?.displayName || null,
            bot_picture_url: this.profile?.pictureUrl || null
        }).catch(() => {});

        this.emit('status_change', {
            status: this.status,
            profile: this.profile,
            qrDataUrl: this.qrDataUrl,
            qrUrl: this.qrUrl,
            pinCode: this.pinCode,
            uptime: this.getUptime(),
            ...extra
        });
    }

    getUptime() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    getStatusInfo() {
        return {
            status: this.status,
            profile: this.profile,
            qrDataUrl: this.qrDataUrl,
            qrUrl: this.qrUrl,
            pinCode: this.pinCode,
            uptime: this.getUptime(),
            groupCount: this.cachedGroups.size
        };
    }

    // -------------------------------------------------------------------------
    // Login Flow
    // -------------------------------------------------------------------------
    async startQRLogin() {
        if (this.status === 'online') {
            throw new Error('Bot is already online.');
        }

        console.log('🔄 Initiating QR Code Login flow...');
        this.updateStatus('waiting_qr');

        const { loginWithQR } = await import('@evex/linejs');

        try {
            const client = await loginWithQR(
                {
                    onReceiveQRUrl: async (url) => {
                        console.log('📱 QR URL received:', url);
                        this.qrUrl = url;
                        this.qrDataUrl = await QRCode.toDataURL(url, { margin: 2, scale: 8 });
                        this.updateStatus('waiting_qr');
                    },
                    onPincodeRequest: async (pin) => {
                        console.log('🔢 PIN Code requested by LINE:', pin);
                        this.pinCode = pin;
                        this.updateStatus('waiting_pin');
                    }
                },
                {
                    device: 'DESKTOPWIN'
                }
            );

            await this.onLoginSuccess(client);
            return true;
        } catch (error) {
            console.error('❌ QR Login failed:', error.message);
            this.updateStatus('offline', { error: error.message });
            throw error;
        }
    }

    async loginWithToken(token) {
        console.log('🔄 Logging in with Auth Token...');
        const { loginWithAuthToken } = await import('@evex/linejs');

        try {
            const client = await loginWithAuthToken(token, {
                device: 'DESKTOPWIN'
            });

            await this.onLoginSuccess(client);
            return true;
        } catch (error) {
            console.error('❌ Auth Token login failed:', error.message);
            this.updateStatus('offline', { error: error.message });
            throw error;
        }
    }

    async logout() {
        console.log('🚪 Logging out bot...');
        if (this.client) {
            try {
                this.client = null;
            } catch (e) {}
        }
        await db.saveBotSettings({ auth_token: null, status: 'offline' });
        this.profile = null;
        this.cachedGroups.clear();
        this.updateStatus('offline');
        return true;
    }

    async onLoginSuccess(client) {
        this.client = client;
        const authToken = client.base.authToken;

        try {
            const myProfile = await client.getMyProfile();
            this.profile = {
                mid: myProfile.mid,
                displayName: myProfile.displayName,
                pictureUrl: myProfile.pictureUrl,
                statusMessage: myProfile.statusMessage
            };

            await db.addWhitelist(myProfile.mid, myProfile.displayName + ' (Bot)', 'owner');
        } catch (e) {
            console.warn('Could not fetch bot profile:', e.message);
        }

        await db.saveBotSettings({
            auth_token: authToken,
            status: 'online',
            bot_mid: this.profile?.mid,
            bot_name: this.profile?.displayName,
            bot_picture_url: this.profile?.pictureUrl
        });

        console.log(`🎉 Bot logged in successfully as: ${this.profile?.displayName || 'LINE Bot'} (${this.profile?.mid || 'Unknown MID'})`);
        this.updateStatus('online');

        await this.syncJoinedGroups();
        this.startEventListener();
    }

    async syncJoinedGroups() {
        if (!this.client) return [];
        try {
            const chats = await this.client.fetchJoinedChats();
            this.cachedGroups.clear();
            for (const chat of chats) {
                if (chat.mid && chat.mid.startsWith('c')) {
                    this.cachedGroups.set(chat.mid, {
                        groupId: chat.mid,
                        groupName: chat.name || 'Unnamed Group',
                        pictureUrl: chat.raw?.picturePath || null,
                        memberCount: chat.raw?.memberCount || 0
                    });

                    await db.getGroupSettings(chat.mid);
                }
            }
            console.log(`📋 Synced ${this.cachedGroups.size} LINE Groups.`);
            return Array.from(this.cachedGroups.values());
        } catch (e) {
            console.warn('Failed to sync joined groups:', e.message);
            return [];
        }
    }

    async getGroupMembers(groupId) {
        if (!this.client) return [];
        try {
            const chatRes = await this.client.base.talk.getChats({
                chatMids: [groupId],
                withMembers: true,
                withInvitees: false
            });
            const chat = chatRes.chats?.[0];
            const memberMids = chat?.extra?.groupExtra?.memberMids ? Object.keys(chat.extra.groupExtra.memberMids) : [];
            
            if (memberMids.length === 0) return [];

            const contacts = await this.client.base.talk.getContacts({ mids: memberMids.slice(0, 100) });
            return contacts.map(c => ({
                mid: c.mid,
                displayName: c.displayName || 'Unknown User',
                pictureUrl: c.picturePath ? `https://profile.line-scdn.net${c.picturePath}` : null
            }));
        } catch (e) {
            console.warn(`Failed to fetch members for group ${groupId}:`, e.message);
            return [];
        }
    }

    // -------------------------------------------------------------------------
    // Real-Time Event Listener & Protection Engine
    // -------------------------------------------------------------------------
    startEventListener() {
        if (!this.client) return;

        console.log('🛡️ Starting LINE Guardian Event Listener...');
        this.client.listen({ talk: true, square: false });

        this.client.on('message', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error('Error in handleMessage:', err);
            }
        });

        this.client.on('event', async (event) => {
            try {
                await this.handleOperation(event);
            } catch (err) {
                console.error('Error in handleOperation:', err);
            }
        });
    }

    async handleMessage(message) {
        if (!message || !message.raw) return;
        const text = message.text || '';
        const senderMid = message.author?.mid || message.raw.from;
        const chatMid = message.chat?.mid || message.raw.to;
        const isGroup = chatMid && chatMid.startsWith('c');

        if (senderMid === this.profile?.mid) return;

        // Strict Admin-Only Commands Check
        if (text.startsWith('#') || text.startsWith('/')) {
            const isWhitelisted = await db.isWhitelisted(senderMid, chatMid);
            if (!isWhitelisted) {
                console.log(`🔒 [Command Ignored] Non-admin (${senderMid}) tried to use command: ${text}`);
                return; // Non-admin commands are completely ignored
            }
            const handled = await this.handleAdminCommand(text, message, senderMid, chatMid);
            if (handled) return;
        }

        if (!isGroup) return;

        // Anti-Link
        const groupSettings = await db.getGroupSettings(chatMid);
        if (groupSettings.is_active && groupSettings.anti_link) {
            const urlRegex = /(https?:\/\/[^\s]+|line\.me\/[^\s]+|t\.me\/[^\s]+|discord\.gg\/[^\s]+|bit\.ly\/[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|co\.th|io|me|app|tv|gg|ly|page|link|xyz)\b[^\s]*)/i;
            if (urlRegex.test(text)) {
                // Extract all URLs in message
                const urlGlobalRegex = /(https?:\/\/[^\s]+|line\.me\/[^\s]+|t\.me\/[^\s]+|discord\.gg\/[^\s]+|bit\.ly\/[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|co\.th|io|me|app|tv|gg|ly|page|link|xyz)\b[^\s]*)/gi;
                const foundUrls = text.match(urlGlobalRegex) || [];

                // Check if all found URLs are whitelisted
                let allLinksAllowed = foundUrls.length > 0;
                for (const url of foundUrls) {
                    const isAllowed = await db.isLinkWhitelisted(url, chatMid);
                    if (!isAllowed) {
                        allLinksAllowed = false;
                        break;
                    }
                }

                if (allLinksAllowed) {
                    console.log(`ℹ️ [Anti-Link] Allowed whitelisted links in group ${chatMid}: ${foundUrls.join(', ')}`);
                    return;
                }

                const isWhitelisted = await db.isWhitelisted(senderMid, chatMid);
                if (!isWhitelisted) {
                    console.log(`🚨 [Anti-Link] Queued kick for forbidden link in group ${chatMid} from ${senderMid}`);
                    const senderName = message.author?.displayName || 'User';

                    this.enqueueKick({
                        chatMid,
                        targetUserMid: senderMid,
                        groupSettings,
                        senderName,
                        actionType: 'anti_link',
                        reason: 'ส่งลิงก์ที่ไม่ได้รับอนุญาต (Anti-Link)',
                        details: `ข้อความที่ส่ง: ${text.substring(0, 100)}`
                    });
                }
            }
        }
    }

    async handleOperation(event) {
        if (!event) return;
        const opType = event.type ?? event.opType;
        const param1 = event.param1;
        const param2 = event.param2;
        const param3 = event.param3;

        // Dedup revisions so no event is processed multiple times
        if (event.revision) {
            if (this.processedRevisions.has(event.revision)) return;
            this.processedRevisions.add(event.revision);
            if (this.processedRevisions.size > 1000) {
                const first = this.processedRevisions.values().next().value;
                this.processedRevisions.delete(first);
            }
        }

        console.log(`📩 [Operation Received] Type: ${opType}, Param1: ${param1}, Param2: ${param2}, Param3: ${param3}`);

        const isGroup = param1 && param1.startsWith('c');
        if (!isGroup) return;

        if (param2 === this.profile?.mid) return;

        const groupSettings = await db.getGroupSettings(param1);
        if (!groupSettings.is_active) return;

        // Exclude Voluntary Leave Events (User leaves group on their own)
        const isLeaveOp =
            opType === 'NOTIFIED_DELETE_SELF_FROM_CHAT' ||
            opType === 'NOTIFIED_LEAVE_CHAT' ||
            opType === 127 || opType === '127' ||
            opType === 18 || opType === '18' ||
            String(opType).toUpperCase().includes('DELETE_SELF') ||
            String(opType).toUpperCase().includes('LEAVE');

        if (isLeaveOp) return; // Leave is voluntary, do not kick

        const isInviteOp =
            (opType === 'NOTIFIED_INVITE_INTO_CHAT' ||
             opType === 'NOTIFIED_INVITE_INTO_ROOM' ||
             opType === 124 || opType === '124' ||
             opType === 13 || opType === '13' ||
             String(opType).toUpperCase().includes('INVITE')) &&
            param3;

        const isKickOp =
            (opType === 'NOTIFIED_DELETE_OTHER_FROM_CHAT' ||
             opType === 'NOTIFIED_DELETE_OTHER_FROM_ROOM' ||
             opType === 128 || opType === '128' ||
             opType === 19 || opType === '19' ||
             String(opType).toUpperCase().includes('DELETE_OTHER')) &&
            param3 && param3.startsWith('u') &&
            param2 !== param3;

        // Anti-Invite
        if (isInviteOp && groupSettings.anti_invite) {
            const isWhitelisted = await db.isWhitelisted(param2, param1);
            if (!isWhitelisted) {
                console.log(`🚨 [Anti-Invite] Unauthorized invite in group ${param1} by ${param2}`);
                const invitedMids = param3 ? param3.split(/[\x1e,]/).filter(Boolean) : [];

                if (invitedMids.length > 0) {
                    try {
                        await this.client.base.talk.cancelChatInvitation({
                            request: {
                                chatMid: param1,
                                targetUserMids: invitedMids
                            }
                        });
                        console.log(`🚫 Canceled invitations for ${invitedMids.length} users.`);
                    } catch (e) {
                        console.warn('Failed to cancel invitation:', e.message);
                    }
                }

                this.enqueueKick({
                    chatMid: param1,
                    targetUserMid: param2,
                    groupSettings,
                    senderName: 'Unknown Inviter',
                    actionType: 'anti_invite',
                    reason: 'เชิญสมาชิกโดยไม่ได้รับอนุญาต (Anti-Invite)',
                    details: `เชิญสมาชิกจำนวน ${invitedMids.length} คน`
                });
            }
        }

        // Anti-Kick
        if (isKickOp && groupSettings.anti_kick) {
            const isWhitelisted = await db.isWhitelisted(param2, param1);
            if (!isWhitelisted) {
                console.log(`🚨 [Anti-Kick] Queued kick for unauthorized kicker in group ${param1} by ${param2}`);

                this.enqueueKick({
                    chatMid: param1,
                    targetUserMid: param2,
                    groupSettings,
                    senderName: 'Offender',
                    actionType: 'anti_kick',
                    reason: 'เตะสมาชิกอื่นโดยไม่ได้รับอนุญาต (Anti-Kick / Kick-back)',
                    details: `เตะผู้ใช้ ${param3}`
                });
            }
        }
    }

    async handleAdminCommand(text, message, senderMid, chatMid) {
        const isWhitelisted = await db.isWhitelisted(senderMid, chatMid);
        if (!isWhitelisted) return false;

        const cmd = text.trim().toLowerCase();

        if (cmd === '#mid' || cmd === '#ไอดี' || cmd === '/mid') {
            const myMid = senderMid;
            const myName = message.author?.displayName || 'User';
            await message.chat.sendMessage(`👤 ข้อมูลของคุณ:\nชื่อ: ${myName}\n🔑 MID: ${myMid}`);
            return true;
        }

        if (cmd.startsWith('#เพิ่มแอดมิน') || cmd.startsWith('#addadmin')) {
            // Check if there are mentions in the message
            const raw = message.raw;
            const contentMetadata = raw?.contentMetadata || {};
            const mentionList = contentMetadata?.MENTION;
            let targetMids = [];

            if (mentionList) {
                try {
                    const parsed = JSON.parse(mentionList);
                    targetMids = parsed.MENTIONEES?.map(m => m.M) || [];
                } catch (e) {}
            }

            // Or extract raw MID from command text
            const parts = text.trim().split(/\s+/);
            if (parts.length > 1 && parts[1].startsWith('u')) {
                targetMids.push(parts[1]);
            }

            if (targetMids.length === 0) {
                await message.chat.sendMessage('⚠️ กรุณาแท็ก (@mention) สมาชิกที่ต้องการตั้งเป็นแอดมิน หรือระบุ MID เช่น:\n#เพิ่มแอดมิน @ชื่อเพื่อน');
                return true;
            }

            for (const mid of targetMids) {
                await db.addWhitelist(mid, 'Admin (จากคำสั่งแชต)', 'admin', chatMid);
            }
            await message.chat.sendMessage(`✅ เพิ่มผู้ดูแลจำนวน ${targetMids.length} คนเข้าสู่ Whitelist เรียบร้อยแล้ว`);
            return true;
        }

        if (cmd.startsWith('#เพิ่มลิงก์') || cmd.startsWith('#addlink')) {
            const parts = text.trim().split(/\s+/);
            if (parts.length < 2) {
                await message.chat.sendMessage('⚠️ กรุณาระบุโดเมนหรือลิงก์ เช่น:\n#เพิ่มลิงก์ youtube.com\n#เพิ่มลิงก์ tiktok.com');
                return true;
            }
            const domain = parts[1];
            await db.addLinkWhitelist(domain, 'เพิ่มผ่านแชต', chatMid);
            await message.chat.sendMessage(`✅ เพิ่มโดเมน/ลิงก์ "${domain}" เข้าสู่ Link Whitelist เรียบร้อยแล้ว (สมาชิกทุกคนสามารถส่งลิงก์นี้ได้)`);
            return true;
        }

        if (cmd.startsWith('#ลบลิงก์') || cmd.startsWith('#removelink')) {
            const parts = text.trim().split(/\s+/);
            if (parts.length < 2) {
                await message.chat.sendMessage('⚠️ กรุณาระบุโดเมนที่ต้องการลบ เช่น:\n#ลบลิงก์ youtube.com');
                return true;
            }
            const domain = parts[1];
            await db.removeLinkWhitelist(domain);
            await message.chat.sendMessage(`🗑️ ลบโดเมน/ลิงก์ "${domain}" ออกจาก Link Whitelist เรียบร้อยแล้ว`);
            return true;
        }

        if (cmd === '#รายการลิงก์' || cmd === '#links') {
            const links = await db.getLinkWhitelists();
            if (links.length === 0) {
                await message.chat.sendMessage('📋 ยังไม่มีลิงก์ที่อนุญาตใน Link Whitelist');
                return true;
            }
            const listText = links.map((l, i) => `${i + 1}. 🌐 ${l.pattern} (${l.description || 'ทั่วไป'})`).join('\n');
            await message.chat.sendMessage(`📋 [รายการลิงก์ที่อนุญาตให้ส่งได้]:\n${listText}`);
            return true;
        }

        if (cmd === '#status' || cmd === '#สถานะ' || cmd === '/status') {
            const s = await db.getGroupSettings(chatMid);
            const statusMsg = `🛡️ [สถานะ Guardian Bot]
กลุ่ม: ${s.group_name || chatMid}
ระบบโดยรวม: ${s.is_active ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน'}
🔗 กันส่งลิงก์ (Anti-Link): ${s.anti_link ? '✅ เปิด' : '❌ ปิด'}
👥 กันเชิญมั่ว (Anti-Invite): ${s.anti_invite ? '✅ เปิด' : '❌ ปิด'}
⚡ กันเตะมั่ว (Anti-Kick): ${s.anti_kick ? '✅ เปิด' : '❌ ปิด'}
⏱️ Uptime: ${this.getUptime()} วินาที`;
            await message.chat.sendMessage(statusMsg);
            return true;
        }

        if (cmd === '#เปิดกันลิงก์') {
            await db.saveGroupSettings(chatMid, { anti_link: true });
            await message.chat.sendMessage('✅ เปิดใช้งานระบบ Anti-Link (เตะคนส่งลิงก์) เรียบร้อยแล้ว');
            return true;
        }
        if (cmd === '#ปิดกันลิงก์') {
            await db.saveGroupSettings(chatMid, { anti_link: false });
            await message.chat.sendMessage('❌ ปิดใช้งานระบบ Anti-Link เรียบร้อยแล้ว');
            return true;
        }

        if (cmd === '#เปิดกันเชิญ') {
            await db.saveGroupSettings(chatMid, { anti_invite: true });
            await message.chat.sendMessage('✅ เปิดใช้งานระบบ Anti-Invite (เตะคนเชิญมั่ว) เรียบร้อยแล้ว');
            return true;
        }
        if (cmd === '#ปิดกันเชิญ') {
            await db.saveGroupSettings(chatMid, { anti_invite: false });
            await message.chat.sendMessage('❌ ปิดใช้งานระบบ Anti-Invite เรียบร้อยแล้ว');
            return true;
        }

        if (cmd === '#เปิดกันเตะ') {
            await db.saveGroupSettings(chatMid, { anti_kick: true });
            await message.chat.sendMessage('✅ เปิดใช้งานระบบ Anti-Kick (เตะคนเตะมั่ว) เรียบร้อยแล้ว');
            return true;
        }
        if (cmd === '#ปิดกันเตะ') {
            await db.saveGroupSettings(chatMid, { anti_kick: false });
            await message.chat.sendMessage('❌ ปิดใช้งานระบบ Anti-Kick เรียบร้อยแล้ว');
            return true;
        }

        if (cmd === '#เปิดระบบ') {
            await db.saveGroupSettings(chatMid, { is_active: true });
            await message.chat.sendMessage('🟢 เปิดใช้งานระบบความปลอดภัยกลุ่มนี้เรียบร้อยแล้ว');
            return true;
        }
        if (cmd === '#ปิดระบบ') {
            await db.saveGroupSettings(chatMid, { is_active: false });
            await message.chat.sendMessage('🔴 ปิดการทำงานของระบบความปลอดภัยกลุ่มนี้ชั่วคราว');
            return true;
        }

        return false;
    }
}

const botGuardian = new BotGuardian();
export default botGuardian;
