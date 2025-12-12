# Database Migration: Weekly Calorie Budget

To enable the Weekly Calorie Budget management features, please run the following SQL queries in your Supabase SQL Editor.

These changes add the `daily_calories` and `weekly_calories` columns to the `profiles` table, allowing the application to persist and track the user's specific calorie targets and weekly allowance.

```sql
-- 1. Add daily_calories column to store the calculated daily target
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS daily_calories INTEGER;

-- 2. Add weekly_calories column to store the calculated weekly budget (Daily * 7)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS weekly_calories INTEGER;

-- Optional: Comment on columns for clarity
COMMENT ON COLUMN profiles.daily_calories IS 'Calculated daily calorie target based on profile stats';
COMMENT ON COLUMN profiles.weekly_calories IS 'Weekly calorie budget (Daily * 7)';
```

