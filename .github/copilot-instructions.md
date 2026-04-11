# Offer Management Application - AI Agent Instructions

## Project Overview
A React + TypeScript quotation and offer management system for a cable/electrical components company. Handles quotations, sales persons, customers, products, delivery challans, and stock management with role-based access control (Admin, Sales Person, Management, SCM, Viewer).

## Architecture & Key Patterns

### Data Persistence Strategy
- **Primary**: Supabase (PostgreSQL) for cloud persistence with real-time subscriptions
- **Fallback**: Browser localStorage for individual tables (except products, which use in-memory)
- **Hook**: `useOnlineStorage<T>()` manages dual-layer persistence automatically
  - Loads from Supabase if configured; falls back to localStorage if unavailable
  - Real-time subscriptions sync changes across browser instances
  - **File**: [useOnlineStorage.ts](../hooks/useOnlineStorage.ts)

### State Management
- **No Redux/Context API** - State lifted to App.tsx with `useOnlineStorage` hooks
- Each entity (users, quotations, customers, products, salesPersons, stockStatements, pendingSOs) has dedicated state
- Mutations: Pass `setters` from App.tsx down to child components
- Data flows: Parent state → Props → Children modify via async setters

### Component Architecture
- **Template Pattern**: [DataManagerTemplate.tsx](../components/common/DataManagerTemplate.tsx) - reused by all manager components
  - Takes: `title`, `form` (JSX), `tableHeaders`, `tableRows` (JSX[]), `isEditing`, `resetForm`, `onExport`
  - Examples: [ProductManager.tsx](../components/ProductManager.tsx), [CustomerManager.tsx](../components/CustomerManager.tsx)
- **Form Modal Pattern**: Quick-add modals (CustomerAddModal, ProductAddModal) provide inline entity creation
- **Print Views**: Three quotation print formats with Tailwind styling (standard, discounted, air freight)
  - Export to PDF via Print API (Ctrl+P → Save as PDF)

### Type System
- Central [types.ts](../types.ts) defines all entities: `Quotation`, `Customer`, `Product`, `SalesPerson`, `User`, `StockItem`, `PendingSO`
- Read-only entity lists in [constants.ts](../constants.ts): sales people names, UOMs (M/PC/ST/No), payment terms, quotation statuses, product brands
- **Critical distinction**: `User.role` controls feature visibility; `currentUser` passed as prop through auth flow

### Key Business Entities
- **Quotation**: Core entity with date, customer, items (products), status (Open/PO received/Lost/etc), sales person
  - **Display Number**: Uses special formatting - see [utils/quotationNumber.ts](../utils/quotationNumber.ts)
    - Before Apr 1, 2026: `SKC/QTN/<id>` (e.g., `SKC/QTN/2183`)
    - Apr 1, 2026 onwards: `SKC/QTN/<XXXX>-<FY>` (e.g., `SKC/QTN/0001-2026-27`) based on fiscal year sequence
  - **Deep linking**: URL param `?id=<quotationId>` auto-opens quotation in QuotationForm
  - **Workflow**: Create → Add items → Set status → Print → Email customer
- **QuotationItem**: Product line with quantity, price, discount, stock status, optional air freight details
- **Product**: Identified by free-form `partNo` (e.g., "OLFLEX-001"), pricing by date range (LP/SP), UOM, plant (MFGN/TRDN), weight per meter for air freight calculation
- **Customer**: Linked to sales persons, has discount structure (singleCore/multiCore/specialCable/accessories %)

## Critical Developer Workflows

### Setup & Running
```bash
npm install
# Set GEMINI_API_KEY in .env.local (required for some AI features)
npm run dev       # Vite dev server on http://localhost:3000
npm run build     # TypeScript + React -> dist/
npm run preview   # Preview production build
```

### Key Commands
- **No test runner configured** - write tests manually if needed
- **Supabase**: Requires .env.local with SUPABASE_URL and SUPABASE_KEY; optional (app degrades gracefully)
- **Firebase**: Currently unused (firebaseConfig.ts exists but not integrated)
- **Capacitor**: Mobile app config exists but web-only build in use

### Adding a New Data Entity
1. Add type definition to [types.ts](../types.ts)
2. Add initial data to [initialData.ts](../initialData.ts) (if not Supabase-only)
3. Create table in Supabase (naming: `snake_case`, see `toSupabaseTableName()` in [supabase.ts](../supabase.ts))
4. Add collection name to `TableName` type in [supabase.ts](../supabase.ts)
5. Use `useOnlineStorage<YourType>('tableName')` in App.tsx
6. Create manager component using [DataManagerTemplate.tsx](../components/common/DataManagerTemplate.tsx) pattern
7. Import and render in App.tsx within appropriate View handler

## Project-Specific Conventions

