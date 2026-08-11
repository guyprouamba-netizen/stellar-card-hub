insert into public.project_api_keys (project_id, business_id, mode, public_key, secret_prefix, secret_hash, webhook_secret)
select p.id, p.business_id, 'test', 'pk_test_probe', 'sk_test_probe', '7709db705200a9853742b96bf82766b72228cf4923c801b1af5a842d841533ac', 'whsec_probe'
from public.projects p limit 1;