import type { UOMS, PLANTS, PAYMENT_TERMS, PREPARED_BY_LIST, PRODUCTS_BRANDS, MODES_OF_ENQUIRY, QUOTATION_STATUSES, SALES_PERSON_NAMES } from './constants';

export type UserRole = 'Admin' | 'Sales Person' | 'Management' | 'SCM' | 'Viewer';

export interface User {
  name: typeof SALES_PERSON_NAMES[number] | 'Admin' | 'Manager' | 'SCM' | 'Gurudatta' | 'Purshothama' | 'DC Venugopal' | 'Kumar' | 'Vandita' | 'Ranjan' | 'Rachana' | 'Mohan' | 'Geetha';
  password: string;
  role: UserRole;
}

export type View = 'dashboard' | 'customers' | 'products' | 'quotations' | 'quotation-form' | 'sales-persons' | 'users' | 'delivery-challans' | 'delivery-challan-form';

export interface SalesPerson {
  id?: number;
  name: string;
  email: string;
  mobile: string;
}

export interface Customer {
  id?: number;
  name: string;
  address: string;
  city: string;
  pincode: string;
  salesPersonId: number | null;
  discountStructure: {
    singleCore: number;
    multiCore: number;
    specialCable: number;
    accessories: number;
  };
}

export interface PriceEntry {
  lp: number;
  sp: number;
  validFrom: string; // YYYY-MM-DD
  validTo: string;   // YYYY-MM-DD
}

export type UOM = typeof UOMS[number];
export type Plant = typeof PLANTS[number];

export interface Product {
  id?: number;
  partNo: string;
  description: string;
  hsnCode?: string;
  prices: PriceEntry[];
  uom: UOM | '';
  plant: Plant | '';
  weight: number; // kg/m
}

export interface QuotationItem {
  productId: number;
  partNo: string;
  description: string;
  moq: number;
  req: number;
  price: number;
  priceSource: 'LP' | 'SP';
  discount: number | string;
  stockStatus: string;
  uom: string;
  airFreight: boolean;
  airFreightDetails: {
    weightPerMtr: number;
    airFreightLeadTime: string;
  };
}

export type PaymentTerm = typeof PAYMENT_TERMS[number];
export type PreparedBy = typeof PREPARED_BY_LIST[number];
export type ProductBrand = typeof PRODUCTS_BRANDS[number];
export type ModeOfEnquiry = typeof MODES_OF_ENQUIRY[number];
export type QuotationStatus = typeof QUOTATION_STATUSES[number];

export interface Quotation {
  id?: number;
  quotationDate: string; // YYYY-MM-DD
  enquiryDate: string;   // YYYY-MM-DD
  customerId: number | null;
  contactPerson: string;
  contactNumber: string;
  otherTerms: string;
  paymentTerms: PaymentTerm;
  preparedBy: PreparedBy;
  productsBrand: ProductBrand;
  salesPersonId: number | null;
  modeOfEnquiry: ModeOfEnquiry;
  status: QuotationStatus;
  comments: string;
  details: QuotationItem[];
}


export interface DeliveryChallanItem {
  productId: number;
  partNo: string;
  description: string;
  hsnCode: string;
  dispatchedQty: number;
  uom: string;
  remarks: string;
}

export interface DeliveryChallan {
  id?: number;
  challanDate: string; // YYYY-MM-DD
  customerId: number | null;
  quotationId: number | null;
  vehicleNo: string;
  poNo: string;
  poDate: string; // YYYY-MM-DD
  items: DeliveryChallanItem[];
}