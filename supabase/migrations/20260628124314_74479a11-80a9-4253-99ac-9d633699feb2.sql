DO $$
DECLARE v_credited boolean;
BEGIN
  UPDATE public.transactions
     SET status = 'success',
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('manual_credit', true, 'manual_credit_at', now()::text)
   WHERE id = 'd62ab82d-bdfd-4cd2-9855-1f874068dc28' AND status = 'pending'
   RETURNING true INTO v_credited;
  IF v_credited THEN
    UPDATE public.wallets
       SET balance = balance + 5000
     WHERE user_id = 'a74c1ce2-b424-4926-9989-658a52b800a9' AND currency = 'XOF';
  END IF;
END $$;