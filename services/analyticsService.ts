import { ProgressEntry, MacroPlan, WeightPrediction } from "../types";

export const predictWeightTrajectory = (
  progressLogs: ProgressEntry[],
  currentPlan: MacroPlan,
  targetWeight?: number
): WeightPrediction => {
  // Sort logs by date ascending
  const sortedLogs = [...progressLogs].sort((a, b) => {
    const dateA = new Date(a.created_at || a.date).getTime();
    const dateB = new Date(b.created_at || b.date).getTime();
    return dateA - dateB;
  });

  if (sortedLogs.length < 2) {
    // Not enough data for regression, return basic projection based on plan deficit
    // Assume generic deficit if not calculateable (e.g., 0.5kg/week)
    return generateFallbackPrediction(sortedLogs, currentPlan, targetWeight);
  }

  // 1. Prepare Data for Linear Regression (x = days, y = weight)
  const firstDate = new Date(sortedLogs[0].created_at || sortedLogs[0].date).getTime();
  const dataPoints = sortedLogs.map(log => {
    const date = new Date(log.created_at || log.date).getTime();
    const days = (date - firstDate) / (1000 * 60 * 60 * 24);
    return { x: days, y: log.weight };
  });

  // 2. Perform Linear Regression
  const n = dataPoints.length;
  const sumX = dataPoints.reduce((acc, p) => acc + p.x, 0);
  const sumY = dataPoints.reduce((acc, p) => acc + p.y, 0);
  const sumXY = dataPoints.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumXX = dataPoints.reduce((acc, p) => acc + p.x * p.x, 0);
  const sumYY = dataPoints.reduce((acc, p) => acc + p.y * p.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // 3. Calculate R-squared (Confidence)
  // SST = sum(y - meanY)^2
  // SSE = sum(y - predictedY)^2
  // R2 = 1 - (SSE/SST)
  const meanY = sumY / n;
  const sst = dataPoints.reduce((acc, p) => acc + Math.pow(p.y - meanY, 2), 0);
  const sse = dataPoints.reduce((acc, p) => {
    const predictedY = slope * p.x + intercept;
    return acc + Math.pow(p.y - predictedY, 2);
  }, 0);
  
  const rSquared = sst === 0 ? 0 : 1 - (sse / sst);
  const confidenceScore = Math.min(100, Math.max(0, Math.round(rSquared * 100)));

  // 4. Trend Analysis
  const weeklyRateOfChange = slope * 7; // kg per week

  let isHealthyPace = true;
  let recommendation = "Your pace is excellent.";

  // Healthy fat loss: -0.5 to -1.0 kg/week
  // Healthy gain: +0.25 to +0.5 kg/week
  if (weeklyRateOfChange < -1.0) {
    isHealthyPace = false;
    recommendation = "Weight loss is too aggressive (>1kg/week). Risk of muscle loss.";
  } else if (weeklyRateOfChange > -0.3 && weeklyRateOfChange < 0) {
    isHealthyPace = true;
    recommendation = "Slow but steady progress.";
  } else if (weeklyRateOfChange > 0.5) {
     isHealthyPace = false;
     recommendation = "Weight gain is too fast. Potential fat gain.";
  } else if (weeklyRateOfChange > 0) {
      recommendation = "Steady gain (Surplus phase).";
  } else {
      recommendation = "Optimal fat loss pace.";
  }

  // 5. Predictions
  const lastDay = dataPoints[dataPoints.length - 1].x;
  const dayIn4Weeks = lastDay + 28;
  const projectedWeight = slope * dayIn4Weeks + intercept;

  // Body Fat Projection (Simple linear if data exists, else current)
  // Filter logs with body fat
  const bfLogs = sortedLogs.filter(l => l.bodyFat !== undefined && l.bodyFat !== null);
  let projectedBodyFat = bfLogs.length > 0 ? bfLogs[bfLogs.length - 1].bodyFat! : 0;
  
  if (bfLogs.length >= 2) {
      // Simple rate of change for BF
      const firstBF = bfLogs[0];
      const lastBF = bfLogs[bfLogs.length - 1];
      const daysDiff = (new Date(lastBF.created_at || lastBF.date).getTime() - new Date(firstBF.created_at || firstBF.date).getTime()) / (1000 * 3600 * 24);
      if (daysDiff > 0) {
          const bfSlope = (lastBF.bodyFat! - firstBF.bodyFat!) / daysDiff;
          projectedBodyFat = lastBF.bodyFat! + (bfSlope * 28);
      }
  }

  // 6. Milestone Date
  let milestone: { targetWeight: number; estimatedDate: string } | undefined = undefined;
  if (targetWeight) {
    // Solve for x: target = slope * x + intercept  =>  x = (target - intercept) / slope
    if (slope !== 0) {
        const daysToTarget = (targetWeight - intercept) / slope;
        // Only valid if in the future relative to start (and generally logic holds)
        if (daysToTarget > lastDay) {
            const milestoneDate = new Date(firstDate + daysToTarget * 24 * 60 * 60 * 1000);
            milestone = {
                targetWeight,
                estimatedDate: milestoneDate.toLocaleDateString()
            };
        }
    }
  }

  // 7. Graph Data (Last 5 actual + 4 predicted weeks)
  const graphData = [];
  // Take last few actual points
  const recentActual = sortedLogs.slice(-5);
  recentActual.forEach(log => {
      graphData.push({
          date: new Date(log.created_at || log.date).toLocaleDateString(undefined, {month:'short', day:'numeric'}),
          weight: log.weight,
          isProjection: false
      });
  });

  // Generate 4 weekly projection points
  for(let i=1; i<=4; i++) {
      const futureDay = lastDay + (i * 7);
      const w = slope * futureDay + intercept;
      const d = new Date(firstDate + futureDay * 24 * 60 * 60 * 1000);
      graphData.push({
          date: d.toLocaleDateString(undefined, {month:'short', day:'numeric'}),
          weight: parseFloat(w.toFixed(1)),
          isProjection: true
      });
  }

  return {
    projectedWeightIn4Weeks: parseFloat(projectedWeight.toFixed(1)),
    projectedBodyFatIn4Weeks: parseFloat(projectedBodyFat.toFixed(1)),
    confidenceScore,
    trendAnalysis: {
      weeklyRateOfChange: parseFloat(weeklyRateOfChange.toFixed(2)),
      isHealthyPace,
      recommendation
    },
    milestoneDate: milestone,
    graphData
  };
};

const generateFallbackPrediction = (logs: ProgressEntry[], plan: MacroPlan, targetWeight?: number): WeightPrediction => {
    const currentWeight = logs.length > 0 ? logs[logs.length - 1].weight : 70;
    const currentBF = logs.length > 0 && logs[logs.length - 1].bodyFat ? logs[logs.length - 1].bodyFat! : 20;

    // Theoretical Calculation
    // Assumed Maintenance approx 30-32 kcal/kg if unknown, but we use plan to guess deficit
    // If deficit is 500kcal -> 0.45kg / week
    const assumedWeeklyChange = -0.5; // Conservative estimate for new users
    
    const projectedWeight = currentWeight + (assumedWeeklyChange * 4);
    
    return {
        projectedWeightIn4Weeks: parseFloat(projectedWeight.toFixed(1)),
        projectedBodyFatIn4Weeks: currentBF, // No change prediction without data
        confidenceScore: 0,
        trendAnalysis: {
            weeklyRateOfChange: assumedWeeklyChange,
            isHealthyPace: true,
            recommendation: "Insufficient data. Projection based on standard deficit."
        },
        graphData: []
    };
};
