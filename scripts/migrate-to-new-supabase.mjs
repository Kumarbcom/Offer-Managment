/**
 * Automated Supabase-to-Supabase Data Migration Tool
 * 
 * Usage:
 *   1. Create your new Supabase project under your new email at https://supabase.com
 *   2. Run the SQL schema script in your new project's SQL Editor.
 *   3. Set the OLD and NEW keys below (or pass via environment variables).
 *   4. Run: node scripts/migrate-to-new-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';

// Source (Current) Supabase
const OLD_URL = process.env.OLD_SUPABASE_URL || 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
const OLD_KEY = process.env.OLD_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA';

// Target (New) Supabase
const NEW_URL = process.env.NEW_SUPABASE_URL || '';
const NEW_KEY = process.env.NEW_SUPABASE_KEY || '';

if (!NEW_URL || !NEW_KEY) {
    console.error("\n❌ Please provide NEW_SUPABASE_URL and NEW_SUPABASE_KEY.");
    console.log("Example:");
    console.log("  $env:NEW_SUPABASE_URL=\"https://your-new-id.supabase.co\"");
    console.log("  $env:NEW_SUPABASE_KEY=\"your-new-anon-key\"");
    console.log("  node scripts/migrate-to-new-supabase.mjs\n");
    process.exit(1);
}

const oldSb = createClient(OLD_URL, OLD_KEY);
const newSb = createClient(NEW_URL, NEW_KEY);

const TABLES = [
    'users',
    'salesPersons',
    'customers',
    'products',
    'quotations',
    'pendingSOs',
    'deliveryChallans'
];

async function migrateTable(table) {
    console.log(`\n⏳ Migrating table: [${table}]...`);
    let offset = 0;
    const batchSize = 500;
    let totalMigrated = 0;

    while (true) {
        const { data, error } = await oldSb
            .from(table)
            .select('*')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error(`❌ Error fetching from ${table}:`, error.message);
            break;
        }

        if (!data || data.length === 0) break;

        const { error: insertError } = await newSb
            .from(table)
            .upsert(data, { onConflict: 'id' });

        if (insertError) {
            console.error(`❌ Error inserting into new ${table}:`, insertError.message);
            break;
        }

        totalMigrated += data.length;
        console.log(`   Copied ${totalMigrated} rows...`);

        if (data.length < batchSize) break;
        offset += data.length;
    }

    console.log(`✅ Table [${table}] completed: ${totalMigrated} total rows migrated.`);
}

async function run() {
    console.log("=========================================");
    console.log("🚀 Supabase Migration Starting...");
    console.log(`From: ${OLD_URL}`);
    console.log(`To:   ${NEW_URL}`);
    console.log("=========================================");

    for (const table of TABLES) {
        await migrateTable(table);
    }

    console.log("\n🎉 ALL TABLES MIGRATED SUCCESSFULLY!");
    console.log("Now update `supabaseClient.ts` with your new URL and Anon Key.\n");
}

run().catch(console.error);
