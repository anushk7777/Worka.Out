import { ActivityLevel, Recipe, Supplement, FoodItem } from "./types";

export const SYSTEM_PROMPT = `
You are the "WorkA.out AI", an elite fitness expert specializing in nutrition and biomechanics.

**CORE KNOWLEDGE BASE:**

1.  **BMR & Caloric Calculation**:
    *   Use Mifflin-St Jeor.
    *   Goal Adjustments: Fat Loss (-300 to -500), Muscle Gain (+200 to +300).

2.  **DIET PHILOSOPHY (INDIAN CONTEXT)**:
    *   Primary sources: Roti, Rice, Dal, Paneer, Soya, Chicken (Curry cut), Eggs.
    *   Measurements: ALWAYS in Raw Grams.
    *   NO Western breakfast defaults (e.g., No Turkey Bacon, No Avocados unless asked).

3.  **BEHAVIOR**:
    *   Direct, authoritative, data-driven.
    *   Empathetic but strict about results.
`;

export const RECIPES: Recipe[] = [
  // ... (Keeping existing recipes as they are already Indian focused)
  // --- BREAKFAST ---
  {
    id: "1",
    name: "Besan Cheela",
    calories: 350,
    protein: 18,
    carbs: 53,
    fats: 7,
    ingredients: ["Besan 75g", "Onion 40g", "Tomato 40g", "Capsicum 15g", "Carrots 25g", "Green chillies", "Coriander", "Spices"],
    procedure: ["Finely chop vegetables.", "Mix besan, veggies, spices and water to consistency.", "Spread on non-stick pan brushed with oil.", "Cook until golden brown."],
    tags: ["Breakfast", "Vegetarian", "Indian"]
  },
  {
    id: "2",
    name: "Egg Pohe",
    calories: 496,
    protein: 7.2, 
    carbs: 42,
    fats: 12,
    ingredients: ["Pohe 40g", "1 Whole Egg (boiled)", "Onion 100g", "Oil 5ml", "Mustard seeds", "Curry leaves"],
    procedure: ["Heat oil, sauté mustard seeds, curry leaves and onion.", "Add washed pohe and cook covered for 5 mins.", "Mix in boiled/scrambled egg.", "Cook for 2 mins more."],
    tags: ["Breakfast", "High Energy", "Indian"]
  },
  {
    id: "3",
    name: "Masala Oats",
    calories: 374,
    protein: 13.1,
    carbs: 67,
    fats: 6.1,
    ingredients: ["Oats 70g", "Onion 50g", "Tomato 50g", "Peas 20g", "Spices"],
    procedure: ["Sauté veggies.", "Add oats and water.", "Cook until porridge consistency."],
    tags: ["Breakfast", "Vegetarian", "Indian"]
  },
  {
    id: "15",
    name: "Palak Paneer",
    calories: 240,
    protein: 13.5,
    carbs: 13,
    fats: 15,
    ingredients: ["Palak 75g", "Paneer 50g", "Tomato 30g", "Onion 40g", "Milk 50ml"],
    procedure: ["Boil spinach and tomato, grind to paste.", "Sauté ginger garlic and onions.", "Add paste and spices.", "Add milk and paneer cubes."],
    tags: ["Main Course", "Vegetarian", "Indian"]
  },
  {
    id: "23",
    name: "Chicken Biryani",
    calories: 490,
    protein: 22,
    carbs: 55,
    fats: 21,
    ingredients: ["Rice 50g", "Chicken 90g", "Onion 60g", "Curd 30g", "Biryani masala"],
    procedure: ["Boil rice.", "Cook chicken with spices and curd.", "Layer rice and chicken.", "Steam (dum) for 5 mins."],
    tags: ["Main Course", "Non-Veg", "Indian"]
  }
];

export const SUPPLEMENTS_DATA: Supplement[] = [
  { id: "s1", name: "Vitamin B-Complex", category: "Anxiety", tier: "TIER 1", dosage: "RDA", mechanism: "Deficiency causes mood disorders." },
  { id: "s2", name: "Ashwagandha", category: "Anxiety", tier: "TIER 1", dosage: "600-1000mg/day", mechanism: "Reduces cortisol." },
  { id: "s6", name: "Creatine Monohydrate", category: "Performance", tier: "TIER 1", dosage: "3-5g/day", mechanism: "Increases strength and lean mass." },
  { id: "s13", name: "Vitamin D3", category: "General Health", tier: "TIER 1", dosage: "2000-4000 IU", mechanism: "Essential for bone health." },
];

