import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChatMessage, UserProfile, ProgressEntry, MacroPlan, PersonalizedPlan, DailyMealPlanDB, WorkoutDay } from "../types";
import { SYSTEM_PROMPT, SUPPLEMENTS_DATA, FOOD_DATABASE } from "../constants";

const apiKey = process.env.API_KEY; 
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

// Helper to format food DB for prompt context
const getFoodDBContext = () => {
  return FOOD_DATABASE
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(f => `- ${f.name} (${f.servingSize}): ${f.calories}kcal, P:${f.protein}g, C:${f.carbs}g, F:${f.fats}g`)
    .join('\n');
};

const cleanJson = (text: string): string => {
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    // Locate the first { and last } to handle potential noise outside JSON block
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        return cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned;
};

// ... existing generateTrainerResponse ...
export const generateTrainerResponse = async (
  history: ChatMessage[], 
  userProfile: UserProfile | null,
  progressLogs: ProgressEntry[],
  newMessage: string
): Promise<string> => {
  if (!apiKey) return "Configuration Error: API Key is missing. Please restart the app.";

  try {
    const model = "gemini-2.5-flash";
    
    let contextPrompt = SYSTEM_PROMPT;
    
    if (userProfile) {
      contextPrompt += `\n\n=== CLIENT PROFILE ===\nName: ${userProfile.name}\nAge: ${userProfile.age}\nHeight: ${userProfile.height}cm\nGoal: ${userProfile.goal}\nActivity: ${userProfile.activityLevel}`;
      const bmr = 22 * userProfile.weight;
      contextPrompt += `\nCurrent Weight: ${userProfile.weight}kg`;
      contextPrompt += `\nEstimated BMR (ETF Formula): ${bmr}`;
    }

    const contents = [
      { role: "user", parts: [{ text: contextPrompt }] },
      ...history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] })),
      { role: "user", parts: [{ text: newMessage }] }
    ];

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: { temperature: 0.7, maxOutputTokens: 1024 }
    });

    return response.text || "I apologize, I'm having trouble analyzing your progress right now.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm experiencing connectivity issues.";
  }
};

// ... updated analyzeBodyComposition for Dual Scan ...
export const analyzeBodyComposition = async (
  frontImageBase64: string, 
  backImageBase64: string | null,
  profile: Partial<UserProfile>
): Promise<{ percentage: number; reasoning: string }> => {
  if (!apiKey) throw new Error("API Key missing");
  
  const bmi = (profile.weight && profile.height) 
    ? (profile.weight / ((profile.height/100) * (profile.height/100))).toFixed(1) 
    : 'Unknown';

  const prompt = `
    Role: Senior Anthropometrist & Biomechanics Analyst.
    Task: Perform a Multi-View Body Composition Analysis.
    
    === SUBJECT VITALS ===
    Gender: ${profile.gender || 'Unknown'}
    Age: ${profile.age || 'Unknown'}
    Height: ${profile.height} cm
    Weight: ${profile.weight} kg
    Calculated BMI: ${bmi}
    
    === ANALYSIS PROTOCOL (DUAL SCAN) ===
    1. **Visual Data Processing**:
       - Image 1: FRONT VIEW (Analyze abdominal definition, quad separation, chest vascularity).
       - Image 2: BACK VIEW (Analyze lower back 'christmas tree', trap definition, glute/hamstring separation).
       
    2. **Cross-Reference & Average**:
       - Compare visual markers against standard anatomical body fat datasets (e.g., DEXA scan reference images).
       - Estimate BF% based on Front View.
       - Estimate BF% based on Back View.
       - Calculate the weighted average (give more weight to the view with clearer definition).
       
    3. **Consistency Check**:
       - Compare the visual estimate against the BMI.
       - If Subject looks leaner than BMI implies -> High Muscle Mass adjustment.
       - If Subject looks softer than BMI implies -> Low Muscle Mass adjustment.

    4. **Output**:
       - Provide a SINGLE final estimated percentage.
       - Provide a technical reasoning summarizing the findings from both angles.
    
    Return JSON ONLY: { "percentage": number, "reasoning": "brief technical explanation citing specific markers from front and back" }
  `;

  try {
    const parts: any[] = [{ text: prompt }];

    // Add Front Image
    const cleanFront = frontImageBase64.split(',')[1] || frontImageBase64;
    parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanFront } });
    parts.push({ text: "Image 1: Front View" });

    // Add Back Image if available
    if (backImageBase64) {
        const cleanBack = backImageBase64.split(',')[1] || backImageBase64;
        parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanBack } });
        parts.push({ text: "Image 2: Back View" });
    } else {
        parts.push({ text: "Note: Only Front View provided. Estimate based on single angle." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: [
        {
          role: "user",
          parts: parts
        }
      ],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                percentage: { type: Type.NUMBER },
                reasoning: { type: Type.STRING }
            }
        }
      }
    });
    const text = cleanJson(response.text || "{}");
    return JSON.parse(text);
  } catch (error) {
    console.error("Body Fat Analysis Error:", error);
    throw new Error("Could not analyze images.");
  }
};

