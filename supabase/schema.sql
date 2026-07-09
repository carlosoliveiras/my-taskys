-- ==========================================
-- CREATE USER TOKENS TABLE FOR GOOGLE TASKS
-- Run this in your Supabase Dashboard SQL Editor
-- ==========================================

-- Create user_tokens table to store Google OAuth tokens
create table if not exists public.user_tokens (
  user_id uuid references auth.users on delete cascade primary key,
  provider_refresh_token text not null,
  provider_token text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.user_tokens enable row level security;

-- NOTE: We do NOT create any public RLS policies for this table.
-- This ensures that users cannot read/write their own refresh tokens via the client API.
-- Only the server-side Next.js route handlers (using the SUPABASE_SERVICE_ROLE_KEY)
-- will be able to read and update this table, keeping the tokens extremely secure.
