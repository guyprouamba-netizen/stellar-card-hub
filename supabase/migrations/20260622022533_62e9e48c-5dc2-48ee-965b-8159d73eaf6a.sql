ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'card_tx';
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'card_withdraw';
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'card_terminated';