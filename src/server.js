import 'dotenv/config';
import express from 'express';
import next from 'next';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from './db.js';
import botManager from './bot-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, '../.next'));
const dev = !isProd;
const app = next({ dev, dir: path.join(__dirname, '..') });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

app.prepare().then(async () => {
    const server = express();
    server.use(cors());
    server.use(express.json());
    server.use(express.static(path.join(__dirname, '../public')));

    // Keep track of active SSE connections
    const sseClients = new Set();

    function broadcastEvent(type, data) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const client of sseClients) {
            try {
                client.write(payload);
            } catch (e) {
                sseClients.delete(client);
            }
        }
    }

    // Forward Bot Manager events to BackOffice UI
    botManager.on('bot_status_change', async (data) => {
        const allBots = await botManager.getAllRegisteredBots();
        broadcastEvent('bots_update', { bots: allBots, event: data });
    });

    botManager.on('qr_status_change', (data) => {
        broadcastEvent('qr_status', data);
    });

    botManager.on('bot_registered', async (data) => {
        const allBots = await botManager.getAllRegisteredBots();
        broadcastEvent('bots_update', { bots: allBots, registered: data });
    });

    botManager.on('bot_removed', async (data) => {
        const allBots = await botManager.getAllRegisteredBots();
        broadcastEvent('bots_update', { bots: allBots, removed: data });
    });

    // -------------------------------------------------------------------------
    // SSE Real-Time Stream
    // -------------------------------------------------------------------------
    server.get('/api/events', async (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        sseClients.add(res);

        const allBots = await botManager.getAllRegisteredBots();
        res.write(`event: bots_update\ndata: ${JSON.stringify({ bots: allBots })}\n\n`);

        req.on('close', () => {
            sseClients.delete(res);
        });
    });

    // -------------------------------------------------------------------------
    // Admin User Auth APIs
    // -------------------------------------------------------------------------
    server.post('/api/auth/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            const result = await db.verifyAdminLogin(username, password);
            if (result.success) {
                res.json(result);
            } else {
                res.status(401).json(result);
            }
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.get('/api/auth/me', (req, res) => {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
        if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const payload = db.verifyToken(token);
        if (!payload) return res.status(401).json({ success: false, message: 'Invalid or expired token' });

        res.json({ success: true, user: { username: payload.username, displayName: payload.displayName } });
    });

    server.post('/api/auth/change-password', async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
            const payload = db.verifyToken(token);
            if (!payload) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const { oldPassword, newPassword } = req.body;
            const result = await db.changeAdminPassword(payload.username, oldPassword, newPassword);
            if (result.success) {
                res.json(result);
            } else {
                res.status(400).json(result);
            }
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // -------------------------------------------------------------------------
    // Multi-Bot Management APIs
    // -------------------------------------------------------------------------
    server.get('/api/bots', async (req, res) => {
        try {
            const bots = await botManager.getAllRegisteredBots();
            res.json({ success: true, data: bots });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.post('/api/bots/qr', async (req, res) => {
        try {
            const sessionId = req.body.sessionId || 'default';
            botManager.startNewBotQR(sessionId).catch(err => {
                console.error(`QR Login Error [${sessionId}]:`, err.message);
            });
            res.json({ success: true, message: 'QR login session initiated.' });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.post('/api/bots/cancel-qr', async (req, res) => {
        try {
            const sessionId = req.body.sessionId || 'default';
            await botManager.cancelQR(sessionId);
            res.json({ success: true, message: 'Cancelled QR session.' });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.delete('/api/bots/:mid', async (req, res) => {
        try {
            const mid = req.params.mid;
            await botManager.removeBot(mid);
            res.json({ success: true, message: 'Bot removed successfully.' });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.post('/api/bots/:mid/toggle', async (req, res) => {
        try {
            const mid = req.params.mid;
            const { isActive } = req.body;
            await botManager.toggleBot(mid, isActive);
            res.json({ success: true, message: `Bot ${isActive ? 'resumed' : 'paused'} successfully.` });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // Backward-compatibility legacy status endpoint
    server.get('/api/status', async (req, res) => {
        const bots = await botManager.getAllRegisteredBots();
        const firstActive = bots.find(b => b.status === 'online') || bots[0] || null;
        res.json({
            success: true,
            data: {
                status: firstActive ? firstActive.status : 'offline',
                profile: firstActive ? { displayName: firstActive.displayName, pictureUrl: firstActive.pictureUrl, mid: firstActive.mid } : null,
                uptime: firstActive ? firstActive.uptime : 0,
                groupCount: bots.reduce((sum, b) => sum + (b.groupCount || 0), 0),
                totalBots: bots.length,
                onlineBots: bots.filter(b => b.status === 'online').length
            }
        });
    });

    // -------------------------------------------------------------------------
    // Groups & Protection Settings APIs (Multi-Bot Aware)
    // -------------------------------------------------------------------------
    server.get('/api/groups', async (req, res) => {
        try {
            const savedSettings = await db.getAllGroupSettings();
            const settingsMap = new Map(savedSettings.map(s => [s.group_id, s]));
            const memoryGroups = botManager.getAllGroups();
            const groupMap = new Map();

            // 1. Add all groups detected by live bots
            for (const g of memoryGroups) {
                const settings = settingsMap.get(g.groupId) || await db.getGroupSettings(g.groupId);
                groupMap.set(g.groupId, { ...g, ...settings });
            }

            // 2. Add saved groups from database even if bots are temporarily offline
            for (const s of savedSettings) {
                if (!groupMap.has(s.group_id)) {
                    groupMap.set(s.group_id, {
                        groupId: s.group_id,
                        groupName: s.group_name || 'LINE Group',
                        pictureUrl: s.group_picture_url || null,
                        assignedBots: [],
                        ...s
                    });
                }
            }

            res.json({ success: true, data: Array.from(groupMap.values()) });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.post('/api/groups/sync', async (req, res) => {
        try {
            const groups = await botManager.syncAllGroups();
            res.json({ success: true, data: groups });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.post('/api/groups/:id/settings', async (req, res) => {
        try {
            const saved = await db.saveGroupSettings(req.params.id, req.body);
            res.json({ success: true, data: saved });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.delete('/api/groups/:id', async (req, res) => {
        try {
            const groupId = req.params.id;
            await db.removeGroupSettings(groupId);
            res.json({ success: true, message: 'Group deleted successfully.' });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.get('/api/groups/:id/members', async (req, res) => {
        try {
            const members = await botManager.getGroupMembers(req.params.id);
            res.json({ success: true, data: members });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // -------------------------------------------------------------------------
    // Whitelist APIs
    // -------------------------------------------------------------------------
    server.get('/api/whitelist', async (req, res) => {
        try {
            const list = await db.getWhitelist();
            res.json({ success: true, data: list });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.post('/api/whitelist', async (req, res) => {
        try {
            const { mid, name, role, groupId } = req.body;
            if (!mid) return res.status(400).json({ success: false, message: 'MID is required.' });
            const created = await db.addWhitelist(mid.trim(), name || 'Admin', role || 'admin', groupId || 'global');
            res.json({ success: true, data: created });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.delete('/api/whitelist/:mid', async (req, res) => {
        try {
            await db.removeWhitelist(req.params.mid);
            res.json({ success: true, message: 'Removed from whitelist.' });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // -------------------------------------------------------------------------
    // Link Whitelist APIs
    // -------------------------------------------------------------------------
    server.get('/api/link-whitelist', async (req, res) => {
        try {
            const list = await db.getLinkWhitelists();
            res.json({ success: true, data: list });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.post('/api/link-whitelist', async (req, res) => {
        try {
            const { pattern, description, groupId } = req.body;
            if (!pattern) return res.status(400).json({ success: false, message: 'Domain or URL pattern is required.' });
            const created = await db.addLinkWhitelist(pattern.trim(), description || '', groupId || 'global');
            res.json({ success: true, data: created });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    server.delete('/api/link-whitelist/:id', async (req, res) => {
        try {
            await db.removeLinkWhitelist(req.params.id);
            res.json({ success: true, message: 'Removed from link whitelist.' });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // -------------------------------------------------------------------------
    // Logs API
    // -------------------------------------------------------------------------
    server.get('/api/logs', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const logs = await db.getAuditLogs(limit);
            res.json({ success: true, data: logs });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // -------------------------------------------------------------------------
    // Next.js Route Handler for all pages
    // -------------------------------------------------------------------------
    server.use((req, res) => {
        return handle(req, res);
    });

    server.listen(PORT, '0.0.0.0', async () => {
        console.log('=======================================================');
        console.log(`🚀 Next.js + Bot Guardian Multi-Bot running on port ${PORT}`);
        console.log('=======================================================');
        await botManager.init();
    });
}).catch(err => {
    console.error('Failed to start Next.js server:', err);
});
