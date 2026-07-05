CREATE INDEX IF NOT EXISTS idx_transactions_reconcile_pending
ON public.transactions (type, status, provider, created_at DESC)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created
ON public.withdrawals (status, created_at);