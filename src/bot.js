import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import db from './db.js';

export class BotGuardian extends EventEmitter {
    // Shared deduplication across all bot instances in the same group
    static recentActionKeys = new Map();

    static isActionRecent(key, ttlMs = 5000) {
        const now = Date.now();
        const lastTime = BotGuardian.recentActionKeys.get(key);
        if (lastTime && (now - lastTime < ttlMs)) {
            return true;
        }
        BotGuardian.recentActionKeys.set(key, now);

        if (BotGuardian.recentActionKeys.size > 500) {
            for (const [k, time] of BotGuardian.recentActionKeys.entries()) {
                if (now - time > 15000) BotGuardian.recentActionKeys.delete(k);
            }
        }
        return false;
    }

    constructor(botData = null) {
        super();
        this.botMid = botData?.mid || null;
        this.displayName = botData?.display_name || botData?.displayName || 'LINE Guardian Bot';
        this.pictureUrl = botData?.picture_url || botData?.pictureUrl || null;
        this.authToken = botData?.auth_token || botData?.authToken || null;
        this.isActive = botData?.is_active !== undefined ? botData.is_active : (botData?.isActive !== undefined ? botData.isActive : true);

        this.client = null;
        this.status = 'offline';
        this.qrUrl = null;
        this.qrDataUrl = null;
        this.pinCode = null;
        this.profile = botData?.mid ? {
            mid: botData.mid,
            displayName: this.displayName,
            pictureUrl: this.pictureUrl
        } : null;
        this.startTime = null;
        this.cachedGroups = new Map();

        // Anti-ban Kick Queue with 1000-1500ms jitter delay
        this.actionQueue = [];
        this.isProcessingQueue = false;

        // Dedup Op Revisions to prevent duplicate loops
        this.processedRevisions = new Set();
    }

    enqueueKick({ chatMid, targetUserMid, groupSettings, senderName, actionType, reason, details }) {
        // Shared Deduplication: Check if any other bot in the same group already handled this action
        const dedupKey = `${chatMid}:${targetUserMid}:${actionType}`;
        if (BotGuardian.isActionRecent(dedupKey, 6000)) {
            console.log(`🛡️ [Multi-Bot Dedup] Action ${dedupKey} already processed by another bot. Skipping duplicate kick.`);
            return;
        }

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
                    console.log(`⚡ [Safe Kick] Bot (${this.profile?.displayName || this.displayName}) kicked ${action.targetUserMid} from group ${action.chatMid}`);
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

                // Log incident to database with this bot's identity
                const groupInfo = this.cachedGroups.get(action.chatMid);
                const groupName = groupInfo ? groupInfo.groupName : 'LINE Group';
                await db.logIncident({
                    groupId: action.chatMid,
                    groupName,
                    userMid: action.targetUserMid,
                    userName: action.senderName || 'Offender',
                    botMid: this.profile?.mid || this.botMid,
                    botName: this.profile?.displayName || this.displayName,
                    actionType: action.actionType,
                    reason: action.reason,
                    details: action.details
                });
            } catch (err) {
                console.error(`❌ Kick action error for ${action.targetUserMid}:`, err.message);
            }

