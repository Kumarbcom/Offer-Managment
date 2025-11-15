import type { SalesPerson, Customer, Product, Quotation, DeliveryChallan } from './types';

export const MOCK_SALES_PERSONS: SalesPerson[] = [
  { id: 1, name: 'Ananthapadmanabha Phandari', email: 'ap@example.com', mobile: '9876543210' },
  { id: 2, name: 'Giridhar', email: 'giridhar@example.com', mobile: '9876543211' },
  { id: 3, name: 'Veeresh', email: 'veeresh@example.com', mobile: '9876543212' },
  { id: 4, name: 'Office', email: 'office@example.com', mobile: '9876543213' },
];

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 1,
    name: 'ABC Electronics',
    address: '123 Tech Park, Electronic City',
    city: 'Bangalore',
    pincode: '560100',
    salesPersonId: 1,
    discountStructure: { singleCore: 10, multiCore: 15, specialCable: 5, accessories: 20 },
  },
  {
    id: 2,
    name: 'XYZ Innovations',
    address: '456 Industrial Area, Phase 2',
    city: 'Pune',
    pincode: '411057',
    salesPersonId: 2,
    discountStructure: { singleCore: 12, multiCore: 18, specialCable: 7, accessories: 22 },
  },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    partNo: 'OLFLEX-100-3G1.5',
    description: 'ÖLFLEX® 100 3 G 1,5',
    hsnCode: '854449',
    prices: [
      { lp: 120.50, sp: 0, validFrom: '2023-01-01', validTo: '9999-12-31' },
    ],
    uom: 'M',
    plant: 'MFGN',
    weight: 0.150,
  },
  {
    id: 2,
    partNo: 'UNITRONIC-LiYCY-2x0.5',
    description: 'UNITRONIC® LiYCY 2 X 0,5',
    hsnCode: '854449',
    prices: [
        { lp: 85.00, sp: 0, validFrom: '2023-01-01', validTo: '2024-06-30' },
        { lp: 90.00, sp: 0, validFrom: '2024-07-01', validTo: '9999-12-31' },
    ],
    uom: 'M',
    plant: 'TRDN',
    weight: 0.080,
  },
  {
    id: 3,
    partNo: 'SKINTOP-MS-M20',
    description: 'SKINTOP® MS-M 20',
    hsnCode: '741999',
    prices: [
      { lp: 0, sp: 250.75, validFrom: '2023-01-01', validTo: '9999-12-31' },
    ],
    uom: 'PC',
    plant: 'MFGN',
    weight: 0.050,
  },
];

export const MOCK_QUOTATIONS: Quotation[] = [
  {
    id: 1,
    quotationDate: '2025-10-26',
    enquiryDate: '2025-10-25',
    customerId: 1,
    contactPerson: 'Mr. Sharma',
    contactNumber: '9876543210',
    otherTerms: '± 5% Length Variation',
    paymentTerms: '100% Payment with in 30 Days',
    preparedBy: 'Kumar',
    productsBrand: 'Lapp',
    salesPersonId: 1,
    modeOfEnquiry: 'Customer Email',
    status: 'Open',
    comments: 'Awaiting customer feedback.',
    details: [
      {
        productId: 1,
        partNo: 'OLFLEX-100-3G1.5',
        description: 'ÖLFLEX® 100 3 G 1,5',
        moq: 100,
        req: 100,
        price: 120.50,
        priceSource: 'LP',
        discount: 15,
        stockStatus: 'Ex-Stock',
        uom: 'M',
        airFreight: false,
        airFreightDetails: { weightPerMtr: 0.150, airFreightLeadTime: '' },
      },
      {
        productId: 3,
        partNo: 'SKINTOP-MS-M20',
        description: 'SKINTOP® MS-M 20',
        moq: 50,
        req: 40,
        price: 250.75,
        priceSource: 'SP',
        discount: 20,
        stockStatus: 'Ex-Stock',
        uom: 'PC',
        airFreight: false,
        airFreightDetails: { weightPerMtr: 0.050, airFreightLeadTime: '' },
      },
    ],
  },
  {
    id: 2,
    quotationDate: '2025-10-27',
    enquiryDate: '2025-10-26',
    customerId: 2,
    contactPerson: 'Ms. Gupta',
    contactNumber: '9123456780',
    otherTerms: 'Standard Terms Apply',
    paymentTerms: '100% Against Proforma Invoice',
    preparedBy: 'Vandita',
    productsBrand: 'Lapp',
    salesPersonId: 2,
    modeOfEnquiry: 'Sales Person What’s app',
    status: 'PO received',
    comments: 'PO No. PO-12345 received.',
    details: [
      {
        productId: 2,
        partNo: 'UNITRONIC-LiYCY-2x0.5',
        description: 'UNITRONIC® LiYCY 2 X 0,5',
        moq: 500,
        req: 500,
        price: 90.00,
        priceSource: 'LP',
        discount: 18,
        stockStatus: '4 Weeks',
        uom: 'M',
        airFreight: true,
        airFreightDetails: { weightPerMtr: 0.080, airFreightLeadTime: '1 Week' },
      },
    ],
  },
];

export const MOCK_DELIVERY_CHALLANS: DeliveryChallan[] = [];