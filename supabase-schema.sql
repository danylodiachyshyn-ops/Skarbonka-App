-- ============================================
-- ПОВНА СХЕМА: Savings Tracker (Phygital App)
-- ============================================

-- 1. НАЛАШТУВАННЯ ТА РОЗШИРЕННЯ
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. ТАБЛИЦЯ ПРОФІЛІВ (Profiles)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Вмикаємо захист (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Політики доступу (Кожен бачить тільки себе)
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 3. ТАБЛИЦЯ ШАБЛОНІВ (Box Templates) - НОВЕ!
-- Тут зберігаються типи ваших фізичних коробок
-- ============================================
CREATE TABLE public.box_templates (
  id TEXT PRIMARY KEY, -- наприклад: 'box_10k_uah'
  name TEXT NOT NULL, -- наприклад: 'Скарбничка 10,000 грн'
  total_amount INTEGER NOT NULL, -- 10000
  currency TEXT DEFAULT 'UAH',
  
  -- КЛЮЧОВЕ ПОЛЕ: Масив чисел, що намальовані на коробці
  -- Наприклад: [5, 10, 20, 50, 5, 10...]
  grid_config JSONB NOT NULL, 
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- RLS: Шаблони доступні для читання всім (публічний каталог)
ALTER TABLE box_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read templates" ON box_templates FOR SELECT USING (true);

-- ============================================
-- 4. ТАБЛИЦЯ СКАРБНИЧОК ЮЗЕРА (User Boxes)
-- ============================================
CREATE TABLE public.user_boxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Зв'язок з шаблоном (яку коробку вибрав юзер)
  template_id TEXT REFERENCES box_templates(id),
  
  name TEXT NOT NULL, -- Юзер може перейменувати ("На мрію")
  currency TEXT DEFAULT 'EUR', -- Валюта скарбнички (EUR, USD, UAH, GBP тощо)
  current_amount DECIMAL(12, 2) DEFAULT 0,
  target_amount DECIMAL(12, 2), -- Цільова сума (з Create Goal або з шаблону)
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- КЛЮЧОВЕ ПОЛЕ: Які саме клітинки закреслено
  -- Зберігає масив індексів, наприклад: [0, 2, 5] (закреслено 1-ше, 3-тє і 6-те число)
  crossed_out_indices JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- RLS: Юзер бачить тільки свої коробки
ALTER TABLE user_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own boxes" ON user_boxes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own boxes" ON user_boxes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own boxes" ON user_boxes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own boxes" ON user_boxes FOR DELETE USING (auth.uid() = user_id);

-- Міграція: якщо таблиця вже існує без target_amount або currency, виконати в SQL Editor:
-- ALTER TABLE public.user_boxes ADD COLUMN IF NOT EXISTS target_amount DECIMAL(12, 2);
-- ALTER TABLE public.user_boxes ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';

-- ============================================
-- 5. ТАБЛИЦЯ ТРАНЗАКЦІЙ (Transactions)
-- Історія поповнень та витягувань (amount > 0 = поповнення, amount < 0 = витягування)
-- Якщо вже створено з CHECK (amount > 0), виконайте supabase-migrations/allow-withdrawals.sql
-- ============================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_id UUID NOT NULL REFERENCES user_boxes(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  note TEXT, -- Наприклад "Закреслив 50 грн"
  date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- RLS: Юзер бачить транзакції тільки своїх коробок
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON transactions FOR SELECT 
USING (EXISTS (SELECT 1 FROM user_boxes WHERE user_boxes.id = transactions.box_id AND user_boxes.user_id = auth.uid()));

CREATE POLICY "Users insert own transactions" ON transactions FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM user_boxes WHERE user_boxes.id = transactions.box_id AND user_boxes.user_id = auth.uid()));

CREATE POLICY "Users delete own transactions" ON transactions FOR DELETE 
USING (EXISTS (SELECT 1 FROM user_boxes WHERE user_boxes.id = transactions.box_id AND user_boxes.user_id = auth.uid()));

-- ============================================
-- 6. АВТОМАТИЗАЦІЯ (Triggers)
-- ============================================

-- АВТО-СТВОРЕННЯ ПРОФІЛЮ при реєстрації (full_name з user_metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- АВТО-ОНОВЛЕННЯ СУМИ в коробці при додаванні транзакції
CREATE OR REPLACE FUNCTION update_box_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_boxes
  SET current_amount = current_amount + NEW.amount,
      updated_at = TIMEZONE('utc', NOW())
  WHERE id = NEW.box_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_transaction_added
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_box_amount();


-- ============================================
-- 7. ТЕСТОВІ ДАНІ (Seed Data)
-- Додаємо шаблони ваших реальних коробок
-- ============================================
INSERT INTO box_templates (id, name, total_amount, grid_config)
VALUES 
(
  'box_1000_uah', 
  'Скарбничка 1000 грн', 
  1000, 
  '[5, 10, 20, 50, 5, 10, 20, 50, 100, 200, 50, 20, 10, 5, 5, 10, 20, 50, 100, 200, 50, 20]'::jsonb
),
(
  'box_5000_uah', 
  'Скарбничка 5000 грн', 
  5000, 
  '[50, 100, 200, 500, 50, 100, 200, 500, 50, 100, 200, 500, 50, 100, 200, 500, 1000]'::jsonb
)
ON CONFLICT DO NOTHING;