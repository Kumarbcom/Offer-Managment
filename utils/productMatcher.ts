import Fuse from 'fuse.js';
import type { Product } from '../types';

export interface MatchResult {
  originalDescription: string;
  matchedProduct: Product | null;
  requestedQuantity: number | undefined;
}

/**
 * Uses fuzzy searching to map AI-extracted requirements to actual products in the database.
 */
export function matchProducts(
  extractedRequirements: { description: string; quantity?: number }[],
  allProducts: Product[]
): MatchResult[] {
  // Setup Fuse.js for fuzzy searching the product list
  const fuseOptions = {
    // isCaseSensitive: false,
    // includeScore: true,
    // shouldSort: true,
    // includeMatches: false,
    // findAllMatches: false,
    // minMatchCharLength: 2,
    // location: 0,
    threshold: 0.4, // Lower threshold = stricter match
    // distance: 100,
    // useExtendedSearch: false,
    // ignoreLocation: false,
    // ignoreFieldNorm: false,
    // fieldNormWeight: 1,
    keys: [
      { name: 'partNo', weight: 0.7 },
      { name: 'description', weight: 1.5 }
    ]
  };

  const fuse = new Fuse(allProducts, fuseOptions);

  return extractedRequirements.map(req => {
    // Try to find a match
    const searchResults = fuse.search(req.description);
    
    // If we have a decent match, use it
    let matchedProduct: Product | null = null;
    if (searchResults.length > 0) {
      matchedProduct = searchResults[0].item;
    }

    return {
      originalDescription: req.description,
      matchedProduct,
      requestedQuantity: req.quantity
    };
  });
}
