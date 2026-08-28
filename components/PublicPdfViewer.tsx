import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Quotation, Customer, SalesPerson } from '../types';
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
                    .select('data')
                    .eq('id', quotationId)
                    .single();
                
                if (qError) throw qError;
                const fetchedQuotation = qData.data as Quotation;
                setQuotation(fetchedQuotation);

                // Fetch All Quotations for Sequence Number logic
                const { data: allQData, error: allQError } = await supabase
                    .from('quotations')
                    .select('data');
                if (!allQError && allQData) {
                    setAllQuotations(allQData.map(d => d.data as Quotation));
                }

                // Fetch Customer
                if (fetchedQuotation.customerId) {
                    const { data: cData } = await supabase
                        .from('customers')
                        .select('data');
                    if (cData) {
                        const customers = cData.map(d => d.data as Customer);
                        const foundCustomer = customers.find(c => c.id === fetchedQuotation.customerId);
                        if (foundCustomer) setCustomer(foundCustomer);
                    }
                }

                // Fetch SalesPerson
                if (fetchedQuotation.salesPersonId) {
                    const { data: sData } = await supabase
                        .from('salesPersons')
                        .select('data');
                    if (sData) {
                        const salesPersons = sData.map(d => d.data as SalesPerson);
                        const foundSP = salesPersons.find(s => s.id === fetchedQuotation.salesPersonId);
                        if (foundSP) setSalesPerson(foundSP);
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
                {mode === 'standard' && <QuotationPrintView quotation={quotation} allQuotations={allQuotations} customer={customer} salesPerson={salesPerson} logoUrl={DEFAULT_LOGO_BASE64} />}
                {mode === 'discounted' && <QuotationPrintViewDiscounted quotation={quotation} allQuotations={allQuotations} customer={customer} salesPerson={salesPerson} logoUrl={DEFAULT_LOGO_BASE64} />}
                {mode === 'withAirFreight' && <QuotationPrintViewWithAirFreight quotation={quotation} allQuotations={allQuotations} customer={customer} salesPerson={salesPerson} logoUrl={DEFAULT_LOGO_BASE64} />}
            </div>
        </div>
    );
};
