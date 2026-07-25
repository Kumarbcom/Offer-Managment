import React, { useState, useRef } from 'react';
import { extractRequirementsFromText, extractRequirementsFromImage } from '../utils/aiService';
import { matchProducts } from '../utils/productMatcher';
import type { Product, QuotationItem } from '../types';

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  allProducts: Product[];
  onItemsExtracted: (items: Partial<QuotationItem>[]) => void;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({ isOpen, onClose, allProducts, onItemsExtracted }) => {
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processExtractedData = (extractedReqs: any[]) => {
    const matched = matchProducts(extractedReqs, allProducts);
    
    const newItems = matched.map(match => {
      if (match.matchedProduct) {
        const product = match.matchedProduct;
        return {
          partNo: product.partNo,
          description: product.description,
          uom: product.uom || 'Mtr',
          moq: product.moq || 1,
          req: match.requestedQuantity || 1,
          price: (product.prices && product.prices.length > 0) ? (product.prices[0].lp || product.prices[0].sp || 0) : 0,
          discount: 0,
          priceSource: (product.prices && product.prices.length > 0 && product.prices[0].lp > 0) ? 'LP' : 'SP',
          stockStatus: 'N/A'
        } as Partial<QuotationItem>;
      } else {
        // Unrecognized item
        return {
          partNo: '',
          description: match.originalDescription,
          uom: 'Mtr',
          moq: 1,
          req: match.requestedQuantity || 1,
          price: 0,
          discount: 0,
          priceSource: 'LP',
          stockStatus: ''
        } as Partial<QuotationItem>;
      }
    });

    onItemsExtracted(newItems);
    onClose();
  };

  const handleProcessText = async () => {
    if (!textInput.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const results = await extractRequirementsFromText(textInput);
      processExtractedData(results);
    } catch (err: any) {
      setError(err.message || 'Failed to process text.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const results = await extractRequirementsFromImage(file);
      processExtractedData(results);
    } catch (err: any) {
      setError(err.message || 'Failed to process image.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setIsProcessing(true);
          setError(null);
          extractRequirementsFromImage(file)
            .then(processExtractedData)
            .catch(err => setError(err.message || 'Failed to process pasted image.'))
            .finally(() => setIsProcessing(false));
          return;
        }
      }
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l border-indigo-100 z-50 flex flex-col font-sans transition-transform transform translate-x-0">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex justify-between items-center shadow-md">
        <h2 className="text-white font-bold flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
          </svg>
          AI Assistant
        </h2>
        <button onClick={onClose} className="text-white hover:text-indigo-200">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" onPaste={handlePaste}>
        <p className="text-xs text-slate-500 bg-indigo-50 p-2 rounded border border-indigo-100">
          Paste text or an image anywhere in this panel, or use the inputs below. The AI will extract parts and quantities.
        </p>

        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-700">Paste Text / Email:</label>
          <textarea
            className="w-full h-32 text-xs p-2 border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="e.g. Please quote LIYY 2X0.5 qty 500"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
          />
          <button 
            onClick={handleProcessText}
            disabled={isProcessing || !textInput.trim()}
            className="w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Extract from Text'}
          </button>
        </div>

        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-2 text-slate-400 text-xs font-medium">OR</span>
            <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-700">Upload Image / Screenshot:</label>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            disabled={isProcessing}
          />
          {isProcessing && <p className="text-xs text-indigo-600 font-semibold animate-pulse text-center mt-2">AI is analyzing image...</p>}
        </div>
      </div>
    </div>
  );
};
