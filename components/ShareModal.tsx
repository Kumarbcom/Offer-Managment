import React, { useRef, useState, useEffect } from 'react';
import { Quotation, SalesPerson } from '../types';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';
import { calculateTotalAmount } from '../utils/calc';
import { calculateQuotationDiff } from '../utils/quotationDiff';
import { DEFAULT_LOGO_BASE64 } from '../constants';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  salesPerson: SalesPerson | null;
  quotations: Quotation[];
  customerName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  quotation,
  salesPerson,
  quotations,
  customerName,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'standard' | 'discounted' | 'withAirFreight' | 'comparison'>('standard');
  const [showPreview, setShowPreview] = useState(false);
  const [includeComparison, setIncludeComparison] = useState(false);

  const isRevision = Boolean(quotation?.revisionNumber && quotation.revisionNumber > 0) || Boolean(quotation?.initialSnapshot);

  useEffect(() => {
    if (isRevision) {
      setIncludeComparison(true);
    }
  }, [isRevision, quotation?.id]);

  if (!isOpen || !quotation) return null;

  const diff = calculateQuotationDiff(quotation);
  const qtnNoStr = generateFormattedQuotationNumber(quotation, quotations);
  const safeCustomerName = (customerName || 'Customer').replace(/\s+/g, '_');
  const safeQtnNo = qtnNoStr.replace(/\//g, '-');

  let formatSuffix = '';
  if (selectedFormat === 'discounted') formatSuffix = '_Discounted';
  if (selectedFormat === 'withAirFreight') formatSuffix = '_AirFreight';
  if (selectedFormat === 'comparison') formatSuffix = '_RevisionComparison';
  const pdfFileName = `${safeCustomerName}_${safeQtnNo}${formatSuffix}.pdf`;

  const appUrl = `${window.location.origin}${window.location.pathname}?view_pdf=${quotation.id}&format=${selectedFormat}`;
  const comparisonUrl = `${window.location.origin}${window.location.pathname}?view_pdf=${quotation.id}&format=comparison`;

  // Determine Creator Details (Kumar, Vandita, etc.)
  const creator = quotation.preparedBy;
  let creatorName = creator || 'Sales Co-Ordinator';
  let creatorTitle = 'Sales Co-Ordinator';
  let creatorPhone = '9620000947 / 9886058511';
  let creatorEmail = 'sales@siddhikabel.com';

  if (creator === 'Kumar') {
    creatorName = 'Kumar N';
    creatorTitle = 'Sales Co-Ordinator';
    creatorPhone = '9620000947 / 9886058511';
  } else if (creator === 'Vandita') {
    creatorName = 'Vandita';
    creatorTitle = 'Sales Co-Ordinator';
    creatorPhone = '7829111594';
  } else if (salesPerson) {
    creatorName = salesPerson.name;
    creatorEmail = salesPerson.email || creatorEmail;
    creatorPhone = salesPerson.mobile || creatorPhone;
  }

  const spFirstName = creatorName.split(' ')[0];

  const totalValue = calculateTotalAmount(quotation.details);
  const totalFormatted = '₹' + totalValue.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatCurrency = (val: number) => {
    return '₹' + Math.abs(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getMailto = (subject: string, bodyText: string) => {
    return `mailto:sales@siddhikabel.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  };

  const linkAccepted = getMailto(
    `Offer Accepted - ${qtnNoStr}`,
    `Dear ${spFirstName},\n\nThank you for sending the offer.\n\nWe are pleased to inform you that we ACCEPT your offer.\n\nKindly proceed with the order confirmation and share the proforma invoice at your earliest.\n\nBest Regards`
  );
  const linkReview = getMailto(
    `Offer Under Review - ${qtnNoStr}`,
    `Dear ${spFirstName},\n\nThank you for the offer.\n\nWe are currently reviewing the quotation internally. We will get back to you within 24-48 hours with our decision.\n\nPlease feel free to follow up if you do not hear from us.\n\nBest Regards`
  );
  const linkAmend = getMailto(
    `Amendment Required - ${qtnNoStr}`,
    `Dear ${spFirstName},\n\nThank you for your offer. We have reviewed the quotation and require the following amendments before we can proceed:\n\n[ ] Price Reduction\n[ ] MOQ Reconsideration\n[ ] Delivery Improvement\n\nKindly send a revised offer at the earliest.\n\nBest Regards`
  );
  const linkRejected = getMailto(
    `Offer Rejected - ${qtnNoStr}`,
    `Dear ${spFirstName},\n\nThank you for sending the offer. After careful review, we regret to inform you that we are unable to accept the current quotation.\n\nBest Regards`
  );

  const handleCopy = async () => {
    if (!contentRef.current) return;
    try {
      const html = contentRef.current.innerHTML;
      
      let plainText = '';
      if (isRevision && includeComparison) {
        plainText = `Dear Sir/Madam,

Thank you for your enquiry.

We are pleased to submit our Amended Offer (Revision ${diff.revisionNumber}) as per our discussion.

• Quotation Ref: ${qtnNoStr}
• Date: ${quotation.quotationDate}
• Initial Offer (Rev 0): ${formatCurrency(diff.initialGrandTotal)}
• Amended Offer (Rev ${diff.revisionNumber}): ${formatCurrency(diff.finalGrandTotal)}
• Commercial Variance: ${diff.grandTotalDelta < 0 ? '-' : '+'}${formatCurrency(diff.grandTotalDelta)} (${diff.percentageChange > 0 ? '+' : ''}${diff.percentageChange.toFixed(2)}%)

👇 Please Click Below to View & Download Your Quotation:
${appUrl}

📊 View Revision Variance Comparison Sheet:
${comparisonUrl}

In case you need any further assistance please feel free to contact us. We will be more than happy to assist you.

Thanking you,
Assuring you of our best services. We look forward to receiving your valuable orders.

Thanks & Regards,
${creatorName}
${creatorTitle}
SIDDHI KABEL CORPORATION PVT LTD
Email: ${creatorEmail} | Phone: ${creatorPhone}
Website: www.siddhikabel.com`;
      } else {
        plainText = `Dear Sir/Madam,

Thank you for your enquiry.

We are pleased to submit our offer as per your requirement:
• Quotation Ref: ${qtnNoStr}
• Date: ${quotation.quotationDate}
• Quoted Amount: ${totalFormatted}

👇 Please Click Below to View & Download Your Quotation:
${appUrl}

In case you need any further assistance please feel free to contact us. We will be more than happy to assist you.

Thanking you,
Assuring you of our best services. We look forward to receiving your valuable orders.

Thanks & Regards,
${creatorName}
${creatorTitle}
SIDDHI KABEL CORPORATION PVT LTD
Email: ${creatorEmail} | Phone: ${creatorPhone}
Website: www.siddhikabel.com`;
      }

      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy via ClipboardItem', err);
      // Fallback
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('copy');
      selection?.removeAllRanges();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyDirectLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error('Failed to copy direct link', e);
    }
  };

  const handleWhatsAppShare = () => {
    let message = '';
    if (isRevision && includeComparison) {
      message = `Dear Sir/Madam,

Greeting of the day.

We are pleased to submit our Amended Offer (Revision ${diff.revisionNumber}):
• QTN Ref: ${qtnNoStr}
• Initial Total (Rev 0): ${formatCurrency(diff.initialGrandTotal)}
• Revised Total (Rev ${diff.revisionNumber}): ${formatCurrency(diff.finalGrandTotal)}
• Variance: ${diff.grandTotalDelta < 0 ? '-' : '+'}${formatCurrency(diff.grandTotalDelta)} (${diff.percentageChange > 0 ? '+' : ''}${diff.percentageChange.toFixed(2)}%)

👇 *Click to View Revised Quotation:*
${appUrl}

📊 *Click to View Revision Comparison:*
${comparisonUrl}

Looking forward to your favorable response.

Thanks & Regards,
${creatorName}
${creatorTitle}
SIDDHI KABEL CORPORATION PVT LTD`;
    } else {
      message = `Dear Sir/Madam,

Greeting of the day.

We would like to thank you for your enquiry. Herewith we are submitting the offer for your requirement:
• Quotation Ref: ${qtnNoStr}
• Quoted Amount: ${totalFormatted}

👇 *Please Click to View Quotation:*
${appUrl}

Looking forward to your favorable response.

Thanks & Regards,
${creatorName}
${creatorTitle}
SIDDHI KABEL CORPORATION PVT LTD`;
    }

    let phoneStr = quotation.contactNumber || '';
    let phone = phoneStr.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let url = '';
    if (isMobile) {
      url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
    } else {
      url = phone
        ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
        : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    }
    window.open(url, 'whatsapp_share_tab');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-white text-base tracking-wide">Share Quotation</h3>
              <span className="bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded">
                #{quotation.id}
              </span>
              {isRevision && (
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded uppercase">
                  Rev {diff.revisionNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {qtnNoStr} • {customerName || 'Customer'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 bg-slate-50/60 overflow-y-auto max-h-[75vh]">
          {/* Format Selector */}
          <div>
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">
              1. Select Quotation Document Format
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedFormat('standard')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                  selectedFormat === 'standard'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('discounted')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                  selectedFormat === 'discounted'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                With Discount
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('withAirFreight')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                  selectedFormat === 'withAirFreight'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                With Air Freight
              </button>
              {isRevision && (
                <button
                  type="button"
                  onClick={() => setSelectedFormat('comparison')}
                  className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                    selectedFormat === 'comparison'
                      ? 'bg-amber-500 border-amber-500 text-slate-950 font-black shadow-sm'
                      : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  Comparison
                </button>
              )}
            </div>
          </div>

          {/* Revision Comparison Inclusion Checkbox */}
          {isRevision && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center justify-between gap-2 shadow-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeComparison}
                  onChange={e => setIncludeComparison(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-amber-400 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-amber-950">
                  Include Revision Comparison &amp; Variance Link in Email Draft
                </span>
              </label>
              <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded shrink-0">
                Rev {diff.revisionNumber} vs Rev 0
              </span>
            </div>
          )}

          {/* Quotation Link Callout Box */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Online Link:</span>
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                Total: {totalFormatted}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 flex-1 truncate select-all">
                {appUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyDirectLink}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded text-xs font-bold shrink-0 transition-colors"
                title="Copy direct quotation link"
              >
                {copiedLink ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Primary Action Button: Copy Rich-Text Email Draft */}
          <div className="bg-gradient-to-br from-indigo-50 via-white to-indigo-50/40 p-4 rounded-xl border-2 border-indigo-200 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                2. Ready-to-Send Email Draft
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Click the button below to copy the complete formal email draft. When pasted into <strong>Gmail</strong> or <strong>Outlook</strong>, it renders beautifully with the quotation link clearly highlighted and directly clickable.
            </p>

            <button
              type="button"
              onClick={handleCopy}
              className={`w-full py-3 px-4 rounded-lg font-black text-sm text-white transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 shadow-md ${
                copied
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>✓ Email Copied! Paste into Gmail / Outlook (Ctrl+V)</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3-3" />
                  </svg>
                  <span>Copy Rich-Text Email Draft</span>
                </>
              )}
            </button>
          </div>

          {/* WhatsApp Share Alternative */}
          <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
              </svg>
              <span className="text-xs font-bold text-slate-700">Share via WhatsApp</span>
            </div>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>Open WhatsApp</span>
            </button>
          </div>

          {/* Optional Collapsible Preview */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowPreview(prev => !prev)}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
            >
              <span>{showPreview ? '▲ Hide Preview' : '▼ Preview Email Content'}</span>
            </button>
            {showPreview && (
              <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 space-y-2">
                <p><strong>Subject:</strong> Quotation {qtnNoStr} - Siddhi Kabel Corporation Pvt Ltd</p>
                <div className="p-3 bg-slate-50 rounded border border-slate-100 text-[11px] font-mono whitespace-pre-line text-slate-600">
                  {`Dear Sir/Madam,

Thank you for your enquiry.

We are pleased to submit our offer as per your requirement:
• Quotation Ref: ${qtnNoStr}
• Date: ${quotation.quotationDate}
• Quoted Amount: ${totalFormatted}

👇 Please Click Below to View & Download Your Quotation:
${appUrl}
${isRevision && includeComparison ? `\n📊 View Revision Variance Comparison Sheet:\n${comparisonUrl}` : ''}

Looking forward to your valuable orders.`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-white flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-all flex items-center gap-1.5 ${
              copied ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy Email Draft'}
          </button>
        </div>

        {/* Hidden Container for Copying Rich-Text HTML to Clipboard */}
        <div
          ref={contentRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '650px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#1f2937',
          }}
        >
          <p>Dear Sir/Madam,</p>
          <p>Thank you for your enquiry.</p>
          <p>
            {isRevision && includeComparison
              ? `We are pleased to submit our Amended Offer (Revision ${diff.revisionNumber}) as per our discussion:`
              : 'We are pleased to submit our official offer as per your requirement. Please find the quotation summary below:'}
          </p>

          {isRevision && includeComparison ? (
            <table
              cellPadding={6}
              cellSpacing={0}
              style={{
                width: '100%',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                margin: '12px 0',
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              <tbody>
                <tr>
                  <td style={{ color: '#64748b', width: '160px', fontWeight: 'bold' }}>Quotation Ref:</td>
                  <td style={{ color: '#0f172a', fontWeight: 'bold' }}>{qtnNoStr}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', fontWeight: 'bold' }}>Quotation Date:</td>
                  <td style={{ color: '#0f172a' }}>{quotation.quotationDate}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', fontWeight: 'bold' }}>Customer:</td>
                  <td style={{ color: '#0f172a', fontWeight: 'bold' }}>{customerName || 'Customer'}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', fontWeight: 'bold' }}>Initial Offer (Rev 0):</td>
                  <td style={{ color: '#64748b', fontWeight: 'bold', textDecoration: 'line-through' }}>
                    {formatCurrency(diff.initialGrandTotal)}
                  </td>
                </tr>
                <tr style={{ backgroundColor: '#eff6ff' }}>
                  <td style={{ color: '#1e40af', fontWeight: 'bold' }}>Amended Offer (Rev {diff.revisionNumber}):</td>
                  <td style={{ color: '#1e40af', fontWeight: 'bold', fontSize: '15px' }}>
                    {formatCurrency(diff.finalGrandTotal)}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', fontWeight: 'bold' }}>Commercial Variance:</td>
                  <td style={{ color: diff.grandTotalDelta <= 0 ? '#166534' : '#b45309', fontWeight: 'bold' }}>
                    {diff.grandTotalDelta < 0 ? '-' : '+'}{formatCurrency(diff.grandTotalDelta)} ({diff.percentageChange > 0 ? '+' : ''}{diff.percentageChange.toFixed(2)}%)
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table
              cellPadding={6}
              cellSpacing={0}
              style={{
                width: '100%',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                margin: '12px 0',
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              <tbody>
                <tr>
                  <td style={{ color: '#64748b', width: '130px', fontWeight: 'bold' }}>Quotation Ref:</td>
                  <td style={{ color: '#0f172a', fontWeight: 'bold' }}>{qtnNoStr}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', fontWeight: 'bold' }}>Quotation Date:</td>
                  <td style={{ color: '#0f172a' }}>{quotation.quotationDate}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', fontWeight: 'bold' }}>Customer:</td>
                  <td style={{ color: '#0f172a', fontWeight: 'bold' }}>{customerName || 'Customer'}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', fontWeight: 'bold' }}>Quoted Amount:</td>
                  <td style={{ color: '#1e40af', fontWeight: 'bold', fontSize: '15px' }}>{totalFormatted}</td>
                </tr>
              </tbody>
            </table>
          )}

          {/* HIGHLIGHTED CALLOUT - EXACT USER REQUEST FORMAT */}
          <div style={{ margin: '22px 0 16px 0' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
              👇 Please Click Below to View &amp; Download Your Quotation:
            </p>
            <p style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold' }}>
              📄{' '}
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#0056b3',
                  textDecoration: 'underline',
                  fontWeight: 'bold',
                  fontSize: '15px',
                }}
              >
                View Offer Document ({pdfFileName})
              </a>
            </p>

            {isRevision && includeComparison && (
              <p style={{ margin: '12px 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                📊{' '}
                <a
                  href={comparisonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#0284c7',
                    textDecoration: 'underline',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                >
                  Click Here to View Revision Variance Analysis (Side-by-Side Comparison)
                </a>
              </p>
            )}
          </div>

          <p>
            In case you need any further assistance please feel free to contact us. We will be more than happy to assist
            you.
          </p>
          <p>
            Thanking you,<br />
            Assuring you of our best services. We look forward to receiving your valuable orders.
          </p>
          <br />

          {/* Email Signature */}
          <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%', marginBottom: '20px' }}>
            <tbody>
              <tr>
                <td width="90" style={{ verticalAlign: 'top', paddingRight: '15px' }}>
                  <img
                    src={DEFAULT_LOGO_BASE64}
                    width="80"
                    alt="Siddhi Kabel"
                    style={{ display: 'block', maxWidth: '80px', height: 'auto' }}
                  />
                </td>
                <td style={{ verticalAlign: 'top', fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: '1.4' }}>
                  <strong style={{ fontSize: '16px', color: '#0f172a' }}>{creatorName}</strong>
                  <br />
                  <span style={{ color: '#025aa5', fontWeight: 'bold', fontSize: '12px' }}>{creatorTitle}</span>
                  <br />
                  <strong style={{ color: '#334155' }}>Siddhi Kabel Corporation Pvt Ltd</strong>
                  <br />
                  <table
                    cellPadding={0}
                    cellSpacing={0}
                    border={0}
                    style={{ marginTop: '5px', fontSize: '12px', color: '#475569' }}
                  >
                    <tbody>
                      <tr>
                        <td width="20">📧</td>
                        <td>
                          <a href={`mailto:${creatorEmail}`} style={{ color: '#025aa5', textDecoration: 'none' }}>
                            {creatorEmail}
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td>📞</td>
                        <td>{creatorPhone}</td>
                      </tr>
                      <tr>
                        <td style={{ verticalAlign: 'top' }}>📍</td>
                        <td>#3, 1st Main, 1st Block, BSK 3rd Stage, Bangalore – 560 085</td>
                      </tr>
                      <tr>
                        <td>🌐</td>
                        <td>
                          <a href="http://www.siddhikabel.com" style={{ color: '#025aa5', textDecoration: 'none' }}>
                            www.siddhikabel.com
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Customer Response Buttons Block */}
          <table
            cellPadding={0}
            cellSpacing={0}
            border={0}
            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}
          >
            <tbody>
              <tr>
                <td style={{ padding: '15px', backgroundColor: '#ffffff' }}>
                  <p
                    style={{
                      fontWeight: 'bold',
                      color: '#94a3b8',
                      fontSize: '12px',
                      marginTop: 0,
                      marginBottom: '15px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    PLEASE RESPOND TO THIS OFFER
                  </p>

                  <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%', tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        {/* Accepted */}
                        <td align="center" style={{ width: '25%', padding: '0 5px' }}>
                          <a
                            href={linkAccepted}
                            style={{
                              display: 'block',
                              backgroundColor: '#1e7e34',
                              color: '#ffffff',
                              textDecoration: 'none',
                              padding: '8px 4px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '13px',
                              textAlign: 'center',
                            }}
                          >
                            ✓ Accepted
                          </a>
                          <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                            Confirm &amp; proceed
                          </p>
                        </td>
                        {/* Review */}
                        <td align="center" style={{ width: '25%', padding: '0 5px' }}>
                          <a
                            href={linkReview}
                            style={{
                              display: 'block',
                              backgroundColor: '#0062cc',
                              color: '#ffffff',
                              textDecoration: 'none',
                              padding: '8px 4px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '13px',
                              textAlign: 'center',
                            }}
                          >
                            🔍 Review
                          </a>
                          <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                            Reply in 24–48h
                          </p>
                        </td>
                        {/* Amend */}
                        <td align="center" style={{ width: '25%', padding: '0 5px' }}>
                          <a
                            href={linkAmend}
                            style={{
                              display: 'block',
                              backgroundColor: '#d39e00',
                              color: '#ffffff',
                              textDecoration: 'none',
                              padding: '8px 4px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '13px',
                              textAlign: 'center',
                            }}
                          >
                            ✎ Amend
                          </a>
                          <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                            Price/MOQ/Delivery
                          </p>
                        </td>
                        {/* Rejected */}
                        <td align="center" style={{ width: '25%', padding: '0 5px' }}>
                          <a
                            href={linkRejected}
                            style={{
                              display: 'block',
                              backgroundColor: '#c82333',
                              color: '#ffffff',
                              textDecoration: 'none',
                              padding: '8px 4px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '13px',
                              textAlign: 'center',
                            }}
                          >
                            ✕ Rejected
                          </a>
                          <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                            Decline with reason
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              {/* Footer Bar */}
              <tr>
                <td style={{ backgroundColor: '#0056b3', padding: '8px 15px' }}>
                  <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%' }}>
                    <tbody>
                      <tr>
                        <td
                          align="left"
                          style={{ color: '#ffffff', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}
                        >
                          Siddhi Kabel Corporation Pvt Ltd · Bangalore
                        </td>
                        <td align="right" style={{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>
                          <a href="http://www.siddhikabel.com" style={{ color: '#93c5fd', textDecoration: 'none' }}>
                            siddhikabel.com
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};
