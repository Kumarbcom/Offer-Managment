
import React, { useState } from 'react';

const ManualIcon = ({ type, className }: { type: string, className?: string }) => {
    switch (type) {
        case 'login': return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>;
        case 'dashboard': return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
        case 'customers': return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
        case 'products': return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
        case 'quotations': return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>;
        case 'calendar': return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
        case 'mobile': return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
        default: return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    }
};

const Section: React.FC<{ title: string; id: string; children: React.ReactNode }> = ({ title, id, children }) => (
    <div id={id} className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
            <ManualIcon type={id} className="w-6 h-6 text-indigo-600"/>
            {title}
        </h2>
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
    const darkFill = "#1e293b"; // slate-800 (Header)
    const accent = "#6366f1"; // indigo-500
    
    return (
        <div className="w-full h-80 bg-slate-100 flex items-center justify-center p-4 border border-slate-300 rounded-lg overflow-hidden relative my-4 shadow-inner">
            <svg width="100%" height="100%" viewBox="0 0 600 350" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                {type === 'login' && (
                    <g>
                        <rect x="0" y="0" width="600" height="350" fill="#f1f5f9" />
                        <rect x="200" y="50" width="200" height="250" rx="8" fill="white" filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))" />
                        <text x="300" y="90" textAnchor="middle" fontSize="18" fill="#1e293b" fontWeight="bold" fontFamily="sans-serif">Login</text>
                        
                        <text x="220" y="125" fontSize="10" fill="#64748b" fontFamily="sans-serif">Username</text>
                        <rect x="220" y="130" width="160" height="30" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                        
                        <text x="220" y="180" fontSize="10" fill="#64748b" fontFamily="sans-serif">Password</text>
                        <rect x="220" y="185" width="160" height="30" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                        
                        <rect x="220" y="240" width="160" height="30" rx="4" fill={accent} />
                        <text x="300" y="260" textAnchor="middle" fontSize="12" fill="white" fontFamily="sans-serif" dominantBaseline="middle" fontWeight="bold">Sign In</text>
                    </g>
                )}

                {type === 'dashboard' && (
                    <g>
                        {/* Header */}
                        <rect x="10" y="10" width="580" height="40" rx="4" fill={darkFill} />
                        <text x="30" y="35" fontSize="14" fill="white" fontWeight="bold" fontFamily="sans-serif">Siddhi Kabel Corp</text>
                        
                        {/* Slicers */}
                        <rect x="400" y="18" width="100" height="24" rx="4" fill="white" opacity="0.2"/>
                        <rect x="510" y="18" width="70" height="24" rx="4" fill="white" opacity="0.2"/>

                        {/* Top Stats Row */}
                        <g transform="translate(10, 60)">
                            {/* Active Customers */}
                            <rect x="0" y="0" width="75" height="60" rx="6" fill="white" stroke="#e2e8f0"/>
                            <circle cx="37.5" cy="20" r="8" fill="#e2e8f0"/>
                            <text x="37.5" y="45" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#334155">25</text>

                            {/* Enquiries */}
                            <rect x="85" y="0" width="75" height="60" rx="6" fill="#4f46e5"/>
                            <text x="122.5" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">102</text>

                            {/* Open */}
                            <rect x="170" y="0" width="75" height="60" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
                            <rect x="170" y="0" width="4" height="60" fill="#3b82f6"/> 
                            <text x="207.5" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#334155">45</text>

                            {/* PO */}
                            <rect x="255" y="0" width="75" height="60" rx="6" fill="white" stroke="#e2e8f0"/>
                            <rect x="255" y="0" width="4" height="60" fill="#22c55e"/>
                            <text x="292.5" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#334155">12</text>
                            
                            {/* Partial */}
                            <rect x="340" y="0" width="75" height="60" rx="6" fill="white" stroke="#e2e8f0"/>
                            <rect x="340" y="0" width="4" height="60" fill="#14b8a6"/>
                            <text x="377.5" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#334155">5</text>

                             {/* Lost */}
                            <rect x="425" y="0" width="75" height="60" rx="6" fill="white" stroke="#e2e8f0"/>
                            <rect x="425" y="0" width="4" height="60" fill="#f43f5e"/>
                            <text x="462.5" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#334155">2</text>

                             {/* Expired */}
                            <rect x="510" y="0" width="75" height="60" rx="6" fill="white" stroke="#e2e8f0"/>
                            <rect x="510" y="0" width="4" height="60" fill="#f59e0b"/>
                            <text x="547.5" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#334155">1</text>
                        </g>

                        {/* Charts Row */}
                        <g transform="translate(10, 130)">
                            {/* Funnel */}
                            <rect x="0" y="0" width="180" height="120" rx="6" fill="white" stroke="#e2e8f0"/>
                            <text x="10" y="20" fontSize="10" fontWeight="bold" fill="#64748b">FUNNEL</text>
                            <rect x="20" y="30" width="140" height="15" fill="#3b82f6"/>
                            <rect x="30" y="50" width="120" height="15" fill="#22c55e"/>
                            <rect x="40" y="70" width="100" height="15" fill="#14b8a6"/>
                            <rect x="50" y="90" width="80" height="15" fill="#f43f5e"/>

                            {/* Trend */}
                            <rect x="190" y="0" width="180" height="120" rx="6" fill="white" stroke="#e2e8f0"/>
                            <text x="200" y="20" fontSize="10" fontWeight="bold" fill="#64748b">VALUE TREND</text>
                            <polyline points="200,100 230,80 260,90 290,50 320,70 350,40" fill="none" stroke="#0ea5e9" strokeWidth="2"/>

                            {/* Top Customers */}
                            <rect x="380" y="0" width="200" height="120" rx="6" fill="white" stroke="#e2e8f0"/>
                            <text x="390" y="20" fontSize="10" fontWeight="bold" fill="#64748b">TOP CUSTOMERS</text>
                            <rect x="390" y="35" width="100" height="10" rx="2" fill="#8b5cf6"/>
                            <rect x="390" y="55" width="140" height="10" rx="2" fill="#8b5cf6"/>
                            <rect x="390" y="75" width="80" height="10" rx="2" fill="#8b5cf6"/>
                        </g>

                        {/* Performance Table */}
                        <g transform="translate(10, 260)">
                            <rect x="0" y="0" width="580" height="80" rx="6" fill="white" stroke="#e2e8f0"/>
                            <text x="10" y="20" fontSize="10" fontWeight="bold" fill="#64748b">PERFORMANCE</text>
                            <line x1="0" y1="30" x2="580" y2="30" stroke="#e2e8f0"/>
                            
                            <text x="10" y="45" fontSize="9" fontWeight="bold" fill="#64748b">Name</text>
                            <text x="100" y="45" fontSize="9" fontWeight="bold" fill="#64748b">Tot</text>
                            <text x="150" y="45" fontSize="9" fontWeight="bold" fill="#64748b">Opn</text>
                            <text x="200" y="45" fontSize="9" fontWeight="bold" fill="#64748b">PO</text>
                            <text x="250" y="45" fontSize="9" fontWeight="bold" fill="#64748b">Part</text>
                            <text x="300" y="45" fontSize="9" fontWeight="bold" fill="#64748b">Lst</text>
                            <text x="350" y="45" fontSize="9" fontWeight="bold" fill="#64748b">Exp</text>
                        </g>
                    </g>
                )}

                {type === 'table' && (
                    <g>
                        {/* Header Row */}
                        <rect x="10" y="20" width="580" height="30" rx="4" fill="#e2e8f0" />
                        <text x="20" y="40" fontSize="10" fontWeight="bold" fill="#475569">ID</text>
                        <text x="60" y="40" fontSize="10" fontWeight="bold" fill="#475569">Name</text>
                        <text x="200" y="40" fontSize="10" fontWeight="bold" fill="#475569">Details</text>
                        <text x="500" y="40" fontSize="10" fontWeight="bold" fill="#475569">Actions</text>

                        {/* Data Rows */}
                        {[0, 1, 2, 3, 4].map(i => (
                            <g key={i} transform={`translate(0, ${60 + i * 40})`}>
                                <rect x="10" y="0" width="580" height="35" rx="4" fill="white" stroke="#f1f5f9" />
                                <text x="20" y="22" fontSize="10" fill="#64748b">10{i+1}</text>
                                <text x="60" y="22" fontSize="10" fill="#1e293b">Sample Item {i+1}</text>
                                <text x="200" y="22" fontSize="10" fill="#64748b">Detailed description of item...</text>
                                <rect x="500" y="8" width="40" height="20" rx="4" fill="#dbeafe" />
                                <text x="520" y="22" textAnchor="middle" fontSize="9" fill="#2563eb">Edit</text>
                            </g>
                        ))}
                        
                        {/* Pagination */}
                        <g transform="translate(450, 300)">
                            <rect x="0" y="0" width="30" height="20" rx="4" fill="white" stroke="#cbd5e1"/>
                            <text x="15" y="14" textAnchor="middle" fontSize="10" fill="#64748b">&lt;</text>
                            <text x="50" y="14" textAnchor="middle" fontSize="10" fill="#64748b">Page 1</text>
                            <rect x="80" y="0" width="30" height="20" rx="4" fill="white" stroke="#cbd5e1"/>
                            <text x="95" y="14" textAnchor="middle" fontSize="10" fill="#64748b">&gt;</text>
                        </g>
                    </g>
                )}

                {type === 'form' && (
                    <g>
                        {/* Form Header */}
                        <rect x="10" y="10" width="580" height="30" rx="4" fill="#1e293b" />
                        <text x="25" y="30" fontSize="12" fontWeight="bold" fill="white">QUOTATION DETAILS</text>
                        
                        {/* Toolbar */}
                        <rect x="10" y="50" width="580" height="30" rx="4" fill="white" stroke="#e2e8f0"/>
                        {[0,1,2,3,4].map(i => (
                            <rect key={i} x={20 + i * 60} y="55" width="50" height="20" rx="4" fill="#f1f5f9"/>
                        ))}

                        {/* 3 Columns Inputs */}
                        <g transform="translate(10, 90)">
                            <rect x="0" y="0" width="180" height="100" rx="4" fill="white" stroke="#e2e8f0"/>
                            <rect x="200" y="0" width="180" height="100" rx="4" fill="white" stroke="#e2e8f0"/>
                            <rect x="400" y="0" width="180" height="100" rx="4" fill="white" stroke="#e2e8f0"/>
                            
                            {[0,1,2,3].map(i => (
                                <g key={i}>
                                    <rect x="10" y={10 + i * 22} width="50" height="15" fill="#e2e8f0"/>
                                    <rect x="65" y={10 + i * 22} width="105" height="15" fill="white" stroke="#cbd5e1"/>
                                    
                                    <rect x="210" y={10 + i * 22} width="50" height="15" fill="#e2e8f0"/>
                                    <rect x="265" y={10 + i * 22} width="105" height="15" fill="white" stroke="#cbd5e1"/>

                                    <rect x="410" y={10 + i * 22} width="50" height="15" fill="#e2e8f0"/>
                                    <rect x="465" y={10 + i * 22} width="105" height="15" fill="white" stroke="#cbd5e1"/>
                                </g>
                            ))}
                        </g>

                        {/* Line Items Grid */}
                        <g transform="translate(10, 200)">
                            <rect x="0" y="0" width="580" height="120" rx="4" fill="white" stroke="#e2e8f0"/>
                            <rect x="0" y="0" width="580" height="25" fill="#f1f5f9"/>
                            {[0,1,2,3].map(i => (
                                <line key={i} x1="0" y1={25 + (i+1)*25} x2="580" y2={25 + (i+1)*25} stroke="#f1f5f9"/>
                            ))}
                            
                            {/* Footer Totals */}
                            <rect x="0" y="120" width="580" height="25" fill="#1e293b"/>
                            <text x="570" y="137" textAnchor="end" fontSize="10" fontWeight="bold" fill="white">Total: ₹ 12,500</text>
                        </g>
                    </g>
                )}

                {type === 'calendar' && (
                    <g>
                        <rect x="10" y="10" width="580" height="330" rx="4" fill="white" stroke="#e2e8f0"/>
                        <rect x="10" y="10" width="580" height="40" fill="#1e293b" rx="4"/>
                        <text x="290" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">October 2025</text>
                        
                        {/* Grid */}
                        <g transform="translate(10, 50)">
                            {/* Header */}
                            <g>
                                {['S','M','T','W','T','F','S'].map((d, i) => (
                                    <text key={i} x={40 + i * 82} y="20" textAnchor="middle" fontSize="12" fill="#64748b">{d}</text>
                                ))}
                            </g>
                            {/* Days */}
                            {[0,1,2,3].map(row => (
                                <g key={row}>
                                    {[0,1,2,3,4,5,6].map(col => (
                                        <g key={col}>
                                            <rect x={col * 82} y={30 + row * 60} width="82" height="60" fill="none" stroke="#f1f5f9"/>
                                            <text x={10 + col * 82} y={50 + row * 60} fontSize="10" fill="#334155">{row * 7 + col + 1}</text>
                                            {(row * 7 + col + 1) % 5 === 0 && (
                                                <rect x={40 + col * 82} y={65 + row * 60} width="35" height="12" rx="6" fill="#dcfce7"/>
                                            )}
                                        </g>
                                    ))}
                                </g>
                            ))}
                        </g>
                    </g>
                )}

                {type === 'mobile' && (
                    <g>
                        {/* Phone Outline */}
                        <rect x="200" y="10" width="200" height="330" rx="20" fill="white" stroke="#e2e8f0" strokeWidth="4"/>
                        {/* Header */}
                        <rect x="200" y="10" width="200" height="40" rx="0" fill="#1e293b"/>
                        <text x="300" y="35" textAnchor="middle" fontSize="12" fontWeight="bold" fill="white">Siddhi Kabel Corp</text>
                        
                        {/* Content - Cards */}
                        {[0,1,2].map(i => (
                            <g key={i} transform={`translate(210, ${60 + i * 90})`}>
                                <rect x="0" y="0" width="180" height="80" rx="8" fill="white" stroke="#e2e8f0" filter="drop-shadow(0 2px 4px rgb(0 0 0 / 0.05))"/>
                                <text x="10" y="20" fontSize="10" fontWeight="bold" fill="#4f46e5">#100{i+1}</text>
                                <text x="130" y="20" fontSize="10" fontWeight="bold" fill="#1e293b">₹ 15,000</text>
                                <text x="10" y="40" fontSize="9" fill="#475569">Customer Name</text>
                                <rect x="10" y="55" width="60" height="15" rx="7.5" fill="#dcfce7"/>
                                <text x="40" y="66" textAnchor="middle" fontSize="8" fill="#15803d">PO Recvd</text>
                            </g>
                        ))}

                        {/* Bottom Nav */}
                        <path d="M 202 300 h 196 v 20 a 18 18 0 0 1 -18 18 h -160 a 18 18 0 0 1 -18 -18 z" fill="white" stroke="#e2e8f0"/>
                        <circle cx="235" cy="320" r="8" fill="#e2e8f0"/>
                        <circle cx="300" cy="320" r="8" fill="#4f46e5"/>
                        <circle cx="365" cy="320" r="8" fill="#e2e8f0"/>
                    </g>
                )}
            </svg>
        </div>
    );
};

