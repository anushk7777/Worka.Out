
export enum ActivityLevel {
  SEDENTARY = "Sedentary (Desk job + 3-6 days lifting)",
  LIGHT = "Lightly Active (Light movement + 3-6 days lifting)",
  MODERATE = "Active (Moderate activity + 3-6 days lifting)",
  VERY_ACTIVE = "Very Active (Physical job/sports + 3-6 days lifting)"
}

export enum Goal {
  FAT_LOSS = "Fat Loss",
  MUSCLE_GAIN = "Muscle Gain",
  MAINTENANCE = "Maintenance / Recomp"
}

export enum Gender {
  MALE = "Male",
  FEMALE = "Female"
}

export interface UserProfile {
  name: string;
  age: number;
  weight: number; // kg
  height: number; // cm
  gender: Gender;
  activityLevel: ActivityLevel;
  goal: Goal;
  dietary_preference?: 'veg' | 'egg' | 'non-veg';
  bodyFat?: number; // Optional percentage
  daily_calories?: number; // Backend stored target
  weekly_calories?: number; // Backend stored budget
  updated_at?: string; // ISO Timestamp for Zig-Zag normalization
  medical_conditions?: string; // New: User input for medical context
  goal_aggressiveness?: 'normal' | 'aggressive'; // New: Rate of change preference
}

export interface ProgressEntry {
  id: string;
  date: string; // Display date
  created_at?: string; // ISO Timestamp for calculation
  weight: number;
  bodyFat?: number;
  photo_url?: string; // New field for image storage
  notes?: string;
  // --- Data Quality Axis ---
  weigh_in_type?: 'fasted' | 'random';
  flags?: {
    high_sodium?: boolean;
    high_carb?: boolean;
    alcohol?: boolean;
  };
}

export interface MacroPlan {
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  bmr: number;
  maintenance: number;
  calculationMethod: string;
  // Ultra-Elite Engine Outputs
  trueBmr: number;
  uncertaintyBand: number; // ± kcal
  confidenceScore: number; // 0-100
  phenotype: string;
  dominantModels: string[];
  adaptationReason?: string; // New field for adaptive feedback
}

export interface WeightPrediction {
  projectedWeightIn4Weeks: number;
  projectedRange: { min: number; max: number }; // Confidence Interval
  projectedBodyFatIn4Weeks: number;
  confidenceScore: number; // 0 to 100
  trendAnalysis: {
    weeklyRateOfChange: number; // kg per week
    effectiveSlope: number; // kg per day (blended)
    isHealthyPace: boolean;
    recommendation: string;
    realTdee?: number; // Reverse-calculated actual expenditure
    neatPenalty?: number; // Metabolic slowdown due to NEAT
    effectiveEnergyDensity?: number; // Real kcal/kg based on tissue partition
    metabolicAdaptation?: string; // 'High', 'Moderate', 'Low'
    tissuePartition?: { fatMassChange: number; leanMassChange: number }; // Est. breakdown
  };
  milestoneDate?: {
    targetWeight: number;
    estimatedDate: string;
  };
  graphData: { date: string; weight: number; isProjection: boolean; min?: number; max?: number }[];
}

export interface DietMeal {
  name: string;
  time: string;
  items: string[];
  macros: { p: number; c: number; f: number; cal: number };
  isCompleted?: boolean; // New field for checklist tracking
}

// Structure for the Database Table `daily_meal_plans`
export interface DailyMealPlanDB {
  id?: string;
  user_id?: string;
  date: string; // YYYY-MM-DD
  meals: DietMeal[];
  macros: { p: number; c: number; f: number; cal: number };
}

export interface WorkoutExercise {
  name: string;
  sets: string;
  reps: string;
  notes?: string;
}

export interface WorkoutDay {
  day: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export interface SupplementRecommendation {
  name: string;
  dosage: string;
  timing: string;
  reason: string;
  priority: 'Essential' | 'Performance' | 'Optional';
  mechanism: string;
  benefits: string[];
  side_effects: string[];
}

// Updated: Plan holds Workout and Supplement Stack
export interface PersonalizedPlan {
  workout: WorkoutDay[];
  supplement_stack?: SupplementRecommendation[];
}

export interface Recipe {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  ingredients: string[];
  procedure: string[];
  tags: string[];
}

export interface Supplement {
  id: string;
  name: string;
  category: string;
  tier: string; // TIER 1, TIER 2A, etc.
  dosage: string;
  mechanism: string;
}

export interface FoodItem {
  id: string;
  name: string;
  type: 'solid' | 'liquid' | 'unit'; // solid=g, liquid=ml, unit=piece
  base_amount: number; // Reference amount (usually 100 for g/ml, 1 for unit)
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  category?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { title: string; uri: string }[];
}