            // Anti-ban Delay Throttle: Random delay between 1000ms - 1500ms
            if (this.actionQueue.length > 0) {
                const delayMs = Math.floor(Math.random() * 501) + 1000;
                console.log(`⏱️ [Anti-Ban Queue] Delaying ${delayMs}ms before executing next kick...`);
                await new Promise(r => setTimeout(r, delayMs));
            }
        }

        this.isProcessingQueue = false;
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

        this.emit('status_change', {
            botMid: this.botMid || this.profile?.mid,
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
        if (!this.startTime || this.status !== 'online') return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    getStatusInfo() {
        return {
            mid: this.botMid || this.profile?.mid || 'unregistered',
            displayName: this.profile?.displayName || this.displayName,
            pictureUrl: this.profile?.pictureUrl || this.pictureUrl,
            status: this.status,
            uptime: this.getUptime(),
            groupCount: this.cachedGroups.size,
            isActive: this.isActive,
            qrDataUrl: this.qrDataUrl,
            qrUrl: this.qrUrl,
            pinCode: this.pinCode
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
        if (!token) throw new Error('No token provided.');
        console.log(`🔄 Logging in bot (${this.displayName})...`);
        const { loginWithAuthToken } = await import('@evex/linejs');

        try {
            const client = await loginWithAuthToken(token, {
                device: 'DESKTOPWIN'
            });

            await this.onLoginSuccess(client);
            return true;
        } catch (error) {
            console.error(`❌ Auth Token login failed for ${this.displayName}:`, error.message);
            this.updateStatus('offline', { error: error.message });
            throw error;
        }
    }

    async logout() {
        console.log(`🚪 Disconnecting bot (${this.profile?.displayName || this.displayName})...`);
        if (this.client) {
            try {
                this.client = null;
            } catch (e) {}
        }
        if (this.botMid) {
            await db.deleteBot(this.botMid);
        }
        this.profile = null;
        this.cachedGroups.clear();
        this.updateStatus('offline');
        return true;
    }

    async stop() {
        if (this.client) {
            try {
                this.client = null;
            } catch (e) {}
        }
        this.updateStatus('offline');
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
            this.botMid = myProfile.mid;
            this.displayName = myProfile.displayName;
            this.pictureUrl = myProfile.pictureUrl;
            this.authToken = authToken;

            // Automatically whitelist this bot as owner/bot
            await db.addWhitelist(myProfile.mid, myProfile.displayName + ' (Bot)', 'owner');
        } catch (e) {
            console.warn('Could not fetch bot profile:', e.message);
        }

        // Save bot to public.line_bots
        await db.saveBot({
            mid: this.botMid,
            displayName: this.displayName,
            pictureUrl: this.pictureUrl,
            authToken: authToken,
            isActive: this.isActive
        });

        console.log(`🎉 Bot logged in successfully: ${this.displayName} (${this.botMid})`);
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
            console.log(`📋 [${this.displayName}] Synced ${this.cachedGroups.size} LINE Groups.`);
            return Array.from(this.cachedGroups.values());
        } catch (e) {
            console.warn(`[${this.displayName}] Failed to sync joined groups:`, e.message);
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
            console.warn(`[${this.displayName}] Failed to fetch members for group ${groupId}:`, e.message);
            return [];
        }
    }

    // -------------------------------------------------------------------------
    // Real-Time Event Listener & Protection Engine
    // -------------------------------------------------------------------------
    startEventListener() {
        if (!this.client) return;

        console.log(`🛡️ [${this.displayName}] Starting LINE Guardian Event Listener...`);
        this.client.listen({ talk: true, square: false });

        this.client.on('message', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (err) {
                console.error(`[${this.displayName}] Error in handleMessage:`, err);
            }
        });

        this.client.on('event', async (event) => {
            try {
                await this.handleOperation(event);
            } catch (err) {
                console.error(`[${this.displayName}] Error in handleOperation:`, err);
            }
        });
    }

    async handleMessage(message) {
        if (!message || !message.raw) return;
        const text = message.text || '';
        const senderMid = message.author?.mid || message.raw.from;
        const chatMid = message.chat?.mid || message.raw.to;
        const isGroup = chatMid && chatMid.startsWith('c');

        if (!senderMid || senderMid === this.botMid) return;

        // Mutual Bot & Admin Whitelist check
        const isWhitelisted = await db.isWhitelisted(senderMid, chatMid);

        // 1. Text Commands in Group
        if (isGroup && text.startsWith('#')) {
            await this.handleCommand(text, chatMid, senderMid, isWhitelisted, message);
            return;
        }

        // 2. Anti-Link Enforcement
        if (isGroup && !isWhitelisted) {
            const groupSettings = await db.getGroupSettings(chatMid);
            if (groupSettings.is_active && groupSettings.anti_link) {
                const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|co|th|io|me|xyz|top|live|app|cc|vip|club|link|online|site|space|fun|info|biz|asia|tv|mobi|tech|click|shop|store|uno|bet|win|game|slot|casino)[^\s]*)/gi;
                const matches = text.match(urlRegex);

                if (matches && matches.length > 0) {
                    let isAllAllowed = true;
                    for (const url of matches) {
                        const isAllowed = await db.isLinkWhitelisted(url, chatMid);
                        if (!isAllowed) {
                            isAllAllowed = false;
                            break;
                        }
                    }

                    if (!isAllAllowed) {
                        console.log(`🚨 [Anti-Link Triggered] User ${senderMid} posted unauthorized link: "${text.substring(0, 30)}..." in group ${chatMid}`);
                        
                        let senderName = 'Unknown User';
                        try {
                            const author = await message.getAuthor();
                            senderName = author?.displayName || 'User';
                        } catch (e) {}

                        this.enqueueKick({
                            chatMid,
                            targetUserMid: senderMid,
                            groupSettings,
                            senderName,
                            actionType: 'anti_link',
                            reason: 'ส่งลิงก์ภายนอกที่ไม่ได้รับอนุญาต',
                            details: text.length > 80 ? text.substring(0, 80) + '...' : text
                        });
                    }
                }
            }
        }
    }

    async handleOperation(event) {
        if (!event || !event.raw) return;
        const op = event.raw;
        const opType = op.type;

        // Deduplicate revisions to prevent loops
        if (op.revision) {
            const revKey = `${op.revision}_${opType}`;
            if (this.processedRevisions.has(revKey)) return;
            this.processedRevisions.add(revKey);
            if (this.processedRevisions.size > 2000) {
                const firstItem = this.processedRevisions.values().next().value;
                this.processedRevisions.delete(firstItem);
            }
        }

        // OpType 124: NOTIFIED_INVITE_INTO_CHAT
        if (opType === 124 || opType === 'NOTIFIED_INVITE_INTO_CHAT') {
            await this.handleInviteEvent(op);
            return;
        }

        // OpType 128: NOTIFIED_DELETE_OTHER_FROM_CHAT (Someone kicked someone)
        if (opType === 128 || opType === 'NOTIFIED_DELETE_OTHER_FROM_CHAT') {
            await this.handleKickEvent(op);
            return;
        }
    }

    async handleInviteEvent(op) {
        const chatMid = op.param1;
        const inviterMid = op.param2;
        const inviteeMids = op.param3 ? op.param3.split('\x1e') : [];

        if (!chatMid || !chatMid.startsWith('c') || !inviterMid) return;
        if (inviterMid === this.botMid) return;

        const isWhitelisted = await db.isWhitelisted(inviterMid, chatMid);
        if (isWhitelisted) return;

        const groupSettings = await db.getGroupSettings(chatMid);
        if (!groupSettings.is_active || !groupSettings.anti_invite) return;

        console.log(`🚨 [Anti-Invite Triggered] Non-admin ${inviterMid} invited ${inviteeMids.length} users into ${chatMid}`);

        let inviterName = 'Unknown User';
        try {
            const contacts = await this.client.base.talk.getContacts({ mids: [inviterMid] });
            inviterName = contacts[0]?.displayName || 'User';
        } catch (e) {}

        // 1. Kick inviter
        this.enqueueKick({
            chatMid,
            targetUserMid: inviterMid,
            groupSettings,
            senderName: inviterName,
            actionType: 'anti_invite',
            reason: `เชิญสมาชิกอื่นเข้ากลุ่มโดยไม่ได้รับอนุญาต (${inviteeMids.length} คน)`,
            details: `Inviter MID: ${inviterMid}`
        });

        // 2. Cancel invitations for invitees
        if (this.client && inviteeMids.length > 0) {
            try {
                await this.client.base.talk.cancelChatInvitation({
                    request: {
                        chatMid,
                        targetUserMids: inviteeMids
                    }
                });
                console.log(`🛑 [Invite Cancelled] Cancelled ${inviteeMids.length} pending invitations in ${chatMid}`);
            } catch (e) {
                console.warn('Failed to cancel chat invitations:', e.message);
            }
        }
    }

    async handleKickEvent(op) {
        const chatMid = op.param1;
        const kickerMid = op.param2;
        const victimMids = op.param3 ? op.param3.split('\x1e') : [];

        if (!chatMid || !chatMid.startsWith('c') || !kickerMid) return;
        if (kickerMid === this.botMid) return;

        // Whitelist check
        const isWhitelisted = await db.isWhitelisted(kickerMid, chatMid);
        if (isWhitelisted) return;

        const groupSettings = await db.getGroupSettings(chatMid);
        if (!groupSettings.is_active || !groupSettings.anti_kick) return;

        console.log(`🚨 [Anti-Kick Triggered] Non-admin ${kickerMid} kicked users from group ${chatMid}`);

        let kickerName = 'Unknown User';
        try {
            const contacts = await this.client.base.talk.getContacts({ mids: [kickerMid] });
            kickerName = contacts[0]?.displayName || 'User';
        } catch (e) {}

        // Kick the rogue kicker immediately
        this.enqueueKick({
            chatMid,
            targetUserMid: kickerMid,
            groupSettings,
            senderName: kickerName,
            actionType: 'anti_kick',
            reason: `เตะสมาชิกคนอื่นออกจากกลุ่ม (${victimMids.length} คน)`,
            details: `Kicked users: ${victimMids.join(', ')}`
        });
    }

    async handleCommand(text, chatMid, senderMid, isWhitelisted, message) {
        const parts = text.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();

        if (cmd === '#สถานะ' || cmd === '#status') {
            const groupSettings = await db.getGroupSettings(chatMid);
            const statusMsg = `🛡️ [Guardian Bot - ข้อมูลสถานะกลุ่ม]\n` +
                `📌 บอทประจำกลุ่ม: ${this.displayName}\n` +
                `━━━━━━━━━━━━━━━\n` +
                `🔗 Anti-Link: ${groupSettings.anti_link ? '✅ เปิดทำงาน' : '❌ ปิด'}\n` +
                `👥 Anti-Invite: ${groupSettings.anti_invite ? '✅ เปิดทำงาน' : '❌ ปิด'}\n` +
                `⚡ Anti-Kick: ${groupSettings.anti_kick ? '✅ เปิดทำงาน' : '❌ ปิด'}\n` +
                `🤫 Silent Kick: ${groupSettings.silent_kick ? '✅ เปิดทำงาน' : '❌ ปิด'}\n` +
                `━━━━━━━━━━━━━━━\n` +
                `💻 จัดการผ่านเว็บ: https://guardianbot-lotto.up.railway.app`;
            try {
                const chat = await this.client.getChat(chatMid);
                await chat.sendMessage(statusMsg);
            } catch (e) {}
            return;
        }

        if (cmd === '#ช่วยเหลือ' || cmd === '#help') {
            const helpMsg = `📖 [คำสั่ง Guardian Bot]\n` +
                `• #สถานะ - ดูสถานะความปลอดภัยกลุ่ม\n` +
                `• #ช่วยเหลือ - ดูรายการคำสั่ง\n` +
                `• #เพิ่มแอดมิน @แท็กชื่อ - แต่งตั้งแอดมิน (Admin Only)\n` +
                `• #ลบแอดมิน @แท็กชื่อ - ลบแอดมิน (Admin Only)\n` +
                `• #เปิดระบบ / #ปิดระบบ - เปิด/ปิดระบบบอทกลุ่มนี้`;
            try {
                const chat = await this.client.getChat(chatMid);
                await chat.sendMessage(helpMsg);
            } catch (e) {}
            return;
        }

        if (!isWhitelisted) return;

        if (cmd === '#เปิดระบบ') {
            await db.saveGroupSettings(chatMid, { is_active: true });
            const chat = await this.client.getChat(chatMid);
            await chat.sendMessage('✅ เปิดระบบความปลอดภัยกลุ่มเรียบร้อยแล้ว');
            return;
        }

        if (cmd === '#ปิดระบบ') {
            await db.saveGroupSettings(chatMid, { is_active: false });
            const chat = await this.client.getChat(chatMid);
            await chat.sendMessage('⚠️ ปิดระบบความปลอดภัยกลุ่มชั่วคราวเรียบร้อยแล้ว');
            return;
        }

        if (cmd === '#เพิ่มแอดมิน' || cmd === '#addadmin') {
            const mentionees = message.raw?.contentMetadata?.MENTION 
                ? JSON.parse(message.raw.contentMetadata.MENTION)?.MENTIONEES || []
                : [];

            if (mentionees.length === 0) {
                const chat = await this.client.getChat(chatMid);
                await chat.sendMessage('⚠️ กรุณาพิมพ์คำสั่งพร้อม @แท็กชื่อ สมาชิกที่ต้องการเพิ่มเป็นแอดมิน เช่น #เพิ่มแอดมิน @ชื่อเพื่อน');
                return;
            }

            for (const m of mentionees) {
                if (m.M) {
                    await db.addWhitelist(m.M, 'Admin (Tag)', 'admin', chatMid);
                }
            }
            const chat = await this.client.getChat(chatMid);
            await chat.sendMessage(`✅ แต่งตั้งผู้ดูแล ${mentionees.length} คนเข้าสู่ Whitelist เรียบร้อยแล้ว`);
            return;
        }

        if (cmd === '#ลบแอดมิน' || cmd === '#deladmin') {
            const mentionees = message.raw?.contentMetadata?.MENTION 
                ? JSON.parse(message.raw.contentMetadata.MENTION)?.MENTIONEES || []
                : [];

            if (mentionees.length === 0) {
                const chat = await this.client.getChat(chatMid);
                await chat.sendMessage('⚠️ กรุณาพิมพ์คำสั่งพร้อม @แท็กชื่อ สมาชิกที่ต้องการลบสิทธิ์ เช่น #ลบแอดมิน @ชื่อเพื่อน');
                return;
            }

            for (const m of mentionees) {
                if (m.M) {
                    await db.removeWhitelist(m.M);
                }
            }
            const chat = await this.client.getChat(chatMid);
            await chat.sendMessage(`✅ ลบสิทธิ์ผู้ดูแล ${mentionees.length} คนออกจาก Whitelist เรียบร้อยแล้ว`);
            return;
        }
    }
}

// Single instance export for backward compatibility
const botInstance = new BotGuardian();
export default botInstance;
