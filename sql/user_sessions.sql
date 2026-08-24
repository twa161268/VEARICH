-- Persistent Express sessions for Vercel
CREATE TABLE IF NOT EXISTS public.user_sessions (
    sid varchar NOT NULL PRIMARY KEY,
    sess json NOT NULL,
    expire timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expire
    ON public.user_sessions (expire);
