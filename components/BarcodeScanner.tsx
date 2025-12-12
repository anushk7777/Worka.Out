import React, { useEffect, useState } from 'react';

interface Props {
  onScanSuccess: (foodData: any) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<Props> = ({ onScanSuccess, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    const startScanner = async () => {
      try {
        // @ts-ignore - html5-qrcode loaded via script tag
        const html5QrcodeScanner = new window.Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        html5QrcodeScanner.render(async (decodedText: string) => {
          html5QrcodeScanner.clear();
          setScanning(false);
          await fetchProductData(decodedText);
        }, (errorMessage: string) => {
          // parse error, ignore
        });
      } catch (e) {
        setError("Could not initialize camera.");
      }
    };

    startScanner();
  }, []);

  const fetchProductData = async (barcode: string) => {
    try {
      // Use OpenFoodFacts API (Free, excellent for Indian products)
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();

      if (data.status === 1) {
        const p = data.product;
        // Normalize Data
        const foodItem = {
          name: p.product_name || "Unknown Product",
          servingSize: p.serving_size || "100g",
          calories: Math.round(p.nutriments?.['energy-kcal_100g'] || 0),
          protein: Math.round(p.nutriments?.proteins_100g || 0),
          carbs: Math.round(p.nutriments?.carbohydrates_100g || 0),
          fats: Math.round(p.nutriments?.fat_100g || 0),
          brand: p.brands || ""
        };
        onScanSuccess(foodItem);
      } else {
        setError("Product not found in database.");
        setTimeout(onClose, 2000);
      }
    } catch (err) {
      setError("Network error fetching product.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[80] p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-secondary rounded-2xl overflow-hidden shadow-2xl border border-primary/20">
        <div className="p-4 bg-dark/50 flex justify-between items-center">
            <h3 className="text-white font-bold flex items-center gap-2">
                <i className="fas fa-barcode text-primary"></i> Scan Food
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
        </div>
        
        <div className="p-4">
            {scanning && <div id="reader" className="rounded-xl overflow-hidden"></div>}
            
            {!scanning && !error && (
                <div className="text-center py-8">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white text-sm">Fetching Nutrition Data...</p>
                </div>
            )}

            {error && (
                <div className="text-center py-8 text-red-400">
                    <i className="fas fa-exclamation-circle text-3xl mb-2"></i>
                    <p>{error}</p>
                </div>
            )}
        </div>
        
        <div className="p-4 bg-white/5 text-center">
            <p className="text-[10px] text-gray-500">
                Point camera at barcode. Works with most Indian packaged foods (Biscuits, Chips, Protein Bars).
            </p>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;