export const UserManual: React.FC = () => {
    const [activeSection, setActiveSection] = useState('login');

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const navItems = [
        { id: 'login', label: 'Login & Access' },
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'customers', label: 'Customers' },
        { id: 'products', label: 'Products' },
        { id: 'quotations', label: 'Quotations' },
        { id: 'calendar', label: 'Calendar' },
        { id: 'mobile', label: 'Mobile App' },
    ];

    return (
        <div className="flex h-[calc(100vh-100px)]">
            {/* Sidebar Navigation */}
            <nav className="w-64 bg-white border-r border-slate-200 p-4 hidden md:block overflow-y-auto">
                <h2 className="text-lg font-bold text-slate-800 mb-4 px-2">User Manual</h2>
                <ul className="space-y-1">
                    {navItems.map(item => (
                        <li key={item.id}>
                            <button
                                onClick={() => scrollToSection(item.id)}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 flex items-center gap-3 ${
                                    activeSection === item.id
                                        ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600 shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                            >
                                <ManualIcon type={item.id} className={`w-4 h-4 ${activeSection === item.id ? 'text-indigo-600' : 'text-slate-400'}`}/>
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    
                    <div className="mb-8 text-center border-b pb-8">
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Offer Management System</h1>
                        <p className="text-slate-500">Comprehensive User Guide for Siddhi Kabel Corporation Pvt Ltd</p>
                    </div>

                    <Section title="Login & Access Control" id="login">
                        <p className="text-slate-600 mb-4">Secure access to the application is managed through role-based user accounts.</p>
                        <UIWireframe type="login" />
                        <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                            <li><span className="font-semibold">Admin:</span> Full access to all modules, user management, and settings.</li>
                            <li><span className="font-semibold">Sales Person:</span> Can create and view their own quotations. Restricted from modifying others' data.</li>
                            <li><span className="font-semibold">Management:</span> View-only access to all data and reports.</li>
                            <li><span className="font-semibold">First Login:</span> You will be prompted to change your default password ('123456') immediately upon first login for security.</li>
                        </ul>
                    </Section>

                    <Section title="Dashboard Overview" id="dashboard">
                        <p className="text-slate-600 mb-4">The central hub for monitoring sales performance and quick actions.</p>
                        <UIWireframe type="dashboard" />
                        
                        <SubSection title="Key Metrics & Charts">
                            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                                <li><span className="font-semibold">Top Statistics Row:</span> Instant view of Active Customers, Total Enquiries, and breakdown by status (Open, PO Received, etc.).</li>
                                <li><span className="font-semibold">Funnel Chart:</span> Visualizes the conversion pipeline from Open to PO Received.</li>
                                <li><span className="font-semibold">Value Trend:</span> Line graph showing quotation value over time.</li>
                                <li><span className="font-semibold">Performance Table:</span> Detailed breakdown of each Sales Person's activity (Count vs Value). Toggle between modes using the 'Cnt/Val' switch.</li>
                            </ul>
                        </SubSection>
                        
                        <SubSection title="Filters & Actions">
                            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                                <li><span className="font-semibold">Sales Person Slicer:</span> (Admin only) Filter the entire dashboard to see data for a specific sales person.</li>
                                <li><span className="font-semibold">Date Range:</span> Quickly filter data for the last Week, Month, or Year.</li>
                                <li><span className="font-semibold">Logo Upload:</span> Admins can update the company logo used in quotation prints directly from the header.</li>
                            </ul>
                        </SubSection>
                    </Section>

                    <Section title="Customer Management" id="customers">
                        <p className="text-slate-600 mb-4">Manage your client database with search and bulk operations.</p>
                        <UIWireframe type="table" />
                        <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                            <li><span className="font-semibold">Add New:</span> Create new customer profiles with specific discount structures.</li>
                            <li><span className="font-semibold">Import/Export:</span> Use the Excel template to bulk upload customers or export the current list.</li>
                            <li><span className="font-semibold">Search:</span> Quickly find customers by Name or City.</li>
                            <li><span className="font-semibold">Discount Structure:</span> Define default discounts for Single Core, Multi Core, Special Cables, etc., which auto-apply during quotation creation.</li>
                        </ul>
                    </Section>

                    <Section title="Product Management" id="products">
                        <p className="text-slate-600 mb-4">Centralized catalog for all items including price lists.</p>
                        <UIWireframe type="table" />
                        <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                            <li><span className="font-semibold">Pricing:</span> Products support List Price (LP) and Special Price (SP) with validity dates. The system automatically picks the valid price for the quotation date.</li>
                            <li><span className="font-semibold">Mobile Search:</span> On mobile, use the 'Universal Search' to find products by Part No or Description (supports fuzzy matching like '3G2.5').</li>
                            <li><span className="font-semibold">Bulk Upload:</span> Admins can upload large product catalogs via Excel.</li>
                        </ul>
                    </Section>

                    <Section title="Quotation Creation" id="quotations">
                        <p className="text-slate-600 mb-4">The core module for generating professional offers.</p>
                        <UIWireframe type="form" />
                        
                        <SubSection title="Creating a New Quote">
                            <ol className="list-decimal list-inside space-y-2 text-slate-700 ml-4">
                                <li>Click <strong>New</strong> in the Quotations tab.</li>
                                <li><strong>Select Customer:</strong> Search and select a customer. Addresses and Sales Person defaults are auto-filled.</li>
                                <li><strong>Add Products:</strong> Use the 'Search Product' button or type directly in the grid. Prices are auto-fetched based on the Quotation Date.</li>
                                <li><strong>Discounts:</strong> Apply discounts per line item. Net Unit Price is calculated automatically.</li>
                                <li><strong>Air Freight:</strong> Toggle 'Air Freight' for urgent items. Freight cost is calculated based on weight (ensure product weight is defined).</li>
                            </ol>
                        </SubSection>

                        <SubSection title="Printing & Sharing">
                            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                                <li><strong>Preview:</strong> Choose 'Standard', 'Discounted', or 'Air Freight' templates.</li>
                                <li><strong>PDF Links:</strong> Generated PDFs include hyperlinks to the Lapp Online Catalogue for valid Part Numbers.</li>
                                <li><strong>WhatsApp:</strong> Share quotation summaries instantly via WhatsApp Web/App.</li>
                            </ul>
                        </SubSection>
                    </Section>

                    <Section title="Calendar & Reminders" id="calendar">
                        <p className="text-slate-600 mb-4">Track quotation activity and follow-ups visually.</p>
                        <UIWireframe type="calendar" />
                        <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                            <li><span className="font-semibold">Green Dots:</span> Indicate quotations created on that day.</li>
                            <li><span className="font-semibold">Orange Dots (Reminders):</span> Indicate follow-ups due (5 days after quotation creation).</li>
                            <li><span className="font-semibold">List View:</span> Clicking a date shows a detailed card view of all activities for that day.</li>
                        </ul>
                    </Section>

                    <Section title="Mobile App Features" id="mobile">
                        <p className="text-slate-600 mb-4">Optimized experience for Sales Persons on the go.</p>
                        <UIWireframe type="mobile" />
                        <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                            <li><span className="font-semibold">Bottom Navigation:</span> Quick access to Home, Quotes, Calendar, and Products.</li>
                            <li><span className="font-semibold">Card View:</span> Data is presented in easy-to-read cards instead of large tables.</li>
                            <li><span className="font-semibold">Quick Actions:</span> Update status (e.g., to 'PO Received') or add comments directly from the card view.</li>
                            <li><span className="font-semibold">Read-Only Safety:</span> Sales Persons are restricted from editing complex quotation details on mobile to prevent data errors.</li>
                        </ul>
                    </Section>

                </div>
                <div className="h-20"></div>
            </div>
        </div>
    );
};
