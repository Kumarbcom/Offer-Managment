import React, { useRef, useState, useMemo } from 'react';
import type { User, SalesPerson, Quotation } from '../types';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';
import { calculateTotalAmount } from '../utils/calc';

interface SalesPersonStatRow {
    id: number;
    name: string;
    total: { count: number; value: number };
    [status: string]: any;
}

interface ManagementReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    salesPersonStats: SalesPersonStatRow[];
    performanceTotals: {
        total: { count: number; value: number };
        [status: string]: any;
    };
    dateRangeLabel: string;
    currentUser: User;
    quotations?: Quotation[] | null;
    customerMap?: Map<number, string>;
    salesPersons?: SalesPerson[] | null;
}

const formatCurrency = (val: number) => {
    return '₹' + (Number(val) || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatCurrencyCompact = (val: number) => {
    const v = Number(val) || 0;
    if (v === 0) return '₹0';
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
    return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

export const ManagementReportModal: React.FC<ManagementReportModalProps> = ({
    isOpen,
    onClose,
    salesPersonStats,
    performanceTotals,
    dateRangeLabel,
    currentUser,
    quotations = [],
    customerMap = new Map(),
    salesPersons = [],
}) => {
    const [copiedHtml, setCopiedHtml] = useState(false);
    const [copiedText, setCopiedText] = useState(false);
    const [copiedSubject, setCopiedSubject] = useState(false);
    const [activeTab, setActiveTab] = useState<'matrix' | 'top10' | 'preview'>('matrix');
    const contentRef = useRef<HTMLDivElement>(null);

    const reportDateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    const emailSubject = `[Weekly Review] Siddhi Kabel Corporation - Offer Management & Enquiry Performance (${dateRangeLabel})`;

    // Compute Top 10 High Value Offers
    const top10Offers = useMemo(() => {
        const list = [...(quotations || [])];
        return list
            .filter(q => q && calculateTotalAmount(q) > 0)
            .sort((a, b) => calculateTotalAmount(b) - calculateTotalAmount(a))
            .slice(0, 10)
            .map((q, idx) => {
                const totalAmt = calculateTotalAmount(q);
                const qNum = generateFormattedQuotationNumber(q, quotations || []);
                const custName = q.customerId ? (customerMap.get(q.customerId) || (q as any).customerName || '—') : '—';
                const spName = salesPersons?.find(s => s.id === q.salesPersonId)?.name || '—';
                const qDate = q.quotationDate
                    ? new Date(q.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—';
                const appLink = `https://offer-managment.vercel.app/?id=${q.id}`;
                return {
                    rank: idx + 1,
                    id: q.id,
                    quotationNumber: qNum,
                    customerName: custName,
                    salesPerson: spName,
                    amount: totalAmt,
                    status: q.status,
                    date: qDate,
                    appLink,
                };
            });
    }, [quotations, customerMap, salesPersons]);

    if (!isOpen) return null;

    // Helper for status percentage
    const calcPct = (part: number, total: number) => {
        if (!total || total <= 0) return '0.0%';
        return `${((part / total) * 100).toFixed(1)}%`;
    };

    // Overall summary metrics
    const totalEnqCount = performanceTotals.total.count || 0;
    const totalEnqVal = performanceTotals.total.value || 0;

    const openCount = performanceTotals['Open']?.count || 0;
    const openVal = performanceTotals['Open']?.value || 0;

    const poCount = performanceTotals['PO received']?.count || 0;
    const poVal = performanceTotals['PO received']?.value || 0;

    const partialPoCount = performanceTotals['Partial PO Received']?.count || 0;
    const partialPoVal = performanceTotals['Partial PO Received']?.value || 0;

    const underReviewCount = performanceTotals['Under Review']?.count || 0;
    const underReviewVal = performanceTotals['Under Review']?.value || 0;

    const amendCount = performanceTotals['Need Amendment']?.count || 0;
    const amendVal = performanceTotals['Need Amendment']?.value || 0;

    const lostCount = (performanceTotals['Lost']?.count || 0) + (performanceTotals['Expired']?.count || 0);
    const lostVal = (performanceTotals['Lost']?.value || 0) + (performanceTotals['Expired']?.value || 0);

    const winRateCountPct = calcPct(poCount + partialPoCount, totalEnqCount);
    const winRateValPct = calcPct(poVal + partialPoVal, totalEnqVal);
    const openPipelineValPct = calcPct(openVal, totalEnqVal);

    // Plain text version for WhatsApp / SMS / Plain email
    const generatePlainText = () => {
        let text = `==================================================\n`;
        text += `WEEKLY SALES & QUOTATION REVIEW DASHBOARD\n`;
        text += `Siddhi Kabel Corporation Pvt Ltd\n`;
        text += `==================================================\n`;
        text += `Subject: ${emailSubject}\n`;
        text += `Period: ${dateRangeLabel} | Date: ${reportDateStr}\n`;
        text += `Prepared By: ${currentUser.name} (${currentUser.role})\n\n`;

        text += `--- 1. EXECUTIVE KPI SUMMARY ---\n`;
        text += `• Total Enquiries: ${totalEnqCount} | ${formatCurrency(totalEnqVal)} (100%)\n`;
        text += `• Orders Won (PO Received): ${poCount} (${calcPct(poCount, totalEnqCount)}) | ${formatCurrency(poVal)} (${calcPct(poVal, totalEnqVal)})\n`;
        text += `• Partial PO Received: ${partialPoCount} (${calcPct(partialPoCount, totalEnqCount)}) | ${formatCurrency(partialPoVal)} (${calcPct(partialPoVal, totalEnqVal)})\n`;
        text += `• Active Open Pipeline: ${openCount} (${calcPct(openCount, totalEnqCount)}) | ${formatCurrency(openVal)} (${calcPct(openVal, totalEnqVal)})\n`;
        text += `• Under Review / Pending: ${underReviewCount} (${calcPct(underReviewCount, totalEnqCount)}) | ${formatCurrency(underReviewVal)} (${calcPct(underReviewVal, totalEnqVal)})\n`;
        text += `• Need Amendment: ${amendCount} (${calcPct(amendCount, totalEnqCount)}) | ${formatCurrency(amendVal)} (${calcPct(amendVal, totalEnqVal)})\n`;
        text += `• Lost / Expired: ${lostCount} (${calcPct(lostCount, totalEnqCount)}) | ${formatCurrency(lostVal)} (${calcPct(lostVal, totalEnqVal)})\n`;
        text += `• Overall Win Rate: ${winRateCountPct} (Count) | ${winRateValPct} (Value)\n\n`;

        text += `--- 2. SALES PERSON PERFORMANCE & STATUS MATRIX ---\n`;
        salesPersonStats.forEach(sp => {
            const spLostCount = (sp['Lost']?.count || 0) + (sp['Expired']?.count || 0);
            const spLostVal = (sp['Lost']?.value || 0) + (sp['Expired']?.value || 0);
            text += `👤 ${sp.name.toUpperCase()}\n`;
            text += `   • Total: ${sp.total.count} (${calcPct(sp.total.count, totalEnqCount)} of co.) | ${formatCurrency(sp.total.value)}\n`;
            text += `   • Open Offers: ${sp['Open']?.count || 0} (${calcPct(sp['Open']?.count || 0, sp.total.count)}) | ${formatCurrency(sp['Open']?.value || 0)} (${calcPct(sp['Open']?.value || 0, sp.total.value)})\n`;
            text += `   • PO Received: ${sp['PO received']?.count || 0} (${calcPct(sp['PO received']?.count || 0, sp.total.count)}) | ${formatCurrency(sp['PO received']?.value || 0)} (${calcPct(sp['PO received']?.value || 0, sp.total.value)})\n`;
            text += `   • Partial PO: ${sp['Partial PO Received']?.count || 0} (${calcPct(sp['Partial PO Received']?.count || 0, sp.total.count)}) | ${formatCurrency(sp['Partial PO Received']?.value || 0)}\n`;
            text += `   • Under Review: ${sp['Under Review']?.count || 0} (${calcPct(sp['Under Review']?.count || 0, sp.total.count)}) | ${formatCurrency(sp['Under Review']?.value || 0)}\n`;
            text += `   • Need Amend: ${sp['Need Amendment']?.count || 0} (${calcPct(sp['Need Amendment']?.count || 0, sp.total.count)}) | ${formatCurrency(sp['Need Amendment']?.value || 0)}\n`;
            text += `   • Lost/Expired: ${spLostCount} (${calcPct(spLostCount, sp.total.count)}) | ${formatCurrency(spLostVal)}\n\n`;
        });

        text += `--- 3. TOP 10 HIGH-VALUE OFFERS (WITH DIRECT APP LINK) ---\n`;
        top10Offers.forEach(o => {
            text += `#${o.rank}. ${o.quotationNumber} | ${formatCurrency(o.amount)}\n`;
            text += `    Customer: ${o.customerName}\n`;
            text += `    Sales Person: ${o.salesPerson} | Status: ${o.status} | Date: ${o.date}\n`;
            text += `    App Link: ${o.appLink}\n\n`;
        });

        text += `--------------------------------------------------\n`;
        text += `GRAND TOTAL: ${totalEnqCount} Enquiries | Value: ${formatCurrency(totalEnqVal)}\n`;
        text += `Generated from Siddhi Kabel Corporation Offer Management System\n`;
        text += `Portal: https://offer-managment.vercel.app\n`;
        return text;
    };

    const handleCopyHtml = async () => {
        if (!contentRef.current) return;
        const html = contentRef.current.innerHTML;
        const plain = generatePlainText();

        try {
            if (navigator.clipboard && window.ClipboardItem) {
                const blobHtml = new Blob([html], { type: 'text/html' });
                const blobText = new Blob([plain], { type: 'text/plain' });
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': blobHtml,
                        'text/plain': blobText,
                    }),
                ]);
            } else {
                await navigator.clipboard.writeText(plain);
            }
            setCopiedHtml(true);
            setTimeout(() => setCopiedHtml(false), 2500);
        } catch (e) {
            console.error("Clipboard copy failed:", e);
            try {
                await navigator.clipboard.writeText(plain);
                setCopiedHtml(true);
                setTimeout(() => setCopiedHtml(false), 2500);
            } catch (_) {
                alert("Failed to copy automatically. Please select text manually.");
            }
        }
    };

    const handleCopyText = async () => {
        const plain = generatePlainText();
        try {
            await navigator.clipboard.writeText(plain);
            setCopiedText(true);
            setTimeout(() => setCopiedText(false), 2500);
        } catch (e) {
            alert("Failed to copy text.");
        }
    };

    const handleCopySubject = async () => {
        try {
            await navigator.clipboard.writeText(emailSubject);
            setCopiedSubject(true);
            setTimeout(() => setCopiedSubject(false), 2500);
        } catch (e) {
            alert("Failed to copy subject.");
        }
    };

    const handleWhatsApp = () => {
        const text = generatePlainText();
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col border border-slate-200 my-auto max-h-[94vh]">
                
                {/* Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-xl shadow-inner">
                            📊
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-white text-base sm:text-lg tracking-wide">
                                    Management Weekly Review Dashboard
                                </h3>
                                <span className="bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                    {dateRangeLabel}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Executive Performance Matrix • Offer Status % Breakdown • Top 10 High Value Offers
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
                        title="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Toolbar & Action Bar */}
                <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    {/* View Switcher Tabs */}
                    <div className="inline-flex bg-slate-200/80 p-1 rounded-xl gap-1 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setActiveTab('matrix')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === 'matrix'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            📊 Performance Matrix (%)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('top10')}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                activeTab === 'top10'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            🏆 Top 10 High-Value Offers
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full text-[10px]">10</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('preview')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === 'preview'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            ✉️ Full Email Preview
                        </button>
                    </div>

                    {/* Quick Copy Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopyHtml}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 ${
                                copiedHtml
                                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
                            }`}
                            title="Copy styled email ready to paste directly into Outlook or Gmail"
                        >
                            {copiedHtml ? '✓ Rich Email Copied!' : '📋 Copy Rich Email (Outlook / Gmail)'}
                        </button>

                        <button
                            type="button"
                            onClick={handleCopySubject}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
                                copiedSubject
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title="Copy email subject line"
                        >
                            {copiedSubject ? '✓ Subject Copied!' : '✉️ Copy Subject'}
                        </button>

                        <button
                            type="button"
                            onClick={handleCopyText}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                copiedText
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title="Copy plain text summary"
                        >
                            {copiedText ? '✓ Text Copied!' : '📄 Plain Text'}
                        </button>

                        <button
                            type="button"
                            onClick={handleWhatsApp}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors flex items-center gap-1"
                        >
                            <span>WhatsApp</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
                    
                    {/* Top Executive KPI Cards Summary (Always visible) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 border border-blue-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Total Enquiries</span>
                                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded">100%</span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{totalEnqCount}</div>
                            <div className="text-xs font-bold text-blue-700 mt-0.5">{formatCurrencyCompact(totalEnqVal)}</div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium">Pipeline volume</div>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">PO Received (Won)</span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                                    {winRateCountPct} Win
                                </span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{poCount}</div>
                            <div className="text-xs font-bold text-emerald-700 mt-0.5">
                                {formatCurrencyCompact(poVal)} <span className="text-[10px] text-emerald-600 font-semibold">({winRateValPct})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium">Closed orders confirmed</div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/40 border border-indigo-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Open Offers</span>
                                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded">
                                    {openPipelineValPct} Val
                                </span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{openCount}</div>
                            <div className="text-xs font-bold text-indigo-700 mt-0.5">
                                {formatCurrencyCompact(openVal)} <span className="text-[10px] text-indigo-600 font-semibold">({calcPct(openCount, totalEnqCount)})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium">Active offers in negotiation</div>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Review / Amend</span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded">Action</span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{underReviewCount + amendCount}</div>
                            <div className="text-xs font-bold text-amber-700 mt-0.5">
                                {formatCurrencyCompact(underReviewVal + amendVal)} <span className="text-[10px] text-amber-600 font-semibold">({calcPct(underReviewCount + amendCount, totalEnqCount)})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium">Pending technical/price revision</div>
                        </div>
                    </div>

                    {/* TAB 1: Performance Matrix with Status % */}
                    {activeTab === 'matrix' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-black text-slate-800 tracking-wide uppercase">
                                        Sales Person Enquiry &amp; Offer Status Breakdown
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                        Each cell shows <strong>Count (% share)</strong> and <strong>Value (% share)</strong> of the sales person's total enquiries.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                    {salesPersonStats.length} Sales Persons
                                </span>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900 text-white font-bold">
                                            <th className="p-3 border-r border-slate-700 text-white bg-slate-950">
                                                Sales Person
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-700 bg-slate-900 text-white">
                                                Total Enquiry<br/>
                                                <span className="text-[10px] text-slate-300 font-normal">Count / Value</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-700 bg-blue-950 text-white">
                                                Open Offer<br/>
                                                <span className="text-[10px] text-blue-200 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-700 bg-emerald-950 text-white">
                                                PO Received<br/>
                                                <span className="text-[10px] text-emerald-200 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-700 bg-teal-950 text-white">
                                                Partial PO<br/>
                                                <span className="text-[10px] text-teal-200 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-700 bg-indigo-950 text-white">
                                                Under Review<br/>
                                                <span className="text-[10px] text-indigo-200 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-700 bg-purple-950 text-white">
                                                Amendment<br/>
                                                <span className="text-[10px] text-purple-200 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center bg-rose-950 text-white">
                                                Lost / Expired<br/>
                                                <span className="text-[10px] text-rose-200 font-normal">Count / Value (%)</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {salesPersonStats.map((sp, idx) => {
                                            const spTotalCount = sp.total.count || 0;
                                            const spTotalVal = sp.total.value || 0;

                                            const spOpenCount = sp['Open']?.count || 0;
                                            const spOpenVal = sp['Open']?.value || 0;

                                            const spPoCount = sp['PO received']?.count || 0;
                                            const spPoVal = sp['PO received']?.value || 0;

                                            const spPartialCount = sp['Partial PO Received']?.count || 0;
                                            const spPartialVal = sp['Partial PO Received']?.value || 0;

                                            const spReviewCount = sp['Under Review']?.count || 0;
                                            const spReviewVal = sp['Under Review']?.value || 0;

                                            const spAmendCount = sp['Need Amendment']?.count || 0;
                                            const spAmendVal = sp['Need Amendment']?.value || 0;

                                            const spLostCount = (sp['Lost']?.count || 0) + (sp['Expired']?.count || 0);
                                            const spLostVal = (sp['Lost']?.value || 0) + (sp['Expired']?.value || 0);

                                            return (
                                                <tr key={sp.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/50 hover:bg-slate-50/80'}>
                                                    <td className="p-3 font-bold text-slate-800 border-r border-slate-200">
                                                        <div className="font-extrabold text-slate-900">{sp.name}</div>
                                                        <div className="text-[10px] text-slate-500 font-normal">
                                                            {calcPct(spTotalCount, totalEnqCount)} of co. enquiries
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-slate-100/50 font-bold text-slate-900">
                                                        <div className="text-sm font-black">{spTotalCount}</div>
                                                        <div className="text-[11px] text-indigo-700 font-bold">{formatCurrencyCompact(spTotalVal)}</div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-blue-50/30">
                                                        <div className="font-bold text-blue-900">
                                                            {spOpenCount} <span className="text-[10px] text-blue-600 font-semibold">({calcPct(spOpenCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-blue-700 font-semibold">
                                                            {formatCurrencyCompact(spOpenVal)} <span className="text-[10px] text-slate-500">({calcPct(spOpenVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-emerald-50/40">
                                                        <div className="font-extrabold text-emerald-900">
                                                            {spPoCount} <span className="text-[10px] text-emerald-600 font-bold">({calcPct(spPoCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-emerald-700 font-bold">
                                                            {formatCurrencyCompact(spPoVal)} <span className="text-[10px] text-emerald-600">({calcPct(spPoVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-teal-50/30">
                                                        <div className="font-bold text-teal-900">
                                                            {spPartialCount} <span className="text-[10px] text-teal-600">({calcPct(spPartialCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-teal-700">
                                                            {formatCurrencyCompact(spPartialVal)} <span className="text-[10px] text-slate-500">({calcPct(spPartialVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-indigo-50/30">
                                                        <div className="font-bold text-indigo-900">
                                                            {spReviewCount} <span className="text-[10px] text-indigo-600">({calcPct(spReviewCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-indigo-700">
                                                            {formatCurrencyCompact(spReviewVal)} <span className="text-[10px] text-slate-500">({calcPct(spReviewVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-purple-50/30">
                                                        <div className="font-bold text-purple-900">
                                                            {spAmendCount} <span className="text-[10px] text-purple-600">({calcPct(spAmendCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-purple-700">
                                                            {formatCurrencyCompact(spAmendVal)} <span className="text-[10px] text-slate-500">({calcPct(spAmendVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center bg-rose-50/30">
                                                        <div className="font-bold text-rose-900">
                                                            {spLostCount} <span className="text-[10px] text-rose-600">({calcPct(spLostCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-rose-700">
                                                            {formatCurrencyCompact(spLostVal)} <span className="text-[10px] text-slate-500">({calcPct(spLostVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-950 text-white font-extrabold border-t-2 border-slate-600">
                                            <td className="p-3 text-left border-r border-slate-700 text-white">
                                                <div className="font-black tracking-wider">COMPANY TOTAL</div>
                                                <div className="text-[10px] text-slate-400 font-normal">All sales combined</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-700 bg-slate-900 text-yellow-300">
                                                <div className="text-sm font-black">{totalEnqCount} (100%)</div>
                                                <div className="text-[11px] font-bold text-yellow-200">{formatCurrencyCompact(totalEnqVal)}</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-700 bg-blue-950 text-blue-200">
                                                <div className="font-bold">{openCount} ({calcPct(openCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-blue-300 font-bold">{formatCurrencyCompact(openVal)} ({calcPct(openVal, totalEnqVal)})</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-700 bg-emerald-950 text-emerald-200">
                                                <div className="font-black text-emerald-300">{poCount} ({calcPct(poCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-emerald-300 font-extrabold">{formatCurrencyCompact(poVal)} ({calcPct(poVal, totalEnqVal)})</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-700 bg-teal-950 text-teal-200">
                                                <div className="font-bold">{partialPoCount} ({calcPct(partialPoCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-teal-300 font-bold">{formatCurrencyCompact(partialPoVal)} ({calcPct(partialPoVal, totalEnqVal)})</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-700 bg-indigo-950 text-indigo-200">
                                                <div className="font-bold">{underReviewCount} ({calcPct(underReviewCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-indigo-300">{formatCurrencyCompact(underReviewVal)} ({calcPct(underReviewVal, totalEnqVal)})</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-700 bg-purple-950 text-purple-200">
                                                <div className="font-bold">{amendCount} ({calcPct(amendCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-purple-300">{formatCurrencyCompact(amendVal)} ({calcPct(amendVal, totalEnqVal)})</div>
                                            </td>
                                            <td className="p-3 text-center bg-rose-950 text-rose-200">
                                                <div className="font-bold">{lostCount} ({calcPct(lostCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-rose-300">{formatCurrencyCompact(lostVal)} ({calcPct(lostVal, totalEnqVal)})</div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: Latest 10 High Value Offers */}
                    {activeTab === 'top10' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-black text-slate-800 tracking-wide uppercase">
                                        Top 10 High-Value Quotations &amp; Opportunities
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                        Largest active value offers with 1-click deep links directly into the system.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
                                    Direct App Links Included
                                </span>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900 text-white font-bold">
                                            <th className="p-3 text-center border-r border-slate-700 text-white w-12">#</th>
                                            <th className="p-3 border-r border-slate-700 text-white">Quotation No</th>
                                            <th className="p-3 border-r border-slate-700 text-white">Customer Name</th>
                                            <th className="p-3 border-r border-slate-700 text-white">Sales Person</th>
                                            <th className="p-3 text-right border-r border-slate-700 text-white">Offer Value (₹)</th>
                                            <th className="p-3 text-center border-r border-slate-700 text-white">Status</th>
                                            <th className="p-3 text-center border-r border-slate-700 text-white">Date</th>
                                            <th className="p-3 text-center text-white">Direct App Link</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {top10Offers.map((offer) => {
                                            const isWon = offer.status === 'PO received' || offer.status === 'Partial PO Received';
                                            const isOpen = offer.status === 'Open';
                                            const isReview = offer.status === 'Under Review' || offer.status === 'Need Amendment';

                                            return (
                                                <tr key={offer.id} className="hover:bg-indigo-50/40 transition-colors">
                                                    <td className="p-3 text-center font-extrabold text-slate-400 border-r border-slate-200">
                                                        {offer.rank}
                                                    </td>
                                                    <td className="p-3 font-bold text-indigo-600 border-r border-slate-200 whitespace-nowrap">
                                                        {offer.quotationNumber}
                                                    </td>
                                                    <td className="p-3 font-bold text-slate-800 border-r border-slate-200 max-w-[220px] truncate" title={offer.customerName}>
                                                        {offer.customerName}
                                                    </td>
                                                    <td className="p-3 font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                                        {offer.salesPerson}
                                                    </td>
                                                    <td className="p-3 text-right font-black text-slate-900 border-r border-slate-200 whitespace-nowrap">
                                                        <div className="text-indigo-700 font-extrabold">{formatCurrency(offer.amount)}</div>
                                                        <div className="text-[10px] text-slate-500 font-normal">{formatCurrencyCompact(offer.amount)}</div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200">
                                                        <span className={`inline-flex px-2.5 py-1 text-[11px] font-bold rounded-full ${
                                                            isWon
                                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                                : isOpen
                                                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                                : isReview
                                                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                                                        }`}>
                                                            {offer.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center text-slate-600 font-medium border-r border-slate-200 whitespace-nowrap">
                                                        {offer.date}
                                                    </td>
                                                    <td className="p-3 text-center whitespace-nowrap">
                                                        <a
                                                            href={offer.appLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold px-3 py-1 rounded-lg border border-indigo-200 transition-colors shadow-2xs"
                                                        >
                                                            <span>Open Offer</span>
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </a>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: Complete Draft Email Preview */}
                    {activeTab === 'preview' && (
                        <div className="space-y-4">
                            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subject Line:</div>
                                    <div className="text-xs font-bold text-slate-800 select-all mt-0.5">{emailSubject}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopySubject}
                                    className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg shadow-2xs"
                                >
                                    {copiedSubject ? '✓ Copied' : 'Copy'}
                                </button>
                            </div>

                            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-6 shadow-xs max-h-[600px] overflow-y-auto">
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
                                    Email Body Preview (Exact format copied to clipboard):
                                </div>
                                
                                <div className="prose max-w-none text-xs text-slate-700 space-y-4">
                                    <p>Respected Management Team,</p>
                                    <p>
                                        Please find below the weekly executive review of sales enquiries, quotation status breakdown, and high-value pipeline opportunities for <strong>{dateRangeLabel}</strong>.
                                    </p>
                                    
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                        <strong>Executive Highlights:</strong>
                                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                            <li>Total Enquiries Recorded: <strong>{totalEnqCount}</strong> ({formatCurrency(totalEnqVal)})</li>
                                            <li>Closed &amp; Won Orders: <strong>{poCount}</strong> ({formatCurrency(poVal)}) — Win Conversion Rate: <strong>{winRateCountPct}</strong></li>
                                            <li>Active Open Pipeline: <strong>{openCount}</strong> ({formatCurrency(openVal)}) — <strong>{openPipelineValPct}</strong> of total value</li>
                                            <li>Pending Under Review / Amendment: <strong>{underReviewCount + amendCount}</strong> ({formatCurrency(underReviewVal + amendVal)})</li>
                                        </ul>
                                    </div>

                                    <p className="font-bold text-slate-800">1. Sales Person Performance &amp; Status Breakdown:</p>
                                    <p className="text-[11px] text-slate-500 italic">[Styled responsive table with status % will be pasted into email]</p>

                                    <p className="font-bold text-slate-800">2. Top 10 High-Value Opportunities (With App Links):</p>
                                    <p className="text-[11px] text-slate-500 italic">[Top 10 offers with customer name, value, status, and direct 1-click links will be pasted into email]</p>

                                    <p className="pt-2">
                                        Warm regards,<br />
                                        <strong>{currentUser.name}</strong> ({currentUser.role})<br />
                                        Siddhi Kabel Corporation Pvt Ltd
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* HIDDEN INLINE-STYLED HTML CONTAINER FOR PERFECT CLIPBOARD COPY (GMAIL & OUTLOOK) */}
                <div ref={contentRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                    <div style={{ fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif', color: '#1e293b', maxWidth: '900px', padding: '20px', backgroundColor: '#ffffff' }}>
                        
                        {/* Title & Header */}
                        <div style={{ borderBottom: '2px solid #4338ca', paddingBottom: '12px', marginBottom: '16px' }}>
                            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '20px', fontWeight: 'bold' }}>
                                Quotation &amp; Offer Management - Executive Performance Review
                            </h2>
                            <p style={{ margin: '0', fontSize: '13px', color: '#64748b' }}>
                                <strong>Company:</strong> Siddhi Kabel Corporation Pvt Ltd &nbsp;|&nbsp; <strong>Period:</strong> {dateRangeLabel} &nbsp;|&nbsp; <strong>Date:</strong> {reportDateStr} &nbsp;|&nbsp; <strong>Prepared By:</strong> {currentUser.name}
                            </p>
                        </div>

                        {/* Executive Summary Metrics Box (Email-friendly Table) */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontFamily: 'inherit' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '25%', padding: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Enquiries</div>
                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{totalEnqCount}</div>
                                        <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 'bold' }}>{formatCurrency(totalEnqVal)}</div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>100% Pipeline Base</div>
                                    </td>
                                    <td style={{ width: '8px' }}></td>
                                    <td style={{ width: '25%', padding: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold', textTransform: 'uppercase' }}>Orders Won (PO)</div>
                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{poCount}</div>
                                        <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>{formatCurrency(poVal)}</div>
                                        <div style={{ fontSize: '10px', color: '#15803d', fontWeight: 'bold' }}>Win Rate: {winRateCountPct} ({winRateValPct} Val)</div>
                                    </td>
                                    <td style={{ width: '8px' }}></td>
                                    <td style={{ width: '25%', padding: '12px', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#6d28d9', fontWeight: 'bold', textTransform: 'uppercase' }}>Active Open Offers</div>
                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{openCount}</div>
                                        <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 'bold' }}>{formatCurrency(openVal)}</div>
                                        <div style={{ fontSize: '10px', color: '#6d28d9' }}>{openPipelineValPct} of Total Pipeline</div>
                                    </td>
                                    <td style={{ width: '8px' }}></td>
                                    <td style={{ width: '25%', padding: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 'bold', textTransform: 'uppercase' }}>Under Review / Amend</div>
                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{underReviewCount + amendCount}</div>
                                        <div style={{ fontSize: '12px', color: '#d97706', fontWeight: 'bold' }}>{formatCurrency(underReviewVal + amendVal)}</div>
                                        <div style={{ fontSize: '10px', color: '#b45309' }}>Action required</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* SECTION 1: Performance Matrix Table */}
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            1. Sales Person Enquiry &amp; Status Breakdown Matrix
                        </h3>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#0f172a' }}>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', textAlign: 'left', fontSize: '12px' }}>
                                        Sales Person
                                    </th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', textAlign: 'center', fontSize: '12px' }}>
                                        Total Enquiry<br/><span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 'normal' }}>Count / Val</span>
                                    </th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', textAlign: 'center', fontSize: '12px' }}>
                                        Open Offer<br/><span style={{ fontSize: '10px', color: '#93c5fd', fontWeight: 'normal' }}>Count / Val (%)</span>
                                    </th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', textAlign: 'center', fontSize: '12px' }}>
                                        PO Received<br/><span style={{ fontSize: '10px', color: '#86efac', fontWeight: 'normal' }}>Count / Val (%)</span>
                                    </th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', textAlign: 'center', fontSize: '12px' }}>
                                        Partial PO<br/><span style={{ fontSize: '10px', color: '#99f6e4', fontWeight: 'normal' }}>Count / Val (%)</span>
                                    </th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', textAlign: 'center', fontSize: '12px' }}>
                                        Under Review<br/><span style={{ fontSize: '10px', color: '#c7d2fe', fontWeight: 'normal' }}>Count / Val (%)</span>
                                    </th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', textAlign: 'center', fontSize: '12px' }}>
                                        Amendment<br/><span style={{ fontSize: '10px', color: '#e9d5ff', fontWeight: 'normal' }}>Count / Val (%)</span>
                                    </th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', textAlign: 'center', fontSize: '12px' }}>
                                        Lost / Expired<br/><span style={{ fontSize: '10px', color: '#fecdd3', fontWeight: 'normal' }}>Count / Val (%)</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {salesPersonStats.map((sp, idx) => {
                                    const spTotalCount = sp.total.count || 0;
                                    const spTotalVal = sp.total.value || 0;
                                    const spOpenCount = sp['Open']?.count || 0;
                                    const spOpenVal = sp['Open']?.value || 0;
                                    const spPoCount = sp['PO received']?.count || 0;
                                    const spPoVal = sp['PO received']?.value || 0;
                                    const spPartialCount = sp['Partial PO Received']?.count || 0;
                                    const spPartialVal = sp['Partial PO Received']?.value || 0;
                                    const spReviewCount = sp['Under Review']?.count || 0;
                                    const spReviewVal = sp['Under Review']?.value || 0;
                                    const spAmendCount = sp['Need Amendment']?.count || 0;
                                    const spAmendVal = sp['Need Amendment']?.value || 0;
                                    const spLostCount = (sp['Lost']?.count || 0) + (sp['Expired']?.count || 0);
                                    const spLostVal = (sp['Lost']?.value || 0) + (sp['Expired']?.value || 0);

                                    return (
                                        <tr key={sp.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                            <td style={{ padding: '8px 10px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#0f172a' }}>
                                                {sp.name}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                                                {spTotalCount} <br/><span style={{ color: '#4338ca', fontSize: '11px' }}>{formatCurrencyCompact(spTotalVal)}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spOpenCount} <span style={{ fontSize: '10px', color: '#2563eb' }}>({calcPct(spOpenCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#1d4ed8', fontSize: '11px', fontWeight: 'bold' }}>{formatCurrencyCompact(spOpenVal)}</span> <span style={{ fontSize: '10px', color: '#64748b' }}>({calcPct(spOpenVal, spTotalVal)})</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0', backgroundColor: '#f0fdf4' }}>
                                                <strong style={{ color: '#15803d' }}>{spPoCount}</strong> <span style={{ fontSize: '10px', color: '#16a34a' }}>({calcPct(spPoCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#15803d', fontSize: '11px', fontWeight: 'bold' }}>{formatCurrencyCompact(spPoVal)}</span> <span style={{ fontSize: '10px', color: '#16a34a' }}>({calcPct(spPoVal, spTotalVal)})</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spPartialCount} <span style={{ fontSize: '10px', color: '#0d9488' }}>({calcPct(spPartialCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#0f766e', fontSize: '11px' }}>{formatCurrencyCompact(spPartialVal)}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spReviewCount} <span style={{ fontSize: '10px', color: '#4f46e5' }}>({calcPct(spReviewCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#4338ca', fontSize: '11px' }}>{formatCurrencyCompact(spReviewVal)}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spAmendCount} <span style={{ fontSize: '10px', color: '#7c3aed' }}>({calcPct(spAmendCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#7e22ce', fontSize: '11px' }}>{formatCurrencyCompact(spAmendVal)}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spLostCount} <span style={{ fontSize: '10px', color: '#e11d48' }}>({calcPct(spLostCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#be123c', fontSize: '11px' }}>{formatCurrencyCompact(spLostVal)}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: '#0f172a' }}>
                                    <td style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        COMPANY TOTAL
                                    </td>
                                    <td style={{ backgroundColor: '#0f172a', color: '#fde047', fontWeight: 'bold', padding: '10px 8px', textAlign: 'center', border: '1px solid #334155', fontSize: '12px' }}>
                                        {totalEnqCount} (100%)<br/>{formatCurrencyCompact(totalEnqVal)}
                                    </td>
                                    <td style={{ backgroundColor: '#0f172a', color: '#93c5fd', fontWeight: 'bold', padding: '10px 8px', textAlign: 'center', border: '1px solid #334155', fontSize: '12px' }}>
                                        {openCount} ({calcPct(openCount, totalEnqCount)})<br/>{formatCurrencyCompact(openVal)} ({calcPct(openVal, totalEnqVal)})
                                    </td>
                                    <td style={{ backgroundColor: '#0f172a', color: '#86efac', fontWeight: 'bold', padding: '10px 8px', textAlign: 'center', border: '1px solid #334155', fontSize: '12px' }}>
                                        {poCount} ({calcPct(poCount, totalEnqCount)})<br/>{formatCurrencyCompact(poVal)} ({calcPct(poVal, totalEnqVal)})
                                    </td>
                                    <td style={{ backgroundColor: '#0f172a', color: '#99f6e4', fontWeight: 'bold', padding: '10px 8px', textAlign: 'center', border: '1px solid #334155', fontSize: '12px' }}>
                                        {partialPoCount} ({calcPct(partialPoCount, totalEnqCount)})<br/>{formatCurrencyCompact(partialPoVal)}
                                    </td>
                                    <td style={{ backgroundColor: '#0f172a', color: '#c7d2fe', fontWeight: 'bold', padding: '10px 8px', textAlign: 'center', border: '1px solid #334155', fontSize: '12px' }}>
                                        {underReviewCount} ({calcPct(underReviewCount, totalEnqCount)})<br/>{formatCurrencyCompact(underReviewVal)}
                                    </td>
                                    <td style={{ backgroundColor: '#0f172a', color: '#e9d5ff', fontWeight: 'bold', padding: '10px 8px', textAlign: 'center', border: '1px solid #334155', fontSize: '12px' }}>
                                        {amendCount} ({calcPct(amendCount, totalEnqCount)})<br/>{formatCurrencyCompact(amendVal)}
                                    </td>
                                    <td style={{ backgroundColor: '#0f172a', color: '#fecdd3', fontWeight: 'bold', padding: '10px 8px', textAlign: 'center', border: '1px solid #334155', fontSize: '12px' }}>
                                        {lostCount} ({calcPct(lostCount, totalEnqCount)})<br/>{formatCurrencyCompact(lostVal)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* SECTION 2: Top 10 High Value Offers Table with Direct App Link */}
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            2. Top 10 High-Value Offers (With 1-Click App Links)
                        </h3>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1', marginBottom: '20px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#0f172a' }}>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '8px 6px', border: '1px solid #334155', textAlign: 'center', width: '30px' }}>#</th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '8px 10px', border: '1px solid #334155', textAlign: 'left' }}>Quotation Ref</th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '8px 10px', border: '1px solid #334155', textAlign: 'left' }}>Customer</th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '8px 10px', border: '1px solid #334155', textAlign: 'left' }}>Sales Person</th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '8px 10px', border: '1px solid #334155', textAlign: 'right' }}>Amount (INR)</th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '8px 10px', border: '1px solid #334155', textAlign: 'center' }}>Status</th>
                                    <th style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '8px 10px', border: '1px solid #334155', textAlign: 'center' }}>App Link</th>
                                </tr>
                            </thead>
                            <tbody>
                                {top10Offers.map((offer, idx) => (
                                    <tr key={offer.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                            {offer.rank}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#4338ca' }}>
                                            {offer.quotationNumber}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#1e293b' }}>
                                            {offer.customerName}
                                        </td>
                                        <td style={{ padding: '8px 10px', border: '1px solid #e2e8f0', color: '#334155' }}>
                                            {offer.salesPerson}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#0f172a' }}>
                                            {formatCurrency(offer.amount)}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold', color: offer.status === 'PO received' ? '#15803d' : offer.status === 'Open' ? '#1d4ed8' : '#b45309' }}>
                                            {offer.status}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                            <a
                                                href={offer.appLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#4338ca', fontWeight: 'bold', textDecoration: 'underline', backgroundColor: '#e0e7ff', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', display: 'inline-block' }}
                                            >
                                                Open Offer ↗
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Sign-off footer */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', fontSize: '11px', color: '#64748b' }}>
                            <p style={{ margin: '0 0 4px 0' }}>
                                Report generated from <strong>Siddhi Kabel Corporation Offer Management System</strong>.
                            </p>
                            <p style={{ margin: '0' }}>
                                Direct Application Portal: <a href="https://offer-managment.vercel.app" style={{ color: '#4338ca' }}>https://offer-managment.vercel.app</a>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-500 font-medium hidden sm:block">
                        Tip: Click <strong>"Copy Rich Email"</strong> to paste directly into Microsoft Outlook or Gmail compose window.
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={handleCopyHtml}
                            className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5 ${
                                copiedHtml ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {copiedHtml ? '✓ Rich Email Copied!' : 'Copy Email Report'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
