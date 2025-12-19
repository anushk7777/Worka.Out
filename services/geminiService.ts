
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, UserProfile, ProgressEntry, MacroPlan, DailyMealPlanDB, WorkoutDay, SupplementRecommendation } from "../types";
import { SYSTEM_PROMPT, FOOD_DATABASE } from "../constants";

// Initialize AI directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        return cleaned.substring(firstBrace, lastBrace + 1);
    }
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
        return cleaned.substring(firstBracket, lastBracket + 1);
    }
    return cleaned;
};

export const generateTrainerResponse = async (
  history: ChatMessage[] = [], 
  userProfile: UserProfile | null,
  progressLogs: ProgressEntry[],
  newMessage: string
): Promise<{ text: string, sources?: { title: string, uri: string }[] }> => {
  try {
    const model = 'gemini-3-pro-preview';
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
      model: model,
      contents: contents,
      config: { 
        tools: [{ googleSearch: {} }], 
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 16000 }
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
    1. **Validation Check**: 
       - If the image is NOT a human torso/body (e.g. text, objects, blurry, face-only), REJECT immediately with valid: false.
       - If clothing obscures critical landmarks (abs, waist), REJECT.

    2. **Anatomical Segmentation (Deep Scan)**:
       - Analyze Abdominal Definition: Check for linea alba, serratus anterior visibility, and lower ab vascularity.
       - Analyze Muscular Separation: Check deltoid/bicep separation and quadricep tear-drop visibility.
       - Analyze Adipose Storage: Evaluate love handles (suprailiac) and lower back storage.

    3. **Estimation Logic**:
       - Compare visual features against the Jackson-Pollock 3-site visual proxies.
       - Reference "Navy Tape Method" visual proxies (neck-to-waist ratio).
       - Cross-reference with standard athletic body composition charts for ${profile.gender}.

    4. **Output**:
       - Provide a single integer percentage.
       - Provide a concise, clinical reasoning string (max 25 words) citing specific visual markers observed.

    Example Reasoning: "Clear upper abs visible, serratus anterior faint. Slight suprailiac storage. Consistent with 14-16% range."
  `;

  try {
    const parts: any[] = [{ text: prompt }];
    const processImage = (base64: string) => {
        const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        return (matches && matches.length === 3) ? { mimeType: matches[1], data: matches[2] } : { mimeType: "image/jpeg", data: base64 };
    };

    const frontImg = processImage(frontImageBase64);
    parts.push({ inlineData: { mimeType: frontImg.mimeType, data: frontImg.data } });

    if (backImageBase64) {
        const backImg = processImage(backImageBase64);
        parts.push({ inlineData: { mimeType: backImg.mimeType, data: backImg.data } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // UPGRADED MODEL FOR HIGHER ACCURACY
      contents: { parts: parts },
      config: { 
        thinkingConfig: { thinkingBudget: 16000 }, // ENABLE DEEP THINKING
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
    throw new Error("Vision analysis failed. Check image format."); 
  }
};

export const generateWorkoutSplit = async (profile: UserProfile): Promise<WorkoutDay[]> => {
    const prompt = `Create a 7-day Weekly Workout Split for Goal: ${profile.goal}, Activity: ${profile.activityLevel}. Format as JSON.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 16000 },
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
    } catch (e) { return []; }
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
    const foodDB = getFoodDBContext();
    const effectiveCalories = customCalorieTarget || macros.calories;
    const aggressiveness = profile.goal_aggressiveness === 'aggressive' ? "AGGRESSIVE/ACCELERATED (Strict Compliance Required)" : "SUSTAINABLE (Balanced)";
    const medical = profile.medical_conditions ? `MEDICAL CONDITIONS: ${profile.medical_conditions}. AVOID CONTRAINDICATED FOODS.` : "No medical conditions.";
    
    const prompt = `
      Create a meal plan for ${dateStr} at ${effectiveCalories} kcal.
      Protein: ${macros.protein}g | Carbs: ${macros.carbs}g | Fats: ${macros.fats}g
      Diet Type: ${dietType}. Preferences: ${preferences}.
      Intensity: ${aggressiveness}.
      ${medical}
      ${contextNote ? `Special Context: ${contextNote}` : ''}
      Use the following database context for calorie/macro values:
      ${foodDB}
      Ensure all strings in the JSON response are properly closed and valid JSON syntax is maintained.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 16000 }, 
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

        const data = JSON.parse(cleanJson(response.text));
        return { date: dateStr, meals: data?.meals || [], macros: data?.daily_totals || { p: 0, c: 0, f: 0, cal: 0 } };
    } catch (e: any) {
        console.error("Plan Gen Failed:", e);
        throw new Error("Meal plan generation failed due to malformed response. Please try again.");
    }
};

export const handleDietDeviation = async (currentPlan: DailyMealPlanDB, targetMacros: MacroPlan, mealIndex: number, userDescription: string): Promise<DailyMealPlanDB> => {
    const prompt = `Adjust plan for deviation. Meal: ${currentPlan.meals[mealIndex].name}. User ate: "${userDescription}". Re-balance remaining meals to hit target: ${targetMacros.calories}kcal.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 8000 }, 
                responseMimeType: "application/json"
            } 
        });
        const data = JSON.parse(cleanJson(response.text));
        return { ...currentPlan, meals: data?.meals || currentPlan.meals, macros: data?.daily_totals || currentPlan.macros };
    } catch (e: any) { throw new Error("Deviation update failed."); }
};

export const addFoodItem = async (currentPlan: DailyMealPlanDB, userDescription: string): Promise<DailyMealPlanDB> => {
    const prompt = `Add item "${userDescription}" to plan. Estimate macros accurately. Return full updated plan JSON.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 4000 }, 
                responseMimeType: "application/json"
            } 
        });
        const data = JSON.parse(cleanJson(response.text));
        return { ...currentPlan, meals: data?.meals || currentPlan.meals, macros: data?.daily_totals || currentPlan.macros };
    } catch (e: any) { throw new Error("Food logging failed."); }
};

export const generateSupplementStack = async (profile: UserProfile): Promise<SupplementRecommendation[]> => {
    const prompt = `
      Design a targeted supplement protocol. 
      Goal: ${profile.goal} (Intensity: ${profile.goal_aggressiveness || 'Normal'})
      Dietary Restriction: ${profile.dietary_preference}
      Medical Context: ${profile.medical_conditions || 'None'}
      Activity Level: ${profile.activityLevel}
      
      CRITICAL: Keep descriptions extremely concise (max 100 characters). 
      Do NOT include long paragraphs. 
      Focus only on evidence-based data for this specific user profile.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 16000 },
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
