
import React, { useState } from 'react';

const Section: React.FC<{ title: string; id: string; children: React.ReactNode }> = ({ title, id, children }) => (
    <div id={id} className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-2">{title}</h2>
        {children}
    </div>
);

const SubSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-2">{title}</h3>
        {children}
    </div>
);

const ScreenshotPlaceholder: React.FC<{ label: string; size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({ label, size = 'md' }) => {
    const heightMap = {
        sm: '100px',
        md: '250px',
        lg: '350px',
        xl: '500px'
    };

    return (
        <div 
            style={{ 
                height: heightMap[size], 
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#e2e8f0', // slate-200 fallback
                borderStyle: 'dashed',
                borderWidth: '2px',
                borderColor: '#94a3b8', // slate-400 fallback
                marginBottom: '1.5rem',
                marginTop: '1rem',
                borderRadius: '0.5rem'
            }}
            className="w-full bg-slate-200 border-2 border-dashed border-slate-400 rounded-lg flex flex-col items-center justify-center text-slate-500 mb-6 my-4"
        >
            <div className="flex flex-col items-center justify-center p-4 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-bold text-sm uppercase tracking-wide bg-white/60 px-3 py-1 rounded">{label}</span>
                <span className="text-xs italic mt-2 text-slate-500">Insert Screenshot Here</span>
            </div>
        </div>
    );
};

export const UserManual: React.FC = () => {
    const [activeSection, setActiveSection] = useState('introduction');

    const sections = [
        { id: 'introduction', title: 'Introduction' },
        { id: 'getting-started', title: 'Getting Started' },
        { id: 'dashboard', title: 'Dashboard' },
        { id: 'customers', title: 'Managing Customers' },
        { id: 'products', title: 'Product Management' },
        { id: 'quotations', title: 'Creating Quotations' },
        { id: 'calendar', title: 'Calendar & Reminders' },
        { id: 'mobile-app', title: 'Mobile App Features' },
        { id: 'admin', title: 'Admin Features' },
    ];

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setActiveSection(id);
        }
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-4 hidden md:block sticky top-0 h-screen overflow-y-auto">
                <h3 className="font-bold text-lg text-slate-800 mb-4 uppercase tracking-wider">User Manual</h3>
                <nav className="space-y-1">
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => scrollToSection(section.id)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === section.id ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            {section.title}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-10 overflow-y-auto h-screen">
                <div className="max-w-4xl mx-auto pb-20">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">Offer Management System</h1>
                    <p className="text-lg text-slate-600 mb-8">Comprehensive User Guide for Siddhi Kabel Corporation Pvt Ltd.</p>

                    <Section id="introduction" title="1. Introduction">
                        <p className="mb-4">
                            Welcome to the Offer Management System. This application allows you to streamline your sales process, 
                            manage customers and products, generate professional quotations, and track your sales performance.
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                            <li>Create and manage quotations with ease.</li>
                            <li>Real-time product pricing (List Price & Special Price).</li>
                            <li>Mobile-friendly interface for sales on the go.</li>
                            <li>Performance dashboard with actionable insights.</li>
                        </ul>
                    </Section>

                    <Section id="getting-started" title="2. Getting Started">
                        <SubSection title="Login">
                            <p className="mb-2">Access the application using your assigned username. The default password for all users is <strong>123456</strong>. You will be prompted to change this upon your first login.</p>
                            <ScreenshotPlaceholder label="Login Screen" size="lg"/>
                        </SubSection>
                    </Section>

                    <Section id="dashboard" title="3. Dashboard">
                        <p className="mb-4">The Dashboard provides a bird's-eye view of your sales activities.</p>
                        
                        <SubSection title="Key Metrics">
                            <p>At the top, you will see cards displaying:</p>
                            <ul className="list-disc list-inside ml-4 mb-2">
                                <li><strong>Active Customers:</strong> Total unique customers engaged.</li>
                                <li><strong>Total Enquiries:</strong> Total number and value of all quotations.</li>
                                <li><strong>Status Breakdown:</strong> Count and value for Open, PO Received, Lost, etc.</li>
                            </ul>
                            <ScreenshotPlaceholder label="Dashboard - Key Metrics Cards" size="sm"/>
                        </SubSection>

                        <SubSection title="Performance Charts">
                            <p>Interactive charts help you visualize trends:</p>
                            <ul className="list-disc list-inside ml-4 mb-2">
                                <li><strong>Quotation Funnel:</strong> Visualizes the drop-off from Open quotes to POs.</li>
                                <li><strong>Value Trend:</strong> Line chart showing quotation value over time.</li>
                                <li><strong>Daily Enquiries:</strong> Bar chart showing activity per day.</li>
                            </ul>
                            <ScreenshotPlaceholder label="Dashboard - Charts Section" size="md" />
                        </SubSection>

                        <SubSection title="Filtering Data">
                            <p>Use the dropdowns at the top to filter data by <strong>Sales Person</strong> (Admin only) or by <strong>Time Period</strong> (Week, Month, Year).</p>
                        </SubSection>
                    </Section>

                    <Section id="customers" title="4. Managing Customers">
                        <p className="mb-4">Navigate to the <strong>Customers</strong> tab to manage your client base.</p>
                        
                        <SubSection title="Searching & Filtering">
                            <p>Use the search bars to find customers by <strong>Name</strong> or <strong>City</strong>. You can also filter by Sales Person.</p>
                            <ScreenshotPlaceholder label="Customer List & Search" size="md" />
                        </SubSection>

                        <SubSection title="Adding a Customer">
                            <p>Click "Add New" to open the customer form. Ensure you fill in:</p>
                            <ul className="list-disc list-inside ml-4">
                                <li>Customer Name & Address</li>
                                <li>Sales Person assigned</li>
                                <li><strong>Discount Structure:</strong> Set default discounts for Single Core, Multi Core, etc. These will auto-apply to quotations.</li>
                            </ul>
                        </SubSection>
                    </Section>

                    <Section id="products" title="5. Product Management">
                        <p className="mb-4">The <strong>Products</strong> tab holds your master price list.</p>
                        
                        <SubSection title="Searching Products">
                            <p>
                                <strong>Desktop:</strong> Search by Part No or Description. You can use <code>*</code> as a wildcard (e.g., <code>CABLE*POWER</code>).<br/>
                                <strong>Mobile:</strong> Use the "Universal Search" bar. It supports fuzzy searching (e.g., "3G2.5" matches "3 G 2.5").
                            </p>
                            <ScreenshotPlaceholder label="Product Search Interface" size="md" />
                        </SubSection>

                        <SubSection title="Pricing">
                            <p>Products have <strong>List Price (LP)</strong> and <strong>Special Price (SP)</strong>. The system automatically picks the valid price based on the date.</p>
                        </SubSection>
                    </Section>

                    <Section id="quotations" title="6. Creating Quotations">
                        <p className="mb-4">This is the core feature of the application.</p>

                        <SubSection title="Creating a New Quote">
                            <ol className="list-decimal list-inside space-y-2 ml-4 mb-4">
                                <li>Go to the <strong>Quotations</strong> tab and click <strong>New</strong>.</li>
                                <li><strong>Select Customer:</strong> Search for the customer. Address and Discount Structure will load automatically.</li>
                                <li><strong>Add Items:</strong>
                                    <ul className="list-disc list-inside ml-6 mt-1">
                                        <li>Type in the "Part No" field to search.</li>
                                        <li>Or click the "Search" button in the toolbar for advanced search.</li>
                                        <li>Select the product. Price (LP/SP) loads automatically.</li>
                                        <li>Enter MOQ (Minimum Order Qty) and Discount %.</li>
                                    </ul>
                                </li>
                                <li><strong>Air Freight (Optional):</strong> Check the "Air Freight" box on a line item to calculate air transport costs based on cable weight.</li>
                            </ol>
                            <ScreenshotPlaceholder label="Quotation Entry Form" size="xl"/>
                        </SubSection>

                        <SubSection title="Printing / Previewing">
                            <p>Click the "Preview" buttons to generate a printable view:</p>
                            <ul className="list-disc list-inside ml-4 mb-2">
                                <li><strong>Standard:</strong> Shows Unit Price and Total.</li>
                                <li><strong>Discounted:</strong> Explicitly shows LP, Discount %, and Net Price.</li>
                                <li><strong>Air Freight:</strong> Includes detailed air freight breakdown.</li>
                            </ul>
                            <p>Part Numbers in the print view are <strong>hyperlinked</strong> to the Lapp Group online catalogue.</p>
                            <ScreenshotPlaceholder label="Quotation Print Preview" size="lg" />
                        </SubSection>
                    </Section>

                    <Section id="calendar" title="7. Calendar & Reminders">
                        <p className="mb-4">The Calendar view helps track follow-ups.</p>
                        <ul className="list-disc list-inside ml-4 mb-4">
                            <li><strong>Green Dots:</strong> Indicate quotations created on that day.</li>
                            <li><strong>Orange Dots:</strong> Indicate follow-up reminders (5 days after quotation creation).</li>
                        </ul>
                        <p>Clicking a day minimizes the calendar and shows a list of tasks for that day.</p>
                        <ScreenshotPlaceholder label="Calendar View" size="md" />
                    </Section>

                    <Section id="mobile-app" title="8. Mobile App Features">
                        <p className="mb-4">The app is optimized for mobile devices.</p>
                        
                        <SubSection title="Mobile Navigation">
                            <p>A bottom navigation bar allows quick switching between Home, Quote, Calendar, and Products.</p>
                            <ScreenshotPlaceholder label="Mobile Bottom Navigation" size="sm" />
                        </SubSection>

                        <SubSection title="Card View">
                            <p>On mobile, tables are replaced by cards for better readability. You can quick-edit status or add comments directly from the card.</p>
                            <ScreenshotPlaceholder label="Mobile Quotation Card" size="md" />
                        </SubSection>

                        <SubSection title="View-Only Restrictions">
                            <p><strong>Sales Persons:</strong> On mobile, you can view details of quotations but cannot edit the line items of existing quotes to prevent accidental data changes. You can still change status and add comments.</p>
                        </SubSection>
                    </Section>

                    <Section id="admin" title="9. Admin Features">
                        <p className="mb-4">Admins have exclusive access to:</p>
                        <ul className="list-disc list-inside ml-4">
                            <li><strong>User Management:</strong> Create/Edit users and assign roles.</li>
                            <li><strong>Sales Person Management:</strong> Add new sales staff.</li>
                            <li><strong>Excel Upload:</strong> Bulk upload Products and Customers via Excel.</li>
                            <li><strong>Logo Management:</strong> Upload/Change the company logo on the Dashboard.</li>
                        </ul>
                    </Section>

                    <div className="mt-12 border-t pt-6 text-center text-slate-500 text-sm">
                        <p>Offer Management System v1.0</p>
                        <p>&copy; {new Date().getFullYear()} Siddhi Kabel Corporation Pvt Ltd.</p>
                    </div>
                </div>
            </main>
        </div>
    );
};
