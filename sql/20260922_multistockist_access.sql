-- Multi-stockist access scope migration.
-- ADMIN is global and therefore does not belong to a stockist.
ALTER TABLE public.users
  ALTER COLUMN stkid DROP NOT NULL;

UPDATE public.users
SET stkid = NULL
WHERE LOWER(role) = 'admin';

-- The existing foreign key to master_stk is intentionally retained.
-- STOCKIST accounts must continue to have a valid stkid; application validation
-- enforces that requirement on user create/update.
