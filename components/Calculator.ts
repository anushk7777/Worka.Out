
import { UserProfile, MacroPlan, ActivityLevel, Goal, Gender } from "../types";
import { ACTIVITY_MULTIPLIERS } from "../constants";

// --- ULTRA-ELITE BMR ESTIMATION ENGINE ---
// Non-Market Grade Inference Logic v3.1 (Aggressiveness Tuned)
// ----------------------------------------

interface ModelResult {
  name: string;
  value: number;
  domainValidity: boolean;
}

// 1. RAW MODEL DEFINITIONS
const calcMifflin = (p: UserProfile): number => {
  let bmr = (10 * p.weight) + (6.25 * p.height) - (5 * p.age);
  bmr += (p.gender === Gender.MALE ? 5 : -161);
  return bmr;
};

const calcHarrisBenedictRevised = (p: UserProfile): number => {
  if (p.gender === Gender.MALE) {
    return 88.362 + (13.397 * p.weight) + (4.799 * p.height) - (5.677 * p.age);
  }
  return 447.593 + (9.247 * p.weight) + (3.098 * p.height) - (4.330 * p.age);
};

const calcSchofield = (p: UserProfile): number => {
  // WHO/FAO/UNU Equations
  const W = p.weight;
  if (p.gender === Gender.MALE) {
    if (p.age < 30) return (15.057 * W) + 673; // 18-30
    if (p.age < 60) return (11.472 * W) + 879; // 30-60
    return (11.711 * W) + 587; // >60
  } else {
    if (p.age < 30) return (14.7 * W) + 496;
    if (p.age < 60) return (8.7 * W) + 829;
    return (9.082 * W) + 658;
  }
};

const calcKatchMcArdle = (p: UserProfile, lbm: number): number => {
  return 370 + (21.6 * lbm);
};

const calcCunningham = (p: UserProfile, lbm: number): number => {
  return 500 + (22 * lbm);
};

// 2. PHENOTYPE CLASSIFICATION
type Phenotype = 'Athlete' | 'General' | 'Overweight' | 'Obese' | 'Underweight';

const classifyPhenotype = (p: UserProfile): Phenotype => {
  // Priority: Body Fat > BMI
  if (p.bodyFat) {
    if (p.gender === Gender.MALE) {
      if (p.bodyFat < 12) return 'Athlete';
      if (p.bodyFat > 25) return 'Obese';
      if (p.bodyFat > 20) return 'Overweight';
    } else {
      if (p.bodyFat < 20) return 'Athlete';
      if (p.bodyFat > 32) return 'Obese';
      if (p.bodyFat > 25) return 'Overweight';
    }
    return 'General';
  }

  // Fallback to BMI
  const hM = p.height / 100;
  const bmi = p.weight / (hM * hM);
  if (bmi < 18.5) return 'Underweight';
  if (bmi > 30) return 'Obese';
  if (bmi > 25) return 'Overweight';
  return 'General';
};

