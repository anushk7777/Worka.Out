import React from 'react';
import { RECIPES } from '../constants';

const RecipeLibrary: React.FC = () => {
  return (
    <div className="p-4 pb-24">
      <h2 className="text-2xl font-bold text-primary mb-6">ETF Recipe Book</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {RECIPES.map((recipe) => (
          <div key={recipe.id} className="bg-secondary rounded-xl overflow-hidden border border-gray-700 flex flex-col">
            <div className="bg-gray-800 h-32 flex items-center justify-center relative">
               {/* Placeholder for recipe image, using icon for now */}
               <i className="fas fa-utensils text-4xl text-gray-600"></i>
               <span className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded">
                 {recipe.tags[0]}
               </span>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-white">{recipe.name}</h3>
                <span className="text-primary font-bold text-sm">{recipe.calories} kcal</span>
              </div>
              
              <div className="flex gap-2 text-xs text-gray-400 mb-4">
                <span>P: {recipe.protein}g</span>
                <span>C: {recipe.carbs}g</span>
                <span>F: {recipe.fats}g</span>
              </div>

              <div className="mb-4">
                <h4 className="text-xs uppercase font-bold text-gray-500 mb-1">Ingredients</h4>
                <p className="text-sm text-gray-300 line-clamp-2">{recipe.ingredients.join(', ')}</p>
              </div>

              <button className="mt-auto w-full bg-dark hover:bg-gray-800 text-primary border border-primary py-2 rounded text-sm transition-colors"
                onClick={() => alert(`Procedure for ${recipe.name}:\n\n${recipe.procedure.join('\n')}`)}
              >
                View Instructions
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecipeLibrary;
