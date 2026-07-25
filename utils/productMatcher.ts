import Fuse from 'fuse.js';
import type { Product } from '../types';

export interface MatchResult {
  extractedPartNo: string | undefined;
  originalDescription: string;
  matchedProduct: Product | null;
  requestedQuantity: number | undefined;
}

/**
 * Uses exact matching for partNo first, then falls back to fuzzy searching descriptions.
 */
export async function matchProducts(
  extractedRequirements: { partNo?: string; description: string; quantity?: number }[],
  searchFn: (term: string) => Promise<Product[]>
): Promise<MatchResult[]> {
  
  const results: MatchResult[] = [];

  for (const req of extractedRequirements) {
    let matchedProduct: Product | null = null;

    // 1. Try Exact Match on PartNo first via DB search
    if (req.partNo) {
      const searchResults = await searchFn(req.partNo);
      const exactMatch = searchResults.find(p => p.partNo === req.partNo);
      if (exactMatch) {
        matchedProduct = exactMatch;
      }
    }

    // 2. Fallback to Fuzzy Search via DB search
    if (!matchedProduct) {
      const searchTerm = req.partNo ? `${req.partNo} ${req.description}` : req.description;
      const dbResults = await searchFn(req.description); // Search DB using description to get candidates
      
      const fuseOptions = {
        threshold: 0.4,
        keys: [
          { name: 'partNo', weight: 1.0 },
          { name: 'description', weight: 1.5 }
        ]
      };
      const fuse = new Fuse(dbResults, fuseOptions);
      const searchResults = fuse.search(searchTerm);
      if (searchResults.length > 0) {
        matchedProduct = searchResults[0].item;
      }
    }

    results.push({
      extractedPartNo: req.partNo,
      originalDescription: req.description,
      matchedProduct,
      requestedQuantity: req.quantity
    });
  }

  return results;
}
