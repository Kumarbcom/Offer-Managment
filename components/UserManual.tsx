
import React, { useState } from 'react';

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
    const stroke = "#94a3b8"; // slate-400
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
                            
                            <text x="10" y="65" fontSize="9" fontWeight="bold" fill="#334155">Ananth</text>
                            <text x="100" y="65" fontSize="9" fill="#334155">50</text>
                            <text x="150" y="65" fontSize="9" fill="#3b82f6">20</text>
                            <text x="200" y="65" fontSize="9" fill="#22c55e">10</text>
                            <text x="250" y="65" fontSize="9" fill="#14b8a6">5</text>
                            <text x="300" y="65" fontSize="9" fill="#f43f5e">2</text>
                            <text x="350" y="65" fontSize="9" fill="#f59e0b">13</text>
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

const ManualIcon: React.FC<{ type: string, className?: string }> = ({ type, className = "w-5 h-5 mr-2" }) => {
    switch (type) {
        case 'introduction': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>;
        case 'getting-started': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>;
        case 'dashboard': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z" clipRule="evenodd" /></svg>;
        case 'customers': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" clipRule="evenodd" /><path d="M5.082 14.254a8.287 8.287 0 00-1.308 5.135 9.687 9.687 0 01-1.764-.44l-.115-.04a.563.563 0 01-.373-.487l-.01-.121a3.75 3.75 0 013.57-4.047zM20.226 19.389a8.287 8.287 0 00-1.308-5.135 3.75 3.75 0 013.57 4.047l-.01.121a.563.563 0 01-.373.486l-.115.04c-.567.2-1.156.349-1.764.441z" /></svg>;
        case 'products': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12.378 1.602a.75.75 0 00-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03zM21.75 7.93l-9 5.25v9l8.628-5.032a.75.75 0 00.372-.648V7.93zM11.25 22.18v-9l-9-5.25v8.57a.75.75 0 00.372.648l8.628 5.033z" /></svg>;
        case 'quotations': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" /><path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" /></svg>;
        case 'calendar': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" /></svg>;
        case 'mobile-app': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M10.5 18.75a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" /><path fillRule="evenodd" d="M8.625.75A3.375 3.375 0 005.25 4.125v15.75a3.375 3.375 0 003.375 3.375h6.75a3.375 3.375 0 003.375-3.375V4.125A3.375 3.375 0 0015.375.75h-6.75zM7.5 4.125C7.5 3.504 8.004 3 8.625 3h6.75c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-6.75A1.125 1.125 0 017.5 19.875V4.125z" clipRule="evenodd" /></svg>;
        case 'admin': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>;
        default: return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 01-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 01-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584zM12 18a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>;
    }
}

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
            <aside className="w-full md:w-64 bg-slate-50 border-r border-slate-200 hidden md:block sticky top-0 h-screen overflow-y-auto">
                <div className="p-4">
                    <h3 className="font-bold text-lg text-slate-800 mb-6 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
                        <ManualIcon type="introduction" className="w-6 h-6 text-indigo-600"/>
                        User Manual
                    </h3>
                    <nav className="space-y-1">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => scrollToSection(section.id)}
                                className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-all flex items-center ${
                                    activeSection === section.id 
                                    ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600 font-bold shadow-sm' 
                                    : 'text-slate-600 hover:bg-white hover:shadow-sm hover:text-slate-900'
                                }`}
                            >
                                <ManualIcon type={section.id} className={`w-5 h-5 mr-3 ${activeSection === section.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                {section.title}
                            </button>
                        ))}
                    </nav>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-10 overflow-y-auto h-screen scroll-smooth">
                <div className="max-w-4xl mx-auto pb-20">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Offer Management System</h1>
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