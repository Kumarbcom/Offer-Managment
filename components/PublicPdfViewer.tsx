import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { mapFromSupabase, getProductsByIds, getProductsByPartNos } from '../supabase';
import type { Quotation, Customer, SalesPerson, Product } from '../types';
import { QuotationPrintView } from './QuotationPrintView';
import { QuotationPrintViewDiscounted } from './QuotationPrintViewDiscounted';
import { QuotationPrintViewWithAirFreight } from './QuotationPrintViewWithAirFreight';
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
                // Fetch Quotation
                const { data: qData, error: qError } = await supabase
                    .from('quotations')
                    .select('*')
                    .eq('id', quotationId)
                    .single();
                
                if (qError) throw qError;
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

                // Fetch All Quotations for Sequence Number logic
                const { data: allQData, error: allQError } = await supabase
                    .from('quotations')
                    .select('*');
                if (!allQError && allQData) {
                    setAllQuotations(allQData.map(d => mapFromSupabase('quotations', d) as Quotation));
                }

                // Fetch Customer
                if (fetchedQuotation.customerId) {
                    const { data: cData } = await supabase
                        .from('customers')
                        .select('*')
                        .eq('id', fetchedQuotation.customerId)
                        .single();
                    if (cData) {
                        setCustomer(mapFromSupabase('customers', cData) as Customer);
                    }
                }

                // Fetch SalesPerson
                if (fetchedQuotation.salesPersonId) {
                    const { data: sData } = await supabase
                        .from('sales_persons')
                        .select('*')
                        .eq('id', fetchedQuotation.salesPersonId)
                        .single();
                    if (sData) {
                        setSalesPerson(mapFromSupabase('salesPersons', sData) as SalesPerson);
                    }
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
                <div className="p-8 bg-white rounded-lg shadow-md">
                    <p className="text-lg text-gray-700 font-semibold">Loading Document...</p>
                </div>
            </div>
        );
    }

    if (error || !quotation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="p-8 bg-white rounded-lg shadow-md border-l-4 border-red-500">
                    <p className="text-lg text-red-700 font-semibold">Error: {error || "Quotation not found"}</p>
                </div>
            </div>
        );
    }

    const mode = format || 'standard';

    if (!customer) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="p-8 bg-white rounded-lg shadow-md border-l-4 border-yellow-500">
                    <p className="text-lg text-yellow-700 font-semibold">Please log in to view this document.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white min-h-screen pb-10">
            {/* Added a toolbar so the user can easily print or download */}
            <div className="bg-slate-800 text-white p-3 flex justify-between items-center print:hidden mb-4 shadow-md sticky top-0 z-50">
                <div className="font-bold text-sm">Siddhi Kabel - Offer View</div>
                <button 
                    onClick={() => window.print()}
                    className="bg-indigo-500 hover:bg-indigo-600 px-4 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print / Save PDF
                </button>
            </div>
            
            <div id="print-area" className="flex justify-center">
                {mode === 'standard' && <QuotationPrintView quotation={quotation} allQuotations={allQuotations} customer={customer} salesPerson={salesPerson!} logoUrl={DEFAULT_LOGO_BASE64} showImages={(quotation.details || []).some(item => !!item.imageUrl)} />}
                {mode === 'discounted' && <QuotationPrintViewDiscounted quotation={quotation} allQuotations={allQuotations} customer={customer} salesPerson={salesPerson!} logoUrl={DEFAULT_LOGO_BASE64} showImages={(quotation.details || []).some(item => !!item.imageUrl)} />}
                {mode === 'withAirFreight' && <QuotationPrintViewWithAirFreight quotation={quotation} allQuotations={allQuotations} customer={customer} salesPerson={salesPerson!} logoUrl={DEFAULT_LOGO_BASE64} showImages={(quotation.details || []).some(item => !!item.imageUrl)} />}
            </div>
        </div>
    );
};
