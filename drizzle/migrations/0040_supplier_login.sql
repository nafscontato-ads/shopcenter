-- Supplier can also enter through the normal Shop Center login (/auth): their account is linked here.
-- The secret panel link keeps working; it is also how the supplier creates or links the login.
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
