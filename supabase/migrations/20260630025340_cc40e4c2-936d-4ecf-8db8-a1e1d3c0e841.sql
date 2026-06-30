UPDATE public.cards
SET status = 'active',
    auto_frozen_at = NULL,
    failed_attempts = 0,
    metadata = COALESCE(metadata, '{}'::jsonb) - 'provider_unfreeze_error' || jsonb_build_object('manual_unfreeze_at', now())
WHERE id = '2a7a7e80-d46a-435f-aa3e-dd0a47029e5e';