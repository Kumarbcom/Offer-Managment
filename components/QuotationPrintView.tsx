import React from 'react';
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

export const QuotationPrintView: React.FC<QuotationPrintViewProps> = ({ quotation, customer, salesPerson }) => {
    const totalAmount = quotation.details.reduce((sum, item) => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        return sum + (unitPrice * item.moq);
    }, 0);

    const preparerDesignation = PREPARER_DESIGNATIONS[quotation.preparedBy] || 'Authorised Signatory';

    return (
        <div className="bg-white p-8 font-sans text-xs text-slate-800 print-wrapper">
            <div className="print-main-content">
                <header className="text-center pb-4 border-b-2 border-slate-800">
                    <h1 className="text-2xl font-bold text-slate-900 uppercase">Siddhi Kabel Corporation Pvt Ltd</h1>
                    <p className="text-slate-600"># 3, 1st Main, 1st Block, B S K 3rd Stage, BENGALURU-560085.</p>
                    <p className="text-slate-600">Tel: 080-26720440 / Mob: 9620000947 | E-Mail: info@siddhikabel.com</p>
                    <p className="text-slate-600">CIN: U52100KA2008PTC047982 | GSTIN/UIN: 29AAMCS4385H1ZQ | State Name : Karnataka, Code: 29</p>
                </header>

                <div className="text-center my-4">
                    <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-wider underline">QUOTATION</h2>
                </div>

                <section className="grid grid-cols-2 gap-4 my-4">
                    <div className="space-y-0.5 border p-2 rounded-md">
                        <p className="font-bold text-slate-600">BILLED TO:</p>
                        <p className="font-bold text-base text-slate-900">{customer.name}</p>
                        <p>{customer.address}</p>
                        <p>{customer.city} - {customer.pincode}</p>
                        <p><span className="font-semibold">Attn:</span> {quotation.contactPerson}</p>
                    </div>
                    <div className="text-right space-y-0.5 border p-2 rounded-md">
                        <p><span className="font-semibold">Quotation No:</span> SKC/QTN/{quotation.id}</p>
                        <p><span className="font-semibold">Date:</span> {new Date(quotation.quotationDate).toLocaleDateString('en-GB')}</p>
                        <p><span className="font-semibold">Enquiry Date:</span> {new Date(quotation.enquiryDate).toLocaleDateString('en-GB')}</p>
                    </div>
                </section>
                
                <div className="my-4 text-sm">
                    <p className="font-semibold mb-1">Dear Sir / Madam,</p>
                    <p>Please find below our favourable offer for your requirement for {quotation.productsBrand} Products.</p>
                </div>

                <table className="w-full text-left text-[10px]">
                    <thead className="bg-slate-100 text-slate-600 uppercase">
                        <tr>
                            <th className="p-1 font-semibold border">Sl. No</th>
                            <th className="p-1 font-semibold border">Part No</th>
                            <th className="p-1 font-semibold border">Description</th>
                            <th className="p-1 font-semibold border text-center">MOQ</th>
                            <th className="p-1 font-semibold border text-center">REQ</th>
                            <th className="p-1 font-semibold border text-center">UOM</th>
                            <th className="p-1 font-semibold border text-right">Unit Price (₹)</th>
                            <th className="p-1 font-semibold border text-right">Amount (₹)</th>
                            <th className="p-1 font-semibold border text-center">Stock Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {quotation.details.map((item, index) => {
                            const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
                            const amount = unitPrice * item.moq;
                            return (
                                <tr key={index}>
                                    <td className="p-1 border text-center">{index + 1}</td>
                                    <td className="p-1 border font-medium">{item.partNo}</td>
                                    <td className="p-1 border max-w-xs">{item.description}</td>
                                    <td className="p-1 border text-center">{item.moq}</td>
                                    <td className="p-1 border text-center">{item.req}</td>
                                    <td className="p-1 border text-center">{item.uom}</td>
                                    <td className="p-1 border text-right">{unitPrice.toFixed(2)}</td>
                                    <td className="p-1 border text-right font-medium">{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-1 border text-center">{item.stockStatus}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                
                <section className="flex justify-end mt-2">
                    <div className="w-1/3">
                        <div className="flex justify-between p-2 bg-slate-100 rounded-md">
                            <span className="font-bold text-sm">Total Amount</span>
                            <span className="font-bold text-sm">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </section>

                <p className="font-semibold my-2 text-sm">Amount in Words: {numberToWords(totalAmount)}</p>

                <section className="border border-slate-200 p-2 rounded-md mt-4 print-no-break">
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
                
                <div className="mt-4 text-sm">
                    <p>Hope the above mentioned details are in line with your requirement, for any further clarification please feel free and contact us.</p>
                    <p className="mt-2">Thanking you,</p>
                </div>
            </div>

            <footer className="mt-8 pt-4 flex justify-between items-end border-t print-footer">
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