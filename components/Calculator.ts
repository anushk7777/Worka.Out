import { UserProfile, MacroPlan, ActivityLevel, Goal, Gender } from "../types";
import { ACTIVITY_MULTIPLIERS } from "../constants";

export const calculatePlan = (profile: UserProfile): MacroPlan => {
  const methods: string[] = [];
  let totalBmr = 0;
  let count = 0;

  // 1. Mifflin-St Jeor (1990) - The modern gold standard for general population
  // Men: 10W + 6.25H - 5A + 5
  // Women: 10W + 6.25H - 5A - 161
  let mifflin = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age);
  mifflin += (profile.gender === Gender.MALE ? 5 : -161);
  
  totalBmr += mifflin;
  count++;
  methods.push("Mifflin");

  // 2. Harris-Benedict (Revised 1984) - Historical standard
  // Men: 88.362 + 13.397W + 4.799H - 5.677A
  // Women: 447.593 + 9.247W + 3.098H - 4.330A
  let harris = 0;
  if (profile.gender === Gender.MALE) {
    harris = 88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age);
  } else {
    harris = 447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age);
  }

  totalBmr += harris;
  count++;
  methods.push("Harris-Benedict");

  // 3. Composition-based Formulas (Only if BF% is known)
  // These are often more accurate for athletic individuals
  if (profile.bodyFat && profile.bodyFat > 0) {
    const leanMass = profile.weight * (1 - (profile.bodyFat / 100));

    // Katch-McArdle
    // 370 + 21.6 * LBM
    const katch = 370 + (21.6 * leanMass);
    totalBmr += katch;
    count++;
    methods.push("Katch");

    // Cunningham (1980)
    // 500 + 22 * LBM
    const cunningham = 500 + (22 * leanMass);
    totalBmr += cunningham;
    count++;
    methods.push("Cunningham");
  }

  // Calculate Average BMR
  const finalBmr = totalBmr / count;
  const calculationMethod = `Avg of: ${methods.join(', ')}`;

  // 2. Calculate Maintenance (TDEE)
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel];
  const maintenance = finalBmr * multiplier;

  // 3. Goal Adjustment
  let targetCalories = maintenance;

  switch (profile.goal) {
    case Goal.FAT_LOSS:
      // Standard sustainable deficit: 500 kcal
      targetCalories = maintenance - 500;
      
      // Safety check: Don't drop drastically below BMR unless maintenance is very high
      if (targetCalories < finalBmr) {
        // If the deficit pushes below BMR, floor it at BMR - 200 or 1200 kcal min.
        targetCalories = Math.max(targetCalories, finalBmr - 200, 1200); 
      }
      break;
    case Goal.MUSCLE_GAIN:
      targetCalories = maintenance + 250; // Lean bulk surplus
      break;
    case Goal.MAINTENANCE:
    default:
      targetCalories = maintenance;
      break;
  }

  // 4. Macronutrient Distribution
  // Protein: 2.0g per kg (High protein for satiety and muscle retention)
  // Fats: 0.8g per kg (Hormonal baseline)
  // Carbs: Remainder
  
  const proteinPerKg = 2.0; 
  const fatPerKg = 0.8;

  const proteinGrams = Math.round(profile.weight * proteinPerKg);
  const fatGrams = Math.round(profile.weight * fatPerKg);

  const proteinCals = proteinGrams * 4;
  const fatCals = fatGrams * 9;
  
  // Calculate remaining calories for carbs
  let remainingCals = targetCalories - (proteinCals + fatCals);
  
  // Safety check: If calories are very low, protein/fat might take up everything.
  // Ensure at least some carbs.
  if (remainingCals < 0) remainingCals = 0;

  const carbGrams = Math.round(remainingCals / 4);

  return {
    bmr: Math.round(finalBmr),
    maintenance: Math.round(maintenance),
    calories: Math.round(targetCalories),
    protein: proteinGrams,
    fats: fatGrams,
    carbs: carbGrams,
    calculationMethod
  };
};