export const calculatePlan = (profile: UserProfile, lastWeight?: number, daysSinceLastLog?: number): MacroPlan => {
  // --- STEP 1: RAW MODEL EXECUTION ---
  const models: ModelResult[] = [];
  const phenotype = classifyPhenotype(profile);
  const leanMass = profile.bodyFat ? profile.weight * (1 - (profile.bodyFat / 100)) : 0;
  const hasCompositionData = !!profile.bodyFat && profile.bodyFat > 0;

  models.push({ name: "Mifflin-St Jeor", value: calcMifflin(profile), domainValidity: true });
  models.push({ name: "Revised Harris-Benedict", value: calcHarrisBenedictRevised(profile), domainValidity: true });
  models.push({ name: "Schofield", value: calcSchofield(profile), domainValidity: true });

  if (hasCompositionData) {
    models.push({ name: "Katch-McArdle", value: calcKatchMcArdle(profile, leanMass), domainValidity: true });
    // Cunningham generally overestimates for obese/sedentary, only valid if decent muscle mass exists
    const cunninghamValid = phenotype === 'Athlete' || phenotype === 'General'; 
    models.push({ name: "Cunningham", value: calcCunningham(profile, leanMass), domainValidity: cunninghamValid });
  }

  // --- STEP 3: BAYESIAN WEIGHTING ---
  let weights: { [key: string]: number } = {};

  if (hasCompositionData) {
    // Composition Driven Strategy
    weights = {
      "Mifflin-St Jeor": 0.10,
      "Revised Harris-Benedict": 0.05,
      "Schofield": 0.05,
      "Katch-McArdle": 0.45, // Primary LBM driver
      "Cunningham": (phenotype === 'Athlete') ? 0.35 : 0.00 // Only trust Cunningham for athletes
    };
    if (phenotype !== 'Athlete') {
        weights["Katch-McArdle"] += 0.15;
        weights["Mifflin-St Jeor"] += 0.20;
    }
  } else {
    // Population Driven Strategy
    if (phenotype === 'Obese') {
        // Mifflin is significantly more accurate for Obese individuals than HB/Schofield
        weights = { "Mifflin-St Jeor": 0.70, "Revised Harris-Benedict": 0.15, "Schofield": 0.15 };
    } else if (phenotype === 'Underweight') {
        weights = { "Mifflin-St Jeor": 0.30, "Revised Harris-Benedict": 0.50, "Schofield": 0.20 };
    } else {
        weights = { "Mifflin-St Jeor": 0.40, "Revised Harris-Benedict": 0.35, "Schofield": 0.25 };
    }
  }

  // --- STEP 3.5: WEIGHT NORMALIZATION ---
  let totalWeight = 0;
  models.forEach(m => {
     if (m.domainValidity) totalWeight += (weights[m.name] || 0);
  });

  if (totalWeight > 0) {
      models.forEach(m => {
          if (m.domainValidity && weights[m.name]) {
              weights[m.name] /= totalWeight;
          }
      });
  }
  
  // --- STEP 4: SPLIT-COMPONENT CORRECTION ---
  let popSum = 0; let popW = 0;
  let compSum = 0; let compW = 0;

  models.forEach(m => {
    if (m.domainValidity) {
       const w = (weights[m.name] || 0);
       if (["Katch-McArdle", "Cunningham"].includes(m.name)) {
           compSum += m.value * w;
           compW += w;
       } else {
           popSum += m.value * w;
           popW += w;
       }
    }
  });

  const popAvg = popW > 0 ? popSum / popW : 0;
  const compAvg = compW > 0 ? compSum / compW : 0;

  let popAvgCorrected = popAvg;
  if (profile.age > 30) {
      const decadesPast30 = (profile.age - 30) / 10;
      const driftFactor = 1 - (decadesPast30 * 0.015);
      popAvgCorrected *= driftFactor;
  }

  let trueBmr = (popAvgCorrected * popW) + (compAvg * compW);

  if (phenotype === 'Athlete' && !hasCompositionData) {
      trueBmr *= 1.04; 
  }

  if (!hasCompositionData && (phenotype === 'Obese' || phenotype === 'Overweight')) {
      trueBmr *= (phenotype === 'Obese' ? 0.95 : 0.97); 
  }

  // --- STEP 5: UNCERTAINTY & CONFIDENCE ---
  const validValues = models.filter(m => m.domainValidity).map(m => m.value);
  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const variance = validValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validValues.length;
  const stdDev = Math.sqrt(variance);

  let uncertainty = stdDev * (hasCompositionData ? 1.15 : 1.4);
  if (hasCompositionData) uncertainty += 30; // Measurement error buffer
  if (phenotype === 'Obese' && !hasCompositionData) uncertainty += 60; 

  let confidence = 100;
  confidence -= (uncertainty / trueBmr) * 100;
  if (!hasCompositionData) confidence -= 15;
  if (profile.age > 60) confidence -= 5;
  confidence = Math.min(98, Math.max(60, Math.round(confidence)));

  // --- STEP 7: DYNAMIC CALORIC DEFICIT/SURPLUS ---
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel];
  const maintenance = trueBmr * multiplier;

  let targetCalories = maintenance;
  const isAggressive = profile.goal_aggressiveness === 'aggressive';
  
  // Base Goal Logic with Aggressiveness Modifier
  switch (profile.goal) {
    case Goal.FAT_LOSS:
      // Normal: -500 | Aggressive: -750 to -800 (but watch floor)
      let deficit = 500;
      if (phenotype === 'Obese') deficit = 750;
      if (phenotype === 'Athlete') deficit = 400;
      
      if (isAggressive) {
          deficit += 250; // Deep deficit
      }
      targetCalories = maintenance - deficit;
      break;

    case Goal.MUSCLE_GAIN:
      // Normal: +300 | Aggressive: +500
      let surplus = 300;
      if (phenotype === 'Underweight') surplus = 400;
      if (phenotype === 'Athlete') surplus = 250;

      if (isAggressive) {
          surplus += 200; // Hard bulk
      }
      targetCalories = maintenance + surplus;
      break;

    case Goal.MAINTENANCE:
    default:
      targetCalories = maintenance;
      break;
  }

  // --- STEP 8: ZIG ZAG ADAPTIVE CORRECTION ---
  let adaptationReason = undefined;
  let calculationMethod = "Ultra-Elite Ensemble v3.1";

  // Check if we have history to adapt from
  if (lastWeight && profile.daily_calories) {
      const weightDelta = profile.weight - lastWeight; // +ve means gain, -ve means loss
      const previousCalories = profile.daily_calories;
      
      const days = daysSinceLastLog || 7; 
      const normalizationFactor = 7 / Math.max(days, 7);
      const normalizedDelta = weightDelta * normalizationFactor;

      // ADAPTIVE LOGIC FOR FAT LOSS
      if (profile.goal === Goal.FAT_LOSS) {
          if (normalizedDelta > 0.4) {
              const aggressiveTarget = previousCalories - 350;
              if (aggressiveTarget < targetCalories) {
                  targetCalories = Math.max(1200, aggressiveTarget); 
                  adaptationReason = "Zig Zag Correction: Weekly gain trend detected. Aggressive deficit applied.";
                  calculationMethod = "Adaptive Zig-Zag (Corrective)";
              }
          }
          else if (normalizedDelta < -1.2) {
              const recoveryTarget = previousCalories + 250;
              if (recoveryTarget > targetCalories) {
                  targetCalories = recoveryTarget;
                  adaptationReason = "Metabolic Guard: Weight loss too rapid (>1.2kg/wk). Calories increased.";
              }
          }
      }
      
      // ADAPTIVE LOGIC FOR MUSCLE GAIN
      if (profile.goal === Goal.MUSCLE_GAIN) {
          if (normalizedDelta > 0.8) {
              const trimTarget = previousCalories - 200;
              if (trimTarget < targetCalories) {
                  targetCalories = trimTarget;
                  adaptationReason = "Lean Gains Protocol: Rate of gain > 0.8kg/wk. Calories trimmed.";
              }
          }
      }
  }

  // Safety Floor Final Check
  // Aggressive cuts allow going slightly lower but never below BMR-200 or absolute 1200
  const floor = Math.max(1200, trueBmr - (isAggressive ? 200 : 100));
  if (targetCalories < floor) targetCalories = floor;

  // --- MACROS ---
  let proteinWeight = profile.weight;
  if (phenotype === 'Obese') {
      proteinWeight = (profile.height - 100) * 1.1; 
  }

  // Aggressive cuts require higher protein to spare muscle
  const proteinMultiplier = isAggressive && profile.goal === Goal.FAT_LOSS ? 2.4 : 2.2;
  
  const proteinGrams = Math.round(proteinWeight * proteinMultiplier); 
  const fatGrams = Math.round(profile.weight * 0.85); 
  
  const proteinCals = proteinGrams * 4;
  const fatCals = fatGrams * 9;
  const remainingCals = Math.max(0, targetCalories - (proteinCals + fatCals));
  const carbGrams = Math.round(remainingCals / 4);

  const dominantModels = models
    .filter(m => m.domainValidity)
    .sort((a, b) => (weights[b.name] || 0) - (weights[a.name] || 0))
    .slice(0, 2)
    .map(m => m.name);

  return {
    bmr: Math.round(trueBmr),
    trueBmr: Math.round(trueBmr),
    maintenance: Math.round(maintenance),
    calories: Math.round(targetCalories),
    protein: proteinGrams,
    fats: fatGrams,
    carbs: carbGrams,
    calculationMethod: calculationMethod,
    uncertaintyBand: Math.round(uncertainty),
    confidenceScore: confidence,
    phenotype: phenotype,
    dominantModels: dominantModels,
    adaptationReason: adaptationReason
  };
};
