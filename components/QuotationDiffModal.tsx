import React, { useRef } from 'react';
import type { Quotation, Customer, SalesPerson } from '../types';
import { calculateQuotationDiff, QuotationDiffResult } from '../utils/quotationDiff';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';

interface QuotationDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation;
  customer?: Customer | null;
  salesPerson?: SalesPerson | null;
  allQuotations: Quotation[];
  logoUrl?: string | null;
}

export const QuotationDiffModal: React.FC<QuotationDiffModalProps> = ({
  isOpen,
  onClose,
  quotation,
  customer,
  salesPerson,
  allQuotations,
  logoUrl,
}) => {
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !quotation) return null;

  const diff: QuotationDiffResult = calculateQuotationDiff(quotation);
  const qtnFormattedNo = generateFormattedQuotationNumber(quotation, allQuotations);
  // Base quotation number without (Rev X) for initial
  const baseQtnNo = qtnFormattedNo.replace(/\s*\(Rev\s*\d+\)/i, '');
  const initialQtnNo = `${baseQtnNo} (Rev 0)`;
  const finalQtnNo = `${baseQtnNo} (Rev ${diff.revisionNumber})`;

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (num: number) => {
    return '₹' + Math.abs(num).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDelta = (val: number, isCurrency = true) => {
    if (Math.abs(val) < 0.001) return <span className="text-slate-400 font-normal">—</span>;
    const isPositive = val > 0;
    const formatted = isCurrency ? formatCurrency(val) : Math.abs(val);
    return (
      <span className={`font-bold ${isPositive ? 'text-indigo-700' : 'text-emerald-700'}`}>
        {isPositive ? `+${formatted}` : `-${formatted}`}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Print styles specifically for the Comparison Sheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #quotation-diff-sheet, #quotation-diff-sheet * {
            visibility: visible;
          }
          #quotation-diff-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .no-print-diff {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="quotation-diff-sheet"
        ref={printContainerRef}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Header Bar */}
        <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 sm:p-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/40 border border-indigo-400/30 rounded-lg shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m-3-3h6" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-white">
                  Quotation Revision Variance Analysis
                </h2>
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                  Rev {diff.revisionNumber} vs Rev 0
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Detailed comparison: Initial Offer (Rev 0) vs Final Amended Offer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 no-print-diff">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Print official comparison sheet"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print Comparison</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-5 space-y-4 bg-slate-50/50">
          
          {/* Metadata Card */}
          <div className="bg-white rounded-lg p-3 sm:p-4 border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer</span>
              <p className="font-bold text-slate-800 text-sm">{customer?.name || 'Customer'}</p>
              <p className="text-[11px] text-slate-500 truncate">{customer?.city ? `${customer.city} - ${customer.pincode || ''}` : ''}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quotation Reference</span>
              <p className="font-bold text-indigo-700 text-xs">{finalQtnNo}</p>
              <p className="text-[10px] text-slate-500">Initial Ref: {initialQtnNo}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Offer Timeline</span>
              <p className="text-[11px] text-slate-700">
                <span className="font-semibold text-slate-500">Initial Date:</span> {diff.initialDate || 'N/A'}
              </p>
              <p className="text-[11px] text-slate-700">
                <span className="font-semibold text-slate-500">Amended Date:</span> {diff.finalDate || 'N/A'}
              </p>
            </div>
          </div>

          {/* Commercial Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
            {/* Initial Total Card */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Initial Offer (Rev 0)</span>
              <div className="text-base sm:text-lg font-black text-slate-700 mt-1">
                {formatCurrency(diff.initialGrandTotal)}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">{diff.totalInitialItems} line items quoted</p>
            </div>

            {/* Final Total Card */}
            <div className="bg-white p-3 rounded-lg border border-indigo-200 bg-indigo-50/20 shadow-xs">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Final Offer (Rev {diff.revisionNumber})</span>
              <div className="text-base sm:text-lg font-black text-indigo-950 mt-1">
                {formatCurrency(diff.finalGrandTotal)}
              </div>
              <p className="text-[10px] text-indigo-600 mt-0.5">{diff.totalFinalItems} line items quoted</p>
            </div>

            {/* Commercial Variance Card */}
            <div className={`p-3 rounded-lg border shadow-xs ${
              diff.grandTotalDelta < 0
                ? 'bg-emerald-50/80 border-emerald-300'
                : diff.grandTotalDelta > 0
                ? 'bg-amber-50/80 border-amber-300'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-600">Net Variance</span>
              <div className="text-base sm:text-lg font-black mt-1">
                {formatDelta(diff.grandTotalDelta)}
              </div>
              <p className="text-[10px] font-semibold mt-0.5 text-slate-600">
                {diff.percentageChange !== 0 ? `${diff.percentageChange > 0 ? '+' : ''}${diff.percentageChange.toFixed(2)}% overall` : 'No net change'}
              </p>
            </div>

            {/* Line Items Breakdown Card */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Item Modifications</span>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {diff.modifiedCount > 0 && (
                  <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-1.5 py-0.5 rounded text-[10px]">
                    {diff.modifiedCount} Modified
                  </span>
                )}
                {diff.addedCount > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-1.5 py-0.5 rounded text-[10px]">
                    +{diff.addedCount} Added
                  </span>
                )}
                {diff.removedCount > 0 && (
                  <span className="bg-rose-100 text-rose-800 border border-rose-300 font-bold px-1.5 py-0.5 rounded text-[10px]">
                    -{diff.removedCount} Removed
                  </span>
                )}
                {diff.unchangedCount > 0 && (
                  <span className="bg-slate-100 text-slate-600 border border-slate-200 font-semibold px-1.5 py-0.5 rounded text-[10px]">
                    {diff.unchangedCount} Unchanged
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Terms and Conditions Diff Notice (if changed) */}
          {(diff.paymentTermsChange.changed || diff.otherTermsChange.changed || diff.gstAddedChange.changed) && (
            <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-3 text-xs text-amber-950 shadow-xs space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-900 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Terms & Conditions Changed in Revision</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                {diff.paymentTermsChange.changed && (
                  <div className="bg-white/80 p-2 rounded border border-amber-200">
                    <span className="font-bold block text-slate-600">Payment Terms:</span>
                    <span className="text-rose-600 line-through mr-2">{diff.paymentTermsChange.initial || 'N/A'}</span>
                    <span className="font-bold text-emerald-700">➔ {diff.paymentTermsChange.final}</span>
                  </div>
                )}
                {diff.otherTermsChange.changed && (
                  <div className="bg-white/80 p-2 rounded border border-amber-200">
                    <span className="font-bold block text-slate-600">Other Terms:</span>
                    <span className="text-rose-600 line-through mr-2">{diff.otherTermsChange.initial || 'N/A'}</span>
                    <span className="font-bold text-emerald-700">➔ {diff.otherTermsChange.final}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Side-by-Side Comparison Table */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden">
            <div className="p-2.5 bg-slate-100 border-b border-slate-300 font-bold text-xs text-slate-800 flex items-center justify-between">
              <span>Item-by-Item Variance Grid</span>
              <span className="text-[10px] text-slate-500 font-normal">
                Color key: <span className="text-amber-700 font-bold">Modified</span> • <span className="text-emerald-700 font-bold">Added</span> • <span className="text-rose-700 font-bold">Removed</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-700 border-b border-slate-300 uppercase text-[9px] font-black tracking-wider">
                    <th className="p-1.5 text-center border-r border-slate-300 w-8" rowSpan={2}>#</th>
                    <th className="p-1.5 text-left border-r border-slate-300 min-w-[180px]" rowSpan={2}>Part No & Description</th>
                    <th className="p-1.5 text-center bg-slate-300/70 border-r border-slate-300" colSpan={4}>Initial Offer (Rev 0)</th>
                    <th className="p-1.5 text-center bg-indigo-100 text-indigo-900 border-r border-slate-300" colSpan={4}>Final Offer (Rev {diff.revisionNumber})</th>
                    <th className="p-1.5 text-center bg-slate-200" colSpan={3}>Variance / Delta</th>
                  </tr>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-300 text-[9px] font-bold">
                    {/* Initial subheaders */}
                    <th className="p-1 text-center border-r border-slate-200">Qty</th>
                    <th className="p-1 text-right border-r border-slate-200">Rate</th>
                    <th className="p-1 text-center border-r border-slate-200">Disc%</th>
                    <th className="p-1 text-right border-r border-slate-300 bg-slate-200/50">Amount</th>
                    {/* Final subheaders */}
                    <th className="p-1 text-center border-r border-slate-200">Qty</th>
                    <th className="p-1 text-right border-r border-slate-200">Rate</th>
                    <th className="p-1 text-center border-r border-slate-200">Disc%</th>
                    <th className="p-1 text-right border-r border-slate-300 bg-indigo-50 font-black">Amount</th>
                    {/* Delta subheaders */}
                    <th className="p-1 text-center border-r border-slate-200">Qty Δ</th>
                    <th className="p-1 text-right border-r border-slate-200">Amount Δ</th>
                    <th className="p-1 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {diff.items.map((item, idx) => {
                    let rowBg = 'hover:bg-slate-50';
                    if (item.status === 'added') rowBg = 'bg-emerald-50/60 hover:bg-emerald-50';
                    else if (item.status === 'removed') rowBg = 'bg-rose-50/60 hover:bg-rose-50';
                    else if (item.status === 'modified') rowBg = 'bg-amber-50/40 hover:bg-amber-50/70';

                    return (
                      <tr key={item.key || idx} className={`${rowBg} transition-colors`}>
                        {/* # */}
                        <td className="p-1.5 text-center font-bold text-slate-500 border-r border-slate-200">
                          {idx + 1}
                        </td>

                        {/* Part No & Description */}
                        <td className="p-1.5 border-r border-slate-200 max-w-[220px]">
                          <div className="font-bold text-slate-900 truncate" title={item.partNo}>
                            {item.partNo || '—'}
                          </div>
                          <div className="text-[10px] text-slate-500 line-clamp-1 truncate" title={item.description}>
                            {item.description}
                          </div>
                        </td>

                        {/* INITIAL: Qty */}
                        <td className="p-1.5 text-center border-r border-slate-200 text-slate-700">
                          {item.status === 'added' ? '—' : item.initialMoq}
                        </td>
                        {/* INITIAL: Rate */}
                        <td className="p-1.5 text-right border-r border-slate-200 text-slate-700 font-mono text-[10px]">
                          {item.status === 'added' ? '—' : item.initialPrice.toFixed(2)}
                        </td>
                        {/* INITIAL: Disc% */}
                        <td className="p-1.5 text-center border-r border-slate-200 text-slate-700 font-mono text-[10px]">
                          {item.status === 'added' ? '—' : `${item.initialDiscount}%`}
                        </td>
                        {/* INITIAL: Amount */}
                        <td className="p-1.5 text-right border-r border-slate-300 bg-slate-100/50 text-slate-700 font-mono text-[10px] font-semibold">
                          {item.status === 'added' ? '—' : formatCurrency(item.initialAmount)}
                        </td>

                        {/* FINAL: Qty */}
                        <td className={`p-1.5 text-center border-r border-slate-200 ${item.hasMoqChanged ? 'font-black text-indigo-700 bg-indigo-50/50' : 'text-slate-700'}`}>
                          {item.status === 'removed' ? '—' : item.finalMoq}
                        </td>
                        {/* FINAL: Rate */}
                        <td className={`p-1.5 text-right border-r border-slate-200 font-mono text-[10px] ${item.hasPriceChanged ? 'font-black text-indigo-700 bg-indigo-50/50' : 'text-slate-700'}`}>
                          {item.status === 'removed' ? '—' : item.finalPrice.toFixed(2)}
                        </td>
                        {/* FINAL: Disc% */}
                        <td className={`p-1.5 text-center border-r border-slate-200 font-mono text-[10px] ${item.hasDiscountChanged ? 'font-black text-indigo-700 bg-indigo-50/50' : 'text-slate-700'}`}>
                          {item.status === 'removed' ? '—' : `${item.finalDiscount}%`}
                        </td>
                        {/* FINAL: Amount */}
                        <td className="p-1.5 text-right border-r border-slate-300 bg-indigo-50/70 font-mono text-[10px] font-bold text-slate-900">
                          {item.status === 'removed' ? '—' : formatCurrency(item.finalAmount)}
                        </td>

                        {/* DELTA: Qty */}
                        <td className="p-1.5 text-center border-r border-slate-200 font-mono text-[10px]">
                          {formatDelta(item.moqDelta, false)}
                        </td>
                        {/* DELTA: Amount */}
                        <td className="p-1.5 text-right border-r border-slate-200 font-mono text-[10px]">
                          {formatDelta(item.amountDelta, true)}
                        </td>
                        {/* STATUS BADGE */}
                        <td className="p-1.5 text-center">
                          {item.status === 'added' && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                              + Added
                            </span>
                          )}
                          {item.status === 'removed' && (
                            <span className="bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                              - Removed
                            </span>
                          )}
                          {item.status === 'modified' && (
                            <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                              Modified
                            </span>
                          )}
                          {item.status === 'unchanged' && (
                            <span className="text-slate-400 text-[9px]">
                              Unchanged
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Table Footer Totals */}
                <tfoot>
                  {/* Subtotal */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-700">
                    <td colSpan={2} className="p-2 text-right uppercase text-[10px] tracking-wider border-r border-slate-300">
                      Subtotal
                    </td>
                    <td colSpan={4} className="p-2 text-right border-r border-slate-300 font-mono text-xs">
                      {formatCurrency(diff.initialSubtotal)}
                    </td>
                    <td colSpan={4} className="p-2 text-right border-r border-slate-300 font-mono text-xs bg-indigo-50/50">
                      {formatCurrency(diff.finalSubtotal)}
                    </td>
                    <td colSpan={3} className="p-2 text-right font-mono text-xs">
                      {formatDelta(diff.subtotalDelta)}
                    </td>
                  </tr>

                  {/* GST (if added) */}
                  {(diff.initialGst > 0 || diff.finalGst > 0) && (
                    <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-600">
                      <td colSpan={2} className="p-1.5 text-right uppercase text-[10px] tracking-wider border-r border-slate-300">
                        GST (18%)
                      </td>
                      <td colSpan={4} className="p-1.5 text-right border-r border-slate-300 font-mono text-xs">
                        {formatCurrency(diff.initialGst)}
                      </td>
                      <td colSpan={4} className="p-1.5 text-right border-r border-slate-300 font-mono text-xs bg-indigo-50/50">
                        {formatCurrency(diff.finalGst)}
                      </td>
                      <td colSpan={3} className="p-1.5 text-right font-mono text-xs">
                        {formatDelta(diff.gstDelta)}
                      </td>
                    </tr>
                  )}

                  {/* Grand Total */}
                  <tr className="bg-indigo-900 text-white font-black text-xs border-t-2 border-indigo-950">
                    <td colSpan={2} className="p-2.5 text-right uppercase tracking-wider border-r border-indigo-800">
                      Grand Total
                    </td>
                    <td colSpan={4} className="p-2.5 text-right border-r border-indigo-800 font-mono">
                      {formatCurrency(diff.initialGrandTotal)}
                    </td>
                    <td colSpan={4} className="p-2.5 text-right border-r border-indigo-800 font-mono bg-indigo-950">
                      {formatCurrency(diff.finalGrandTotal)}
                    </td>
                    <td colSpan={3} className="p-2.5 text-right font-mono">
                      <span className={diff.grandTotalDelta < 0 ? 'text-emerald-300' : 'text-amber-300'}>
                        {diff.grandTotalDelta > 0 ? `+${formatCurrency(diff.grandTotalDelta)}` : diff.grandTotalDelta < 0 ? `-${formatCurrency(diff.grandTotalDelta)}` : '₹0.00'}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Footer Remarks / Legend */}
          <div className="text-[10px] text-slate-500 bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div>
              Generated for Quotation <span className="font-bold text-slate-700">{finalQtnNo}</span> on {new Date().toLocaleDateString('en-GB')}.
            </div>
            <div className="font-semibold text-slate-600">
              Siddhi Kabel Corporation Pvt Ltd
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
