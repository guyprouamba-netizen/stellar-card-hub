DROP TRIGGER IF EXISTS on_auth_user_created_autoconfirm ON auth.users;
CREATE TRIGGER on_auth_user_created_autoconfirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_email();

UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cards_one_active_per_user
  ON public.cards (user_id)
  WHERE status NOT IN ('terminated','canceled');