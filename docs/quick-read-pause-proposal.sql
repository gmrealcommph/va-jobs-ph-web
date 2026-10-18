-- FUTURE OPERATOR PROPOSAL ONLY. Never run on production without separate approval.
-- Compatible with verified bb53 claim functions; reverify definitions before use.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Same global lock first as claim/auto-finish. Serialize the pause after prior claims.
SELECT id FROM public.quick_read_control WHERE id = true FOR UPDATE;
SELECT id FROM public.quick_read_rollout_stop WHERE id = true FOR UPDATE;
SELECT id FROM public.quick_read_auto_control WHERE id = true FOR UPDATE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.quick_read_control WHERE id = true) <> 1
 OR (SELECT count(*) FROM public.quick_read_rollout_stop WHERE id = true) <> 1
 OR (SELECT count(*) FROM public.quick_read_auto_control WHERE id = true) <> 1
 THEN RAISE EXCEPTION 'Missing generation control singleton; abort pause'; END IF;
END $$;
UPDATE public.quick_read_control SET next_claim_at = 'infinity'::timestamptz WHERE id = true;
UPDATE public.quick_read_rollout_stop SET enabled = false WHERE id = true;
UPDATE public.quick_read_auto_control SET enabled = false WHERE id = true;
COMMIT;
-- Read back all three values immediately. Do not reset these on cutover or rollback.
