
import React from 'react';
import type { Quotation, Customer, SalesPerson } from '../types';

interface QuotationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  customer: Customer | null;
  salesPerson: SalesPerson | null;
  onPrint: () => void;
}

export const QuotationSuccessModal: React.FC<QuotationSuccessModalProps> = ({
  isOpen,
  onClose,
  quotation,
  customer,
  salesPerson,
  onPrint,
}) => {
  if (!isOpen || !quotation) return null;

  const calculateTotal = (details: typeof quotation.details) => {
    if (!details || !Array.isArray(details)) return 0;
    return details.reduce((sum, item) => {
      const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
      return sum + (unitPrice * item.moq);
    }, 0);
  };

  const totalValue = calculateTotal(quotation.details);

  const handleWhatsAppShare = () => {
    if (!salesPerson || !salesPerson.mobile) return;
    
    const appUrl = `${window.location.origin}${window.location.pathname}?id=${quotation.id}`;
    const message = `*New Quotation Generated*\n` +
                    `QTN No: ${quotation.id}\n` +
                    `Date: ${quotation.quotationDate}\n` +
                    `Customer: ${customer?.name || 'N/A'}\n` +
                    `Contact: ${quotation.contactPerson} (${quotation.contactNumber})\n` +
                    `Value: ₹${totalValue.toLocaleString('en-IN', {maximumFractionDigits: 0})}\n` +
                    `Link: ${appUrl}`;
    
    let phone = salesPerson.mobile.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className="bg-green-600 p-4 text-white text-center">
          <div className="mx-auto bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Quotation Created!</h2>
          <p className="text-green-100 text-xs">Successfully saved to system</p>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase">Quotation No</p>
              <p className="font-bold text-gray-800">#{quotation.id}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs uppercase">Date</p>
              <p className="font-bold text-gray-800">{new Date(quotation.quotationDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <p className="text-gray-500 text-xs uppercase mb-1">Customer</p>
            <p className="font-bold text-gray-800 text-sm">{customer?.name || 'Unknown Customer'}</p>
            <div className="mt-2 flex items-start gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
               </svg>
               <div>
                 <p className="text-xs font-medium text-gray-700">{quotation.contactPerson}</p>
                 <p className="text-xs text-gray-500">{quotation.contactNumber}</p>
               </div>
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-dashed border-gray-200 pt-3">
            <span className="text-gray-600 font-medium">Total Value</span>
            <span className="text-xl font-bold text-indigo-600">₹{totalValue.toLocaleString('en-IN', {maximumFractionDigits: 0})}</span>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2">
            <button 
              onClick={onPrint}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Preview
            </button>
            
            <button 
              onClick={handleWhatsAppShare}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
              </svg>
              Share to Sales Person
            </button>

            <button 
              onClick={onClose}
              className="w-full py-2 px-4 text-gray-500 text-sm font-medium hover:text-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
