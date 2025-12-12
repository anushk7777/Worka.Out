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

// Updated: Uses Google Search Grounding with Flash for speed
export const generateTrainerResponse = async (
  history: ChatMessage[], 
  userProfile: UserProfile | null,
  progressLogs: ProgressEntry[],
  newMessage: string
): Promise<{ text: string, sources?: { title: string, uri: string }[] }> => {
  if (!apiKey) return { text: "Configuration Error: API Key is missing. Please restart the app." };

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
      config: { 
        tools: [{ googleSearch: {} }],
        temperature: 0.7
      }
    });

    // Extract sources if available
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web)
      .filter((web: any) => web)
      .map((web: any) => ({ title: web.title, uri: web.uri }));

    return { 
      text: response.text || "I apologize, I'm having trouble analyzing your progress right now.",
      sources: sources
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "I'm experiencing connectivity issues." };
  }
};

// Updated: Uses Gemini 3 Pro Preview with Thinking for deep visual analysis
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

    // Helper to get mime type and data
    const processImage = (base64: string) => {
        const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            return { mimeType: matches[1], data: matches[2] };
        }
        return { mimeType: "image/jpeg", data: base64 }; // Fallback
    };

    // Add Front Image
    const frontImg = processImage(frontImageBase64);
    parts.push({ inlineData: { mimeType: frontImg.mimeType, data: frontImg.data } });
    parts.push({ text: "Image 1: Front View" });

    // Add Back Image if available
    if (backImageBase64) {
        const backImg = processImage(backImageBase64);
        parts.push({ inlineData: { mimeType: backImg.mimeType, data: backImg.data } });
        parts.push({ text: "Image 2: Back View" });
    } else {
        parts.push({ text: "Note: Only Front View provided. Estimate based on single angle." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: [
        {
          role: "user",
          parts: parts
        }
      ],
      config: { 
        thinkingConfig: { thinkingBudget: 32768 },
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

// Updated: Uses Gemini 3 Pro Preview with Thinking for complex workout logic
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
            model: "gemini-3-pro-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                thinkingConfig: { thinkingBudget: 32768 },
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
// Updated to use Gemini 3 Pro with Thinking for better calorie math and menu planning
export const generateDailyMealPlan = async (
    profile: UserProfile, 
    macros: MacroPlan, 
    dateStr: string,
    history: DailyMealPlanDB[] = [],
    preferences?: string,
    dietType: 'veg' | 'egg' | 'non-veg' = 'non-veg',
    customCalorieTarget?: number,
    weeklyStatusNote?: string
): Promise<DailyMealPlanDB> => {
    if (!apiKey) throw new Error("API Key missing. Please check your configuration.");

    const foodDB = getFoodDBContext();
    const isEditMode = !!preferences;
    
    // Determine the actual target for today
    const effectiveCalories = customCalorieTarget || macros.calories;
    
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
      
      DIET MODE: ${dietType.toUpperCase()}
      ${dietRule}
      
      MODE: ${isEditMode ? "**CORRECTION / RE-CALCULATION**" : "NEW PLAN GENERATION"}
      USER INPUT / CORRECTION: "${preferences || 'Standard Indian Diet'}"

      ---------------------------------------------------------
      *** SMART MEAL ROTATION ENGINE (ALGORITHM) ***
      HISTORY (Last 3 Days):
      ${recentHistory || "No history available (New Client)"}

      1. PROTEIN CONSISTENCY: Goal 60-70% consistency in core protein items (Chicken Breast, Paneer, etc).
      2. CARB/FAT VARIETY: Rotate carb sources (Rice vs Roti) and cooking styles.
      3. OVERALL REPETITION: Aim for ~40-50% repetition of total ingredients.

      *** UNIT POLICE (ZERO TOLERANCE) ***
      1. YOU MUST USE GRAMS (g) FOR SOLIDS.
      2. YOU MUST USE MILLILITERS (ml) FOR LIQUIDS.
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
            model: "gemini-3-pro-preview", // Upgraded for complex reasoning
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                thinkingConfig: { thinkingBudget: 32768 }, // Enabled Thinking
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
// Updated to use Gemini 3 Pro for complex adjustment reasoning
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
    1. ESTIMATE the macros for the deviation described by the user. Be realistic.
    2. REPLACE the items/macros of "${mealName}" with this new data.
    3. RE-CALCULATE the "daily_totals" based on this change.
    4. ADJUST REMAINING MEALS to balance the budget if possible, using "Zigzag" approach.
    
    CURRENT JSON (To be modified):
    ${JSON.stringify(currentPlan)}
    
    OUTPUT: Full updated JSON object with the same structure.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", // Upgraded
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                thinkingConfig: { thinkingBudget: 32768 }, // Enabled Thinking
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