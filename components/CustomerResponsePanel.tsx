
import React, { useState, useEffect } from 'react';
import type { Quotation, QuotationStatus } from '../types';

interface CustomerResponsePanelProps {
    quotation: Quotation;
    customerName: string;
    onStatusUpdate: (newStatus: QuotationStatus) => Promise<void>;
}

const REMINDER_KEY = (qtnId: number) => `crp_reminder_${qtnId}`;

function getRemainingTime(isoString: string): string {
    const diff = new Date(isoString).getTime() - Date.now();
    if (diff <= 0) return 'overdue – please follow up!';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m remaining`;
}

function formatReminderDeadline(isoString: string) {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export const CustomerResponsePanel: React.FC<CustomerResponsePanelProps> = ({
    quotation,
    customerName,
    onStatusUpdate,
}) => {
    const [reminderInfo, setReminderInfo] = useState<string | null>(null);
    const [remainingTime, setRemainingTime] = useState<string>('');

    const qtnId = quotation.id;
    const appBaseUrl = window.location.origin + window.location.pathname;

    // Build response URLs
    const makeUrl = (action: string, reason?: string) => {
        let url = `${appBaseUrl}?qr=${qtnId}&action=${action}`;
        if (reason) url += `&reason=${reason}`;
        return url;
    };

    useEffect(() => {
        const stored = localStorage.getItem(REMINDER_KEY(qtnId));
        if (stored) {
            setReminderInfo(stored);
            setRemainingTime(getRemainingTime(stored));
        }
    }, [qtnId]);

    useEffect(() => {
        if (!reminderInfo) return;
        const interval = setInterval(() => {
            setRemainingTime(getRemainingTime(reminderInfo));
        }, 60000);
        return () => clearInterval(interval);
    }, [reminderInfo]);

    const handleDismissReminder = () => {
        localStorage.removeItem(REMINDER_KEY(qtnId));
        setReminderInfo(null);
    };

    // Button style helper
    const btnStyle = (bg: string, shadow: string): React.CSSProperties => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        background: bg,
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        padding: '12px 8px',
        textDecoration: 'none',
        fontSize: '11px',
        fontWeight: 700,
        boxShadow: shadow,
        cursor: 'pointer',
        textAlign: 'center',
        lineHeight: 1.3,
    });

    return (
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', marginTop: '16px' }}>
            {/* Reminder Banner - screen only (no-print) */}
            {reminderInfo && (
                <div className="no-print" style={{
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    border: '1px solid #f59e0b',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(245,158,11,0.2)',
                }}>
                    <div>
                        <div style={{ fontWeight: 700, color: '#92400e', fontSize: '12px' }}>
                            ⏰ Follow-up Reminder Active
                        </div>
                        <div style={{ color: '#78350f', fontSize: '11px' }}>
                            Deadline: {formatReminderDeadline(reminderInfo)} · <strong>{remainingTime}</strong>
                        </div>
                    </div>
                    <button
                        onClick={handleDismissReminder}
                        style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Main Panel - visible in both screen and print/PDF */}
            <div style={{
                border: '2px solid #6366f1',
                borderRadius: '12px',
                padding: '16px',
                background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.1)',
            }}>
                <div style={{ marginBottom: '12px', borderBottom: '1px dashed #c7d2fe', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#3730a3', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📋 Customer Response — SKC/QTN/{qtnId}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>
                        Click a button below to send your response. Your action will be recorded automatically.
                    </div>
                </div>

                {/* 4 Response Buttons as clickable links */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {/* ✅ Offer Accepted */}
                    <a
                        href={makeUrl('accepted')}
                        id="pdf-btn-accepted"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={btnStyle(
                            'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                            '0 3px 10px rgba(34,197,94,0.35)'
                        )}
                    >
                        <span style={{ fontSize: '20px' }}>✅</span>
                        <span>Offer Accepted</span>
                        <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 500 }}>Updates status → PO Received</span>
                    </a>

                    {/* 🔍 Under Review */}
                    <a
                        href={makeUrl('under_review')}
                        id="pdf-btn-review"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={btnStyle(
                            'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            '0 3px 10px rgba(245,158,11,0.35)'
                        )}
                        onClick={() => {
                            // Also set local reminder (for internal team when viewing in-app)
                            const reminderAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                            localStorage.setItem(REMINDER_KEY(qtnId), reminderAt);
                            setReminderInfo(reminderAt);
                            setRemainingTime(getRemainingTime(reminderAt));
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>🔍</span>
                        <span>Under Review</span>
                        <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 500 }}>Sets 24-hr follow-up</span>
                    </a>

                    {/* ✏️ Need Amendment — dropdown sub-options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            borderRadius: '10px 10px 4px 4px',
                            padding: '8px',
                            textAlign: 'center',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 800,
                        }}>
                            <span style={{ fontSize: '18px', display: 'block', marginBottom: '2px' }}>✏️</span>
                            Need Amendment
                        </div>
                        <a href={makeUrl('amendment', 'need_price_revision')} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'block', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', padding: '5px 8px', fontSize: '9px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                            Price Revision
                        </a>
                        <a href={makeUrl('amendment', 'moq_not_matching')} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'block', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', padding: '5px 8px', fontSize: '9px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                            MOQ Not Matching
                        </a>
                        <a href={makeUrl('amendment', 'lead_time_improvement')} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'block', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', padding: '5px 8px', fontSize: '9px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                            Lead Time Improvement
                        </a>
                    </div>

                    {/* ❌ Offer Rejected — dropdown sub-options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            borderRadius: '10px 10px 4px 4px',
                            padding: '8px',
                            textAlign: 'center',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 800,
                        }}>
                            <span style={{ fontSize: '18px', display: 'block', marginBottom: '2px' }}>❌</span>
                            Offer Rejected
                        </div>
                        <a href={makeUrl('rejected', 'price_not_matching')} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'block', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', padding: '5px 8px', fontSize: '9px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                            Price Not Matching
                        </a>
                        <a href={makeUrl('rejected', 'moq_not_matching')} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'block', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', padding: '5px 8px', fontSize: '9px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                            MOQ Not Matching
                        </a>
                        <a href={makeUrl('rejected', 'lead_time_too_long')} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'block', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', padding: '5px 8px', fontSize: '9px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                            Lead Time Too Long
                        </a>
                    </div>
                </div>

                <div style={{ marginTop: '10px', fontSize: '9px', color: '#9ca3af', textAlign: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                    Clicking a button will open a secure confirmation page · Your response updates the offer status automatically
                </div>
            </div>
        </div>
    );
};
