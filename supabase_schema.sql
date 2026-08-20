-- ==============================================================================
-- Guardian Bot - Supabase Database Schema & RLS Policies (Full Anon Access)
-- Run this SQL in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Table for Bot Settings & Auth Token
CREATE TABLE IF NOT EXISTS public.bot_settings (
    id TEXT PRIMARY KEY DEFAULT 'config',
    auth_token TEXT,
    bot_mid TEXT,
    bot_name TEXT,
    bot_picture_url TEXT,
    status TEXT DEFAULT 'offline',
    pin_code TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table for Group Protection Settings
CREATE TABLE IF NOT EXISTS public.group_settings (
    group_id TEXT PRIMARY KEY,
    group_name TEXT NOT NULL DEFAULT 'LINE Group',
    group_picture_url TEXT,
    anti_link BOOLEAN DEFAULT TRUE,
    anti_invite BOOLEAN DEFAULT TRUE,
    anti_kick BOOLEAN DEFAULT TRUE,
    silent_kick BOOLEAN DEFAULT FALSE,
    kick_message TEXT DEFAULT '🛡️ Guardian Bot: ตรวจพบการกระทำผิดกฎ เตะผู้กระทำผิดออกจากกลุ่ม',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table for Admin & Whitelist Members (Immune to kick)
CREATE TABLE IF NOT EXISTS public.whitelists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mid TEXT NOT NULL,
    name TEXT DEFAULT 'Admin',
    role TEXT DEFAULT 'admin',
    group_id TEXT DEFAULT 'global',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table for Link Whitelist (Allowed Domains)
CREATE TABLE IF NOT EXISTS public.link_whitelists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern TEXT NOT NULL,
    description TEXT,
    group_id TEXT DEFAULT 'global',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Table for Audit Logs & Incident History
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT,
    group_name TEXT,
    user_mid TEXT,
    user_name TEXT,
    action_type TEXT NOT NULL, -- 'anti_link', 'anti_invite', 'anti_kick', 'command'
    reason TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_group_id ON public.audit_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whitelists_mid ON public.whitelists(mid);
CREATE INDEX IF NOT EXISTS idx_link_whitelists_pattern ON public.link_whitelists(pattern);

-- 6. Table for BackOffice Dashboard Administrators
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT DEFAULT 'Administrator',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- Enable RLS and Configure Full Access Policies for `anon` role
-- ==============================================================================
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_whitelists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop old policies if existing
DROP POLICY IF EXISTS "Anon Full Access bot_settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Anon Full Access group_settings" ON public.group_settings;
DROP POLICY IF EXISTS "Anon Full Access whitelists" ON public.whitelists;
DROP POLICY IF EXISTS "Anon Full Access link_whitelists" ON public.link_whitelists;
DROP POLICY IF EXISTS "Anon Full Access audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anon Full Access admin_users" ON public.admin_users;

-- Policy 1: bot_settings
CREATE POLICY "Anon Full Access bot_settings"
ON public.bot_settings
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Policy 2: group_settings
CREATE POLICY "Anon Full Access group_settings"
ON public.group_settings
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Policy 3: whitelists
CREATE POLICY "Anon Full Access whitelists"
ON public.whitelists
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Policy 4: link_whitelists
CREATE POLICY "Anon Full Access link_whitelists"
ON public.link_whitelists
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Policy 5: audit_logs
CREATE POLICY "Anon Full Access audit_logs"
ON public.audit_logs
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Policy 6: admin_users
CREATE POLICY "Anon Full Access admin_users"
ON public.admin_users
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Grant table privileges
GRANT ALL ON TABLE public.bot_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.group_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.whitelists TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.link_whitelists TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.audit_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.admin_users TO anon, authenticated, service_role;

-- Default allowed links
INSERT INTO public.link_whitelists (pattern, description, group_id)
VALUES 
    ('youtube.com', 'YouTube Videos', 'global'),
    ('youtu.be', 'YouTube Short Links', 'global')
ON CONFLICT DO NOTHING;

-- Initial default row in bot_settings
INSERT INTO public.bot_settings (id, status)
VALUES ('config', 'offline')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Initial default Admin User (Username: admin / Password: admin1234)
INSERT INTO public.admin_users (username, password_hash, display_name)
VALUES ('admin', 'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270', 'Administrator')
ON CONFLICT (username) DO NOTHING;
