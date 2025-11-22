
import React, { useState } from 'react';
import type { Quotation, Customer, SalesPerson, PreparedBy } from '../types';
import { PREPARED_BY_LIST } from '../constants';

interface QuotationPrintViewProps {
    quotation: Quotation;
    customer: Customer;
    salesPerson?: SalesPerson;
}

const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const number = parseFloat(num.toFixed(2));
    const integerPart = Math.floor(number);
    if (integerPart > 999999999) return "Number too large";
    
    const toWords = (n: number): string => {
        let str = '';
        if (n >= 10000000) { str += toWords(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
        if (n >= 100000) { str += toWords(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
        if (n >= 1000) { str += toWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
        if (n >= 100) { str += toWords(Math.floor(n / 100)) + ' Hundred '; n %= 100; }
        if (n > 0) {
            if (str !== '') str += 'and ';
            if (n < 20) str += a[n];
            else { str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' : '') + a[n % 10]; }
        }
        return str.trim();
    };

    const words = toWords(integerPart);
    return `Rupees ${words.charAt(0).toUpperCase() + words.slice(1)} Only`;
}

const PREPARER_DESIGNATIONS: Record<PreparedBy, string> = {
    'Kumar': 'Sales Coordinator',
    'Vandita': 'Sales Coordinator',
    'Ranjan': 'Sales Coordinator',
};

export const QuotationPrintViewWithAirFreight: React.FC<QuotationPrintViewProps> = ({ quotation, customer, salesPerson }) => {
    const [logoUrl] = useState(() => localStorage.getItem('company_logo'));

    const totals = (quotation.details || []).reduce((acc, item) => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        const amount = unitPrice * item.moq;
        // Safety Check: Ensure airFreightDetails exists before accessing
        const freightAmount = (item.airFreight && item.airFreightDetails) ? (item.airFreightDetails.weightPerMtr / 1000 * 150) * item.moq : 0;
        
        acc.totalAmount += amount;
        acc.totalFreight += freightAmount;
        return acc;
    }, { totalAmount: 0, totalFreight: 0 });

    const grandTotal = totals.totalAmount + totals.totalFreight;
    const preparerDesignation = PREPARER_DESIGNATIONS[quotation.preparedBy] || 'Authorised Signatory';

    const getPartNoLink = (partNo: string) => {
        if (quotation.productsBrand === 'Lapp' && partNo) {
            return `https://products.lappgroup.com/online-catalogue.html?q=${encodeURIComponent(partNo)}`;
        }
        return null;
    };

    return (
        <div className="bg-white p-2 font-sans text-xs text-slate-800 print-wrapper">
            <div className="print-main-content">
                <header className="flex items-center justify-between pb-2 border-b-2 border-slate-800 relative">
                    <div className="w-20 h-12 flex items-center justify-center shrink-0">
                         {logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <div className="text-[10px] text-slate-300 border border-dashed border-slate-200 p-1 text-center rounded">Logo (Upload in Dashboard)</div>}
                    </div>
                    <div className="flex-1 text-center px-2">
                        <h1 className="text-xl font-bold text-slate-900 uppercase leading-tight whitespace-nowrap">Siddhi Kabel Corporation Pvt Ltd</h1>
                        <p className="text-slate-600 text-xs mt-1"># 3, 1st Main, 1st Block, B S K 3rd Stage, BENGALURU-560085.</p>
                        <p className="text-slate-600 text-xs">Tel: 080-26720440 / Mob: 9620000947 | E-Mail: info@siddhikabel.com</p>
                        <p className="text-slate-600 text-xs">CIN: U52100KA2008PTC047982 | GSTIN/UIN: 29AAMCS4385H1ZQ | State Name : Karnataka, Code: 29</p>
                    </div>
                    <div className="w-20 shrink-0"></div>
                </header>

                <div className="text-center my-2">
                    <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider underline">QUOTATION</h2>
                </div>

                <section className="grid grid-cols-2 gap-4 my-2">
                    <div className="space-y-0.5 border p-2 rounded-md">
                        <p className="font-bold text-slate-600">BILLED TO:</p>
                        <p className="font-bold text-base text-slate-900">{customer.name}</p>
                        <p>{customer.address}</p>
                        <p>{customer.city} - {customer.pincode}</p>
                        <p><span className="font-semibold">Attn:</span> {quotation.contactPerson} ({quotation.contactNumber})</p>
                    </div>
                    <div className="text-right space-y-0.5 border p-2 rounded-md">
                        <p><span className="font-semibold">Quotation No:</span> SKC/QTN/{quotation.id}</p>
                        <p><span className="font-semibold">Date:</span> {new Date(quotation.quotationDate).toLocaleDateString('en-GB')}</p>
                        <p><span className="font-semibold">Enquiry Date:</span> {new Date(quotation.enquiryDate).toLocaleDateString('en-GB')}</p>
                    </div>
                </section>
                
                <div className="my-2 text-sm">
                    <p className="font-semibold mb-1">Dear Sir / Madam,</p>
                    <p>Please find below our favourable offer for your requirement for {quotation.productsBrand} Products.</p>
                </div>

                <table className="w-full text-left text-[10px]">
                    <thead className="bg-slate-100 text-slate-600 uppercase">
                        <tr>
                            <th className="p-1 font-semibold border align-middle" rowSpan={2}>Sl. No</th>
                            <th className="p-1 font-semibold border align-middle" rowSpan={2}>Part No</th>
                            <th className="p-1 font-semibold border align-middle" rowSpan={2}>Description</th>
                            <th className="p-1 font-semibold border align-middle text-center" rowSpan={2}>MOQ</th>
                            <th className="p-1 font-semibold border align-middle text-center" rowSpan={2}>REQ</th>
                            <th className="p-1 font-semibold border align-middle text-center" rowSpan={2}>UOM</th>
                            <th className="p-1 font-semibold border align-middle text-right" rowSpan={2}>Unit Price (₹)</th>
                            <th className="p-1 font-semibold border align-middle text-right" rowSpan={2}>Amount (₹)</th>
                            <th className="p-1 font-semibold border align-middle text-center" rowSpan={2}>Stock Status</th>
                            <th className="p-1 font-semibold border text-center" colSpan={3}>Air Freight Details</th>
                            <th className="p-1 font-semibold border align-middle text-right" rowSpan={2}>Total (₹)</th>
                        </tr>
                        <tr>
                            <th className="p-1 font-semibold border text-right">Per Unit (₹)</th>
                            <th className="p-1 font-semibold border text-right">Amount (₹)</th>
                            <th className="p-1 font-semibold border text-center">Lead Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {(quotation.details || []).map((item, index) => {
                            const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
                            const amount = unitPrice * item.moq;
                            // Safety Check: Ensure airFreightDetails exists
                            const freightPerUnit = (item.airFreight && item.airFreightDetails) ? (item.airFreightDetails.weightPerMtr / 1000 * 150) : 0;
                            const freightAmount = freightPerUnit * item.moq;
                            const totalWithFreight = amount + freightAmount;
                            const partNoUrl = getPartNoLink(item.partNo);

                            return (
                                <tr key={index}>
                                    <td className="p-1 border text-center">{index + 1}</td>
                                    <td className="p-1 border font-medium">
                                         {partNoUrl ? (
                                            <a href={partNoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'blue', textDecoration: 'none' }}>
                                                {item.partNo}
                                            </a>
                                        ) : (
                                            item.partNo
                                        )}
                                    </td>
                                    <td className="p-1 border max-w-xs">{item.description}</td>
                                    <td className="p-1 border text-center">{item.moq}</td>
                                    <td className="p-1 border text-center">{item.req}</td>
                                    <td className="p-1 border text-center">{item.uom}</td>
                                    <td className="p-1 border text-right">{unitPrice.toFixed(2)}</td>
                                    <td className="p-1 border text-right">{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-1 border text-center">{item.stockStatus}</td>
                                    <td className="p-1 border text-right">{freightPerUnit > 0 ? freightPerUnit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                    <td className="p-1 border text-right">{freightAmount > 0 ? freightAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                    <td className="p-1 border text-center">{(item.airFreight && item.airFreightDetails) ? item.airFreightDetails.airFreightLeadTime : '-'}</td>
                                    <td className="p-1 border text-right font-medium">{totalWithFreight.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <section className="flex justify-end mt-2">
                    <div className="w-1/2 space-y-1 text-sm">
                        <div className="flex justify-between p-1">
                            <span className="font-semibold">Subtotal</span>
                            <span>₹{totals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                         <div className="flex justify-between p-1">
                            <span className="font-semibold">Total Air Freight</span>
                            <span>₹{totals.totalFreight.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-slate-100 rounded-md">
                            <span className="font-bold">Grand Total</span>
                            <span className="font-bold text-base">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </section>

                <p className="font-semibold my-2 text-sm">Amount in Words: {numberToWords(grandTotal)}</p>

                <section className="border border-slate-200 p-2 rounded-md mt-2 print-no-break">
                    <h3 className="font-bold text-slate-800 mb-1 text-sm">Terms & Conditions:</h3>
                     <ol className="list-decimal list-inside space-y-0.5 text-slate-700">
                        <li><span className="font-semibold">Prices:</span> Ex Godown, Bangalore. (The Above Mentioned Price Is Net Disounted)</li>
                        <li><span className="font-semibold">Goods Service Tax:</span> GST 18% Or As Applicable at the Time of Delivery.</li>
                        <li><span className="font-semibold">Delivery:</span> As Mentioned Above, Subject to Prior Sales.</li>
                        <li><span className="font-semibold">Freight:</span> Freight Extra Applicable.</li>
                        <li><span className="font-semibold">Payment terms:</span> {quotation.paymentTerms}</li>
                        <li><span className="font-semibold">Validity:</span> This Offer is Valid for One Week From the Date of Offer.</li>
                        <li><span className="font-semibold">Other terms:</span> {quotation.otherTerms}</li>
                    </ol>
                </section>

                <div className="mt-2 text-sm">
                    <p>Hope the above mentioned details are in line with your requirement, for any further clarification please feel free and contact us.</p>
                    <p className="mt-1">Thanking you,</p>
                </div>
            </div>

            <footer className="mt-2 pt-2 flex justify-between items-end border-t print-footer">
                <p className="text-slate-500 text-xs">This is a computer-generated document.</p>
                <div className="text-center text-sm">
                    <p className="font-bold">For Siddhi Kable Corporation Pvt Ltd,</p>
                    <div className="h-16 signature-space"></div>
                    <div className="border-t border-slate-400 pt-1">
                        <p>{quotation.preparedBy}</p>
                        <p>({preparerDesignation})</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};
