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
    const reviewAmendCountPct = calcPct(underReviewCount + amendCount, totalEnqCount);

    // Compute Top 10 High Value Offers (Filtered for Latest 1 Month / 30 Days)
    const top10Offers = useMemo(() => {
        const list = [...(quotations || [])];
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
        oneMonthAgo.setHours(0, 0, 0, 0);

        // Filter for offers from the last 30 days
        let recentList = list.filter(q => {
            if (!q || calculateTotalAmount(q) <= 0) return false;
            if (!q.quotationDate) return false;
            const d = new Date(q.quotationDate);
            return !isNaN(d.getTime()) && d >= oneMonthAgo;
        });

        // If fewer than 10 offers in last 30 days, fall back to recent non-zero offers
        if (recentList.length < 5) {
            recentList = list.filter(q => q && calculateTotalAmount(q) > 0);
        }

        return recentList
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

    // Plain text version for WhatsApp / SMS / Plain email
    const generatePlainText = () => {
        let text = `Dear Sir,\n\n`;
        text += `Please find below the Quotation Management & Sales Enquiry Weekly Performance Review for ${dateRangeLabel} (${reportDateStr}).\n\n`;
        text += `📌 ACTION REQUIRED:\n`;
        text += `Please review your offers and update the status directly on the portal:\n`;
        text += `👉 https://offer-managment.vercel.app\n\n`;
        text += `==================================================\n`;
        text += `WEEKLY SALES & QUOTATION REVIEW DASHBOARD\n`;
        text += `Siddhi Kabel Corporation Pvt Ltd\n`;
        text += `==================================================\n`;
        text += `Subject: ${emailSubject}\n`;
        text += `Period: ${dateRangeLabel} | Date: ${reportDateStr}\n`;
        text += `Prepared By: ${currentUser.name} (${currentUser.role})\n\n`;

        text += `--- 1. EXECUTIVE KPI SUMMARY ---\n`;
        text += `• Total Enquiries: ${totalEnqCount} | ${formatCurrencyCompact(totalEnqVal)} (100% Pipeline Base)\n`;
        text += `• PO Received (Won): ${poCount} | ${formatCurrencyCompact(poVal)} (${winRateValPct}) [Win Rate: ${winRateCountPct}]\n`;
        text += `• Open Offers: ${openCount} | ${formatCurrencyCompact(openVal)} (${calcPct(openCount, totalEnqCount)}) [${openPipelineValPct} of Pipeline]\n`;
        text += `• Review / Amend: ${underReviewCount + amendCount} | ${formatCurrencyCompact(underReviewVal + amendVal)} (${reviewAmendCountPct})\n\n`;

        text += `--- 2. SALES PERSON PERFORMANCE & STATUS MATRIX ---\n`;
        salesPersonStats.forEach(sp => {
            const spLostCount = (sp['Lost']?.count || 0) + (sp['Expired']?.count || 0);
            const spLostVal = (sp['Lost']?.value || 0) + (sp['Expired']?.value || 0);
            text += `👤 ${sp.name.toUpperCase()}\n`;
            text += `   • Total: ${sp.total.count} (${calcPct(sp.total.count, totalEnqCount)} of co.) | ${formatCurrencyCompact(sp.total.value)}\n`;
            text += `   • Open Offers: ${sp['Open']?.count || 0} (${calcPct(sp['Open']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['Open']?.value || 0)} (${calcPct(sp['Open']?.value || 0, sp.total.value)})\n`;
            text += `   • PO Received: ${sp['PO received']?.count || 0} (${calcPct(sp['PO received']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['PO received']?.value || 0)} (${calcPct(sp['PO received']?.value || 0, sp.total.value)})\n`;
            text += `   • Partial PO: ${sp['Partial PO Received']?.count || 0} (${calcPct(sp['Partial PO Received']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['Partial PO Received']?.value || 0)}\n`;
            text += `   • Under Review: ${sp['Under Review']?.count || 0} (${calcPct(sp['Under Review']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['Under Review']?.value || 0)}\n`;
            text += `   • Need Amend: ${sp['Need Amendment']?.count || 0} (${calcPct(sp['Need Amendment']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['Need Amendment']?.value || 0)}\n`;
            text += `   • Lost/Expired: ${spLostCount} (${calcPct(spLostCount, sp.total.count)}) | ${formatCurrencyCompact(spLostVal)}\n\n`;
        });

        text += `--- 3. TOP 10 HIGH-VALUE OFFERS (LATEST 1 MONTH) ---\n`;
        top10Offers.forEach(o => {
            text += `#${o.rank}. ${o.quotationNumber} | ${formatCurrency(o.amount)}\n`;
            text += `    Customer: ${o.customerName}\n`;
            text += `    Sales Person: ${o.salesPerson} | Status: ${o.status} | Date: ${o.date}\n`;
            text += `    App Link: ${o.appLink}\n\n`;
        });

        text += `--------------------------------------------------\n`;
        text += `GRAND TOTAL: ${totalEnqCount} Enquiries | Value: ${formatCurrency(totalEnqVal)}\n\n`;
        text += `Thanks & Best Regards,\n`;
        text += `${currentUser.name}\n`;
        text += `${currentUser.role} | Sales & Commercial Operations\n`;
        text += `Siddhi Kabel Corporation Pvt. Ltd.\n`;
        text += `Manufacturers of High Temperature & Speciality Cables\n`;
        text += `🔗 Portal: https://offer-managment.vercel.app\n`;
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
                                Executive Performance Matrix • Offer Status % Breakdown • Top 10 High Value Offers (Latest 1 Mo)
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
                            🏆 Top 10 Offers (Latest 1 Mo)
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full text-[10px]">{top10Offers.length}</span>
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
                    
                    {/* Top Executive KPI Cards Summary (Always visible - Image 3 Format) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Card 1: Total Enquiries */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 border border-blue-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">TOTAL ENQUIRIES</span>
                                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded">100%</span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{totalEnqCount}</div>
                            <div className="text-xs font-bold text-blue-700 mt-0.5">{formatCurrencyCompact(totalEnqVal)}</div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium">Pipeline volume</div>
                        </div>

                        {/* Card 2: PO Received (Won) */}
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">PO RECEIVED (WON)</span>
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

                        {/* Card 3: Open Offers */}
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/40 border border-indigo-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">OPEN OFFERS</span>
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

                        {/* Card 4: Review / Amend */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">REVIEW / AMEND</span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded">Action</span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{underReviewCount + amendCount}</div>
                            <div className="text-xs font-bold text-amber-700 mt-0.5">
                                {formatCurrencyCompact(underReviewVal + amendVal)} <span className="text-[10px] text-amber-600 font-semibold">({reviewAmendCountPct})</span>
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
                                                <div className="text-[11px] text-teal-300 font-bold">{formatCurrencyCompact(partialPoVal)}</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-700 bg-indigo-950 text-indigo-200">
                                                <div className="font-bold">{underReviewCount} ({calcPct(underReviewCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-indigo-300">{formatCurrencyCompact(underReviewVal)}</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-700 bg-purple-950 text-purple-200">
                                                <div className="font-bold">{amendCount} ({calcPct(amendCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-purple-300">{formatCurrencyCompact(amendVal)}</div>
                                            </td>
                                            <td className="p-3 text-center bg-rose-950 text-rose-200">
                                                <div className="font-bold">{lostCount} ({calcPct(lostCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-rose-300">{formatCurrencyCompact(lostVal)}</div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: Latest 10 High Value Offers (Last 1 Month) */}
                    {activeTab === 'top10' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-black text-slate-800 tracking-wide uppercase">
                                        Top 10 High-Value Quotations &amp; Opportunities (Latest 1 Month)
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                        Highest-value offers quoted in the last 30 days with direct 1-click app links.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
                                    Last 30 Days Window
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
                                    <p className="text-sm font-semibold text-slate-900">Dear Sir,</p>
                                    <p>
                                        Please find below the Quotation Management &amp; Sales Enquiry Weekly Performance Review for <strong>{dateRangeLabel}</strong> ({reportDateStr}).
                                    </p>
                                    
                                    {/* Action Required Banner at Top */}
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-amber-900">
                                        <div className="text-xs">
                                            <strong>⚡ Action Required:</strong> Please review your offers and update the current status on the portal.
                                        </div>
                                        <a
                                            href="https://offer-managment.vercel.app"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs whitespace-nowrap"
                                        >
                                            Review Offers &amp; Update Status ↗
                                        </a>
                                    </div>
                                    
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                        <strong>Executive Highlights:</strong>
                                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                            <li>Total Enquiries: <strong>{totalEnqCount}</strong> ({formatCurrencyCompact(totalEnqVal)})</li>
                                            <li>Orders Won (PO Received): <strong>{poCount}</strong> ({formatCurrencyCompact(poVal)}) — Win Rate: <strong>{winRateCountPct}</strong></li>
                                            <li>Active Open Offers: <strong>{openCount}</strong> ({formatCurrencyCompact(openVal)}) — <strong>{openPipelineValPct}</strong> of total value</li>
                                            <li>Review / Amend: <strong>{underReviewCount + amendCount}</strong> ({formatCurrencyCompact(underReviewVal + amendVal)})</li>
                                        </ul>
                                    </div>

                                    <p className="font-bold text-slate-800">1. Sales Person Performance &amp; Status Breakdown Matrix</p>
                                    <p className="text-[11px] text-slate-500 italic">[Styled responsive table with visible white headers and % share]</p>

                                    <p className="font-bold text-slate-800">2. Top 10 High-Value Offers (Latest 1 Month - With 1-Click App Links)</p>
                                    <p className="text-[11px] text-slate-500 italic">[Top 10 highest-value offers with customer, sales person, value, and direct app links]</p>

                                    <div className="pt-4 border-t border-slate-200 text-xs text-slate-800 space-y-1">
                                        <p>Thanks &amp; Best Regards,</p>
                                        <p className="font-bold text-slate-900">{currentUser.name}</p>
                                        <p className="text-slate-500">{currentUser.role} | Sales &amp; Commercial Operations</p>
                                        <p className="font-bold text-indigo-900">Siddhi Kabel Corporation Pvt. Ltd.</p>
                                        <p className="text-slate-500 text-[11px]">Manufacturers of High Temperature &amp; Speciality Cables</p>
                                        <p className="text-indigo-600 font-semibold pt-1">
                                            🔗 Portal: <a href="https://offer-managment.vercel.app" target="_blank" rel="noopener noreferrer" className="underline">https://offer-managment.vercel.app</a>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* HIDDEN INLINE-STYLED HTML CONTAINER FOR PERFECT CLIPBOARD COPY (GMAIL & OUTLOOK) */}
                <div ref={contentRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                    <div style={{ fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif', color: '#1e293b', maxWidth: '900px', padding: '20px', backgroundColor: '#ffffff' }}>
                        
                        {/* 1. GREETING - Dear Sir, */}
                        <p style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#0f172a', fontWeight: 'bold' }}>
                            Dear Sir,
                        </p>
                        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                            Please find below the Quotation Management &amp; Sales Enquiry Weekly Performance Review for <strong>{dateRangeLabel}</strong> ({reportDateStr}).
                        </p>

                        {/* Top Action Required Callout Banner with Link */}
                        <table width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ width: '100%', marginBottom: '18px', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '12px 14px', fontSize: '13px', color: '#92400e' }}>
                                        <font color="#92400e">
                                            <strong>📌 Action Required:</strong> Please review your offers and update the status directly on the portal:&nbsp;
                                        </font>
                                        <a
                                            href="https://offer-managment.vercel.app"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: '#ffffff',
                                                backgroundColor: '#4338ca',
                                                fontWeight: 'bold',
                                                textDecoration: 'none',
                                                padding: '6px 14px',
                                                borderRadius: '6px',
                                                display: 'inline-block',
                                                fontSize: '12px',
                                                marginLeft: '8px',
                                            }}
                                        >
                                            <font color="#ffffff"><b>Review Offers &amp; Update Status ↗</b></font>
                                        </a>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Title Bar */}
                        <div style={{ borderBottom: '2px solid #4338ca', paddingBottom: '10px', marginBottom: '16px' }}>
                            <h2 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '18px', fontWeight: 'bold' }}>
                                Quotation &amp; Offer Management - Executive Performance Review
                            </h2>
                            <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>
                                <strong>Company:</strong> Siddhi Kabel Corporation Pvt Ltd &nbsp;|&nbsp; <strong>Period:</strong> {dateRangeLabel} &nbsp;|&nbsp; <strong>Date:</strong> {reportDateStr} &nbsp;|&nbsp; <strong>Prepared By:</strong> {currentUser.name}
                            </p>
                        </div>

                        {/* 2. EXECUTIVE KPI CARDS TABLE (EXACT IMAGE 3 FORMAT WITH PILLS & COMPACT VALUES) */}
                        <table width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px 0', marginBottom: '22px' }}>
                            <tbody>
                                <tr>
                                    {/* Card 1: TOTAL ENQUIRIES */}
                                    <td width="25%" valign="top" style={{ width: '25%', padding: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px' }}>
                                        <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
                                            <tbody>
                                                <tr>
                                                    <td align="left" style={{ fontSize: '11px', fontWeight: 'bold', color: '#1d4ed8', textTransform: 'uppercase' }}>
                                                        <font color="#1d4ed8"><b>TOTAL ENQUIRIES</b></font>
                                                    </td>
                                                    <td align="right">
                                                        <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '6px', display: 'inline-block' }}>
                                                            <font color="#1e40af"><b>100%</b></font>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', padding: '6px 0 2px 0' }}>
                                                        <font color="#0f172a"><b>{totalEnqCount}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '13px', fontWeight: 'bold', color: '#1d4ed8' }}>
                                                        <font color="#1d4ed8"><b>{formatCurrencyCompact(totalEnqVal)}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '10px', color: '#64748b', paddingTop: '4px' }}>
                                                        <font color="#64748b">Pipeline volume</font>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>

                                    {/* Card 2: PO RECEIVED (WON) */}
                                    <td width="25%" valign="top" style={{ width: '25%', padding: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px' }}>
                                        <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
                                            <tbody>
                                                <tr>
                                                    <td align="left" style={{ fontSize: '11px', fontWeight: 'bold', color: '#15803d', textTransform: 'uppercase' }}>
                                                        <font color="#15803d"><b>PO RECEIVED (WON)</b></font>
                                                    </td>
                                                    <td align="right">
                                                        <span style={{ backgroundColor: '#dcfce7', color: '#166534', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '6px', display: 'inline-block' }}>
                                                            <font color="#166534"><b>{winRateCountPct} Win</b></font>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', padding: '6px 0 2px 0' }}>
                                                        <font color="#0f172a"><b>{poCount}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '13px', fontWeight: 'bold', color: '#15803d' }}>
                                                        <font color="#15803d"><b>{formatCurrencyCompact(poVal)}</b></font>
                                                        &nbsp;<font color="#16a34a"><span style={{ fontSize: '11px', fontWeight: '600' }}>({winRateValPct})</span></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '10px', color: '#64748b', paddingTop: '4px' }}>
                                                        <font color="#64748b">Closed orders confirmed</font>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>

                                    {/* Card 3: OPEN OFFERS */}
                                    <td width="25%" valign="top" style={{ width: '25%', padding: '12px', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px' }}>
                                        <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
                                            <tbody>
                                                <tr>
                                                    <td align="left" style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', textTransform: 'uppercase' }}>
                                                        <font color="#4338ca"><b>OPEN OFFERS</b></font>
                                                    </td>
                                                    <td align="right">
                                                        <span style={{ backgroundColor: '#ede9fe', color: '#5b21b6', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '6px', display: 'inline-block' }}>
                                                            <font color="#5b21b6"><b>{openPipelineValPct} Val</b></font>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', padding: '6px 0 2px 0' }}>
                                                        <font color="#0f172a"><b>{openCount}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '13px', fontWeight: 'bold', color: '#4338ca' }}>
                                                        <font color="#4338ca"><b>{formatCurrencyCompact(openVal)}</b></font>
                                                        &nbsp;<font color="#6366f1"><span style={{ fontSize: '11px', fontWeight: '600' }}>({calcPct(openCount, totalEnqCount)})</span></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '10px', color: '#64748b', paddingTop: '4px' }}>
                                                        <font color="#64748b">Active offers in negotiation</font>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>

                                    {/* Card 4: REVIEW / AMEND */}
                                    <td width="25%" valign="top" style={{ width: '25%', padding: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px' }}>
                                        <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
                                            <tbody>
                                                <tr>
                                                    <td align="left" style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309', textTransform: 'uppercase' }}>
                                                        <font color="#b45309"><b>REVIEW / AMEND</b></font>
                                                    </td>
                                                    <td align="right">
                                                        <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '6px', display: 'inline-block' }}>
                                                            <font color="#92400e"><b>Action</b></font>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', padding: '6px 0 2px 0' }}>
                                                        <font color="#0f172a"><b>{underReviewCount + amendCount}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '13px', fontWeight: 'bold', color: '#b45309' }}>
                                                        <font color="#b45309"><b>{formatCurrencyCompact(underReviewVal + amendVal)}</b></font>
                                                        &nbsp;<font color="#d97706"><span style={{ fontSize: '11px', fontWeight: '600' }}>({reviewAmendCountPct})</span></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '10px', color: '#64748b', paddingTop: '4px' }}>
                                                        <font color="#64748b">Pending technical/price revision</font>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* SECTION 1: Performance Matrix Table (BULLETPROOF WHITE HEADERS FOR OUTLOOK & GMAIL) */}
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            1. Sales Person Enquiry &amp; Status Breakdown Matrix
                        </h3>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
                            <thead>
                                <tr bgcolor="#0f172a" style={{ backgroundColor: '#0f172a' }}>
                                    <td bgcolor="#0f172a" align="left" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Sales Person</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Total Enquiry</b></font><br/>
                                        <font color="#cbd5e1"><span style={{ fontSize: '10px', color: '#cbd5e1' }}>Count / Val</span></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Open Offer</b></font><br/>
                                        <font color="#93c5fd"><span style={{ fontSize: '10px', color: '#93c5fd' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>PO Received</b></font><br/>
                                        <font color="#86efac"><span style={{ fontSize: '10px', color: '#86efac' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Partial PO</b></font><br/>
                                        <font color="#99f6e4"><span style={{ fontSize: '10px', color: '#99f6e4' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Under Review</b></font><br/>
                                        <font color="#c7d2fe"><span style={{ fontSize: '10px', color: '#c7d2fe' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Amendment</b></font><br/>
                                        <font color="#e9d5ff"><span style={{ fontSize: '10px', color: '#e9d5ff' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Lost / Expired</b></font><br/>
                                        <font color="#fecdd3"><span style={{ fontSize: '10px', color: '#fecdd3' }}>Count / Val (%)</span></font>
                                    </td>
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
                                <tr bgcolor="#0f172a" style={{ backgroundColor: '#0f172a' }}>
                                    <td bgcolor="#0f172a" align="left" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>COMPANY TOTAL</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#fde047', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#fde047"><b>{totalEnqCount} (100%)<br/>{formatCurrencyCompact(totalEnqVal)}</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#93c5fd', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#93c5fd"><b>{openCount} ({calcPct(openCount, totalEnqCount)})<br/>{formatCurrencyCompact(openVal)} ({calcPct(openVal, totalEnqVal)})</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#86efac', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#86efac"><b>{poCount} ({calcPct(poCount, totalEnqCount)})<br/>{formatCurrencyCompact(poVal)} ({calcPct(poVal, totalEnqVal)})</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#99f6e4', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#99f6e4"><b>{partialPoCount} ({calcPct(partialPoCount, totalEnqCount)})<br/>{formatCurrencyCompact(partialPoVal)}</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#c7d2fe', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#c7d2fe"><b>{underReviewCount} ({calcPct(underReviewCount, totalEnqCount)})<br/>{formatCurrencyCompact(underReviewVal)}</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#e9d5ff', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#e9d5ff"><b>{amendCount} ({calcPct(amendCount, totalEnqCount)})<br/>{formatCurrencyCompact(amendVal)}</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#fecdd3', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#fecdd3"><b>{lostCount} ({calcPct(lostCount, totalEnqCount)})<br/>{formatCurrencyCompact(lostVal)}</b></font>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* SECTION 2: TOP 10 HIGH VALUE OFFERS (LATEST 1 MONTH - WITH APP LINKS) */}
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            2. Top 10 High-Value Offers (Latest 1 Month - With 1-Click App Links)
                        </h3>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
                            <thead>
                                <tr bgcolor="#0f172a" style={{ backgroundColor: '#0f172a' }}>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #334155', fontSize: '12px', width: '30px' }}>
                                        <font color="#ffffff"><b>#</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="left" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Quotation Ref</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="left" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Customer Name</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="left" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Sales Person</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="right" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Offer Value (INR)</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Status</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>Date</b></font>
                                    </td>
                                    <td bgcolor="#0f172a" align="center" style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #334155', fontSize: '12px' }}>
                                        <font color="#ffffff"><b>App Link</b></font>
                                    </td>
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
                                        <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                            {offer.date}
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

                        {/* 3. SIGNATURE - Full Executive Sign-off */}
                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #e2e8f0', fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif' }}>
                            <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#334155' }}>
                                Thanks &amp; Best Regards,
                            </p>
                            <p style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                                {currentUser.name}
                            </p>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b' }}>
                                {currentUser.role} | Sales &amp; Commercial Operations
                            </p>
                            <p style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 'bold', color: '#1e3a8a' }}>
                                Siddhi Kabel Corporation Pvt. Ltd.
                            </p>
                            <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#64748b' }}>
                                Manufacturers of High Temperature &amp; Speciality Cables
                            </p>
                            <p style={{ margin: '0', fontSize: '11px', color: '#4338ca' }}>
                                🔗 System Portal: <a href="https://offer-managment.vercel.app" style={{ color: '#4338ca', textDecoration: 'underline', fontWeight: 'bold' }}>https://offer-managment.vercel.app</a>
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
