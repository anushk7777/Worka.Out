import React, { useState } from 'react';
import { RECIPES, SUPPLEMENTS_DATA, FOOD_DATABASE } from '../constants';

type Tab = 'recipes' | 'supplements' | 'foods';

const Library: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('recipes');
  const [searchTerm, setSearchTerm] = useState('');

  const filterData = (data: any[], keys: string[]) => {
    return data.filter(item => 
      keys.some(key => 
        String(item[key]).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  };

  const filteredRecipes = filterData(RECIPES, ['name', 'tags']);
  const filteredSupplements = filterData(SUPPLEMENTS_DATA, ['name', 'category']);
  const filteredFoods = filterData(FOOD_DATABASE, ['name']);

  return (
    <div className="p-4 pb-24 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-primary">WorkA.out Library</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex space-x-2 mb-6 bg-secondary p-1 rounded-lg border border-gray-700">
        {(['recipes', 'supplements', 'foods'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearchTerm(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-md capitalize transition-colors ${
              activeTab === tab 
                ? 'bg-primary text-dark' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <i className="fas fa-search absolute left-3 top-3 text-gray-500"></i>
        <input 
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-secondary border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white focus:border-primary outline-none"
        />
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === 'recipes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRecipes.map((recipe) => (
              <div key={recipe.id} className="bg-secondary rounded-xl overflow-hidden border border-gray-700 flex flex-col">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white">{recipe.name}</h3>
                    <span className="text-primary font-bold text-sm whitespace-nowrap">{recipe.calories} kcal</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {recipe.tags.map(tag => (
                      <span key={tag} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded border border-gray-700">{tag}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center bg-dark rounded p-2 mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Protein</div>
                      <div className="font-bold text-blue-400">{recipe.protein}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Carbs</div>
                      <div className="font-bold text-green-400">{recipe.carbs}g</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Fats</div>
                      <div className="font-bold text-yellow-400">{recipe.fats}g</div>
                    </div>
                  </div>
                  <button 
                    className="w-full text-xs text-gray-400 hover:text-white underline text-left"
                    onClick={() => alert(`Ingredients:\n${recipe.ingredients.join(', ')}\n\nProcedure:\n${recipe.procedure.join('\n')}`)}
                  >
                    View Ingredients & Procedure
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'supplements' && (
          <div className="space-y-3">
            {filteredSupplements.map((supp) => (
              <div key={supp.id} className="bg-secondary p-4 rounded-xl border border-gray-700">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-white text-lg">{supp.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${
                    supp.tier === 'TIER 1' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {supp.tier}
                  </span>
                </div>
                <div className="text-primary text-sm font-semibold mb-2">{supp.category}</div>
                <div className="text-sm text-gray-300 mb-2">
                  <span className="text-gray-500">Dosage:</span> {supp.dosage}
                </div>
                <p className="text-xs text-gray-400 italic">"{supp.mechanism}"</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'foods' && (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 uppercase px-4 mb-2">
              <div className="col-span-5">Food</div>
              <div className="col-span-2 text-right">Cal</div>
              <div className="col-span-5 text-right">P / C / F</div>
            </div>
            {filteredFoods.map((food) => (
              <div key={food.id} className="bg-secondary p-3 rounded-lg border border-gray-700 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <div className="font-bold text-white text-sm truncate">{food.name}</div>
                  <div className="text-xs text-gray-500">{food.servingSize}</div>
                </div>
                <div className="col-span-2 text-right text-white font-mono">{food.calories}</div>
                <div className="col-span-5 text-right text-xs font-mono text-gray-400">
                  <span className="text-blue-400">{food.protein}</span> / <span className="text-green-400">{food.carbs}</span> / <span className="text-yellow-400">{food.fats}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;