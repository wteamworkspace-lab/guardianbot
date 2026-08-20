import { EventEmitter } from 'events';
import { BotGuardian } from './bot.js';
import db from './db.js';

class BotManager extends EventEmitter {
    constructor() {
        super();
        this.bots = new Map(); // Map<botMid, BotGuardian>
        this.qrSessions = new Map(); // Map<sessionId, BotGuardian>
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log('🚀 Initializing Multi-Bot Manager...');
        const savedBots = await db.getAllBots();

        if (savedBots && savedBots.length > 0) {
            console.log(`📋 Found ${savedBots.length} registered bot(s) in database.`);
            for (const botData of savedBots) {
                if (botData.auth_token && (botData.is_active !== false)) {
                    await this.startBot(botData);
                } else {
                    console.log(`⏸️ Bot "${botData.display_name || botData.mid}" is paused or has no token.`);
                }
            }
        } else {
            console.log('ℹ️ No registered bots in database. Ready for first-time QR Login.');
        }
    }

    async startBot(botData) {
        if (!botData || !botData.auth_token) return null;
        const mid = botData.mid;

        // If already running
        if (this.bots.has(mid)) {
            const existing = this.bots.get(mid);
            if (existing.status === 'online') return existing;
        }

        const botInstance = new BotGuardian(botData);
        botInstance.on('status_change', (data) => {
            this.emit('bot_status_change', { botMid: mid, ...data });
        });

        this.bots.set(mid, botInstance);

        try {
            await botInstance.loginWithToken(botData.auth_token);
            return botInstance;
        } catch (err) {
            console.warn(`⚠️ Failed to start bot (${botData.display_name || mid}):`, err.message);
            return botInstance;
        }
    }

    async startNewBotQR(sessionId = 'default') {
        // If an existing QR session for this sessionId exists, cancel it first
        if (this.qrSessions.has(sessionId)) {
            await this.cancelQR(sessionId);
        }

        console.log(`🔄 Starting new Bot QR Login session [${sessionId}]...`);
        const newBot = new BotGuardian();

        newBot.on('status_change', async (data) => {
            this.emit('qr_status_change', { sessionId, ...data });

            // If login succeeded, move from qrSessions to bots map
            if (data.status === 'online' && newBot.botMid) {
                this.bots.set(newBot.botMid, newBot);
                this.qrSessions.delete(sessionId);
                console.log(`🎉 New bot registered into Multi-Bot fleet: ${newBot.displayName} (${newBot.botMid})`);
                this.emit('bot_registered', newBot.getStatusInfo());
            }
        });

        this.qrSessions.set(sessionId, newBot);

        try {
            await newBot.startQRLogin();
            return newBot;
        } catch (err) {
            this.qrSessions.delete(sessionId);
            throw err;
        }
    }

    async cancelQR(sessionId = 'default') {
        if (this.qrSessions.has(sessionId)) {
            const bot = this.qrSessions.get(sessionId);
            await bot.stop();
            this.qrSessions.delete(sessionId);
            this.emit('qr_status_change', { sessionId, status: 'offline' });
        }
    }

    async removeBot(mid) {
        if (!mid) return false;
        if (this.bots.has(mid)) {
            const bot = this.bots.get(mid);
            await bot.logout();
            this.bots.delete(mid);
        }
        await db.deleteBot(mid);
        this.emit('bot_removed', { botMid: mid });
        return true;
    }

    async toggleBot(mid, isActive) {
        if (!mid) return false;
        await db.toggleBot(mid, isActive);

        if (isActive) {
            const botData = await db.getBotByMid(mid);
            if (botData) {
                await this.startBot(botData);
            }
        } else {
            if (this.bots.has(mid)) {
                const bot = this.bots.get(mid);
                await bot.stop();
                this.bots.delete(mid);
            }
        }
        return true;
    }

    getAllBotsInfo() {
        const result = [];
        // Active in-memory bots
        for (const [mid, bot] of this.bots.entries()) {
            result.push(bot.getStatusInfo());
        }
        return result;
    }

    async getAllRegisteredBots() {
        const dbBots = await db.getAllBots();
        return dbBots.map(b => {
            const activeInstance = this.bots.get(b.mid);
            return {
                mid: b.mid,
                displayName: b.display_name || b.displayName || 'LINE Bot',
                pictureUrl: b.picture_url || b.pictureUrl || null,
                status: activeInstance ? activeInstance.status : 'offline',
                uptime: activeInstance ? activeInstance.getUptime() : 0,
                groupCount: activeInstance ? activeInstance.cachedGroups.size : 0,
                isActive: b.is_active !== false,
                createdAt: b.created_at
            };
        });
    }

    getAllGroups() {
        const groupMap = new Map();

        for (const [botMid, bot] of this.bots.entries()) {
            if (bot.status === 'online') {
                for (const [groupId, g] of bot.cachedGroups.entries()) {
                    if (!groupMap.has(groupId)) {
                        groupMap.set(groupId, {
                            ...g,
                            assignedBots: []
                        });
                    }
                    const group = groupMap.get(groupId);
                    group.assignedBots.push({
                        mid: botMid,
                        displayName: bot.displayName,
                        pictureUrl: bot.pictureUrl
                    });
                }
            }
        }

        return Array.from(groupMap.values());
    }

    async syncAllGroups() {
        const allGroups = [];
        for (const [botMid, bot] of this.bots.entries()) {
            if (bot.status === 'online') {
                const groups = await bot.syncJoinedGroups();
                allGroups.push(...groups);
            }
        }
        return this.getAllGroups();
    }

    async getGroupMembers(groupId) {
        // Find any online bot that is inside this group
        for (const bot of this.bots.values()) {
            if (bot.status === 'online' && bot.cachedGroups.has(groupId)) {
                return await bot.getGroupMembers(groupId);
            }
        }

        // Fallback: try first online bot
        for (const bot of this.bots.values()) {
            if (bot.status === 'online') {
                return await bot.getGroupMembers(groupId);
            }
        }

        return [];
    }
}

const botManager = new BotManager();
export default botManager;
