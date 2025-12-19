
import { ProgressEntry, MacroPlan, WeightPrediction } from "../types";

interface DataPoint {
    x: number; // Days from start
    y: number; // Weight
    w: number; // Regression Weight
    date: Date;
    isFlagged: boolean;
}

// Updated to return statistical moments for Prediction Intervals
const calculateWeightedSlope = (data: DataPoint[], daysWindow: number, lastDay: number): { slope: number, r2: number, stdErr: number, meanX: number, Sxx: number, count: number } => {
    // Filter for window
    const windowData = data.filter(p => (lastDay - p.x) <= daysWindow);
    
    if (windowData.length < 2) return { slope: 0, r2: 0, stdErr: 0, meanX: 0, Sxx: 0, count: 0 };

    let sumWt = 0, sumXWt = 0, sumYWt = 0, sumXYWt = 0, sumXXWt = 0, sumYYWt = 0;
    
    // Weighted Least Squares
    windowData.forEach(p => {
        // Exponential decay weight within the window itself for extra recency bias
        // 7 days ago = 0.5, Today = 1.0
        const recency = Math.exp(-0.1 * (lastDay - p.x));
        const finalWeight = p.w * recency; 

        sumWt += finalWeight;
        sumXWt += p.x * finalWeight;
        sumYWt += p.y * finalWeight;
        sumXYWt += p.x * p.y * finalWeight;
        sumXXWt += p.x * p.x * finalWeight;
        sumYYWt += p.y * p.y * finalWeight;
    });

    const denom = (sumWt * sumXXWt - sumXWt * sumXWt);
    if (denom === 0) return { slope: 0, r2: 0, stdErr: 0, meanX: 0, Sxx: 0, count: 0 };

    const slope = (sumWt * sumXYWt - sumXWt * sumYWt) / denom;
    const intercept = (sumYWt - slope * sumXWt) / sumWt;

    // Weighted R-Squared & Standard Error
    const meanY = sumYWt / sumWt;
    const meanX = sumXWt / sumWt; // Weighted Mean X for uncertainty calc
    
    const sst = windowData.reduce((acc, p) => acc + (p.w * Math.pow(p.y - meanY, 2)), 0);
    const sse = windowData.reduce((acc, p) => {
        const pred = slope * p.x + intercept;
        return acc + (p.w * Math.pow(p.y - pred, 2));
    }, 0);
    
    // Sxx (Sum of Weighted Squared Differences of X) for Prediction Interval
    const sxx = windowData.reduce((acc, p) => acc + (p.w * Math.pow(p.x - meanX, 2)), 0);

    const r2 = sst === 0 ? 0 : Math.max(0, 1 - (sse / sst));
    const stdErr = Math.sqrt(sse / (sumWt - 2)) || 0.1; // Approx weighted standard error

    return { slope, r2, stdErr, meanX, Sxx: sxx, count: windowData.length };
};