### Naming & ID Schemes
- **File naming**: PascalCase for components (QuotationForm.tsx), camelCase for hooks/utils
- **Product Numbers**: Free-form `partNo` strings (e.g., "OLFLEX-001", "UNITRONIC-24AWG"). No format validation.
- **Quotation Display Numbers**: Only for quotations (NOT products)
  - **Before 01-Apr-2026**: Old format `SKC/QTN/<id>` (e.g., `SKC/QTN/2183`)
  - **On or after 01-Apr-2026**: New format `SKC/QTN/XXXX-YYYY-YY` (e.g., `SKC/QTN/0001-2026-27`) where XXXX is fiscal-year sequence rank
  - See [utils/quotationNumber.ts](../utils/quotationNumber.ts) for implementation
- **Supabase tables**: Use `camelCase` in TypeScript, map to `snake_case` in DB via `toSupabaseTableName()`
- **Primary keys**: `id` (numeric) for most entities; `name` (string) for users

### UI/Styling
- **Framework**: React 19 + Tailwind CSS (no component library)
- **Animations**: Framer Motion for Dashboard cards
- **Icons**: Inline SVGs (custom-drawn, not from icon library)
- **Print styling**: Hidden divs with absolute positioning for print-only content; use browser Print Preview

### Role-Based Access
- Defined in [types.ts](../types.ts): Admin, Sales Person, Management, SCM, Viewer
- Feature gates: Check `currentUser.role` before rendering (e.g., only Admins see UserManager)
- All roles require password change on first login (default: '123456')

### Common Patterns to Reuse
- **useLocalStorage hook**: Browser storage without Supabase (used as fallback)
- **useDebounce hook**: Debounce product/customer search inputs (300ms default)
- **SearchableSelect component**: Searchable dropdown (used in QuotationForm for customer/product selection)
- **DropdownInput component**: Simple select input wrapper
- **Batch operations**: `addProductsBatch()`, `updateProduct()`, `upsertCustomer()` use Supabase batch writes

## Integration Points & External Dependencies

### Supabase Integration
- Real-time subscriptions via `.channel().on('postgres_changes', ...)`
- Handles INSERT/UPDATE/DELETE events; merges with local state (de-duplicates "local echo")
- Pagination: 1000 rows per query (see [supabase.ts](../supabase.ts))
- Error handling: Catches Supabase errors and falls back to localStorage gracefully

### Chart.js CDN
- Used in Dashboard for quotation status pie charts and sales metrics
- ChartDataLabels plugin for labels on chart segments
- Declared as `declare const Chart: any; declare const ChartDataLabels: any;`
- Files: index.html includes Chart.js scripts

### XLSX (SheetJS)
- Used for exporting data tables (Manage Products, Manage Customers, etc.)
- Declared globally in QuotationForm for file-based import
- Pattern: Convert array of objects → XLSX workbook → download

### Vite Configuration
- React plugin enabled; [vite.config.ts](../vite.config.ts) defines port 3000, GEMINI_API_KEY injection
- Alias support (not currently used, but available)

## Common Debugging Patterns

### Data Not Syncing
1. Check if Supabase is configured: `supabaseConfig.url && !includes('YOUR_PROJECT_ID')`
2. Verify real-time channel subscriptions in browser console (should see `table-changes-*` channels)
3. Check localStorage fallback: If Supabase fails, data will load from localStorage instead

### Quotation Form Slowness
- Large product lists: Search is debounced; check `useDebounce` hook for delays
- Stock statement data: Optional `stockStatements` prop; UI hides stock checks if undefined
- Air freight calculations: Uses weightPerMtr × req × multiplier; validate in QuotationItem

### URL Deep Linking Issues
- Ensure `window.location.search` parsing handles both browser and mobile contexts
- Avoid pushState if protocol is blob (Capacitor/embedded WebView)
- Clear search params on logout (line in App.tsx logout handler)

## Testing & Quality
- No automated test suite configured
- Manual testing: Run `npm run dev`, test role-based views, verify Supabase sync
- Check TypeScript compilation: `npm run build` catches type errors
- Browser DevTools: Monitor Network tab for Supabase queries, Application tab for localStorage

## Quick Reference: Key Files
| File | Purpose |
|------|---------|
| [App.tsx](../App.tsx) | Root component, state management, view routing |
| [types.ts](../types.ts) | Type definitions for all entities |
| [hooks/useOnlineStorage.ts](../hooks/useOnlineStorage.ts) | Dual-layer persistence (Supabase + localStorage) |
| [supabase.ts](../supabase.ts) | Supabase API wrapper (get, set, batch operations) |
| [components/QuotationForm.tsx](../components/QuotationForm.tsx) | Main quotation CRUD (1052 lines, uses most patterns) |
| [components/common/DataManagerTemplate.tsx](../components/common/DataManagerTemplate.tsx) | Reusable form + table layout for all managers |
| [constants.ts](../constants.ts) | Dropdown options, role names, UOMs, payment terms |
| [initialData.ts](../initialData.ts) | Seed data for first-time users |
