import React, { useState } from 'react';

const SQL_SCHEMA = `
-- Offer Management Database Schema v1.2
-- Instructions:
-- 1. Go to your Supabase project dashboard.
-- 2. In the left sidebar, navigate to the "SQL Editor".
-- 3. Click "New query".
-- 4. Copy and paste the entire content of this script into the editor.
-- 5. Click "Run".
-- 6. CRITICAL FOR REAL-TIME: Go to "Database" > "Replication". Find your tables under "Source" and click the number (e.g., "0 tables"). Check all tables for replication and click "Save".
-- 7. After running the script and enabling replication, refresh this application page.

-- Step 1: Create the tables with required columns.

CREATE TABLE public.users (
  name TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE TABLE public.sales_persons (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  mobile TEXT
);

CREATE TABLE public.products (
  id INT PRIMARY KEY,
  "partNo" TEXT NOT NULL,
  description TEXT NOT NULL,
  "hsnCode" TEXT,
  prices JSONB NOT NULL,
  uom TEXT,
  plant TEXT,
  weight NUMERIC
);

CREATE TABLE public.customers (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  pincode TEXT,
  "salesPersonId" INT,
  "discountStructure" JSONB
);

CREATE TABLE public.quotations (
  id INT PRIMARY KEY,
  "quotationDate" DATE NOT NULL,
  "enquiryDate" DATE NOT NULL,
  "customerId" INT,
  "contactPerson" TEXT,
  "contactNumber" TEXT,
  "otherTerms" TEXT,
  "paymentTerms" TEXT,
  "preparedBy" TEXT,
  "productsBrand" TEXT,
  "salesPersonId" INT,
  "modeOfEnquiry" TEXT,
  status TEXT,
  comments TEXT,
  details JSONB
);

CREATE TABLE public.delivery_challans (
  id INT PRIMARY KEY,
  "challanDate" DATE NOT NULL,
  "customerId" INT,
  "quotationId" INT,
  "vehicleNo" TEXT,
  "poNo" TEXT,
  "poDate" DATE,
  items JSONB
);

-- Step 2: Grant permissions to the API roles.
-- This allows the application to read and write to the tables using the public anon key.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_persons TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_challans TO anon, authenticated;

-- Step 3: Disable Row Level Security (RLS) for all new tables.
-- This is a quick setup for development. For production, you should enable RLS
-- and define policies for who can access or modify what data.
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_persons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challans DISABLE ROW LEVEL SECURITY;
`;

interface SchemaSetupInstructionsProps {
  error: string;
}

export const SchemaSetupInstructions: React.FC<SchemaSetupInstructionsProps> = ({ error }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="text-left p-8 bg-white rounded-lg shadow-2xl max-w-4xl w-full">
        <h1 className="text-2xl font-bold text-red-700 mb-4">Database Setup Required</h1>
        <p className="text-gray-600 mb-2">
          The application couldn't connect to your database tables. This usually means the tables haven't been created yet or have incorrect permissions.
        </p>
        <p className="text-gray-600 mb-4">
          Please run the following SQL script in your Supabase project's SQL Editor to create and configure the necessary tables.
        </p>
        
        <p className="mt-4 text-sm text-red-500 bg-red-50 p-2 rounded mb-4">
            <strong>Detected Error:</strong> {error}
        </p>

        <div className="relative">
            <textarea
                readOnly
                value={SQL_SCHEMA}
                className="w-full h-64 p-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-md border border-slate-700 resize-none focus:outline-none"
                aria-label="SQL Schema for database setup"
            />
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-1 px-3 rounded-md text-sm transition-colors"
            >
                {copied ? 'Copied!' : 'Copy SQL'}
            </button>
        </div>

        <h2 className="text-xl font-bold text-indigo-700 mt-6 mb-2">CRITICAL: Enable Real-time Updates</h2>
        <p className="text-gray-600 mb-2">
            For data to sync automatically between users, you must enable database replication.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-gray-700 bg-indigo-50 p-3 rounded-md border border-indigo-200">
            <li>In your Supabase dashboard, go to <strong className="font-semibold">Database</strong>, then <strong className="font-semibold">Replication</strong>.</li>
            <li>Under <strong className="font-semibold">Source</strong>, click on the text that says something like "0 tables".</li>
            <li>In the popup, check the boxes for all the application's tables (users, customers, etc.).</li>
            <li>Click <strong className="font-semibold">Save</strong>.</li>
        </ol>
        
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            After running the script and enabling replication, click Retry.
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Go to Supabase Dashboard →
            </a>
            <button 
                onClick={() => window.location.reload()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
                Retry Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};