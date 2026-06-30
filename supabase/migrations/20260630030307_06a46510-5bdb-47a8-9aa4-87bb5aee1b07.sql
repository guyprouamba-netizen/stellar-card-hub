
DO $$
DECLARE
  v_card_id text := '019f136a-65cf-7050-a219-0e6e71a2cf51';
  v_user uuid := 'a74c1ce2-b424-4926-9989-658a52b800a9';
  v_amount numeric := 14928;
  v_ref text := 'cardissuerefund:019f136a-65cf-7050-a219-0e6e71a2cf51';
  v_exists uuid;
BEGIN
  SELECT id INTO v_exists FROM public.transactions WHERE provider_ref = v_ref;
  IF v_exists IS NULL THEN
    UPDATE public.wallets SET balance = balance + v_amount
      WHERE user_id = v_user AND currency = 'XOF';
    INSERT INTO public.transactions(user_id, type, status, amount, currency, provider, provider_ref, description, metadata)
    VALUES (v_user, 'refund', 'success', v_amount, 'XOF', 'internal', v_ref,
            'Remboursement émission carte échouée chez l''émetteur (14928 XOF)',
            jsonb_build_object('card_id', v_card_id, 'reason', 'issuer_failed_provisioning'));
  END IF;
  UPDATE public.cards
     SET status = 'terminated',
         last4 = NULL,
         balance = 0,
         metadata = jsonb_build_object(
           'provider_status','failed',
           'terminated_reason','issuer_failed_provisioning',
           'refunded_xof', v_amount
         )
   WHERE provider_card_id = v_card_id;
END $$;
