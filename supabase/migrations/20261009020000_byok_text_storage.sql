alter table public.byok_credentials
  alter column ciphertext type text using encode(ciphertext, 'base64'),
  alter column iv type text using encode(iv, 'base64');
