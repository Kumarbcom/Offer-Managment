import React, { useRef, useState } from 'react';
import { Quotation, SalesPerson } from '../types';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';
import { calculateTotalAmount } from '../utils/calculations';
import { DEFAULT_LOGO_BASE64 } from '../constants';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  salesPerson: SalesPerson | null;
  quotations: Quotation[];
  customerName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, quotation, salesPerson, quotations, customerName }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'standard' | 'discounted' | 'withAirFreight'>('standard');

  if (!isOpen || !quotation || !salesPerson) return null;

  const qtnNoStr = generateFormattedQuotationNumber(quotation, quotations);
  const safeCustomerName = customerName.replace(/\s+/g, '_');
  const safeQtnNo = qtnNoStr.replace(/\//g, '-');
  
  let formatSuffix = '';
  if (selectedFormat === 'discounted') formatSuffix = '_Discounted';
  if (selectedFormat === 'withAirFreight') formatSuffix = '_AirFreight';
  const pdfFileName = `${safeCustomerName}_${safeQtnNo}${formatSuffix}.pdf`;

  const appUrl = `${window.location.origin}${window.location.pathname}?view_pdf=${quotation.id}&format=${selectedFormat}`;

  const handleCopy = async () => {
    if (!contentRef.current) return;
    try {
      const html = contentRef.current.innerHTML;
      const text = contentRef.current.innerText;
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      });
      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('copy');
      selection?.removeAllRanges();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    if (!salesPerson || !salesPerson.mobile) {
      alert("Sales Person does not have a mobile number configured.");
      return;
    }
    const totalValue = calculateTotalAmount(quotation.details);
    const contactInfo = quotation.contactPerson ? `\nContact: ${quotation.contactPerson} ${quotation.contactNumber ? `(${quotation.contactNumber})` : ''}` : '';
    const message = `*New Quotation Assigned*\nQTN No: ${qtnNoStr}\nDate: ${quotation.quotationDate}\nCustomer: ${customerName}${contactInfo}\nValue: ₹${totalValue.toLocaleString('en-IN')}\n\n📄 *View Offer (${pdfFileName}):*\n${appUrl}`;
    
    let phone = salesPerson.mobile.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let url = '';
    if (isMobile) {
      url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    } else {
      url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    }
    window.open(url, 'whatsapp_share_tab');
  };

  // Determine Creator Details (Kumar, Vandita, etc.) instead of just SalesPerson
  const creator = quotation.preparedBy;
  let creatorName = creator;
  let creatorTitle = 'Sales Co-Ordinator';
  let creatorPhone = '9620000947 / 9886058511'; // Default / Kumar
  let creatorEmail = 'sales@siddhikabel.com';

  if (creator === 'Kumar') {
      creatorName = 'Kumar N';
      creatorTitle = 'Sales Co-Ordinator';
      creatorPhone = '9620000947 / 9886058511';
  } else if (creator === 'Vandita') {
      creatorName = 'Vandita';
      creatorTitle = 'Sales Co-Ordinator';
      creatorPhone = '7829111594'; // fallback
  }
  // Otherwise use the creator name with default company info

  const spFirstName = creatorName.split(' ')[0];
  
  const getMailto = (subject: string, bodyText: string) => {
      return `mailto:sales@siddhikabel.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  };

  const linkAccepted = getMailto(`Offer Accepted - ${qtnNoStr}`, `Dear ${spFirstName},\n\nThank you for sending the offer.\n\nWe are pleased to inform you that we ACCEPT your offer.\n\nKindly proceed with the order confirmation and share the proforma invoice at your earliest.\n\nBest Regards`);
  const linkReview = getMailto(`Offer Under Review - ${qtnNoStr}`, `Dear ${spFirstName},\n\nThank you for the offer.\n\nWe are currently reviewing the quotation internally. We will get back to you within 24-48 hours with our decision.\n\nPlease feel free to follow up if you do not hear from us.\n\nBest Regards`);
  const linkAmend = getMailto(`Amendment Required - ${qtnNoStr}`, `Dear ${spFirstName},\n\nThank you for your offer. We have reviewed the quotation and require the following amendments before we can proceed:\n\n[ ] Price Reduction\n[ ] MOQ Reconsideration\n[ ] Delivery Improvement\n\nKindly send a revised offer at the earliest.\n\nBest Regards`);
  const linkRejected = getMailto(`Offer Rejected - ${qtnNoStr}`, `Dear ${spFirstName},\n\nThank you for sending the offer. After careful review, we regret to inform you that we are unable to accept the current quotation.\n\nBest Regards`);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Share Quotation</h3>
            <p className="text-xs text-slate-500">Choose the format, then share via WhatsApp or Email.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Format Selector */}
        <div className="p-4 bg-white border-b border-slate-100">
            <p className="text-xs font-bold text-slate-600 uppercase mb-2">1. Select Document Format to Share</p>
            <div className="flex gap-3">
                <button
                    onClick={() => setSelectedFormat('standard')}
                    className={`flex-1 py-2 px-3 text-sm font-semibold rounded-lg border transition-all ${selectedFormat === 'standard' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                    Standard
                </button>
                <button
                    onClick={() => setSelectedFormat('discounted')}
                    className={`flex-1 py-2 px-3 text-sm font-semibold rounded-lg border transition-all ${selectedFormat === 'discounted' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                    With Discount
                </button>
                <button
                    onClick={() => setSelectedFormat('withAirFreight')}
                    className={`flex-1 py-2 px-3 text-sm font-semibold rounded-lg border transition-all ${selectedFormat === 'withAirFreight' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                    With Air Freight
                </button>
            </div>
            
            <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-100 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <div className="text-xs text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                    Generated Link: <span className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded">{appUrl}</span>
                </div>
            </div>
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-100">
             <p className="text-xs font-bold text-slate-600 uppercase mb-2">2. Option A: Copy Rich-Text Email Draft</p>
             <p className="text-xs text-slate-500 mb-3">Notice that the link perfectly matches the format you selected above!</p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-100">
          <div className="bg-white p-6 rounded shadow-sm border border-slate-200" style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.5', color: '#333' }}>
            <div ref={contentRef}>
              <p>Dear Sir/Madam,</p>
              <p>We thanks for your enquiry,</p>
              <p>We are pleased to submit our offer as per attachment, kindly go through the same,</p>
              <p>In case you need any further assistance please feel free to contact us,</p>
              <p>We will be more than happy to assist you.</p>
              <p>Thanking you,<br/>Assuring you of our best services. We look forward to receiving your valuable orders.</p>
              <br/>
              
              <div style={{ marginBottom: '20px' }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>
                  📄 <a href={appUrl} style={{ color: '#2563eb' }}>View Offer Document ({pdfFileName})</a>
                </p>
              </div>

              {/* Improved Email Signature based on Screenshot */}
              <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%', marginBottom: '20px' }}>
                  <tbody>
                      <tr>
                          <td width="90" style={{ verticalAlign: 'top', paddingRight: '15px' }}>
                              <img src={DEFAULT_LOGO_BASE64} width="80" alt="Siddhi Kabel" style={{ display: 'block', maxWidth: '80px', height: 'auto' }} />
                          </td>
                          <td style={{ verticalAlign: 'top', fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: '1.4' }}>
                              <strong style={{ fontSize: '16px', color: '#0f172a' }}>{creatorName}</strong><br/>
                              <span style={{ color: '#025aa5', fontWeight: 'bold', fontSize: '12px' }}>{creatorTitle}</span><br/>
                              <strong style={{ color: '#334155' }}>Siddhi Kabel Corporation Pvt Ltd</strong><br/>
                              <table cellPadding={0} cellSpacing={0} border={0} style={{ marginTop: '5px', fontSize: '12px', color: '#475569' }}>
                                  <tbody>
                                      <tr><td width="20">📧</td><td><a href={`mailto:${creatorEmail}`} style={{ color: '#025aa5', textDecoration: 'none' }}>{creatorEmail}</a></td></tr>
                                      <tr><td>📞</td><td>{creatorPhone}</td></tr>
                                      <tr><td style={{ verticalAlign: 'top' }}>📍</td><td>#3, 1st Main, 1st Block, BSK 3rd Stage, Bangalore – 560 085</td></tr>
                                      <tr><td>🌐</td><td><a href="http://www.siddhikabel.com" style={{ color: '#025aa5', textDecoration: 'none' }}>www.siddhikabel.com</a></td></tr>
                                  </tbody>
                              </table>
                          </td>
                      </tr>
                  </tbody>
              </table>
              
              {/* Customer Response Buttons Block */}
              <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <tbody>
                      <tr>
                          <td style={{ padding: '15px', backgroundColor: '#ffffff' }}>
                              <p style={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '12px', marginTop: 0, marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>PLEASE RESPOND TO THIS OFFER</p>
                              
                              <table cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%', tableLayout: 'fixed' }}>
                                  <tbody>
                                      <tr>
                                          {/* Accepted Button */}
                                          <td align="center" style={{ width: '25%', padding: '0 5px' }}>
                                              <a href={linkAccepted} style={{ display: 'block', backgroundColor: '#1e7e34', color: '#ffffff', textDecoration: 'none', padding: '8px 4px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center' }}>
                                                  ✓ Accepted
                                              </a>
                                              <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>Confirm & proceed</p>
                                          </td>
                                          {/* Review Button */}
                                          <td align="center" style={{ width: '25%', padding: '0 5px' }}>
                                              <a href={linkReview} style={{ display: 'block', backgroundColor: '#0062cc', color: '#ffffff', textDecoration: 'none', padding: '8px 4px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center' }}>
                                                  🔍 Review
                                              </a>
                                              <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>Reply in 24–48h</p>
                                          </td>
                                          {/* Amend Button */}
                                          <td align="center" style={{ width: '25%', padding: '0 5px' }}>
                                              <a href={linkAmend} style={{ display: 'block', backgroundColor: '#d39e00', color: '#ffffff', textDecoration: 'none', padding: '8px 4px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center' }}>
                                                  ✎ Amend
                                              </a>
                                              <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>Price/MOQ/Delivery</p>
                                          </td>
                                          {/* Rejected Button */}
                                          <td align="center" style={{ width: '25%', padding: '0 5px' }}>
                                              <a href={linkRejected} style={{ display: 'block', backgroundColor: '#c82333', color: '#ffffff', textDecoration: 'none', padding: '8px 4px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center' }}>
                                                  ✕ Rejected
                                              </a>
                                              <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>Decline with reason</p>
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
                                          <td align="left" style={{ color: '#ffffff', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>
                                              Siddhi Kabel Corporation Pvt Ltd · Bangalore
                                          </td>
                                          <td align="right" style={{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>
                                              <a href="http://www.siddhikabel.com" style={{ color: '#93c5fd', textDecoration: 'none' }}>siddhikabel.com</a>
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

        <div className="p-4 border-t border-slate-100 bg-white flex justify-between gap-3">
          
          <div className="flex gap-3 items-center">
             {(!salesPerson || salesPerson.name.toLowerCase() !== 'office') && (
                 <div className="flex items-center">
                     <p className="text-xs font-bold text-slate-600 uppercase mr-2">Option B:</p>
                     <button onClick={handleWhatsAppShare} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                         <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                           <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                         </svg>
                         Share WhatsApp
                     </button>
                 </div>
             )}
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                Cancel
            </button>
            <button 
                onClick={handleCopy} 
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-all flex items-center gap-2 ${copied ? 'bg-green-500 hover:bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'}`}
            >
                {copied ? (
                <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Copied Email Draft!
                </>
                ) : (
                <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3-3" /></svg>
                    Copy Rich Text Email
                </>
                )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