export const predictWeightTrajectory = (
  progressLogs: ProgressEntry[],
  currentPlan: MacroPlan,
  targetWeight?: number,
  isTraining: boolean = false
): WeightPrediction => {
  // 1. DATA PRE-PROCESSING & CLEANING
  const sortedLogs = [...progressLogs].sort((a, b) => {
    const dateA = new Date(a.created_at || a.date).getTime();
    const dateB = new Date(b.created_at || b.date).getTime();
    return dateA - dateB;
  });

  if (sortedLogs.length < 3) {
    return generateFallbackPrediction(sortedLogs, currentPlan, targetWeight);
  }

  const firstDate = new Date(sortedLogs[0].created_at || sortedLogs[0].date).getTime();
  const cleanedData: DataPoint[] = [];

  // Outlier Filtration & Weighting Assignment
  for (let i = 0; i < sortedLogs.length; i++) {
      const current = sortedLogs[i];
      const weight = current.weight;
      let regWeight = 1.0;
      let isFlagged = false;

      // Axis A1: Enforce Weigh-In Protocol
      if (current.weigh_in_type === 'random') {
          regWeight *= 0.6;
      }

      // Axis A2: Sodium / Carb / Alcohol Flags
      if (current.flags?.high_sodium || current.flags?.high_carb || current.flags?.alcohol) {
          regWeight *= 0.3; 
          isFlagged = true;
      }

      // Axis 5C: Glycogen Reset / Outlier Detection
      if (i > 0) {
          const prev = sortedLogs[i-1].weight;
          const delta = weight - prev;
          // If massive drop (>1kg) happens instantly, assume water dump (noise)
          if (delta < -1.0) regWeight *= 0.2; 
          // If massive spike (>2kg) happens instantly, assume error/water
          if (Math.abs(delta) > 2.0) regWeight = 0;
      }

      const date = new Date(current.created_at || current.date);
      const days = (date.getTime() - firstDate) / (1000 * 60 * 60 * 24);
      
      if (regWeight > 0) {
          cleanedData.push({ x: days, y: weight, w: regWeight, date, isFlagged });
      }
  }

  if (cleanedData.length < 2) return generateFallbackPrediction(sortedLogs, currentPlan, targetWeight);

  const lastDay = cleanedData[cleanedData.length - 1].x;

  // 2. MULTI-TIMEFRAME REGRESSION (Axis C1)
  const trend7d = calculateWeightedSlope(cleanedData, 7, lastDay);
  const trend28d = calculateWeightedSlope(cleanedData, 28, lastDay);

  // Blend slopes
  const effectiveSlope = (cleanedData.length > 5 && trend28d.slope !== 0) 
      ? (0.65 * trend7d.slope) + (0.35 * trend28d.slope) 
      : trend7d.slope;

  const combinedR2 = (trend7d.r2 + trend28d.r2) / 2;
  const confidenceScore = Math.round(combinedR2 * 100);

  // 3. BIO-PHYSICS ENERGY MODEL (Axis B1 + Issue 2 Update)
  const currentWeight = cleanedData[cleanedData.length - 1].y;
  const currentBodyFat = sortedLogs[sortedLogs.length - 1].bodyFat || 20;
  const fatMass = currentWeight * (currentBodyFat / 100);
  
  // Dynamic Tissue Partitioning
  const dailyCaloricImbalance = effectiveSlope * 7700; // Preliminary guess for logic branching
  const proteinPerKg = currentPlan.protein / currentWeight;
  const surplus = dailyCaloricImbalance > 0 ? dailyCaloricImbalance : 0;

  let pRatio = 0; // Fraction LBM change
  
  if (effectiveSlope < 0) {
      // LOSS: Forbes Theory
      // pRatio = 1 - (FM / (FM + 10.4))
      const fatFraction = fatMass / (fatMass + 10.4);
      pRatio = 1 - fatFraction; 
  } else {
      // GAIN: Protein-Aware Partitioning (REALITY CHECKED)
      if (surplus < 200 || proteinPerKg < 1.4) {
          pRatio = 0.15; // Untrained low surplus = mostly fat
      } else if (surplus > 500 && isTraining && proteinPerKg >= 2.0) {
          pRatio = 0.5; // Even with perfect conditions, max ~50% lean
      } else if (isTraining && proteinPerKg >= 1.8) {
          pRatio = 0.35; // Realistic trained baseline
      } else {
          pRatio = 0.25; // Average
      }
  }

  // Tissue-Aware Energy Density (Issue 1 Fix)
  // Fat: ~9500 kcal/kg, Lean: ~1800 kcal/kg
  const effectiveKcalPerKg = ((1 - pRatio) * 9500) + (pRatio * 1800);

  const weeklyRate = effectiveSlope * 7; // kg/week
  
  // Re-calculate Imbalance with correct Energy Density
  const realDailyImbalance = (effectiveSlope * effectiveKcalPerKg); 

  // 4. NEAT SUPPRESSION MODEL (Axis B2)
  let neatPenalty = 0;
  if (realDailyImbalance < -500) {
      neatPenalty = 0.08 * Math.abs(realDailyImbalance);
  }

  // Real TDEE Back-Calculation (Issue 5 Fix - No Double Counting)
  // Observed Rate ALREADY includes NEAT suppression. 
  // Real TDEE is just Intake - Observed Imbalance.
  let estimatedRealTdee = currentPlan.calories - realDailyImbalance;

  // 5. RECOMMENDATIONS & SAFETY
  let recommendation = "Metabolic signal stable. Maintain protocol.";
  let isHealthyPace = true;
  let metabolicStatus = "Healthy";

  const metabolicRatio = estimatedRealTdee / currentPlan.maintenance;
  if (metabolicRatio < 0.85) metabolicStatus = "High Adaptation (Slow)";
  if (metabolicRatio > 1.15) metabolicStatus = "Hyper-Metabolic";

  if (effectiveSlope < 0) {
      if (weeklyRate < -1.0) {
          isHealthyPace = false;
          recommendation = "Rate too steep (>1kg/wk). Risk of muscle catabolism. Increase calories.";
      } else if (weeklyRate < -0.7 && proteinPerKg < 1.6) {
          isHealthyPace = false;
          recommendation = "Lean loss risk detected. Rate is fast but Protein < 1.6g/kg. Increase Protein.";
      } else if (Math.abs(weeklyRate) < 0.15 && cleanedData.length > 14) {
          recommendation = "Plateau confirmed (28d trend flat). Consider Zig-Zag or NEAT reset.";
      }
  }

  // 6. PROJECTION WITH ASYMMETRIC DECAY (Issue 3 Fix)
  const projectionPoints: { x: number; y: number; min: number; max: number }[] = [];
  let projectedW = currentWeight;
  let currentImbalance = realDailyImbalance; 
  
  // Asymmetric Decay Factors
  // Losing: Body defends strongly (0.93). Gaining: Body defends weakly (0.97).
  let decayFactor = effectiveSlope < 0 ? 0.93 : 0.97;

  // Target Dampening (Issue 5B Fix)
  // If close to target, dampen rate (reduce multiplier)
  if (targetWeight && Math.abs(currentWeight - targetWeight) < 2.0) {
      decayFactor -= 0.05; // 0.93 -> 0.88 (Stops faster)
  }

  // Principled Uncertainty (Issue 4 Fix)
  // Use Prediction Interval Stats from 28d trend
  const { stdErr, meanX, Sxx, count } = trend28d;
  const tScore = 1.28; // 80% CI (Narrowed from 95% to exclude hydration noise)
  const safeStdErr = stdErr || 0.3;
  const safeSxx = Sxx || 1; // Prevent div/0

  for (let w = 1; w <= 4; w++) {
      currentImbalance *= decayFactor; // Compounded decay

      const weeklyChange = (currentImbalance * 7) / effectiveKcalPerKg;
      projectedW += weeklyChange;

      // Mathematical Prediction Interval Formula
      // Error grows as we move away from the mean X of the data
      const predX = lastDay + (w * 7);
      const distFromMean = Math.pow(predX - meanX, 2);
      const sizing = 1 + (1 / (count || 1)) + (distFromMean / safeSxx);
      const uncertainty = tScore * safeStdErr * Math.sqrt(sizing);

      projectionPoints.push({
          x: lastDay + (w * 7),
          y: projectedW,
          min: projectedW - uncertainty,
          max: projectedW + uncertainty
      });
  }

  const finalProjectedWeight = projectionPoints[3].y;
  const finalRange = { min: projectionPoints[3].min, max: projectionPoints[3].max };

  // Tissue Breakdown Prediction
  const totalChange = finalProjectedWeight - currentWeight;
  const leanChange = totalChange * pRatio;
  const fatChange = totalChange * (1 - pRatio);

  // Recalculate Body Fat %
  const newFatMass = fatMass + fatChange;
  const projectedBodyFat = (newFatMass / finalProjectedWeight) * 100;

  // 7. GRAPH DATA FORMATTING
  const graphData: { date: string; weight: number; isProjection: boolean; min?: number; max?: number }[] = cleanedData.map(l => ({
      date: l.date.toLocaleDateString(undefined, {month:'short', day:'numeric'}),
      weight: l.y,
      isProjection: false
  }));

  projectionPoints.forEach(p => {
      const d = new Date(firstDate + p.x * 24 * 60 * 60 * 1000);
      graphData.push({
          date: d.toLocaleDateString(undefined, {month:'short', day:'numeric'}),
          weight: parseFloat(p.y.toFixed(1)),
          min: parseFloat(p.min.toFixed(1)),
          max: parseFloat(p.max.toFixed(1)),
          isProjection: true
      });
  });

  return {
    projectedWeightIn4Weeks: parseFloat(finalProjectedWeight.toFixed(1)),
    projectedRange: { min: parseFloat(finalRange.min.toFixed(1)), max: parseFloat(finalRange.max.toFixed(1)) },
    projectedBodyFatIn4Weeks: parseFloat(projectedBodyFat.toFixed(1)),
    confidenceScore,
    trendAnalysis: {
      weeklyRateOfChange: parseFloat(weeklyRate.toFixed(2)),
      effectiveSlope: parseFloat(effectiveSlope.toFixed(3)),
      isHealthyPace,
      recommendation,
      realTdee: Math.round(estimatedRealTdee),
      neatPenalty: Math.round(neatPenalty),
      effectiveEnergyDensity: Math.round(effectiveKcalPerKg),
      metabolicAdaptation: metabolicStatus,
      tissuePartition: {
          fatMassChange: parseFloat(fatChange.toFixed(1)),
          leanMassChange: parseFloat(leanChange.toFixed(1))
      }
    },
    graphData
  };
};

