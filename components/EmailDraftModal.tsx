import React, { useRef, useState } from 'react';
import { Quotation, SalesPerson } from '../types';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';

interface EmailDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  salesPerson: SalesPerson | null;
  quotations: Quotation[];
}

export const EmailDraftModal: React.FC<EmailDraftModalProps> = ({ isOpen, onClose, quotation, salesPerson, quotations }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !quotation || !salesPerson) return null;

  const qtnNoStr = generateFormattedQuotationNumber(quotation, quotations);

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

  const spFirstName = salesPerson.name.split(' ')[0];
  // Reusing exact links requested by user
  const linkAccepted = `mailto:sales@siddhikabel.com?subject=Offer%20Accepted%20-%20${qtnNoStr}&body=Dear%20${spFirstName}%2C%0D%0A%0D%0AThank%20you%20for%20sending%20the%20offer.%0D%0A%0D%0AWe%20are%20pleased%20to%20inform%20you%20that%20we%20ACCEPT%20your%20offer.%0D%0A%0D%0AKindly%20proceed%20with%20the%20order%20confirmation%20and%20share%20the%20proforma%20invoice%20at%20your%20earliest.%0D%0A%0D%0ABest%20Regards`;
  const linkReview = `mailto:sales@siddhikabel.com?subject=Offer%20Under%20Review%20-%20${qtnNoStr}&body=Dear%20${spFirstName}%2C%0D%0A%0D%0AThank%20you%20for%20the%20offer.%0D%0A%0D%0AWe%20are%20currently%20reviewing%20the%20quotation%20internally.%20We%20will%20get%20back%20to%20you%20within%2024-48%20hours%20with%20our%20decision.%0D%0A%0D%0APlease%20feel%20free%20to%20follow%20up%20if%20you%20do%20not%20hear%20from%20us.%0D%0A%0D%0ABest%20Regards`;
  const linkAmend = `mailto:sales@siddhikabel.com?subject=Amendment%20Required%20-%20${qtnNoStr}&body=Dear%20${spFirstName}%2C%0D%0A%0D%0AThank%20you%20for%20your%20offer.%20We%20have%20reviewed%20the%20quotation%20and%20require%20the%20following%20amendments%20before%20we%20can%20proceed%3A%0D%0A%0D%0A%5B%20%5D%20Price%20Reduction%0D%0A%5B%20%5D%20MOQ%20Reconsideration%0D%0A%5B%20%5D%20Delivery%20Improvement%0D%0A%0D%0AKindly%20send%20a%20revised%20offer%20at%20the%20earliest.%0D%0A%0D%0ABest%20Regards`;
  const linkRejected = `mailto:sales@siddhikabel.com?subject=Offer%20Rejected%20-%20${qtnNoStr}&body=Dear%20${spFirstName}%2C%0D%0A%0D%0AThank%20you%20for%20sending%20the%20offer.%20After%20careful%20review%2C%20we%20regret%20to%20inform%20you%20that%20we%20are%20unable%20to%20accept%20the%20current%20quotation.%0D%0A%0D%0ABest%20Regards`;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Email Draft</h3>
            <p className="text-xs text-slate-500">Copy and paste this into your email client to reply to the customer's enquiry.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
              <p>Best Regards,</p>
              <p>
                <strong>{salesPerson.name}</strong><br/>
                Sales Co-Ordinator<br/>
                Siddhi Kabel Corporation Pvt Ltd<br/>
                📧 <a href="mailto:sales@siddhikabel.com">sales@siddhikabel.com</a><br/>
                📞 {salesPerson.mobile}<br/>
                📍 #3, 1st Main, 1st Block, BSK 3rd Stage, Bangalore – 560 085<br/>
                🌐 <a href="http://www.siddhikabel.com">www.siddhikabel.com</a>
              </p>
              
              <br/>
              <div style={{ padding: '15px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <p style={{ fontWeight: 'bold', color: '#1e293b', marginTop: 0, marginBottom: '10px' }}>PLEASE RESPOND TO THIS OFFER</p>
                
                <p style={{ margin: '5px 0' }}>
                  <a href={linkAccepted} style={{ color: '#15803d', textDecoration: 'none', fontWeight: 'bold' }}>✓ Accepted</a>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '10px' }}>Confirm & proceed</span>
                </p>
                
                <p style={{ margin: '5px 0' }}>
                  <a href={linkReview} style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 'bold' }}>🔍 Review</a>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '10px' }}>Reply in 24–48h</span>
                </p>
                
                <p style={{ margin: '5px 0' }}>
                  <a href={linkAmend} style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: 'bold' }}>✎ Amend</a>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '10px' }}>Price/MOQ/Delivery</span>
                </p>
                
                <p style={{ margin: '5px 0' }}>
                  <a href={linkRejected} style={{ color: '#ef4444', textDecoration: 'none', fontWeight: 'bold' }}>✕ Rejected</a>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '10px' }}>Decline with reason</span>
                </p>
                <p style={{ marginTop: '15px', fontSize: '11px', color: '#64748b' }}>
                  Siddhi Kabel Corporation Pvt Ltd · Bangalore<br/>
                  <a href="http://www.siddhikabel.com" style={{ color: '#3b82f6', textDecoration: 'none' }}>siddhikabel.com</a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
            Close
          </button>
          <button 
            onClick={handleCopy} 
            className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-all flex items-center gap-2 ${copied ? 'bg-green-500 hover:bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'}`}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                Copy Rich Text
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
