
DO $$
DECLARE
  v_transfer momo_transfers%ROWTYPE;
  v_wallet_id uuid;
  v_wallet_balance numeric;
BEGIN
  SELECT * INTO v_transfer FROM momo_transfers WHERE id = '9728616e-9942-4dc4-97c2-f2123a43890a';
  IF NOT FOUND THEN RAISE NOTICE 'transfer not found'; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM transactions WHERE user_id = v_transfer.user_id AND type = 'refund' AND provider_ref = v_transfer.payment_reference) THEN
    RAISE NOTICE 'already refunded'; RETURN;
  END IF;
  SELECT id, balance INTO v_wallet_id, v_wallet_balance FROM wallets WHERE user_id = v_transfer.user_id AND currency = 'XOF' LIMIT 1;
  IF v_wallet_id IS NOT NULL THEN
    UPDATE wallets SET balance = v_wallet_balance + v_transfer.total_charged_xof WHERE id = v_wallet_id;
  END IF;
  INSERT INTO transactions (user_id, type, status, amount, currency, provider, provider_ref, description)
  VALUES (v_transfer.user_id, 'refund', 'success', v_transfer.total_charged_xof, 'XOF', 'yengapay', v_transfer.payment_reference,
    'Remboursement transfert ORANGE_MONEY→WAVE_MONEY (Wave non supporté par le payout YengaPay)');
  UPDATE momo_transfers
     SET status = 'refunded',
         admin_note = 'Wave non supporté par le payout YengaPay — ' || v_transfer.total_charged_xof || ' XOF recrédité au portefeuille'
   WHERE id = v_transfer.id;
END $$;
