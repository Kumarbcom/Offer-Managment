
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

const UIWireframe: React.FC<{ type: 'login' | 'dashboard' | 'table' | 'form' | 'calendar' | 'mobile' }> = ({ type }) => {
    const stroke = "#94a3b8"; // slate-400
    const fill = "#f8fafc"; // slate-50
    const darkFill = "#1e293b"; // slate-800 (Header)
    const accent = "#6366f1"; // indigo-500
    const green = "#22c55e";
    const orange = "#f97316";
    
    return (
        <div className="w-full h-72 bg-slate-100 flex items-center justify-center p-4 border border-slate-300 rounded-lg overflow-hidden relative my-4 shadow-inner">
            <svg width="100%" height="100%" viewBox="0 0 600 350" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                {type === 'login' && (
                    <g>
                        {/* Background */}
                        <rect x="0" y="0" width="600" height="350" fill="#f1f5f9" />
                        {/* Login Box */}
                        <rect x="200" y="50" width="200" height="250" rx="8" fill="white" filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))" />
                        <text x="300" y="90" textAnchor="middle" fontSize="18" fill="#1e293b" fontWeight="bold" fontFamily="sans-serif">Login</text>
                        
                        {/* Inputs */}
                        <text x="220" y="125" fontSize="10" fill="#64748b" fontFamily="sans-serif">Username</text>
                        <rect x="220" y="130" width="160" height="30" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                        
                        <text x="220" y="180" fontSize="10" fill="#64748b" fontFamily="sans-serif">Password</text>
                        <rect x="220" y="185" width="160" height="30" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                        
                        {/* Button */}
                        <rect x="220" y="240" width="160" height="30" rx="4" fill={accent} />
                        <text x="300" y="260" textAnchor="middle" fontSize="12" fill="white" fontFamily="sans-serif" dominantBaseline="middle" fontWeight="bold">Sign In</text>
                    </g>
                )}

                {type === 'dashboard' && (
                    <g>
                        {/* Header */}
                        <rect x="10" y="10" width="580" height="40" rx="4" fill="white" stroke="#e2e8f0" />
                        <rect x="20" y="20" width="20" height="20" rx="4" fill={accent}/>
                        <text x="50" y="35" fontSize="14" fill="#1e293b" fontWeight="bold" fontFamily="sans-serif">Dashboard</text>
                        
                        {/* Slicers */}
                        <rect x="400" y="18" width="100" height="24" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/>
                        <rect x="510" y="18" width="70" height="24" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/>

                        {/* Top Stats Row */}
                        <g transform="translate(10, 60)">
                            <rect x="0" y="0" width="80" height="60" rx="6" fill="white" stroke="#e2e8f0"/>
                            <text x="40" y="25" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#334155">25</text>
                            <text x="40" y="45" textAnchor="middle" fontSize="8" fill="#94a3b8">CUSTOMERS</text>

                            <rect x="90" y="0" width="80" height="60" rx="6" fill="#4f46e5"/>
                            <text x="130" y="25" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">102</text>
                            <text x="130" y="45" textAnchor="middle" fontSize="8" fill="white" opacity="0.8">ENQUIRIES</text>

                            <rect x="180" y="0" width="80" height="60" rx="6" fill="white" stroke="#e2e8f0" strokeLeft="4" strokeColor="#3b82f6"/>
                            <rect x="180" y="0" width="4" height="60" fill="#3b82f6"/> {/* Border left accent */}
                            <text x="220" y="25" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#334155">45</text>
                            <text x="220" y="45" textAnchor="middle" fontSize="8" fill="#3b82f6">OPEN</text>

                            <rect x="270" y="0" width="80" height="60" rx="6" fill="white" stroke="#e2e8f0"/>
                            <rect x="270" y="0" width="4" height="60" fill="#22c55e"/>
                            <text x="310" y="25" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#334155">12</text>
                            <text x="310" y="45" textAnchor="middle" fontSize="8" fill="#22c55e">PO REC</text>
                            
                            <rect x="360" y="0" width="80" height="60" rx="6" fill="white" stroke="#e2e8f0"/>
                            <rect x="360" y="0" width="4" height="60" fill="#14b8a6"/>
                            <text x="400" y="25" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#334155">5</text>
                            <text x="400" y="45" textAnchor="middle" fontSize="8" fill="#14b8a6">PARTIAL</text>
                        </g>

                        {/* Charts Row */}
                        <g transform="translate(10, 130)">
                            {/* Funnel */}
                            <rect x="0" y="0" width="180" height="120" rx="6" fill="white" stroke="#e2e8f0"/>
                            <text x="10" y="20" fontSize="10" fontWeight="bold" fill="#64748b">FUNNEL</text>
                            <path d="M20 40 L160 40 L140 60 L40 60 Z" fill="#3b82f6"/>
                            <path d="M40 65 L140 65 L120 85 L60 85 Z" fill="#22c55e"/>
                            <path d="M60 90 L120 90 L100 110 L80 110 Z" fill="#f43f5e"/>

                            {/* Trend */}
                            <rect x="190" y="0" width="180" height="120" rx="6" fill="white" stroke="#e2e8f0"/>
                            <text x="200" y="20" fontSize="10" fontWeight="bold" fill="#64748b">TREND</text>
                            <polyline points="200,100 230,80 260,90 290,50 320,70 350,40" fill="none" stroke="#0ea5e9" strokeWidth="2"/>

                            {/* Top Customers */}
                            <rect x="380" y="0" width="190" height="120" rx="6" fill="white" stroke="#e2e8f0"/>
                            <text x="390" y="20" fontSize="10" fontWeight="bold" fill="#64748b">TOP CUSTOMERS</text>
                            <rect x="390" y="35" width="100" height="10" rx="2" fill="#8b5cf6"/>
                            <rect x="390" y="55" width="140" height="10" rx="2" fill="#8b5cf6"/>
                            <rect x="390" y="75" width="80" height="10" rx="2" fill="#8b5cf6"/>
                        </g>

                        {/* Performance Table */}
                        <g transform="translate(10, 260)">
                            <rect x="0" y="0" width="570" height="80" rx="6" fill="white" stroke="#e2e8f0"/>
                            <text x="10" y="20" fontSize="10" fontWeight="bold" fill="#64748b">PERFORMANCE</text>
                            <line x1="0" y1="30" x2="570" y2="30" stroke="#e2e8f0"/>
                            <text x="10" y="45" fontSize="8" fill="#64748b">Name</text>
                            <text x="100" y="45" fontSize="8" fill="#64748b">Total</text>
                            <text x="150" y="45" fontSize="8" fill="#64748b">Open</text>
                            <text x="200" y="45" fontSize="8" fill="#64748b">PO</text>
                            
                            <text x="10" y="65" fontSize="9" fontWeight="bold" fill="#334155">Sales Person 1</text>
                            <text x="100" y="65" fontSize="9" fill="#334155">50</text>
                            <text x="150" y="65" fontSize="9" fill="#3b82f6">20</text>
                            <text x="200" y="65" fontSize="9" fill="#22c55e">10</text>
                        </g>
                    </g>
                )}

                {type === 'table' && (
                    <g>
                        {/* Container */}
                        <rect x="10" y="10" width="580" height="330" rx="6" fill="white" stroke="#e2e8f0" />
                        
                        {/* Header Toolbar */}
                        <text x="30" y="40" fontSize="16" fontWeight="bold" fill="#1e293b">Customers</text>
                        
                        {/* Buttons */}
                        <rect x="450" y="25" width="60" height="24" rx="4" fill="#059669"/> {/* Upload */}
                        <rect x="520" y="25" width="60" height="24" rx="4" fill="#2563eb"/> {/* Add New */}
                        
                        {/* Search Filters Row */}
                        <g transform="translate(20, 60)">
                            <rect x="0" y="0" width="120" height="30" rx="4" fill="white" stroke="#cbd5e1"/>
                            <text x="10" y="20" fontSize="10" fill="#94a3b8">Search Name...</text>
                            
                            <rect x="130" y="0" width="120" height="30" rx="4" fill="white" stroke="#cbd5e1"/>
                            <text x="140" y="20" fontSize="10" fill="#94a3b8">Search City...</text>
                            
                            <rect x="260" y="0" width="120" height="30" rx="4" fill="white" stroke="#cbd5e1"/>
                            <text x="270" y="20" fontSize="10" fill="#94a3b8">Filter Sales Person</text>
                        </g>

                        {/* Table Header */}
                        <rect x="20" y="100" width="550" height="30" rx="0" fill="#f8fafc" stroke="#e2e8f0"/>
                        <text x="30" y="120" fontSize="10" fontWeight="bold" fill="#64748b">ID</text>
                        <text x="80" y="120" fontSize="10" fontWeight="bold" fill="#64748b">CUSTOMER NAME</text>
                        <text x="250" y="120" fontSize="10" fontWeight="bold" fill="#64748b">CITY</text>
                        <text x="350" y="120" fontSize="10" fontWeight="bold" fill="#64748b">SALES PERSON</text>
                        <text x="500" y="120" fontSize="10" fontWeight="bold" fill="#64748b">ACTIONS</text>

                        {/* Table Rows */}
                        {[0, 1, 2, 3].map((i) => (
                            <g key={i} transform={`translate(20, ${140 + i * 35})`}>
                                <line x1="0" y1="0" x2="550" y2="0" stroke="#f1f5f9"/>
                                <text x="10" y="20" fontSize="10" fill="#64748b">#{101 + i}</text>
                                <text x="60" y="20" fontSize="10" fontWeight="bold" fill="#334155">Customer {String.fromCharCode(65 + i)} Pvt Ltd</text>
                                <text x="230" y="20" fontSize="10" fill="#64748b">Bangalore</text>
                                <text x="330" y="20" fontSize="10" fill="#64748b">Kumar</text>
                                <text x="480" y="20" fontSize="10" fill="#2563eb" fontWeight="bold">Edit</text>
                                <text x="515" y="20" fontSize="10" fill="#dc2626" fontWeight="bold">Delete</text>
                            </g>
                        ))}
                    </g>
                )}

                {type === 'form' && (
                    <g>
                        {/* Form Container */}
                        <rect x="10" y="10" width="580" height="330" rx="6" fill="white" stroke="#e2e8f0"/>
                        
                        {/* Dark Header */}
                        <rect x="10" y="10" width="580" height="40" rx="6" fill={darkFill} />
                        <text x="30" y="35" fontSize="14" fontWeight="bold" fill="white">QUOTATION DETAILS</text>
                        
                        {/* Nav Buttons */}
                        <g transform="translate(450, 18)">
                            <rect x="0" y="0" width="24" height="24" rx="4" fill="#475569"/>
                            <rect x="30" y="0" width="24" height="24" rx="4" fill="#475569"/>
                            <rect x="60" y="0" width="50" height="24" rx="4" fill="#3b82f6"/>
                            <text x="85" y="16" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">Back</text>
                        </g>

                        {/* Action Bar */}
                        <rect x="20" y="60" width="560" height="30" rx="4" fill="#f8fafc" stroke="#e2e8f0"/>
                        <circle cx="40" cy="75" r="8" fill="white" stroke="#cbd5e1"/> {/* New */}
                        <circle cx="70" cy="75" r="8" fill="white" stroke="#cbd5e1"/> {/* Save */}
                        <line x1="90" y1="65" x2="90" y2="85" stroke="#cbd5e1"/>
                        <rect x="100" y="65" width="60" height="20" rx="4" fill="white" stroke="#cbd5e1"/>
                        <text x="130" y="79" textAnchor="middle" fontSize="8" fill="#475569">Preview</text>

                        {/* 3-Column Form Fields */}
                        <g transform="translate(20, 100)">
                            {/* Col 1 */}
                            <g>
                                <rect x="0" y="0" width="180" height="24" stroke="#e2e8f0" fill="white"/>
                                <rect x="0" y="0" width="60" height="24" fill="#f1f5f9"/>
                                <text x="30" y="16" textAnchor="middle" fontSize="9" fill="#475569">ID</text>
                                <text x="70" y="16" fontSize="10" fontWeight="bold" fill="#334155">{`{New}`}</text>

                                <rect x="0" y="30" width="180" height="24" stroke="#e2e8f0" fill="white"/>
                                <rect x="0" y="30" width="60" height="24" fill="#f1f5f9"/>
                                <text x="30" y="46" textAnchor="middle" fontSize="9" fill="#475569">Date</text>
                                
                                <rect x="0" y="60" width="180" height="24" stroke="#e2e8f0" fill="white"/>
                                <rect x="0" y="60" width="60" height="24" fill="#f1f5f9"/>
                                <text x="30" y="76" textAnchor="middle" fontSize="9" fill="#475569">Customer</text>
                            </g>
                            {/* Col 2 */}
                            <g transform="translate(190, 0)">
                                <rect x="0" y="0" width="180" height="24" stroke="#e2e8f0" fill="white"/>
                                <rect x="0" y="0" width="60" height="24" fill="#f1f5f9"/>
                                <text x="30" y="16" textAnchor="middle" fontSize="9" fill="#475569">Contact</text>

                                <rect x="0" y="30" width="180" height="24" stroke="#e2e8f0" fill="white"/>
                                <rect x="0" y="30" width="60" height="24" fill="#f1f5f9"/>
                                <text x="30" y="46" textAnchor="middle" fontSize="9" fill="#475569">Phone</text>
                            </g>
                            {/* Col 3 */}
                            <g transform="translate(380, 0)">
                                <rect x="0" y="0" width="180" height="24" stroke="#e2e8f0" fill="white"/>
                                <rect x="0" y="0" width="60" height="24" fill="#f1f5f9"/>
                                <text x="30" y="16" textAnchor="middle" fontSize="9" fill="#475569">Sales Person</text>

                                <rect x="0" y="30" width="180" height="24" stroke="#e2e8f0" fill="white"/>
                                <rect x="0" y="30" width="60" height="24" fill="#f1f5f9"/>
                                <text x="30" y="46" textAnchor="middle" fontSize="9" fill="#475569">Status</text>
                            </g>
                        </g>

                        {/* Item Grid */}
                        <g transform="translate(20, 200)">
                            <rect x="0" y="0" width="560" height="20" fill="#e2e8f0"/>
                            <text x="10" y="14" fontSize="9" fontWeight="bold" fill="#475569">SL</text>
                            <text x="40" y="14" fontSize="9" fontWeight="bold" fill="#475569">Part No</text>
                            <text x="150" y="14" fontSize="9" fontWeight="bold" fill="#475569">Description</text>
                            <text x="300" y="14" fontSize="9" fontWeight="bold" fill="#475569">MOQ</text>
                            <text x="350" y="14" fontSize="9" fontWeight="bold" fill="#475569">Price</text>
                            <text x="400" y="14" fontSize="9" fontWeight="bold" fill="#475569">Total</text>
                            
                            <rect x="0" y="20" width="560" height="30" fill="white" stroke="#e2e8f0"/>
                            <text x="10" y="40" fontSize="9" fill="#475569">1</text>
                            <rect x="35" y="25" width="100" height="20" stroke="#cbd5e1" fill="white"/>
                            <text x="150" y="40" fontSize="9" fill="#475569">CABLE 3G2.5</text>
                            <rect x="300" y="25" width="40" height="20" stroke="#cbd5e1" fill="white"/>
                            <text x="400" y="40" fontSize="9" fontWeight="bold" fill="#475569">5,000</text>
                        </g>

                        {/* Bottom Total Bar */}
                        <rect x="0" y="320" width="600" height="30" fill={darkFill}/>
                        <text x="450" y="340" fontSize="12" fontWeight="bold" fill="white">Grand Total: 5,000.00</text>
                    </g>
                )}

                {type === 'calendar' && (
                    <g>
                        {/* Container */}
                        <rect x="50" y="10" width="500" height="330" rx="4" fill="white" stroke="#e2e8f0"/>
                        
                        {/* Header */}
                        <rect x="50" y="10" width="500" height="50" rx="4" fill={darkFill} />
                        <text x="300" y="40" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">October 2025</text>
                        <path d="M100 35 L110 25 L110 45 Z" fill="white" transform="rotate(180 105 35)"/> {/* Prev */}
                        <path d="M490 35 L500 25 L500 45 Z" fill="white"/> {/* Next */}

                        {/* Days Header */}
                        <rect x="50" y="60" width="500" height="30" fill="#f1f5f9"/>
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
                            <text key={i} x={85 + i * 71} y="80" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#64748b">{d}</text>
                        ))}

                        {/* Grid */}
                        <g transform="translate(50, 90)">
                            {/* Lines */}
                            {[0, 1, 2, 3].map(i => <line key={i} x1="0" y1={i * 60} x2="500" y2={i * 60} stroke="#e2e8f0"/>)}
                            {[1, 2, 3, 4, 5, 6].map(i => <line key={i} x1={i * 71.4} y1="0" x2={i * 71.4} y2="240" stroke="#e2e8f0"/>)}
                            
                            {/* Day Cell Example */}
                            <rect x="71.4" y="60" width="71.4" height="60" fill="#e0e7ff"/> {/* Selected Day */}
                            <text x="80" y="80" fontSize="12" fontWeight="bold" fill="#4338ca">10</text>
                            
                            {/* Events */}
                            <rect x="75" y="90" width="40" height="14" rx="7" fill="#dcfce7"/>
                            <text x="95" y="100" textAnchor="middle" fontSize="8" fill="#166534">2 Qtn</text>
                            
                            <rect x="120" y="90" width="18" height="14" rx="7" fill="#ffedd5"/>
                            <text x="129" y="100" textAnchor="middle" fontSize="8" fill="#9a3412">!</text>
                        </g>
                    </g>
                )}

                {type === 'mobile' && (
                    <g transform="translate(175, 10)">
                        {/* Phone Body */}
                        <rect x="0" y="0" width="250" height="330" rx="20" fill="#1e293b" />
                        <rect x="10" y="10" width="230" height="310" rx="10" fill="#f1f5f9"/>
                        
                        {/* App Header */}
                        <rect x="10" y="10" width="230" height="40" rx="10" fill={darkFill}/>
                        <text x="30" y="35" fontSize="12" fontWeight="bold" fill="white">Siddhi Kabel</text>
                        
                        {/* Content: Card List */}
                        <g transform="translate(20, 60)">
                            {/* Card 1 */}
                            <rect x="0" y="0" width="210" height="90" rx="6" fill="white" filter="drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))"/>
                            <text x="10" y="20" fontSize="12" fontWeight="bold" fill={accent}>#1024</text>
                            <text x="160" y="20" fontSize="10" fill="#64748b">26/10</text>
                            <text x="10" y="40" fontSize="12" fontWeight="bold" fill="#1e293b">ABC Electronics</text>
                            <text x="10" y="55" fontSize="10" fill="#64748b">Mr. Sharma</text>
                            <line x1="0" y1="65" x2="210" y2="65" stroke="#f1f5f9"/>
                            <text x="10" y="80" fontSize="10" fontWeight="bold" fill={accent}>View Details</text>
                            <text x="150" y="80" fontSize="12" fontWeight="bold" fill="#1e293b">₹12,500</text>
                            
                            {/* Card 2 */}
                            <rect x="0" y="100" width="210" height="90" rx="6" fill="white" filter="drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))"/>
                            <text x="10" y="120" fontSize="12" fontWeight="bold" fill={accent}>#1023</text>
                            <rect x="160" y="110" width="40" height="16" rx="8" fill="#dcfce7"/>
                            <text x="180" y="121" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#166534">PO REC</text>
                        </g>

                        {/* Bottom Nav */}
                        <rect x="10" y="280" width="230" height="40" fill="white" stroke="#e2e8f0"/>
                        <circle cx="40" cy="300" r="8" fill={accent}/>
                        <circle cx="90" cy="300" r="8" fill="#cbd5e1"/>
                        <circle cx="140" cy="300" r="8" fill="#cbd5e1"/>
                        <circle cx="190" cy="300" r="8" fill="#cbd5e1"/>
                    </g>
                )}
            </svg>
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
            <main className="flex-1 p-6 md:p-10 overflow-y-auto h-screen scroll-smooth">
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
                            <UIWireframe type="login"/>
                        </SubSection>
                    </Section>

                    <Section id="dashboard" title="3. Dashboard">
                        <p className="mb-4">The Dashboard provides a bird's-eye view of your sales activities.</p>
                        
                        <SubSection title="Key Metrics & Charts">
                            <p>At the top, you will see cards displaying metrics like <strong>Active Customers</strong> and <strong>Total Enquiries</strong>. Below that, interactive charts visualize trends:</p>
                            <ul className="list-disc list-inside ml-4 mb-2">
                                <li><strong>Quotation Funnel:</strong> Visualizes the drop-off from Open quotes to POs.</li>
                                <li><strong>Value Trend:</strong> Line chart showing quotation value over time.</li>
                                <li><strong>Daily Enquiries:</strong> Bar chart showing activity per day.</li>
                            </ul>
                            <UIWireframe type="dashboard"/>
                        </SubSection>

                        <SubSection title="Filtering Data">
                            <p>Use the dropdowns at the top to filter data by <strong>Sales Person</strong> (Admin only) or by <strong>Time Period</strong> (Week, Month, Year).</p>
                        </SubSection>
                    </Section>

                    <Section id="customers" title="4. Managing Customers">
                        <p className="mb-4">Navigate to the <strong>Customers</strong> tab to manage your client base.</p>
                        
                        <SubSection title="Searching & Filtering">
                            <p>Use the search bars to find customers by <strong>Name</strong> or <strong>City</strong>. The list displays customer details and quick actions.</p>
                            <UIWireframe type="table"/>
                        </SubSection>

                        <SubSection title="Adding a Customer">
                            <p>Click "Add New" to open the customer form. Ensure you set the <strong>Discount Structure</strong> (Single Core, Multi Core, etc.) as these percentages will auto-apply to new quotations.</p>
                        </SubSection>
                    </Section>

                    <Section id="products" title="5. Product Management">
                        <p className="mb-4">The <strong>Products</strong> tab holds your master price list.</p>
                        
                        <SubSection title="Searching Products">
                            <p>
                                <strong>Desktop:</strong> Search by Part No or Description. You can use <code>*</code> as a wildcard (e.g., <code>CABLE*POWER</code>).<br/>
                                <strong>Mobile:</strong> Use the "Universal Search" bar which supports fuzzy matching (e.g., "3G2.5" matches "3 G 2.5").
                            </p>
                            <UIWireframe type="table"/>
                        </SubSection>
                    </Section>

                    <Section id="quotations" title="6. Creating Quotations">
                        <p className="mb-4">This is the core feature of the application.</p>

                        <SubSection title="Creating a New Quote">
                            <ol className="list-decimal list-inside space-y-2 ml-4 mb-4">
                                <li>Go to the <strong>Quotations</strong> tab and click <strong>New</strong>.</li>
                                <li><strong>Select Customer:</strong> Search for the customer. Address and discounts load automatically.</li>
                                <li><strong>Add Items:</strong> Type in the "Part No" field to search or use the search icon. Prices (LP/SP) are auto-fetched based on the quotation date.</li>
                                <li><strong>Air Freight (Optional):</strong> Check the "Air Freight" box on a line item to calculate air transport costs based on weight.</li>
                            </ol>
                            <UIWireframe type="form"/>
                        </SubSection>

                        <SubSection title="Printing / Previewing">
                            <p>Click the "Preview" buttons to generate a printable view. You can choose between Standard, Discounted, or Air Freight templates. Part Numbers in the print view are hyperlinked to the Lapp Group catalogue.</p>
                        </SubSection>
                    </Section>

                    <Section id="calendar" title="7. Calendar & Reminders">
                        <p className="mb-4">The Calendar view helps track follow-ups.</p>
                        <ul className="list-disc list-inside ml-4 mb-4">
                            <li><strong>Green Dots:</strong> Quotations created on that day.</li>
                            <li><strong>Orange Dots:</strong> Follow-up reminders (5 days after creation).</li>
                        </ul>
                        <UIWireframe type="calendar"/>
                    </Section>

                    <Section id="mobile-app" title="8. Mobile App Features">
                        <p className="mb-4">The app is optimized for mobile devices.</p>
                        
                        <SubSection title="Mobile Navigation & Cards">
                            <p>A bottom navigation bar allows quick switching. Tables are replaced by card views for better readability on small screens.</p>
                            <p>Sales Persons can view quotations, change status, and add comments directly from the card view.</p>
                            <UIWireframe type="mobile"/>
                        </SubSection>
                    </Section>

                    <Section id="admin" title="9. Admin Features">
                        <p className="mb-4">Admins have exclusive access to:</p>
                        <ul className="list-disc list-inside ml-4">
                            <li><strong>User Management:</strong> Create/Edit users and assign roles.</li>
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
