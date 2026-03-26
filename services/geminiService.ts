
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, UserProfile, ProgressEntry, MacroPlan, DailyMealPlanDB, WorkoutDay, SupplementRecommendation } from "../types";
import { SYSTEM_PROMPT, FOOD_DATABASE } from "../constants";

// Helper to get a fresh client instance
const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const retryWithBackoff = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.warn(`Retry attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // Exponential backoff
        }
    }
    throw new Error("Max retries reached");
};

const getFoodDBContext = () => {
  return FOOD_DATABASE
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(f => {
        const unit = f.type === 'unit' ? 'pcs' : f.type === 'liquid' ? 'ml' : 'g';
        return `- ${f.name} (${f.base_amount}${unit}): ${f.calories}kcal, P:${f.protein}g, C:${f.carbs}g, F:${f.fats}g`;
    })
    .join('\n');
};

const cleanJson = (text: string): string => {
    if (!text) return "{}";
    try {
        let cleaned = text.trim();
        // Remove markdown formatting (```json ... ```)
        cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        // Locate JSON array or object
        const firstBrace = cleaned.indexOf('{');
        const firstBracket = cleaned.indexOf('[');
        
        // Determine start index
        let startIdx = 0;
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            startIdx = firstBrace;
        } else if (firstBracket !== -1) {
            startIdx = firstBracket;
        } else {
            // No JSON structure found
            return "{}";
        }

        // Determine end index
        let endIdx = cleaned.length;
        const lastBrace = cleaned.lastIndexOf('}');
        const lastBracket = cleaned.lastIndexOf(']');

        if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) {
            endIdx = lastBrace + 1;
        } else if (lastBracket !== -1) {
            endIdx = lastBracket + 1;
        }

        return cleaned.substring(startIdx, endIdx);
    } catch (e) {
        console.error("JSON Clean Error:", e);
        return "{}";
    }
};

const recalculateDailyTotals = (meals: any[]) => {
    return meals.reduce((acc, meal) => {
        acc.p = Math.round((acc.p + (meal.macros?.p || 0)) * 10) / 10;
        acc.c = Math.round((acc.c + (meal.macros?.c || 0)) * 10) / 10;
        acc.f = Math.round((acc.f + (meal.macros?.f || 0)) * 10) / 10;
        acc.cal = Math.round((acc.cal + (meal.macros?.cal || 0)));
        return acc;
    }, { p: 0, c: 0, f: 0, cal: 0 });
};

export const generateTrainerResponse = async (
  history: ChatMessage[] = [], 
  userProfile: UserProfile | null,
  progressLogs: ProgressEntry[],
  newMessage: string
): Promise<{ text: string, sources?: { title: string, uri: string }[] }> => {
  try {
    const ai = getAIClient();
    let contextPrompt = SYSTEM_PROMPT;
    if (userProfile) {
      contextPrompt += `\n\n=== CLIENT PROFILE ===\nName: ${userProfile.name}\nAge: ${userProfile.age}\nGoal: ${userProfile.goal}\nActivity: ${userProfile.activityLevel}\nCurrent Weight: ${userProfile.weight}kg\nConditions: ${userProfile.medical_conditions || 'None'}\nIntensity: ${userProfile.goal_aggressiveness || 'normal'}`;
    }

    const contents = [
      { role: "user", parts: [{ text: contextPrompt }] },
      ...(history || []).map(msg => ({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] })),
      { role: "user", parts: [{ text: newMessage }] }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: contents,
      config: { 
        tools: [{ googleSearch: {} }], 
        temperature: 0.7
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web)
      .map((web: any) => ({ title: web.title, uri: web.uri }));

    return { text: response.text || "I'm having trouble analyzing that right now.", sources: sources };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "Network connectivity issue. Please check your connection." };
  }
};

export const analyzeBodyComposition = async (
  frontImageBase64: string, 
  backImageBase64: string | null,
  profile: Partial<UserProfile>
): Promise<{ valid: boolean; percentage?: number; reasoning: string }> => {
  const prompt = `
    Role: Elite Biomechanics & Anthropometry Analyst.
    Task: Conduct a clinical-grade Body Fat Percentage (BFP) analysis from visual data.
    Subject Data: Gender: ${profile.gender}, Age: ${profile.age}, Height: ${profile.height} cm, Weight: ${profile.weight} kg.

    PROTOCOL (STRICT):
    1. Validation Check: REJECT valid:false if not a human torso or completely blurry.
    2. Analyze visual landmarks (abs, obliques, separation).
    3. Output JSON.
  `;

  try {
    const ai = getAIClient();
    const parts: any[] = [{ text: prompt }];
    
    // Safety check for base64
    const processImage = (base64: string) => {
        if (!base64 || typeof base64 !== 'string') return null;
        const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        return (matches && matches.length === 3) ? { mimeType: matches[1], data: matches[2] } : { mimeType: "image/jpeg", data: base64 };
    };

    const frontImg = processImage(frontImageBase64);
    if (!frontImg) throw new Error("Invalid image data");
    
    parts.push({ inlineData: { mimeType: frontImg.mimeType, data: frontImg.data } });

    if (backImageBase64) {
        const backImg = processImage(backImageBase64);
        if (backImg) parts.push({ inlineData: { mimeType: backImg.mimeType, data: backImg.data } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview", 
      contents: { parts: parts },
      config: { 
        responseMimeType: "application/json",
        responseSchema: { 
          type: Type.OBJECT, 
          properties: { 
            valid: { type: Type.BOOLEAN },
            percentage: { type: Type.NUMBER }, 
            reasoning: { type: Type.STRING } 
          }, 
          required: ["valid", "reasoning"] 
        }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) { 
    console.error("Analysis Error:", error);
    return { valid: false, reasoning: "Vision analysis service unavailable." };
  }
};

export const generateWorkoutSplit = async (profile: UserProfile): Promise<WorkoutDay[]> => {
    const prompt = `Create a 7-day Weekly Workout Split for Goal: ${profile.goal}, Activity: ${profile.activityLevel}. Format as JSON.`;
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: prompt,
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
                                            notes: { type: Type.STRING } 
                                          }, 
                                          required: ["name", "sets", "reps"] 
                                        }
                                    }
                                },
                                required: ["day", "focus", "exercises"]
                            }
                        }
                    },
                    required: ["workout"]
                }
            }
        });
        const data = JSON.parse(cleanJson(response.text));
        return data?.workout || [];
    } catch (e) { 
        console.error("Workout Gen Error:", e);
        return []; 
    }
};

export const generateDailyMealPlan = async (
    profile: UserProfile, 
    macros: MacroPlan, 
    dateStr: string,
    history: DailyMealPlanDB[] = [],
    preferences?: string,
    dietType: 'veg' | 'egg' | 'non-veg' = 'non-veg',
    customCalorieTarget?: number,
    contextNote?: string
): Promise<DailyMealPlanDB> => {
    const effectiveCalories = customCalorieTarget || macros.calories;
    const aggressiveness = profile.goal_aggressiveness === 'aggressive' ? "AGGRESSIVE/ACCELERATED (Strict Compliance Required)" : "SUSTAINABLE (Balanced)";
    
    // MEDICAL CONTEXT ENHANCEMENT
    const medical = profile.medical_conditions 
        ? `MEDICAL PROTOCOL ACTIVE: "${profile.medical_conditions}".
           ADAPTATION RULES:
           1. DIABETES/INSULIN: Use Complex Carbs (Low GI), High Fiber. NO simple sugars.
           2. DEPRESSION/MOOD: Include Serotonergic foods (Walnuts, Seeds, Oats, Eggs, Dark Chocolate).
           3. HYPERTENSION: Restrict Sodium.
           4. GENERAL: Strictly avoid foods contraindicated for the listed conditions.`
        : "No medical conditions.";
    
    const prompt = `
      Create a meal plan for ${dateStr} at ${effectiveCalories} kcal.
      Protein: ${macros.protein}g | Carbs: ${macros.carbs}g | Fats: ${macros.fats}g
      Diet Type: ${dietType}. Preferences: ${preferences}.
      Intensity: ${aggressiveness}.
      ${medical}
      ${contextNote ? `Special Context: ${contextNote}` : ''}
      Use Google Search to find accurate nutritional data for the foods you include to ensure the macros are realistic.
      Ensure all strings in the JSON response are properly closed and valid JSON syntax is maintained.
    `;

    return retryWithBackoff(async () => {
        try {
            const ai = getAIClient();
            console.log("Generating plan for:", dateStr);
            const response = await ai.models.generateContent({
                model: "gemini-3.1-pro-preview", 
                contents: prompt,
                config: { 
                    tools: [{ googleSearch: {} }],
                    maxOutputTokens: 32768, // Explicitly set max output tokens to allow room after thinking
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
                                },
                                required: ["p", "c", "f", "cal"]
                              },
                              isCompleted: { type: Type.BOOLEAN }
                            },
                            required: ["name", "time", "items", "macros"]
                          }
                        },
                        daily_totals: {
                          type: Type.OBJECT,
                          properties: {
                            p: { type: Type.NUMBER },
                            c: { type: Type.NUMBER },
                            f: { type: Type.NUMBER },
                            cal: { type: Type.NUMBER }
                          },
                          required: ["p", "c", "f", "cal"]
                        }
                      },
                      required: ["meals", "daily_totals"]
                    }
                } 
            });

            console.log("Plan generated, cleaning JSON...");
            const data = JSON.parse(cleanJson(response.text));
            if (!data?.meals || !Array.isArray(data.meals)) {
                throw new Error("Invalid response format: Missing meals array");
            }
            return { date: dateStr, meals: data.meals, macros: data.daily_totals || { p: 0, c: 0, f: 0, cal: 0 } };
        } catch (e: any) {
            console.error("Plan Gen Failed (Attempt):", e);
            throw e; // Propagate to retry handler
        }
    });
};

export const handleDietDeviation = async (currentPlan: DailyMealPlanDB, targetMacros: MacroPlan, mealIndex: number, userDescription: string): Promise<DailyMealPlanDB> => {
    const mealToEdit = currentPlan.meals[mealIndex];
    const prompt = `
      Original Meal: ${JSON.stringify({ items: mealToEdit.items, macros: mealToEdit.macros })}
      User Modification: "${userDescription}"

      Task:
      1. Modify the meal items based on the user's instruction.
      2. Recalculate the macros (protein, carbs, fats, calories) for the updated meal. Use Google Search to find accurate nutritional data.
      3. Return ONLY the updated meal JSON.
    `;
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview", 
            contents: prompt,
            config: { 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    items: { type: Type.ARRAY, items: { type: Type.STRING } },
                    macros: {
                      type: Type.OBJECT,
                      properties: {
                        p: { type: Type.NUMBER },
                        c: { type: Type.NUMBER },
                        f: { type: Type.NUMBER },
                        cal: { type: Type.NUMBER }
                      },
                      required: ["p", "c", "f", "cal"]
                    }
                  },
                  required: ["items", "macros"]
                }
            } 
        });
        const updatedMealData = JSON.parse(cleanJson(response.text));
        
        const updatedMeals = [...currentPlan.meals];
        updatedMeals[mealIndex] = {
            ...updatedMeals[mealIndex],
            items: updatedMealData.items || updatedMeals[mealIndex].items,
            macros: updatedMealData.macros || updatedMeals[mealIndex].macros
        };
        
        const updatedTotals = recalculateDailyTotals(updatedMeals);
        
        return { ...currentPlan, meals: updatedMeals, macros: updatedTotals };
    } catch (e: any) { throw new Error("Deviation update failed."); }
};

export const addFoodItem = async (currentPlan: DailyMealPlanDB, userDescription: string): Promise<DailyMealPlanDB> => {
    const prompt = `
      The user ate: "${userDescription}".
      
      Task:
      1. Identify the food items and their quantities.
      2. Estimate the nutritional macros (protein, carbs, fats, calories) for this consumption. Use Google Search to find accurate nutritional data.
      3. Return a JSON object representing this as a meal addition.
    `;
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview", 
            contents: prompt,
            config: { 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
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
                      },
                      required: ["p", "c", "f", "cal"]
                    }
                  },
                  required: ["name", "time", "items", "macros"]
                }
            } 
        });
        const newMeal = JSON.parse(cleanJson(response.text));
        newMeal.isCompleted = true; // Assume if they are logging it, they ate it.
        
        // Provide defaults if AI missed something
        if (!newMeal.name) newMeal.name = "Snack / Addition";
        if (!newMeal.time) newMeal.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const updatedMeals = [...currentPlan.meals, newMeal];
        const updatedTotals = recalculateDailyTotals(updatedMeals);
        
        return { ...currentPlan, meals: updatedMeals, macros: updatedTotals };
    } catch (e: any) { throw new Error("Food logging failed."); }
};

export const generateSupplementStack = async (profile: UserProfile): Promise<SupplementRecommendation[]> => {
    const prompt = `
      Design a targeted supplement protocol. 
      Goal: ${profile.goal} (Intensity: ${profile.goal_aggressiveness || 'Normal'})
      Dietary Restriction: ${profile.dietary_preference}
      Medical Context: ${profile.medical_conditions || 'None'}
      Activity Level: ${profile.activityLevel}
      
      INSTRUCTION: If medical conditions are present (e.g., Diabetes, Depression), prioritize supplements known to support those specific conditions (e.g., Magnesium/Ashwagandha for mood, Chromium for blood sugar) provided they are generally safe. List contraindications clearly.

      CRITICAL: Keep descriptions extremely concise (max 100 characters). 
      Do NOT include long paragraphs. 
      Focus only on evidence-based data for this specific user profile.
    `;
    
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    stack: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          dosage: { type: Type.STRING },
                          timing: { type: Type.STRING },
                          reason: { type: Type.STRING },
                          priority: { type: Type.STRING, enum: ["Essential", "Performance", "Optional"] },
                          mechanism: { type: Type.STRING },
                          benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
                          side_effects: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["name", "dosage", "timing", "reason", "priority", "mechanism", "benefits", "side_effects"]
                      }
                    }
                  },
                  required: ["stack"]
                }
            }
        });
        const data = JSON.parse(cleanJson(response.text));
        return data?.stack || [];
    } catch (e) {
        console.error("Supp Generation Error:", e);
        return [];
    }
};
