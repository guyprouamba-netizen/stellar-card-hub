DO $$
DECLARE v_user uuid; v_amount numeric := 10540;
BEGIN
  SELECT user_id INTO v_user FROM public.cards WHERE id = '83b3c390-54f0-482e-be71-1c21cccae232';
  IF v_user IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance + v_amount WHERE user_id = v_user AND currency = 'XOF';
    INSERT INTO public.transactions (user_id, type, status, amount, currency, description)
      VALUES (v_user, 'refund', 'success', v_amount, 'XOF', 'Remboursement carte démo sandbox invalide');
    DELETE FROM public.cards WHERE id = '83b3c390-54f0-482e-be71-1c21cccae232';
  END IF;
END $$;