// ... existing generateWorkoutSplit ...
export const generateWorkoutSplit = async (profile: UserProfile): Promise<WorkoutDay[]> => {
    if (!apiKey) throw new Error("API Key missing");
    const prompt = `
      Create a Weekly Workout Split for:
      Goal: ${profile.goal}
      Activity: ${profile.activityLevel}
      
      Ensure 7 days.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        workout: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    day: { type: Type.STRING },
                                    focus: { type: Type.STRING },
                                    exercises: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING },
                                                sets: { type: Type.STRING },
                                                reps: { type: Type.STRING },
                                                notes: { type: Type.STRING, nullable: true }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        const text = cleanJson(response.text || "{}");
        const data = JSON.parse(text);
        return data.workout || [];
    } catch (e) {
        console.error("Workout gen failed", e);
        return [];
    }
};

// --- REVISED: DAILY MEAL PLAN WITH STRICT ZIGZAG TARGETING ---
export const generateDailyMealPlan = async (
    profile: UserProfile, 
    macros: MacroPlan, 
    dateStr: string,
    history: DailyMealPlanDB[] = [],
    preferences?: string,
    dietType: 'veg' | 'egg' | 'non-veg' = 'non-veg',
    // New parameters for Zigzag logic
    customCalorieTarget?: number,
    weeklyStatusNote?: string
): Promise<DailyMealPlanDB> => {
    if (!apiKey) throw new Error("API Key missing. Please check your configuration.");

    const foodDB = getFoodDBContext();
    const isEditMode = !!preferences;
    
    // Determine the actual target for today
    const effectiveCalories = customCalorieTarget || macros.calories;
    
    // Adjust macros roughly based on new calories (keeping protein high)
    // Protein: fixed grams usually, but if calories drop too low, we might scale slightly.
    // For simplicity, we'll ask AI to fit the new calorie target.
    
    // Prepare History Context (Last 3 days for relevance)
    const recentHistory = history.slice(0, 3).map(plan => {
        const mealsSummary = plan.meals.map(m => `${m.name}: ${m.items.join(', ')}`).join(' | ');
        return `Date: ${plan.date} (${plan.macros.cal}kcal) -> ${mealsSummary}`;
    }).join('\n');

    let dietRule = "";
    if (dietType === 'veg') {
        dietRule = "STRICT VEGETARIAN: You must NOT include meat, fish, or eggs. Dairy (Paneer, Milk, Curd) is allowed. Focus on Dal, Paneer, Soya.";
    } else if (dietType === 'egg') {
        dietRule = "EGGETARIAN: You may include Eggs and Dairy. You must NOT include meat or fish.";
    } else {
        dietRule = "NON-VEGETARIAN: Include Chicken, Meat, Fish, Eggs, and Dairy where appropriate. Vegetarian meals are also acceptable.";
    }

    const prompt = `
      CONTEXT: You are "Master Trainer AI". You are creating/editing a daily meal plan for an INDIAN client.
      DATE: ${dateStr}
      
      *** WEEKLY BUDGET & ZIGZAG STATUS (CRITICAL) ***
      ${weeklyStatusNote || "Standard Day. No deviation detected."}
      
      *** TODAY'S STRICT TARGET: ${effectiveCalories} kcal ***
      (Original Baseline Goal was: ${macros.calories} kcal)
      
      INSTRUCTION: This target (${effectiveCalories} kcal) has been adjusted to AVERAGE OUT deviations from the rest of the week.
      YOU MUST GENERATE A PLAN THAT HITS THIS TARGET (+/- 50kcal). 
      
      If the Target is LOWER than original: This is a debt repayment day. Focus on Volume Eating (high fiber, low calorie density, salads, clear soups).
      If the Target is HIGHER than original: This is a refeed day.
      
      DIET MODE: ${dietType.toUpperCase()}
      ${dietRule}
      
      MODE: ${isEditMode ? "**CORRECTION / RE-CALCULATION**" : "NEW PLAN GENERATION"}
      USER INPUT / CORRECTION: "${preferences || 'Standard Indian Diet'}"

      ---------------------------------------------------------
      *** SMART MEAL ROTATION ENGINE (ALGORITHM) ***
      HISTORY (Last 3 Days):
      ${recentHistory || "No history available (New Client)"}

      1. PROTEIN CONSISTENCY (The Anchor):
         - Identify staple protein sources from history (e.g., Chicken Breast, Paneer, Eggs).
         - REPEAT these protein sources if they worked well. Consistency is key for muscle building/fat loss.
         - Goal: 60-70% consistency in core protein items.

      2. CARB/FAT VARIETY (The Spice):
         - ROTATE carbohydrate sources. If they had Rice yesterday, suggest Roti, Quinoa, or Oats today.
         - ROTATE cooking styles. If they had "Boiled Egg" yesterday, make "Egg Bhurji" today.
         - Goal: Prevent monotony by changing textures and flavors of side dishes/carbs.

      3. OVERALL REPETITION TARGET:
         - Aim for ~40-50% repetition of total ingredients. This makes the diet easy to shop for but not boring to eat.
         - DO NOT create a completely wild, new menu every day. Build on previous days.

      ---------------------------------------------------------
      *** INTELLIGENT ADJUSTMENT PROTOCOL (CRITICAL) ***
      ${isEditMode ? `
      The user is asking for a CORRECTION or has reported food consumption (e.g. "I ate 500g Biryani").
      1. IDENTIFY what they ate and ESTIMATE its macros (be generous with calorie estimation for restaurant food).
      2. DEDUCT these macros from the TODAY'S STRICT TARGET.
      3. RE-PLAN the REMAINING meals to fit the NEW REMAINING BUDGET.
      ` : `
      Generate a balanced Indian diet plan strictly adhering to ${effectiveCalories} kcal.
      `}
      
      *** UNIT POLICE (ZERO TOLERANCE) ***
      1. YOU MUST USE GRAMS (g) FOR SOLIDS.
      2. YOU MUST USE MILLILITERS (ml) FOR LIQUIDS.
      3. BANNED WORDS: "Cup", "Bowl", "Slice", "Ounce", "oz", "lb", "Tablespoon" (unless followed by exact grams).
      ---------------------------------------------------------

      FOOD DATABASE (Use these items primarily):
      ${foodDB}

      OUTPUT JSON FORMAT:
      {
        "meals": [
          { 
            "name": "Breakfast", 
            "time": "8:00 AM", 
            "items": ["Paneer Bhurji (Paneer 100g, Onion 50g)", "Roti (Wheat Flour 40g)"], 
            "macros": { "p": 20, "c": 30, "f": 10, "cal": 300 } 
          }
        ],
        "daily_totals": { "p": 0, "c": 0, "f": 0, "cal": 0 }
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                temperature: 0.4, 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        meals: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    time: { type: Type.STRING },
                                    items: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    macros: {
                                        type: Type.OBJECT,
                                        properties: {
                                            p: { type: Type.NUMBER },
                                            c: { type: Type.NUMBER },
                                            f: { type: Type.NUMBER },
                                            cal: { type: Type.NUMBER }
                                        }
                                    }
                                }
                            }
                        },
                        daily_totals: {
                             type: Type.OBJECT,
                             properties: {
                                 p: { type: Type.NUMBER },
                                 c: { type: Type.NUMBER },
                                 f: { type: Type.NUMBER },
                                 cal: { type: Type.NUMBER }
                             }
                        }
                    }
                }
            } 
        });

        const text = cleanJson(response.text || "{}");
        const data = JSON.parse(text);
        
        if (!data.meals || data.meals.length === 0) throw new Error("Empty plan generated");

        return {
            date: dateStr,
            meals: data.meals,
            macros: data.daily_totals
        };

    } catch (e: any) {
        console.error("Daily Diet gen failed", e);
        throw new Error(`Generation failed: ${e.message}`);
    }
};