const generateFallbackPrediction = (logs: ProgressEntry[], plan: MacroPlan, targetWeight?: number): WeightPrediction => {
    const currentWeight = logs.length > 0 ? logs[logs.length - 1].weight : 70;
    const currentBF = logs.length > 0 && logs[logs.length - 1].bodyFat ? logs[logs.length - 1].bodyFat! : 20;

    // Physics-only fallback
    const deficit = plan.maintenance - plan.calories;
    const assumedWeeklyChange = -(deficit * 7) / 7700; 
    
    const projectedWeight = currentWeight + (assumedWeeklyChange * 4);
    
    return {
        projectedWeightIn4Weeks: parseFloat(projectedWeight.toFixed(1)),
        projectedRange: { min: projectedWeight - 1, max: projectedWeight + 1 },
        projectedBodyFatIn4Weeks: currentBF, 
        confidenceScore: 0,
        trendAnalysis: {
            weeklyRateOfChange: parseFloat(assumedWeeklyChange.toFixed(2)),
            effectiveSlope: parseFloat((assumedWeeklyChange/7).toFixed(3)),
            isHealthyPace: true,
            recommendation: "Insufficient data. Projection based on caloric targets.",
            realTdee: plan.maintenance,
            metabolicAdaptation: "Unknown"
        },
        graphData: []
    };
};
