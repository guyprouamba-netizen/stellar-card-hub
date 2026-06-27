
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE code text; tries int := 0;
BEGIN
  LOOP
    code := upper(substr(replace(encode(gen_random_bytes(6),'base64'),'/',''),1,8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
    tries := tries + 1;
    IF tries > 5 THEN RETURN code || floor(random()*1000)::text; END IF;
  END LOOP;
  RETURN code;
END $$;

REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO service_role;
