

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { get, set } from './supabase';
import { INITIAL_DATA } from './initialData';
import { supabaseConfig } from './supabaseClient';
import { SchemaSetupInstructions } from './components/SchemaSetupInstructions';

const SEEDING_ORDER: (keyof typeof INITIAL_DATA)[] = [
    'users', 
    'salesPersons', 
    'products', 
    'customers', 
    'quotations', 
    'deliveryChallans'
];

const startup = async () => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        throw new Error("Could not find root element to mount to");
    }

    const root = ReactDOM.createRoot(rootElement);

    // Only attempt to seed if Supabase is configured
    if (supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID')) {
        try {
            console.log("Checking database state before app start...");
            for (const tableName of SEEDING_ORDER) {
                const data = await get(tableName);
                if (data.length === 0) {
                    console.log(`Table '${tableName}' is empty. Seeding with initial data...`);
                    // It's a new table, so there's no "previous" data to diff against.
                    // Fix: Use a switch statement to provide a concrete type to the generic `set` function,
                    // resolving a type error caused by passing a union of array types.
                    switch (tableName) {
                        case 'users':
                            await set(tableName, [], INITIAL_DATA.users);
                            break;
                        case 'salesPersons':
                            await set(tableName, [], INITIAL_DATA.salesPersons);
                            break;
                        case 'products':
                            await set(tableName, [], INITIAL_DATA.products);
                            break;
                        case 'customers':
                            await set(tableName, [], INITIAL_DATA.customers);
                            break;
                        case 'quotations':
                            await set(tableName, [], INITIAL_DATA.quotations);
                            break;
                        case 'deliveryChallans':
                            await set(tableName, [], INITIAL_DATA.deliveryChallans);
                            break;
                    }
                }
            }
            console.log("Database check complete.");
        } catch (e) {
            const errorMessage = (e as Error).message;
            // Check for the specific Supabase error indicating a missing table
            if (errorMessage.includes("Could not find the table") || (errorMessage.includes("relation") && errorMessage.includes("does not exist"))) {
                root.render(<SchemaSetupInstructions error={errorMessage} />);
            } else {
                console.error("Fatal error during database initialization:", e);
                root.render(
                    <div className="flex items-center justify-center min-h-screen bg-slate-100">
                        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-lg">
                            <h1 className="text-2xl font-bold text-red-700 mb-4">Database Initialization Failed</h1>
                            <p className="text-gray-600 mb-2">An unexpected error occurred. Please check the following:</p>
                            <ul className="text-left list-disc list-inside text-gray-600 space-y-1">
                                <li>Ensure your Supabase project is running.</li>
                                <li>Check that the tables have been created with the correct names (e.g., 'sales_persons') and columns.</li>
                                <li>Verify that Row Level Security (RLS) policies allow 'select' and 'insert' for the 'anon' role, or that RLS is disabled for the tables.</li>
                            </ul>
                            <p className="mt-4 text-sm text-red-500 bg-red-50 p-2 rounded"><strong>Error:</strong> {errorMessage}</p>
                        </div>
                    </div>
                );
            }
            return; // Stop execution if initialization fails
        }
    }

    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
};

startup();