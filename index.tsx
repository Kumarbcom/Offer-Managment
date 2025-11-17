
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { get } from './supabase';
import { supabaseConfig } from './supabaseClient';
import { SchemaSetupInstructions } from './components/SchemaSetupInstructions';

const startup = async () => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        throw new Error("Could not find root element to mount to");
    }

    const root = ReactDOM.createRoot(rootElement);

    // If Supabase is configured, check for database table existence before starting the app.
    if (supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID')) {
        try {
            // A simple check to see if we can query a table. If this fails with a "relation does not exist"
            // error, we can assume the schema has not been set up. For other errors, we show a generic
            // database connection error.
            await get('users');
        } catch (e) {
            const errorMessage = (e as Error).message;
            // Check for the specific Supabase error indicating a missing table.
            if (errorMessage.includes("Could not find the table") || (errorMessage.includes("relation") && errorMessage.includes("does not exist"))) {
                root.render(<SchemaSetupInstructions error={errorMessage} />);
            } else {
                console.error("Fatal error during database check:", e);
                 root.render(
                    <div className="flex items-center justify-center min-h-screen bg-slate-100">
                        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-lg">
                            <h1 className="text-2xl font-bold text-red-700 mb-4">Database Connection Failed</h1>
                            <p className="text-gray-600 mb-2">An unexpected error occurred while connecting to the database. Please check the following:</p>
                            <ul className="text-left list-disc list-inside text-gray-600 space-y-1">
                                <li>Ensure your Supabase project is running.</li>
                                <li>Verify your internet connection.</li>
                                <li>Check that Row Level Security (RLS) policies allow 'select' for the 'anon' role, or that RLS is disabled for the tables.</li>
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
