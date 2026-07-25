import Fuse from 'fuse.js';
import type { Product } from '../types';

export interface MatchResult {
  originalDescription: string;
  matchedProduct: Product | null;
  requestedQuantity: number | undefined;
}

/**
 * Uses exact matching for partNo first, then falls back to fuzzy searching descriptions.
 */
export function matchProducts(
  extractedRequirements: { partNo?: string; description: string; quantity?: number }[],
  allProducts: Product[]
): MatchResult[] {
  
  // Setup Fuse.js for fuzzy searching the product list if partNo fails
  const fuseOptions = {
    threshold: 0.4,
    keys: [
      { name: 'partNo', weight: 1.0 },
      { name: 'description', weight: 1.5 }
    ]
  };

  const fuse = new Fuse(allProducts, fuseOptions);

  return extractedRequirements.map(req => {
    let matchedProduct: Product | null = null;

    // 1. Try Exact Match on PartNo first
    if (req.partNo) {
      const exactMatch = allProducts.find(p => p.partNo === req.partNo);
      if (exactMatch) {
        matchedProduct = exactMatch;
      }
    }

    // 2. Fallback to Fuzzy Search
    if (!matchedProduct) {
      const searchTerm = req.partNo ? `${req.partNo} ${req.description}` : req.description;
      const searchResults = fuse.search(searchTerm);
      if (searchResults.length > 0) {
        matchedProduct = searchResults[0].item;
      }
    }

    return {
      originalDescription: req.description,
      matchedProduct,
      requestedQuantity: req.quantity
    };
  });
}
