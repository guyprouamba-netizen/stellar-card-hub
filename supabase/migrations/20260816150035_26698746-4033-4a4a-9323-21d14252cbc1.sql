ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'otp_purpose'
    ) THEN
        ALTER TYPE public.otp_purpose ADD VALUE 'registration';
    END IF;
END $$;