// ... existing handleDietDeviation ...
export const handleDietDeviation = async (
    currentPlan: DailyMealPlanDB,
    targetMacros: MacroPlan,
    mealIndex: number,
    userDescription: string
): Promise<DailyMealPlanDB> => {
    if (!apiKey) throw new Error("API Key missing.");
    
    const mealName = currentPlan.meals[mealIndex].name;

    const prompt = `
    TASK: DEVIATION MANAGEMENT (ZIGZAG ADJUSTMENT)
    
    Current Plan Date: ${currentPlan.date}
    User has deviated from the plan for meal: "${mealName}".
    User's Report: "${userDescription}" (e.g., Cheat meal, skipped meal, extra food).
    
    Target for Day: ${targetMacros.calories} kcal
    
    ACTION REQUIRED:
    1. ESTIMATE the macros for the deviation described by the user. Be realistic (e.g. Pizza is high calorie).
    2. REPLACE the items/macros of "${mealName}" with this new data.
    3. RE-CALCULATE the "daily_totals" based on this change.
    4. ADJUST REMAINING MEALS:
       - If the user overate significantly at ${mealName}, REDUCE the calories of subsequent meals (Dinner/Snack) to try and balance the daily budget.
       - Use the "Zigzag" approach: If lunch was heavy, Dinner should be very light (Salad/Soup/Shake).
       - Do NOT modify meals that have already happened (assume chronological order: Breakfast -> Lunch -> Dinner).
    
    CURRENT JSON (To be modified):
    ${JSON.stringify(currentPlan)}
    
    OUTPUT: Full updated JSON object with the same structure.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                temperature: 0.5, 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        meals: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    time: { type: Type.STRING },
                                    items: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    macros: {
                                        type: Type.OBJECT,
                                        properties: {
                                            p: { type: Type.NUMBER },
                                            c: { type: Type.NUMBER },
                                            f: { type: Type.NUMBER },
                                            cal: { type: Type.NUMBER }
                                        }
                                    }
                                }
                            }
                        },
                        daily_totals: {
                             type: Type.OBJECT,
                             properties: {
                                 p: { type: Type.NUMBER },
                                 c: { type: Type.NUMBER },
                                 f: { type: Type.NUMBER },
                                 cal: { type: Type.NUMBER }
                             }
                        }
                    }
                }
            } 
        });

        const text = cleanJson(response.text || "{}");
        const data = JSON.parse(text);
        
        return {
            ...currentPlan,
            meals: data.meals,
            macros: data.daily_totals
        };

    } catch (e: any) {
        console.error("Deviation adjustment failed", e);
        throw new Error(`Deviation adjustment failed: ${e.message}`);
    }
};