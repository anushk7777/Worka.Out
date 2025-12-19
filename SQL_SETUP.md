
-- ============================================================
-- DATABASE SETUP SCRIPT (ROBUST MIGRATION)
-- INSTRUCTIONS: Copy ALL text in this file, paste into Supabase SQL Editor, and click RUN.
-- ============================================================

-- 1. Profiles Table - Create if missing
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
);

-- 2. Forcefully Add Columns if they don't exist (Fixes "Column not found" errors)
DO $$
BEGIN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight NUMERIC;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height NUMERIC;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_level TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dietary_preference TEXT DEFAULT 'non-veg';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_fat NUMERIC;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_calories INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_calories INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
    -- New Fields for V4
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medical_conditions TEXT DEFAULT '';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal_aggressiveness TEXT DEFAULT 'normal';
END $$;

-- Enable Security for Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Daily Meal Plans Table
CREATE TABLE IF NOT EXISTS daily_meal_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meals JSONB NOT NULL DEFAULT '[]',
  macros JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_meal_plans ENABLE ROW LEVEL SECURITY;

-- 4. Progress Logs Table
CREATE TABLE IF NOT EXISTS progress_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight NUMERIC,
  body_fat NUMERIC,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;

-- 5. User Plans Table (Workout Splits)
CREATE TABLE IF NOT EXISTS user_plans (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  workout_plan JSONB,
  diet_plan JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES (Idempotent - Safe to re-run)
DO $$ 
BEGIN
    -- PROFILES POLICIES
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
        CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;

    -- MEAL PLANS POLICIES
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_meal_plans' AND policyname = 'Users can manage meal plans') THEN
        CREATE POLICY "Users can manage meal plans" ON daily_meal_plans FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- LOGS POLICIES
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'progress_logs' AND policyname = 'Users can manage logs') THEN
        CREATE POLICY "Users can manage logs" ON progress_logs FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- USER PLANS POLICIES
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_plans' AND policyname = 'Users can manage plans') THEN
        CREATE POLICY "Users can manage plans" ON user_plans FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
