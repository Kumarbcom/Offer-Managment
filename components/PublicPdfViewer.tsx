import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { mapFromSupabase, getProductsByIds, getProductsByPartNos } from '../supabase';
import type { Quotation, Customer, SalesPerson, Product } from '../types';
import { QuotationPrintView } from './QuotationPrintView';
import { QuotationPrintViewDiscounted } from './QuotationPrintViewDiscounted';
import { QuotationPrintViewWithAirFreight } from './QuotationPrintViewWithAirFreight';
import { QuotationDiffModal } from './QuotationDiffModal';
import { DEFAULT_LOGO_BASE64 } from '../constants';

import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { mapFromSupabase, getProductsByIds, getProductsByPartNos } from '../supabase';
import type { Quotation, Customer, SalesPerson, Product } from '../types';
import { QuotationPrintView } from './QuotationPrintView';
import { QuotationPrintViewDiscounted } from './QuotationPrintViewDiscounted';
import { QuotationPrintViewWithAirFreight } from './QuotationPrintViewWithAirFreight';
import { QuotationDiffModal } from './QuotationDiffModal';
import { DEFAULT_LOGO_BASE64 } from '../constants';
import { idbGet } from '../utils/idbStorage';

interface PublicPdfViewerProps {
    quotationId: number;
    format: string | null;
    cachedQuotations?: Quotation[] | null;
    cachedCustomers?: Customer[] | null;
    cachedSalesPersons?: SalesPerson[] | null;
}

