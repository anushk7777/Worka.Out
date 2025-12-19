
import { ActivityLevel, Recipe, Supplement, FoodItem } from "./types";

export const SYSTEM_PROMPT = `
You are the "MealMan AI", an elite fitness expert specializing in nutrition and biomechanics.

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

export const MOTIVATIONAL_QUOTES = [
  "Discipline is doing what needs to be done, even if you don't want to do it.",
  "The only bad workout is the one that didn't happen.",
  "Success starts with self-discipline.",
  "Your body can stand almost anything. It’s your mind that you have to convince.",
  "Action is the foundational key to all success.",
  "Don’t count the days, make the days count.",
  "Suffer the pain of discipline, or suffer the pain of regret.",
  "Consistency is what transforms average into excellence.",
  "Motivation gets you going, but discipline keeps you growing.",
  "The hard part isn't getting your body in shape. The hard part is getting your mind in shape."
];

export const RECIPES: Recipe[] = [
  // ... (Keeping existing recipes)
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

// --- EXPANDED FOOD DATABASE (Standardized to 100g/ml or 1 unit) ---
export const FOOD_DATABASE: FoodItem[] = [
  // ==========================================
  // 1. RAW GRAINS & FLOURS (Ingredients)
  // ==========================================
  { id: "g1", name: "Atta (Wheat Flour Raw)", type: "solid", base_amount: 100, calories: 340, protein: 13, carbs: 72, fats: 2.5, category: "Grains" },
  { id: "g2", name: "Rice (White Raw)", type: "solid", base_amount: 100, calories: 345, protein: 6.8, carbs: 78, fats: 0.5, category: "Grains" },
  { id: "g3", name: "Basmati Rice (Raw)", type: "solid", base_amount: 100, calories: 350, protein: 8, carbs: 77, fats: 0.5, category: "Grains" },
  { id: "g4", name: "Brown Rice (Raw)", type: "solid", base_amount: 100, calories: 360, protein: 7.5, carbs: 76, fats: 3, category: "Grains" },
  { id: "g5", name: "Oats (Rolled Raw)", type: "solid", base_amount: 100, calories: 389, protein: 16.9, carbs: 66, fats: 6.9, category: "Grains" },
  { id: "g6", name: "Besan (Gram Flour)", type: "solid", base_amount: 100, calories: 387, protein: 22, carbs: 58, fats: 7, category: "Grains" },
  { id: "g7", name: "Rava / Sooji (Semolina)", type: "solid", base_amount: 100, calories: 360, protein: 12, carbs: 72, fats: 1, category: "Grains" },
  { id: "g8", name: "Poha (Flattened Rice Raw)", type: "solid", base_amount: 100, calories: 346, protein: 6.6, carbs: 77, fats: 1.2, category: "Grains" },
  { id: "g9", name: "Quinoa (Raw)", type: "solid", base_amount: 100, calories: 368, protein: 14, carbs: 64, fats: 6, category: "Grains" },
  { id: "g10", name: "Dalia (Broken Wheat Raw)", type: "solid", base_amount: 100, calories: 340, protein: 12, carbs: 71, fats: 1.5, category: "Grains" },
  { id: "g11", name: "Maida (Refined Flour)", type: "solid", base_amount: 100, calories: 364, protein: 10, carbs: 76, fats: 1, category: "Grains" },
  { id: "g12", name: "Bajra (Pearl Millet Raw)", type: "solid", base_amount: 100, calories: 361, protein: 12, carbs: 67, fats: 5, category: "Grains" },
  { id: "g13", name: "Jowar (Sorghum Raw)", type: "solid", base_amount: 100, calories: 349, protein: 10, carbs: 72, fats: 3, category: "Grains" },
  { id: "g14", name: "Ragi (Finger Millet Raw)", type: "solid", base_amount: 100, calories: 328, protein: 7, carbs: 72, fats: 1.3, category: "Grains" },
  { id: "g15", name: "Sabudana (Tapioca Pearls Raw)", type: "solid", base_amount: 100, calories: 351, protein: 0.2, carbs: 87, fats: 0.2, category: "Grains" },
  { id: "g16", name: "Vermicelli (Raw)", type: "solid", base_amount: 100, calories: 330, protein: 10, carbs: 70, fats: 1, category: "Grains" },

  // ==========================================
  // 2. RAW PULSES & LEGUMES (Ingredients)
  // ==========================================
  { id: "l1", name: "Moong Dal (Yellow Raw)", type: "solid", base_amount: 100, calories: 348, protein: 24, carbs: 60, fats: 1.2, category: "Pulses" },
  { id: "l2", name: "Moong Dal (Green Whole Raw)", type: "solid", base_amount: 100, calories: 334, protein: 24, carbs: 59, fats: 1.3, category: "Pulses" },
  { id: "l3", name: "Toor Dal (Arhar Raw)", type: "solid", base_amount: 100, calories: 343, protein: 22, carbs: 60, fats: 1.5, category: "Pulses" },
  { id: "l4", name: "Masoor Dal (Red Raw)", type: "solid", base_amount: 100, calories: 340, protein: 24, carbs: 60, fats: 1, category: "Pulses" },
  { id: "l5", name: "Urad Dal (Black/White Raw)", type: "solid", base_amount: 100, calories: 350, protein: 24, carbs: 59, fats: 1.6, category: "Pulses" },
  { id: "l6", name: "Chana Dal (Raw)", type: "solid", base_amount: 100, calories: 372, protein: 20, carbs: 59, fats: 5.6, category: "Pulses" },
  { id: "l7", name: "Rajma (Kidney Beans Raw)", type: "solid", base_amount: 100, calories: 333, protein: 24, carbs: 60, fats: 1, category: "Pulses" },
  { id: "l8", name: "Chickpeas (Kabuli Chana Raw)", type: "solid", base_amount: 100, calories: 360, protein: 19, carbs: 61, fats: 6, category: "Pulses" },
  { id: "l9", name: "Kala Chana (Black Chickpeas Raw)", type: "solid", base_amount: 100, calories: 360, protein: 20, carbs: 62, fats: 5, category: "Pulses" },
  { id: "l10", name: "Soya Chunks (Raw)", type: "solid", base_amount: 100, calories: 345, protein: 52, carbs: 33, fats: 0.5, category: "Pulses" },
  { id: "l11", name: "Lobia (Black Eyed Peas Raw)", type: "solid", base_amount: 100, calories: 336, protein: 24, carbs: 60, fats: 1, category: "Pulses" },
  { id: "l12", name: "Matar (Dried White Peas Raw)", type: "solid", base_amount: 100, calories: 340, protein: 20, carbs: 60, fats: 1, category: "Pulses" },

  // ==========================================
  // 3. COOKED DALS & CURRIES (Ready to Eat)
  // ==========================================
  { id: "cd1", name: "Moong Dal (Cooked Plain)", type: "solid", base_amount: 100, calories: 105, protein: 7, carbs: 18, fats: 1, category: "Cooked Dals" },
  { id: "cd2", name: "Moong Dal Tadka", type: "solid", base_amount: 100, calories: 140, protein: 7, carbs: 18, fats: 5, category: "Cooked Dals" },
  { id: "cd3", name: "Toor Dal (Cooked Plain)", type: "solid", base_amount: 100, calories: 110, protein: 6, carbs: 18, fats: 1, category: "Cooked Dals" },
  { id: "cd4", name: "Dal Fry (Toor/Arhar)", type: "solid", base_amount: 100, calories: 150, protein: 6, carbs: 19, fats: 7, category: "Cooked Dals" },
  { id: "cd5", name: "Masoor Dal (Cooked)", type: "solid", base_amount: 100, calories: 115, protein: 7, carbs: 19, fats: 2, category: "Cooked Dals" },
  { id: "cd6", name: "Dal Makhani", type: "solid", base_amount: 100, calories: 280, protein: 9, carbs: 25, fats: 18, category: "Cooked Dals" },
  { id: "cd7", name: "Chana Masala (Cooked)", type: "solid", base_amount: 100, calories: 165, protein: 7, carbs: 20, fats: 6, category: "Cooked Dals" },
  { id: "cd8", name: "Rajma Masala (Cooked)", type: "solid", base_amount: 100, calories: 140, protein: 6, carbs: 18, fats: 5, category: "Cooked Dals" },
  { id: "cd9", name: "Kala Chana Curry", type: "solid", base_amount: 100, calories: 150, protein: 7, carbs: 22, fats: 4, category: "Cooked Dals" },
  { id: "cd10", name: "Sambar", type: "solid", base_amount: 100, calories: 85, protein: 4, carbs: 13, fats: 2, category: "Cooked Dals" },
  { id: "cd11", name: "Kadhi Pakora", type: "solid", base_amount: 100, calories: 140, protein: 4, carbs: 12, fats: 8, category: "Cooked Dals" },
  { id: "cd12", name: "Chole (Chickpea Curry)", type: "solid", base_amount: 100, calories: 220, protein: 8, carbs: 30, fats: 9, category: "Cooked Dals" },
  { id: "cd13", name: "Lobia Curry", type: "solid", base_amount: 100, calories: 130, protein: 7, carbs: 18, fats: 4, category: "Cooked Dals" },
  { id: "cd14", name: "Panchmel Dal", type: "solid", base_amount: 100, calories: 160, protein: 8, carbs: 20, fats: 6, category: "Cooked Dals" },

  // ==========================================
  // 4. COOKED SABZIS (VEGETABLES)
  // ==========================================
  { id: "sab1", name: "Aloo Gobi (Dry)", type: "solid", base_amount: 100, calories: 120, protein: 2, carbs: 15, fats: 6, category: "Sabzi" },
  { id: "sab2", name: "Aloo Matar (Gravy)", type: "solid", base_amount: 100, calories: 130, protein: 3, carbs: 18, fats: 5, category: "Sabzi" },
  { id: "sab3", name: "Bhindi Masala / Fry", type: "solid", base_amount: 100, calories: 160, protein: 3, carbs: 10, fats: 12, category: "Sabzi" },
  { id: "sab4", name: "Jeera Aloo", type: "solid", base_amount: 100, calories: 150, protein: 2, carbs: 22, fats: 6, category: "Sabzi" },
  { id: "sab5", name: "Baingan Bharta", type: "solid", base_amount: 100, calories: 110, protein: 2, carbs: 12, fats: 6, category: "Sabzi" },
  { id: "sab6", name: "Mix Veg", type: "solid", base_amount: 100, calories: 140, protein: 3, carbs: 14, fats: 8, category: "Sabzi" },
  { id: "sab7", name: "Palak Paneer", type: "solid", base_amount: 100, calories: 220, protein: 12, carbs: 6, fats: 18, category: "Sabzi" },
  { id: "sab8", name: "Paneer Butter Masala", type: "solid", base_amount: 100, calories: 350, protein: 12, carbs: 15, fats: 28, category: "Sabzi" },
  { id: "sab9", name: "Matar Paneer", type: "solid", base_amount: 100, calories: 240, protein: 10, carbs: 12, fats: 16, category: "Sabzi" },
  { id: "sab10", name: "Kadai Paneer", type: "solid", base_amount: 100, calories: 280, protein: 14, carbs: 8, fats: 22, category: "Sabzi" },
  { id: "sab11", name: "Lauki Ki Sabzi (Bottle Gourd)", type: "solid", base_amount: 100, calories: 70, protein: 1, carbs: 8, fats: 4, category: "Sabzi" },
  { id: "sab12", name: "Cabbage Sabzi (Patta Gobi)", type: "solid", base_amount: 100, calories: 90, protein: 2, carbs: 8, fats: 6, category: "Sabzi" },
  { id: "sab13", name: "Gajar Matar", type: "solid", base_amount: 100, calories: 100, protein: 3, carbs: 12, fats: 5, category: "Sabzi" },
  { id: "sab14", name: "Karela Fry (Bitter Gourd)", type: "solid", base_amount: 100, calories: 180, protein: 3, carbs: 15, fats: 12, category: "Sabzi" },
  { id: "sab15", name: "Dum Aloo", type: "solid", base_amount: 100, calories: 190, protein: 3, carbs: 25, fats: 9, category: "Sabzi" },
  { id: "sab16", name: "Sarson Ka Saag", type: "solid", base_amount: 100, calories: 140, protein: 4, carbs: 8, fats: 10, category: "Sabzi" },
  { id: "sab17", name: "Methi Aloo", type: "solid", base_amount: 100, calories: 130, protein: 3, carbs: 16, fats: 6, category: "Sabzi" },
  { id: "sab18", name: "Malai Kofta", type: "solid", base_amount: 100, calories: 320, protein: 6, carbs: 20, fats: 25, category: "Sabzi" },
  { id: "sab19", name: "Shahi Paneer", type: "solid", base_amount: 100, calories: 340, protein: 11, carbs: 18, fats: 25, category: "Sabzi" },
  { id: "sab20", name: "Soyabean Curry", type: "solid", base_amount: 100, calories: 160, protein: 15, carbs: 10, fats: 7, category: "Sabzi" },

  // ==========================================
  // 5. RICE & ROTI VARIATIONS (Ready to Eat)
  // ==========================================
  { id: "cr1", name: "Cooked White Rice", type: "solid", base_amount: 100, calories: 130, protein: 2.7, carbs: 28, fats: 0.3, category: "Rice" },
  { id: "cr2", name: "Cooked Brown Rice", type: "solid", base_amount: 100, calories: 111, protein: 2.6, carbs: 23, fats: 0.9, category: "Rice" },
  { id: "cr3", name: "Jeera Rice", type: "solid", base_amount: 100, calories: 150, protein: 3, carbs: 28, fats: 4, category: "Rice" },
  { id: "cr4", name: "Veg Pulao", type: "solid", base_amount: 100, calories: 160, protein: 4, carbs: 30, fats: 3, category: "Rice" },
  { id: "cr5", name: "Veg Biryani", type: "solid", base_amount: 100, calories: 180, protein: 5, carbs: 32, fats: 6, category: "Rice" },
  { id: "cr6", name: "Curd Rice", type: "solid", base_amount: 100, calories: 140, protein: 4, carbs: 20, fats: 5, category: "Rice" },
  { id: "cr7", name: "Khichdi (Moong Dal)", type: "solid", base_amount: 100, calories: 130, protein: 5, carbs: 22, fats: 3, category: "Rice" },
  { id: "cr8", name: "Chicken Biryani", type: "solid", base_amount: 100, calories: 220, protein: 10, carbs: 25, fats: 8, category: "Rice" },
  { id: "cr9", name: "Lemon Rice", type: "solid", base_amount: 100, calories: 170, protein: 3, carbs: 30, fats: 5, category: "Rice" },
  { id: "cr10", name: "Fried Rice (Veg)", type: "solid", base_amount: 100, calories: 180, protein: 3, carbs: 35, fats: 4, category: "Rice" },

  { id: "ro1", name: "Roti / Phulka (Medium)", type: "unit", base_amount: 1, calories: 80, protein: 2.5, carbs: 15, fats: 0.5, category: "Breads" },
  { id: "ro2", name: "Roti with Ghee", type: "unit", base_amount: 1, calories: 120, protein: 2.5, carbs: 15, fats: 5, category: "Breads" },
  { id: "ro3", name: "Paratha (Plain)", type: "unit", base_amount: 1, calories: 180, protein: 4, carbs: 28, fats: 7, category: "Breads" },
  { id: "ro4", name: "Aloo Paratha", type: "unit", base_amount: 1, calories: 280, protein: 6, carbs: 40, fats: 10, category: "Breads" },
  { id: "ro5", name: "Paneer Paratha", type: "unit", base_amount: 1, calories: 310, protein: 12, carbs: 35, fats: 13, category: "Breads" },
  { id: "ro6", name: "Gobi Paratha", type: "unit", base_amount: 1, calories: 260, protein: 6, carbs: 38, fats: 9, category: "Breads" },
  { id: "ro7", name: "Naan (Plain)", type: "unit", base_amount: 1, calories: 260, protein: 8, carbs: 45, fats: 5, category: "Breads" },
  { id: "ro8", name: "Butter Naan", type: "unit", base_amount: 1, calories: 330, protein: 8, carbs: 45, fats: 12, category: "Breads" },
  { id: "ro9", name: "Tandoori Roti", type: "unit", base_amount: 1, calories: 110, protein: 3, carbs: 22, fats: 1, category: "Breads" },
  { id: "ro10", name: "Missi Roti", type: "unit", base_amount: 1, calories: 140, protein: 5, carbs: 20, fats: 4, category: "Breads" },
  { id: "ro11", name: "Bajra Roti", type: "unit", base_amount: 1, calories: 115, protein: 3, carbs: 20, fats: 2, category: "Breads" },
  { id: "ro12", name: "Jowar Roti", type: "unit", base_amount: 1, calories: 100, protein: 3, carbs: 20, fats: 1, category: "Breads" },
  { id: "ro13", name: "Makki Ki Roti", type: "unit", base_amount: 1, calories: 160, protein: 3, carbs: 25, fats: 5, category: "Breads" },
  { id: "ro14", name: "Bhatura", type: "unit", base_amount: 1, calories: 280, protein: 6, carbs: 40, fats: 11, category: "Breads" },
  { id: "ro15", name: "Kulcha (Plain)", type: "unit", base_amount: 1, calories: 200, protein: 6, carbs: 35, fats: 3, category: "Breads" },
  { id: "ro16", name: "Puri (Fried)", type: "unit", base_amount: 1, calories: 101, protein: 2, carbs: 12, fats: 5, category: "Breads" },
  { id: "ro17", name: "Thepla", type: "unit", base_amount: 1, calories: 140, protein: 4, carbs: 20, fats: 5, category: "Breads" },

  // ==========================================
  // 6. NON-VEG (COOKED)
  // ==========================================
  { id: "nv1", name: "Chicken Curry (Home Style)", type: "solid", base_amount: 100, calories: 160, protein: 16, carbs: 4, fats: 9, category: "Non-Veg" },
  { id: "nv2", name: "Butter Chicken", type: "solid", base_amount: 100, calories: 240, protein: 14, carbs: 8, fats: 16, category: "Non-Veg" },
  { id: "nv3", name: "Chicken Tikka Masala", type: "solid", base_amount: 100, calories: 180, protein: 18, carbs: 6, fats: 9, category: "Non-Veg" },
  { id: "nv4", name: "Chicken Tandoori (1 Pc)", type: "unit", base_amount: 1, calories: 220, protein: 25, carbs: 2, fats: 12, category: "Non-Veg" },
  { id: "nv5", name: "Grilled Chicken Breast", type: "solid", base_amount: 100, calories: 165, protein: 31, carbs: 0, fats: 3.6, category: "Non-Veg" },
  { id: "nv6", name: "Egg Curry (2 Eggs)", type: "unit", base_amount: 1, calories: 260, protein: 14, carbs: 8, fats: 18, category: "Non-Veg" },
  { id: "nv7", name: "Omelette (2 Eggs)", type: "unit", base_amount: 1, calories: 220, protein: 14, carbs: 2, fats: 18, category: "Non-Veg" },
  { id: "nv8", name: "Egg Bhurji (2 Eggs)", type: "unit", base_amount: 1, calories: 240, protein: 14, carbs: 4, fats: 19, category: "Non-Veg" },
  { id: "nv9", name: "Boiled Egg (Whole)", type: "unit", base_amount: 1, calories: 72, protein: 6, carbs: 0.5, fats: 5, category: "Non-Veg" },
  { id: "nv10", name: "Fish Curry", type: "solid", base_amount: 100, calories: 150, protein: 15, carbs: 3, fats: 8, category: "Non-Veg" },
  { id: "nv11", name: "Fish Fry (1 Pc)", type: "unit", base_amount: 1, calories: 200, protein: 18, carbs: 5, fats: 12, category: "Non-Veg" },
  { id: "nv12", name: "Mutton Curry", type: "solid", base_amount: 100, calories: 210, protein: 16, carbs: 4, fats: 14, category: "Non-Veg" },
  { id: "nv13", name: "Keema (Mutton)", type: "solid", base_amount: 100, calories: 250, protein: 18, carbs: 3, fats: 18, category: "Non-Veg" },
  { id: "nv14", name: "Chilli Chicken", type: "solid", base_amount: 100, calories: 200, protein: 15, carbs: 12, fats: 10, category: "Non-Veg" },

  // ==========================================
  // 7. STREET FOOD & SNACKS
  // ==========================================
  { id: "sf1", name: "Samosa", type: "unit", base_amount: 1, calories: 260, protein: 4, carbs: 25, fats: 17, category: "Snacks" },
  { id: "sf2", name: "Vada Pav", type: "unit", base_amount: 1, calories: 300, protein: 6, carbs: 40, fats: 12, category: "Snacks" },
  { id: "sf3", name: "Pani Puri / Golgappa (6 pcs)", type: "unit", base_amount: 1, calories: 220, protein: 4, carbs: 35, fats: 8, category: "Snacks" },
  { id: "sf4", name: "Bhel Puri", type: "unit", base_amount: 1, calories: 250, protein: 6, carbs: 45, fats: 5, category: "Snacks" },
  { id: "sf5", name: "Pav Bhaji (2 Pav + Bhaji)", type: "unit", base_amount: 1, calories: 550, protein: 12, carbs: 70, fats: 25, category: "Snacks" },
  { id: "sf6", name: "Idli", type: "unit", base_amount: 1, calories: 35, protein: 1, carbs: 8, fats: 0, category: "Snacks" },
  { id: "sf7", name: "Medu Vada", type: "unit", base_amount: 1, calories: 140, protein: 4, carbs: 12, fats: 8, category: "Snacks" },
  { id: "sf8", name: "Dosa (Plain)", type: "unit", base_amount: 1, calories: 133, protein: 4, carbs: 22, fats: 3, category: "Snacks" },
  { id: "sf9", name: "Masala Dosa", type: "unit", base_amount: 1, calories: 350, protein: 6, carbs: 45, fats: 16, category: "Snacks" },
  { id: "sf10", name: "Dhokla (1 Pc)", type: "unit", base_amount: 1, calories: 80, protein: 2, carbs: 10, fats: 3, category: "Snacks" },
  { id: "sf11", name: "Kachori", type: "unit", base_amount: 1, calories: 280, protein: 5, carbs: 28, fats: 16, category: "Snacks" },
  { id: "sf12", name: "Aloo Tikki", type: "unit", base_amount: 1, calories: 150, protein: 2, carbs: 20, fats: 7, category: "Snacks" },
  { id: "sf13", name: "Momos (Steamed - 6pcs)", type: "unit", base_amount: 1, calories: 210, protein: 6, carbs: 35, fats: 4, category: "Snacks" },
  { id: "sf14", name: "Maggi Noodles (1 Pack Cooked)", type: "unit", base_amount: 1, calories: 310, protein: 7, carbs: 42, fats: 13, category: "Snacks" },
  { id: "sf15", name: "Sandwich (Veg Grilled)", type: "unit", base_amount: 1, calories: 250, protein: 8, carbs: 35, fats: 8, category: "Snacks" },
  { id: "sf16", name: "Upma", type: "solid", base_amount: 100, calories: 190, protein: 4, carbs: 30, fats: 6, category: "Snacks" },
  { id: "sf17", name: "Poha (Cooked)", type: "solid", base_amount: 100, calories: 180, protein: 3, carbs: 35, fats: 5, category: "Snacks" },
  { id: "sf18", name: "Pakora (Veg/Onion - 1 Pc)", type: "unit", base_amount: 1, calories: 75, protein: 1, carbs: 8, fats: 5, category: "Snacks" },
  { id: "sf19", name: "Papdi Chaat", type: "unit", base_amount: 1, calories: 350, protein: 8, carbs: 45, fats: 15, category: "Snacks" },
  { id: "sf20", name: "Burger (Veg)", type: "unit", base_amount: 1, calories: 350, protein: 10, carbs: 45, fats: 14, category: "Snacks" },

  // ==========================================
  // 8. DAIRY (Raw & Products)
  // ==========================================
  { id: "d1", name: "Milk (Cow/Toned)", type: "liquid", base_amount: 100, calories: 60, protein: 3, carbs: 4.7, fats: 3, category: "Dairy" },
  { id: "d2", name: "Milk (Buffalo/Full Cream)", type: "liquid", base_amount: 100, calories: 95, protein: 3.8, carbs: 5, fats: 6.5, category: "Dairy" },
  { id: "d3", name: "Curd (Yogurt)", type: "solid", base_amount: 100, calories: 60, protein: 3.5, carbs: 4.5, fats: 3, category: "Dairy" },
  { id: "d4", name: "Greek Yogurt", type: "solid", base_amount: 100, calories: 60, protein: 10, carbs: 4, fats: 0.4, category: "Dairy" },
  { id: "d5", name: "Paneer (Raw)", type: "solid", base_amount: 100, calories: 265, protein: 18, carbs: 2, fats: 20, category: "Dairy" },
  { id: "d6", name: "Cheese Slice", type: "unit", base_amount: 1, calories: 105, protein: 6, carbs: 1, fats: 9, category: "Dairy" },
  { id: "d7", name: "Butter", type: "solid", base_amount: 100, calories: 717, protein: 0.8, carbs: 0.1, fats: 81, category: "Dairy" },
  { id: "d8", name: "Ghee", type: "solid", base_amount: 100, calories: 900, protein: 0, carbs: 0, fats: 100, category: "Dairy" },
  { id: "d9", name: "Khoa / Mawa", type: "solid", base_amount: 100, calories: 420, protein: 16, carbs: 20, fats: 30, category: "Dairy" },
  { id: "d10", name: "Lassi (Sweet)", type: "liquid", base_amount: 200, calories: 180, protein: 6, carbs: 30, fats: 5, category: "Dairy" },
  { id: "d11", name: "Chaas (Buttermilk)", type: "liquid", base_amount: 200, calories: 40, protein: 2, carbs: 4, fats: 1, category: "Dairy" },
  { id: "d12", name: "Whey Protein Scoop", type: "unit", base_amount: 1, calories: 120, protein: 24, carbs: 3, fats: 1.5, category: "Dairy" },

  // ==========================================
  // 9. FRUITS (Raw)
  // ==========================================
  { id: "fr1", name: "Banana", type: "solid", base_amount: 100, calories: 89, protein: 1.1, carbs: 22.8, fats: 0.3, category: "Fruits" },
  { id: "fr2", name: "Apple", type: "solid", base_amount: 100, calories: 52, protein: 0.3, carbs: 14, fats: 0.2, category: "Fruits" },
  { id: "fr3", name: "Mango", type: "solid", base_amount: 100, calories: 60, protein: 0.8, carbs: 15, fats: 0.4, category: "Fruits" },
  { id: "fr4", name: "Papaya", type: "solid", base_amount: 100, calories: 43, protein: 0.5, carbs: 11, fats: 0.3, category: "Fruits" },
  { id: "fr5", name: "Orange", type: "solid", base_amount: 100, calories: 47, protein: 0.9, carbs: 12, fats: 0.1, category: "Fruits" },
  { id: "fr6", name: "Guava", type: "solid", base_amount: 100, calories: 68, protein: 2.6, carbs: 14, fats: 1, category: "Fruits" },
  { id: "fr7", name: "Watermelon", type: "solid", base_amount: 100, calories: 30, protein: 0.6, carbs: 8, fats: 0.2, category: "Fruits" },
  { id: "fr8", name: "Pomegranate", type: "solid", base_amount: 100, calories: 83, protein: 1.7, carbs: 19, fats: 1.2, category: "Fruits" },
  { id: "fr9", name: "Grapes", type: "solid", base_amount: 100, calories: 67, protein: 0.6, carbs: 17, fats: 0.4, category: "Fruits" },
  { id: "fr10", name: "Mosambi (Sweet Lime)", type: "solid", base_amount: 100, calories: 43, protein: 0.8, carbs: 9, fats: 0.3, category: "Fruits" },
  { id: "fr11", name: "Pineapple", type: "solid", base_amount: 100, calories: 50, protein: 0.5, carbs: 13, fats: 0.1, category: "Fruits" },
  { id: "fr12", name: "Chiku (Sapodilla)", type: "solid", base_amount: 100, calories: 83, protein: 0.4, carbs: 20, fats: 1.1, category: "Fruits" },
  { id: "fr13", name: "Custard Apple (Sitaphal)", type: "solid", base_amount: 100, calories: 94, protein: 2, carbs: 24, fats: 0.3, category: "Fruits" },
  { id: "fr14", name: "Jamun", type: "solid", base_amount: 100, calories: 60, protein: 0.7, carbs: 14, fats: 0.2, category: "Fruits" },
  { id: "fr15", name: "Muskmelon (Kharbuja)", type: "solid", base_amount: 100, calories: 34, protein: 0.8, carbs: 8, fats: 0.2, category: "Fruits" },
  { id: "fr16", name: "Pear", type: "solid", base_amount: 100, calories: 57, protein: 0.4, carbs: 15, fats: 0.1, category: "Fruits" },
  { id: "fr17", name: "Strawberry", type: "solid", base_amount: 100, calories: 32, protein: 0.7, carbs: 7.7, fats: 0.3, category: "Fruits" },
  { id: "fr18", name: "Kiwi", type: "solid", base_amount: 100, calories: 61, protein: 1.1, carbs: 15, fats: 0.5, category: "Fruits" },
  { id: "fr19", name: "Dates (Dried)", type: "solid", base_amount: 100, calories: 282, protein: 2.5, carbs: 75, fats: 0.4, category: "Fruits" },
  { id: "fr20", name: "Raisins", type: "solid", base_amount: 100, calories: 299, protein: 3, carbs: 79, fats: 0.5, category: "Fruits" },

  // ==========================================
  // 10. BEVERAGES
  // ==========================================
  { id: "bev1", name: "Tea / Chai (Milk + Sugar)", type: "liquid", base_amount: 150, calories: 80, protein: 2, carbs: 12, fats: 2, category: "Beverages" },
  { id: "bev2", name: "Tea (Black / Green)", type: "liquid", base_amount: 150, calories: 2, protein: 0, carbs: 0.5, fats: 0, category: "Beverages" },
  { id: "bev3", name: "Coffee (Milk + Sugar)", type: "liquid", base_amount: 150, calories: 90, protein: 2.5, carbs: 12, fats: 3, category: "Beverages" },
  { id: "bev4", name: "Black Coffee", type: "liquid", base_amount: 150, calories: 2, protein: 0, carbs: 0.5, fats: 0, category: "Beverages" },
  { id: "bev5", name: "Coconut Water", type: "liquid", base_amount: 200, calories: 40, protein: 1, carbs: 9, fats: 0, category: "Beverages" },
  { id: "bev6", name: "Sugarcane Juice", type: "liquid", base_amount: 200, calories: 150, protein: 0, carbs: 38, fats: 0, category: "Beverages" },
  { id: "bev7", name: "Cola / Soda", type: "liquid", base_amount: 100, calories: 44, protein: 0, carbs: 11, fats: 0, category: "Beverages" },
  { id: "bev8", name: "Alcohol (Whisky/Vodka)", type: "liquid", base_amount: 30, calories: 65, protein: 0, carbs: 0, fats: 0, category: "Beverages" },
  { id: "bev9", name: "Beer", type: "liquid", base_amount: 330, calories: 150, protein: 1, carbs: 12, fats: 0, category: "Beverages" },
  
  // ==========================================
  // 11. VEGETABLES (RAW Ingredients)
  // ==========================================
  { id: "v1", name: "Potato (Aloo)", type: "solid", base_amount: 100, calories: 77, protein: 2, carbs: 17, fats: 0.1, category: "Veg" },
  { id: "v2", name: "Onion", type: "solid", base_amount: 100, calories: 40, protein: 1.1, carbs: 9, fats: 0.1, category: "Veg" },
  { id: "v3", name: "Tomato", type: "solid", base_amount: 100, calories: 18, protein: 0.9, carbs: 3.9, fats: 0.2, category: "Veg" },
  { id: "v4", name: "Cucumber", type: "solid", base_amount: 100, calories: 15, protein: 0.7, carbs: 3.6, fats: 0.1, category: "Veg" },
  { id: "v5", name: "Spinach (Palak)", type: "solid", base_amount: 100, calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4, category: "Veg" },
  { id: "v6", name: "Okra (Bhindi)", type: "solid", base_amount: 100, calories: 33, protein: 1.9, carbs: 7.5, fats: 0.2, category: "Veg" },
  { id: "v7", name: "Cauliflower (Gobi)", type: "solid", base_amount: 100, calories: 25, protein: 1.9, carbs: 5, fats: 0.3, category: "Veg" },
  { id: "v8", name: "Carrot", type: "solid", base_amount: 100, calories: 41, protein: 0.9, carbs: 10, fats: 0.2, category: "Veg" },
  { id: "v9", name: "Broccoli", type: "solid", base_amount: 100, calories: 34, protein: 2.8, carbs: 7, fats: 0.4, category: "Veg" },
  { id: "v10", name: "Sweet Potato", type: "solid", base_amount: 100, calories: 86, protein: 1.6, carbs: 20, fats: 0.1, category: "Veg" },
  { id: "v11", name: "Cabbage", type: "solid", base_amount: 100, calories: 25, protein: 1.3, carbs: 6, fats: 0.1, category: "Veg" },
  { id: "v12", name: "Eggplant (Baingan)", type: "solid", base_amount: 100, calories: 25, protein: 1, carbs: 6, fats: 0.2, category: "Veg" },
  { id: "v13", name: "Bottle Gourd (Lauki)", type: "solid", base_amount: 100, calories: 15, protein: 0.6, carbs: 3.4, fats: 0.1, category: "Veg" },
  { id: "v14", name: "Bitter Gourd (Karela)", type: "solid", base_amount: 100, calories: 17, protein: 1, carbs: 3.7, fats: 0.2, category: "Veg" },
  { id: "v15", name: "Pumpkin (Kaddu)", type: "solid", base_amount: 100, calories: 26, protein: 1, carbs: 6.5, fats: 0.1, category: "Veg" },
  { id: "v16", name: "Beans (French)", type: "solid", base_amount: 100, calories: 31, protein: 1.8, carbs: 7, fats: 0.2, category: "Veg" },
  { id: "v17", name: "Capsicum", type: "solid", base_amount: 100, calories: 20, protein: 0.9, carbs: 4.6, fats: 0.2, category: "Veg" },
  { id: "v18", name: "Peas (Green Matar)", type: "solid", base_amount: 100, calories: 81, protein: 5, carbs: 14, fats: 0.4, category: "Veg" },
  { id: "v19", name: "Mushroom", type: "solid", base_amount: 100, calories: 22, protein: 3.1, carbs: 3.3, fats: 0.3, category: "Veg" },
  { id: "v20", name: "Lettuce", type: "solid", base_amount: 100, calories: 15, protein: 1.4, carbs: 2.9, fats: 0.2, category: "Veg" },

  // ==========================================
  // 12. NUTS & SEEDS
  // ==========================================
  { id: "nut1", name: "Almonds", type: "solid", base_amount: 100, calories: 579, protein: 21, carbs: 22, fats: 50, category: "Nuts" },
  { id: "nut2", name: "Walnuts", type: "solid", base_amount: 100, calories: 654, protein: 15, carbs: 14, fats: 65, category: "Nuts" },
  { id: "nut3", name: "Cashews", type: "solid", base_amount: 100, calories: 553, protein: 18, carbs: 30, fats: 44, category: "Nuts" },
  { id: "nut4", name: "Peanuts", type: "solid", base_amount: 100, calories: 567, protein: 26, carbs: 16, fats: 49, category: "Nuts" },
  { id: "nut5", name: "Chia Seeds", type: "solid", base_amount: 100, calories: 486, protein: 17, carbs: 42, fats: 31, category: "Nuts" },
  { id: "nut6", name: "Flax Seeds", type: "solid", base_amount: 100, calories: 534, protein: 18, carbs: 29, fats: 42, category: "Nuts" },
  { id: "nut7", name: "Pumpkin Seeds", type: "solid", base_amount: 100, calories: 559, protein: 30, carbs: 10, fats: 49, category: "Nuts" },
  { id: "nut8", name: "Sunflower Seeds", type: "solid", base_amount: 100, calories: 584, protein: 21, carbs: 20, fats: 51, category: "Nuts" },
  { id: "nut9", name: "Pistachios", type: "solid", base_amount: 100, calories: 560, protein: 20, carbs: 27, fats: 45, category: "Nuts" },
  { id: "nut10", name: "Peanut Butter", type: "solid", base_amount: 100, calories: 588, protein: 25, carbs: 20, fats: 50, category: "Spreads" },

  // ==========================================
  // 13. OILS & FATS
  // ==========================================
  { id: "oil1", name: "Cooking Oil (Vegetable)", type: "solid", base_amount: 100, calories: 884, protein: 0, carbs: 0, fats: 100, category: "Fats" },
  { id: "oil2", name: "Olive Oil", type: "solid", base_amount: 100, calories: 884, protein: 0, carbs: 0, fats: 100, category: "Fats" },
  { id: "oil3", name: "Coconut Oil", type: "solid", base_amount: 100, calories: 862, protein: 0, carbs: 0, fats: 100, category: "Fats" },
  { id: "oil4", name: "Mustard Oil", type: "solid", base_amount: 100, calories: 884, protein: 0, carbs: 0, fats: 100, category: "Fats" }
];

export const ACTIVITY_MULTIPLIERS = {
  [ActivityLevel.SEDENTARY]: 1.35,
  [ActivityLevel.LIGHT]: 1.55,
  [ActivityLevel.MODERATE]: 1.725,
  [ActivityLevel.VERY_ACTIVE]: 1.9
};
