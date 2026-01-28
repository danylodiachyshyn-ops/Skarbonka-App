-- ============================================
-- Skarbonka App - Supabase Database Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read and update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. PIGGY_BANKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS piggy_banks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(12, 2) DEFAULT 0 CHECK (current_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'PLN',
  color_theme TEXT NOT NULL DEFAULT '#0ea5e9',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE piggy_banks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own piggy banks
CREATE POLICY "Users can view own piggy banks"
  ON piggy_banks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own piggy banks"
  ON piggy_banks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own piggy banks"
  ON piggy_banks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own piggy banks"
  ON piggy_banks FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_piggy_banks_user_id ON piggy_banks(user_id);
CREATE INDEX IF NOT EXISTS idx_piggy_banks_is_archived ON piggy_banks(is_archived);

-- ============================================
-- 3. TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  piggy_bank_id UUID NOT NULL REFERENCES piggy_banks(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access transactions for their own piggy banks
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM piggy_banks
      WHERE piggy_banks.id = transactions.piggy_bank_id
      AND piggy_banks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM piggy_banks
      WHERE piggy_banks.id = transactions.piggy_bank_id
      AND piggy_banks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM piggy_banks
      WHERE piggy_banks.id = transactions.piggy_bank_id
      AND piggy_banks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM piggy_banks
      WHERE piggy_banks.id = transactions.piggy_bank_id
      AND piggy_banks.user_id = auth.uid()
    )
  );

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_piggy_bank_id ON transactions(piggy_bank_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);

-- ============================================
-- 4. FUNCTION: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on piggy_banks
CREATE TRIGGER update_piggy_banks_updated_at
  BEFORE UPDATE ON piggy_banks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. FUNCTION: Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 6. FUNCTION: Update piggy_bank current_amount when transaction is added
-- ============================================
CREATE OR REPLACE FUNCTION update_piggy_bank_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE piggy_banks
  SET current_amount = current_amount + NEW.amount
  WHERE id = NEW.piggy_bank_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update current_amount when transaction is inserted
CREATE TRIGGER update_piggy_bank_on_transaction
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_piggy_bank_amount();

-- ============================================
-- 7. FUNCTION: Update piggy_bank current_amount when transaction is deleted
-- ============================================
CREATE OR REPLACE FUNCTION update_piggy_bank_amount_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE piggy_banks
  SET current_amount = current_amount - OLD.amount
  WHERE id = OLD.piggy_bank_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update current_amount when transaction is deleted
CREATE TRIGGER update_piggy_bank_on_transaction_delete
  AFTER DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_piggy_bank_amount_on_delete();
