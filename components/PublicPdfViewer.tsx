import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { mapFromSupabase, getProductsByIds, getProductsByPartNos } from '../supabase';
import type { Quotation, Customer, SalesPerson, Product } from '../types';
import { QuotationPrintView } from './QuotationPrintView';
import { QuotationPrintViewDiscounted } from './QuotationPrintViewDiscounted';
import { QuotationPrintViewWithAirFreight } from './QuotationPrintViewWithAirFreight';
import { QuotationDiffModal } from './QuotationDiffModal';
import { DEFAULT_LOGO_BASE64 } from '../constants';

interface PublicPdfViewerProps {
    quotationId: number;
    format: string | null;
}

export const PublicPdfViewer: React.FC<PublicPdfViewerProps> = ({ quotationId, format }) => {
    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [salesPerson, setSalesPerson] = useState<SalesPerson | null>(null);
    const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch the requested Quotation by ID
                const { data: qData, error: qError } = await supabase
                    .from('quotations')
                    .select('*')
                    .eq('id', quotationId)
                    .single();
                
                if (qError) throw qError;
                if (!qData) throw new Error(`Quotation #${quotationId} not found.`);

                const fetchedQuotation = mapFromSupabase('quotations', qData) as Quotation;

                // Auto-enrich details with product images if missing
                if (fetchedQuotation.details && fetchedQuotation.details.length > 0) {
                    const pIds = fetchedQuotation.details.map(d => d.productId).filter((id): id is number => typeof id === 'number' && id > 0);
                    const pNos = fetchedQuotation.details.map(d => d.partNo).filter((p): p is string => Boolean(p && p.trim()));
                    try {
                        const [byId, byPart] = await Promise.all([
                            pIds.length > 0 ? getProductsByIds(pIds) : Promise.resolve([]),
                            pNos.length > 0 ? getProductsByPartNos(pNos) : Promise.resolve([])
                        ]);
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
                        fetchedQuotation.details = fetchedQuotation.details.map(item => {
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
                    } catch (e) {
                        console.warn("Could not fetch product images for public viewer:", e);
                    }
                }
                setQuotation(fetchedQuotation);

                // 2. Fetch Lightweight Quotations metadata for Sequence Number (id and quotation_date ONLY)
                try {
                    const { data: lightQData } = await supabase
                        .from('quotations')
                        .select('id, quotation_date')
                        .order('id', { ascending: true });
                    if (lightQData && lightQData.length > 0) {
                        setAllQuotations(lightQData.map(d => ({
                            id: d.id,
                            quotationDate: d.quotation_date,
                            enquiryDate: '',
                            customerId: null,
                            contactPerson: '',
                            contactNumber: '',
                            otherTerms: '',
                            paymentTerms: '100% Against Proforma Invoice' as any,
                            preparedBy: 'Kumar' as any,
                            productsBrand: 'Lapp' as any,
                            salesPersonId: null,
                            modeOfEnquiry: 'Customer Email' as any,
                            status: 'Open' as any,
                            comments: '',
                            details: [],
                            gstAdded: true
                        })));
                    } else {
                        setAllQuotations([fetchedQuotation]);
                    }
                } catch (e) {
                    setAllQuotations([fetchedQuotation]);
                }

                // 3. Setup Fallback Customer
                const fallbackCustomer: Customer = {
                    id: fetchedQuotation.customerId || 0,
                    name: fetchedQuotation.contactPerson || 'Customer',
                    address: '',
                    city: '',
                    pincode: '',
                    salesPersonId: fetchedQuotation.salesPersonId,
                    discountStructure: { singleCore: 0, multiCore: 0, specialCable: 0, accessories: 0 }
                };

                // Fetch Customer from Supabase if customerId exists
                if (fetchedQuotation.customerId) {
                    try {
                        const { data: cData } = await supabase
                            .from('customers')
                            .select('*')
                            .eq('id', fetchedQuotation.customerId)
                            .maybeSingle();
                        if (cData) {
                            setCustomer(mapFromSupabase('customers', cData) as Customer);
                        } else {
                            setCustomer(fallbackCustomer);
                        }
                    } catch (e) {
                        setCustomer(fallbackCustomer);
                    }
                } else {
                    setCustomer(fallbackCustomer);
                }

                // 4. Setup Fallback SalesPerson
                const fallbackSalesPerson: SalesPerson = {
                    id: fetchedQuotation.salesPersonId || 0,
                    name: fetchedQuotation.preparedBy || 'Sales Coordinator',
                    email: 'sales@siddhikabel.com',
                    mobile: '9620000947'
                };

                // Fetch SalesPerson from Supabase if salesPersonId exists
                if (fetchedQuotation.salesPersonId) {
                    try {
                        const { data: sData } = await supabase
                            .from('sales_persons')
                            .select('*')
                            .eq('id', fetchedQuotation.salesPersonId)
                            .maybeSingle();
                        if (sData) {
                            setSalesPerson(mapFromSupabase('salesPersons', sData) as SalesPerson);
                        } else {
                            setSalesPerson(fallbackSalesPerson);
                        }
                    } catch (e) {
                        setSalesPerson(fallbackSalesPerson);
                    }
                } else {
                    setSalesPerson(fallbackSalesPerson);
                }

                setLoading(false);
            } catch (err: any) {
                console.error("Error fetching public PDF data:", err);
                setError(err.message || "Failed to load quotation.");
                setLoading(false);
            }
        };
        fetchData();
    }, [quotationId]);

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

    const mode = format || 'standard';
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
                        <a 
                            href={`?view_pdf=${quotation.id}&format=standard`}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
                        >
                            View Standard Offer
                        </a>
                    ) : (
                        (quotation.revisionNumber && quotation.revisionNumber > 0) && (
                            <a 
                                href={`?view_pdf=${quotation.id}&format=comparison`}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                            >
                                View Revision Variance
                            </a>
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
                            onClose={() => { window.location.href = `?view_pdf=${quotation.id}&format=standard`; }}
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
