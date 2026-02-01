-- Allow negative amounts in transactions (withdrawals).
-- Run this in Supabase SQL Editor if you get "amount must be > 0" when withdrawing.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_amount_check;

-- Optional: allow any non-zero amount (positive = deposit, negative = withdrawal)
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_amount_check CHECK (amount != 0);