// EXPANDED DATASET IMPLEMENTATION (Based on aryachakraborty/Food_Calorie_Dataset)
// Prioritizing RAW ingredients for accurate macro tracking as per system prompt.
export const FOOD_DATABASE: FoodItem[] = [
  // --- CEREALS & GRAINS (RAW) ---
  { id: "g1", name: "Atta (Wheat Flour)", servingSize: "100g", calories: 340, protein: 12, carbs: 70, fats: 2 },
  { id: "g2", name: "Rice (Raw Sona Masoori)", servingSize: "100g", calories: 360, protein: 7, carbs: 78, fats: 0.5 },
  { id: "g3", name: "Basmati Rice (Raw)", servingSize: "100g", calories: 350, protein: 8, carbs: 77, fats: 0.5 },
  { id: "g4", name: "Brown Rice (Raw)", servingSize: "100g", calories: 360, protein: 7.5, carbs: 76, fats: 3 },
  { id: "g5", name: "Oats (Rolled/Raw)", servingSize: "100g", calories: 389, protein: 16.9, carbs: 66, fats: 6.9 },
  { id: "g6", name: "Quinoa (Raw)", servingSize: "100g", calories: 368, protein: 14, carbs: 64, fats: 6 },
  { id: "g7", name: "Besan (Gram Flour)", servingSize: "100g", calories: 387, protein: 22, carbs: 58, fats: 7 },
  { id: "g8", name: "Ragi Flour", servingSize: "100g", calories: 328, protein: 7.3, carbs: 72, fats: 1.3 },
  { id: "g9", name: "Poha (Flattened Rice)", servingSize: "100g", calories: 346, protein: 6.6, carbs: 77, fats: 1.2 },
  { id: "g10", name: "Rava/Sooji (Semolina)", servingSize: "100g", calories: 360, protein: 12, carbs: 72, fats: 1 },

  // --- PULSES & LEGUMES (RAW) ---
  { id: "l1", name: "Moong Dal (Yellow)", servingSize: "100g", calories: 348, protein: 24, carbs: 60, fats: 1.2 },
  { id: "l2", name: "Moong Dal (Whole Green)", servingSize: "100g", calories: 334, protein: 24, carbs: 56, fats: 1.3 },
  { id: "l3", name: "Toor Dal (Arhar)", servingSize: "100g", calories: 343, protein: 22, carbs: 60, fats: 1.5 },
  { id: "l4", name: "Masoor Dal (Red)", servingSize: "100g", calories: 340, protein: 24, carbs: 60, fats: 1 },
  { id: "l5", name: "Chana Dal", servingSize: "100g", calories: 370, protein: 20, carbs: 60, fats: 5 },
  { id: "l6", name: "Rajma (Red Kidney Beans)", servingSize: "100g", calories: 333, protein: 24, carbs: 60, fats: 1 },
  { id: "l7", name: "Chickpeas (Kabuli Chana)", servingSize: "100g", calories: 360, protein: 19, carbs: 61, fats: 6 },
  { id: "l8", name: "Black Chana", servingSize: "100g", calories: 360, protein: 19, carbs: 60, fats: 5 },
  { id: "l9", name: "Soya Chunks", servingSize: "100g", calories: 345, protein: 52, carbs: 33, fats: 0.5 },
  { id: "l10", name: "Urad Dal", servingSize: "100g", calories: 341, protein: 25, carbs: 59, fats: 1.6 },

  // --- DAIRY & ALTERNATIVES ---
  { id: "d1", name: "Milk (Toned)", servingSize: "100ml", calories: 60, protein: 3, carbs: 4.7, fats: 3 },
  { id: "d2", name: "Curd (Yogurt)", servingSize: "100g", calories: 60, protein: 3.5, carbs: 4.5, fats: 3 },
  { id: "d3", name: "Paneer (Cottage Cheese)", servingSize: "100g", calories: 265, protein: 18, carbs: 2, fats: 20 },
  { id: "d4", name: "Tofu", servingSize: "100g", calories: 76, protein: 8, carbs: 2, fats: 4 },
  { id: "d5", name: "Whey Protein (Standard)", servingSize: "1 scoop (30g)", calories: 120, protein: 24, carbs: 3, fats: 1.5 },

  // --- NON-VEG (RAW MEAT) ---
  { id: "m1", name: "Chicken Breast (Boneless)", servingSize: "100g", calories: 120, protein: 23, carbs: 0, fats: 2 },
  { id: "m2", name: "Chicken Thigh (Boneless)", servingSize: "100g", calories: 160, protein: 20, carbs: 0, fats: 9 },
  { id: "m3", name: "Chicken Curry Cut (Skinless)", servingSize: "100g", calories: 140, protein: 20, carbs: 0, fats: 6 },
  { id: "m4", name: "Egg (Whole)", servingSize: "1 large (50g)", calories: 72, protein: 6, carbs: 0.5, fats: 5 },
  { id: "m5", name: "Egg White", servingSize: "1 large", calories: 17, protein: 3.5, carbs: 0.2, fats: 0 },
  { id: "m6", name: "Fish (Rohu/Indian Carp)", servingSize: "100g", calories: 100, protein: 19, carbs: 0, fats: 2.5 },
  { id: "m7", name: "Fish (Salmon)", servingSize: "100g", calories: 208, protein: 20, carbs: 0, fats: 13 },
  { id: "m8", name: "Mutton (Goat)", servingSize: "100g", calories: 143, protein: 25, carbs: 0, fats: 4 },
  { id: "m9", name: "Prawns", servingSize: "100g", calories: 85, protein: 17, carbs: 0, fats: 1 },

  // --- VEGETABLES (RAW) ---
  { id: "v1", name: "Potato", servingSize: "100g", calories: 77, protein: 2, carbs: 17, fats: 0.1 },
  { id: "v2", name: "Onion", servingSize: "100g", calories: 40, protein: 1.1, carbs: 9, fats: 0.1 },
  { id: "v3", name: "Tomato", servingSize: "100g", calories: 18, protein: 0.9, carbs: 3.9, fats: 0.2 },
  { id: "v4", name: "Spinach (Palak)", servingSize: "100g", calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4 },
  { id: "v5", name: "Bhindi (Okra)", servingSize: "100g", calories: 33, protein: 1.9, carbs: 7.5, fats: 0.2 },
  { id: "v6", name: "Cauliflower", servingSize: "100g", calories: 25, protein: 1.9, carbs: 5, fats: 0.3 },
  { id: "v7", name: "Broccoli", servingSize: "100g", calories: 34, protein: 2.8, carbs: 7, fats: 0.4 },
  { id: "v8", name: "Carrot", servingSize: "100g", calories: 41, protein: 0.9, carbs: 10, fats: 0.2 },
  { id: "v9", name: "Bottle Gourd (Lauki)", servingSize: "100g", calories: 15, protein: 0.6, carbs: 3.6, fats: 0.1 },

  // --- FATS & NUTS ---
  { id: "f1", name: "Ghee", servingSize: "1 tsp (5ml)", calories: 45, protein: 0, carbs: 0, fats: 5 },
  { id: "f2", name: "Olive Oil / Oil", servingSize: "1 tsp (5ml)", calories: 45, protein: 0, carbs: 0, fats: 5 },
  { id: "f3", name: "Almonds", servingSize: "10g (7-8 pcs)", calories: 60, protein: 2, carbs: 2, fats: 5 },
  { id: "f4", name: "Peanuts", servingSize: "10g", calories: 56, protein: 2.6, carbs: 1.6, fats: 4.9 },
  { id: "f5", name: "Walnuts", servingSize: "10g", calories: 65, protein: 1.5, carbs: 1.4, fats: 6.5 },

  // --- PREPARED ITEMS (Standard Approximations) ---
  { id: "p1", name: "Idli", servingSize: "1 piece (40g)", calories: 35, protein: 1, carbs: 7, fats: 0.2 },
  { id: "p2", name: "Dosa (Plain)", servingSize: "1 medium", calories: 133, protein: 3, carbs: 22, fats: 4 },
  { id: "p3", name: "Chapati/Roti", servingSize: "1 medium (30g flour)", calories: 104, protein: 3, carbs: 20, fats: 0.5 },
  { id: "p4", name: "Bread (Whole Wheat)", servingSize: "1 slice", calories: 77, protein: 3, carbs: 14, fats: 1 },
];

export const ACTIVITY_MULTIPLIERS = {
  [ActivityLevel.SEDENTARY]: 1.35,
  [ActivityLevel.LIGHT]: 1.55,
  [ActivityLevel.MODERATE]: 1.725,
  [ActivityLevel.VERY_ACTIVE]: 1.9
};