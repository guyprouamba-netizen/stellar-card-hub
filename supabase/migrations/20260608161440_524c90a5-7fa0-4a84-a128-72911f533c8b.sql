CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  IF lower(NEW.email) = 'ilboudoibonydo@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  INSERT INTO public.wallets (user_id, currency) VALUES (NEW.id, 'XOF'), (NEW.id, 'USD');
  RETURN NEW;
END $function$;

DELETE FROM public.wallets WHERE currency = 'EUR' AND COALESCE(balance, 0) = 0;