export const PublicPdfViewer: React.FC<PublicPdfViewerProps> = ({
    quotationId,
    format,
    cachedQuotations,
    cachedCustomers,
    cachedSalesPersons,
}) => {
    const [mode, setMode] = useState<string>(format || 'standard');
    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [salesPerson, setSalesPerson] = useState<SalesPerson | null>(null);
    const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Keep mode in sync if format prop changes
    useEffect(() => {
        if (format) setMode(format);
    }, [format]);

    useEffect(() => {
        let isMounted = true;

        const hydrateAndFetch = async () => {
            // STEP 1: FAST HYDRATION (Instant 0ms from Props or <20ms from IndexedDB)
            let initialQ: Quotation | null = null;
            let initialCust: Customer | null = null;
            let initialSp: SalesPerson | null = null;
            let initialAllQ: Quotation[] = [];

            // A) Check props passed from App
            if (cachedQuotations && cachedQuotations.length > 0) {
                const found = cachedQuotations.find(q => q.id === quotationId);
                if (found) {
                    initialQ = found;
                    initialAllQ = cachedQuotations;
                    if (cachedCustomers && found.customerId) {
                        initialCust = cachedCustomers.find(c => c.id === found.customerId) || null;
                    }
                    if (cachedSalesPersons && found.salesPersonId) {
                        initialSp = cachedSalesPersons.find(sp => sp.id === found.salesPersonId) || null;
                    }
                }
            }

            // B) If not found in props, check browser IndexedDB cache
            if (!initialQ) {
                try {
                    const idbQ = await idbGet<Quotation[]>('cache_quotations');
                    if (idbQ && idbQ.length > 0) {
                        const found = idbQ.find(q => q.id === quotationId);
                        if (found) {
                            initialQ = found;
                            initialAllQ = idbQ;
                            const idbCust = await idbGet<Customer[]>('cache_customers');
                            if (idbCust && found.customerId) {
                                initialCust = idbCust.find(c => c.id === found.customerId) || null;
                            }
                            const idbSp = await idbGet<SalesPerson[]>('cache_salesPersons');
                            if (idbSp && found.salesPersonId) {
                                initialSp = idbSp.find(sp => sp.id === found.salesPersonId) || null;
                            }
                        }
                    }
                } catch (_) {}
            }

            // If found in local cache, render immediately (<20ms)!
            if (initialQ && isMounted) {
                setQuotation(initialQ);
                setAllQuotations(initialAllQ.length > 0 ? initialAllQ : [initialQ]);
                if (initialCust) setCustomer(initialCust);
                if (initialSp) setSalesPerson(initialSp);
                setLoading(false);
            }

            // STEP 2: Background or First-Time Cloud Fetch from Supabase
            try {
                if (!supabase) throw new Error("Supabase client not initialized");

                // Fetch requested Quotation
                const { data: qData, error: qError } = await supabase
                    .from('quotations')
                    .select('*')
                    .eq('id', quotationId)
                    .single();

                if (qError) throw qError;
                if (!qData) throw new Error(`Quotation #${quotationId} not found.`);

                const fetchedQuotation = mapFromSupabase('quotations', qData) as Quotation;

                if (isMounted) {
                    setQuotation(fetchedQuotation);
                    setAllQuotations(prev => (prev.length > 1 ? prev : [fetchedQuotation]));
                    setLoading(false); // Instantly show document to user!
                }

                // In parallel, fetch Customer & SalesPerson
                const fetchCustPromise = fetchedQuotation.customerId
                    ? supabase.from('customers').select('*').eq('id', fetchedQuotation.customerId).maybeSingle()
                    : Promise.resolve({ data: null });

                const fetchSpPromise = fetchedQuotation.salesPersonId
                    ? supabase.from('sales_persons').select('*').eq('id', fetchedQuotation.salesPersonId).maybeSingle()
                    : Promise.resolve({ data: null });

                const [custRes, spRes] = await Promise.all([fetchCustPromise, fetchSpPromise]);

                if (isMounted) {
                    if (custRes.data) {
                        setCustomer(mapFromSupabase('customers', custRes.data) as Customer);
                    }
                    if (spRes.data) {
                        setSalesPerson(mapFromSupabase('salesPersons', spRes.data) as SalesPerson);
                    }
                }

                // Non-blocking product image enrichment in background
                if (fetchedQuotation.details && fetchedQuotation.details.length > 0) {
                    const missingImages = fetchedQuotation.details.some(d => !d.imageUrl);
                    if (missingImages) {
                        const pIds = fetchedQuotation.details.map(d => d.productId).filter((id): id is number => typeof id === 'number' && id > 0);
                        const pNos = fetchedQuotation.details.map(d => d.partNo).filter((p): p is string => Boolean(p && p.trim()));
                        
                        Promise.all([
                            pIds.length > 0 ? getProductsByIds(pIds) : Promise.resolve([]),
                            pNos.length > 0 ? getProductsByPartNos(pNos) : Promise.resolve([])
                        ]).then(([byId, byPart]) => {
                            if (!isMounted) return;
                            const combined = [...byId, ...byPart];
                            const prodMap = new Map<number, Product>();
                            const partImgMap = new Map<string, string>();
                            for (const p of combined) {
                                if (p.id) prodMap.set(p.id, p);
                                if (p.partNo && p.imageUrl) {
                                    partImgMap.set(p.partNo.trim().toLowerCase(), p.imageUrl);
                                    const unpadded = p.partNo.trim().replace(/^0+/, '');
                                    if (unpadded) partImgMap.set(unpadded.toLowerCase(), p.imageUrl);
                                }
                            }
                            setQuotation(prev => {
                                if (!prev || !prev.details) return prev;
                                const enrichedDetails = prev.details.map(item => {
                                    if (!item.imageUrl) {
                                        const cleanPNo = (item.partNo || '').trim().toLowerCase();
                                        const unpadded = cleanPNo.replace(/^0+/, '');
                                        const matched = (item.productId && prodMap.get(item.productId)?.imageUrl) ||
                                                        (cleanPNo && partImgMap.get(cleanPNo)) ||
                                                        (unpadded && partImgMap.get(unpadded));
                                        if (matched) return { ...item, imageUrl: matched };
                                    }
                                    return item;
                                });
                                return { ...prev, details: enrichedDetails };
                            });
                        }).catch(() => {});
                    }
                }
            } catch (err: any) {
                if (isMounted && !initialQ) {
                    console.error("Error loading quotation document:", err);
                    setError(err.message || "Failed to load quotation.");
                    setLoading(false);
                }
            }
        };

        hydrateAndFetch();

        return () => { isMounted = false; };
    }, [quotationId, cachedQuotations, cachedCustomers, cachedSalesPersons]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="p-8 bg-white rounded-lg shadow-md text-center space-y-3">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                    <p className="text-sm text-gray-700 font-bold">Loading Quotation Document...</p>
                </div>
            </div>
        );
    }

    if (error || !quotation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="p-8 bg-white rounded-lg shadow-md border-l-4 border-red-500 max-w-md w-full">
                    <h3 className="text-lg text-red-700 font-bold mb-1">Quotation Not Available</h3>
                    <p className="text-sm text-gray-600 mb-4">{error || "The requested quotation could not be found or has expired."}</p>
                    <a href="/" className="inline-block bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded shadow hover:bg-indigo-700">
                        Return to Home
                    </a>
                </div>
            </div>
        );
    }

    const effectiveCustomer = customer || {
        id: quotation.customerId || 0,
        name: quotation.contactPerson || 'Customer',
        address: '',
        city: '',
        pincode: '',
        salesPersonId: quotation.salesPersonId,
        discountStructure: { singleCore: 0, multiCore: 0, specialCable: 0, accessories: 0 }
    };

    const effectiveSalesPerson = salesPerson || {
        id: quotation.salesPersonId || 0,
        name: quotation.preparedBy || 'Sales Coordinator',
        email: 'sales@siddhikabel.com',
        mobile: '9620000947'
    };

    return (
        <div className="bg-white min-h-screen pb-10">
            {/* Top Toolbar */}
            <div className="bg-slate-900 text-white p-3 flex justify-between items-center print:hidden mb-4 shadow-md sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-wide">Siddhi Kabel Corporation</span>
                    {mode === 'comparison' && (
                        <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                            Revision Analysis
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {mode === 'comparison' ? (
                        <button 
                            type="button"
                            onClick={() => {
                                setMode('standard');
                                window.history.replaceState({}, '', `?view_pdf=${quotation.id}&format=standard`);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
                        >
                            View Standard Offer
                        </button>
                    ) : (
                        (quotation.revisionNumber && quotation.revisionNumber > 0) && (
                            <button 
                                type="button"
                                onClick={() => {
                                    setMode('comparison');
                                    window.history.replaceState({}, '', `?view_pdf=${quotation.id}&format=comparison`);
                                }}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
                            >
                                View Revision Variance
                            </button>
                        )
                    )}
                    <button 
                        onClick={() => window.print()}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        <span>Print / Save PDF</span>
                    </button>
                </div>
            </div>
            
            <div id="print-area" className="flex justify-center">
                {mode === 'standard' && (
                    <QuotationPrintView 
                        quotation={quotation} 
                        allQuotations={allQuotations} 
                        customer={effectiveCustomer} 
                        salesPerson={effectiveSalesPerson} 
                        logoUrl={DEFAULT_LOGO_BASE64} 
                        showImages={(quotation.details || []).some(item => !!item.imageUrl)} 
                    />
                )}
                {mode === 'discounted' && (
                    <QuotationPrintViewDiscounted 
                        quotation={quotation} 
                        allQuotations={allQuotations} 
                        customer={effectiveCustomer} 
                        salesPerson={effectiveSalesPerson} 
                        logoUrl={DEFAULT_LOGO_BASE64} 
                        showImages={(quotation.details || []).some(item => !!item.imageUrl)} 
                    />
                )}
                {mode === 'withAirFreight' && (
                    <QuotationPrintViewWithAirFreight 
                        quotation={quotation} 
                        allQuotations={allQuotations} 
                        customer={effectiveCustomer} 
                        salesPerson={effectiveSalesPerson} 
                        logoUrl={DEFAULT_LOGO_BASE64} 
                        showImages={(quotation.details || []).some(item => !!item.imageUrl)} 
                    />
                )}
                {mode === 'comparison' && (
                    <div className="w-full max-w-6xl mx-auto px-2">
                        <QuotationDiffModal
                            isOpen={true}
                            onClose={() => { 
                                setMode('standard'); 
                                window.history.replaceState({}, '', `?view_pdf=${quotation.id}&format=standard`); 
                            }}
                            quotation={quotation}
                            customer={effectiveCustomer}
                            salesPerson={effectiveSalesPerson}
                            allQuotations={allQuotations}
                            logoUrl={DEFAULT_LOGO_BASE64}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
