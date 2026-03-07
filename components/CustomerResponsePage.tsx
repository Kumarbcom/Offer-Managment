
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface CustomerResponsePageProps {
    quotationId: number;
    action: string;
    reason?: string;
}

const NOTIFY_EMAILS = 'sales@siddhikabel.com,info@siddhikabel.com,enquiry@siddhikabel.com';

type PageState = 'loading' | 'confirm' | 'submitting' | 'done' | 'error' | 'already_done';

const ACTION_CONFIG: Record<string, {
    label: string;
    emoji: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
    newStatus?: string;
}> = {
    accepted: {
        label: 'Offer Accepted',
        emoji: '✅',
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#22c55e',
        description: 'You are confirming that you accept this quotation and wish to proceed with a Purchase Order.',
        newStatus: 'PO received',
    },
    under_review: {
        label: 'Under Review',
        emoji: '🔍',
        color: '#92400e',
        bgColor: '#fffbeb',
        borderColor: '#f59e0b',
        description: 'You are indicating that the quotation is currently under internal review. Our team will follow up with you.',
    },
    amendment: {
        label: 'Need Amendment',
        emoji: '✏️',
        color: '#3730a3',
        bgColor: '#eef2ff',
        borderColor: '#6366f1',
        description: 'You are requesting an amendment to the quotation. Our team will contact you to discuss the changes.',
    },
    rejected: {
        label: 'Offer Rejected',
        emoji: '❌',
        color: '#b91c1c',
        bgColor: '#fef2f2',
        borderColor: '#ef4444',
        description: 'You are declining this quotation. Our team will be notified and may contact you to address your concerns.',
        newStatus: 'Lost',
    },
};

const REASON_LABELS: Record<string, string> = {
    'need_price_revision': 'Need Price Revision',
    'moq_not_matching': 'MOQ Not Matching',
    'lead_time_improvement': 'Lead Time Improvement',
    'price_not_matching': 'Price Not Matching',
    'lead_time_too_long': 'Lead Time is Too Long',
};

export const CustomerResponsePage: React.FC<CustomerResponsePageProps> = ({ quotationId, action, reason }) => {
    const [pageState, setPageState] = useState<PageState>('loading');
    const [quotationInfo, setQuotationInfo] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const config = ACTION_CONFIG[action];

    useEffect(() => {
        if (!config) {
            setPageState('error');
            setErrorMsg('Invalid response action.');
            return;
        }
        // Fetch quotation details to show customer context
        if (!supabase) { setPageState('error'); setErrorMsg('Service unavailable.'); return; }
        supabase.from('quotations').select('id, status, contactPerson').eq('id', quotationId).single()
            .then(({ data, error }) => {
                if (error || !data) {
                    setPageState('error');
                    setErrorMsg('Quotation not found. It may have been deleted or the link is invalid.');
                    return;
                }
                // If already in a terminal state for this action, show already_done
                if (action === 'accepted' && data.status === 'PO received') {
                    setPageState('already_done');
                    return;
                }
                if (action === 'rejected' && data.status === 'Lost') {
                    setPageState('already_done');
                    return;
                }
                setQuotationInfo(data);
                setPageState('confirm');
            });
    }, [quotationId, action, config]);

    const handleConfirm = async () => {
        setPageState('submitting');
        try {
            if (!supabase) throw new Error('Service unavailable');

            // Update status in Supabase if needed
            if (config.newStatus) {
                const { error } = await supabase
                    .from('quotations')
                    .update({ status: config.newStatus })
                    .eq('id', quotationId);
                if (error) throw error;
            }

            // Build email notification via mailto (opens email client on this page)
            const qtnNo = `SKC/QTN/${quotationId}`;
            const reasonText = reason ? (REASON_LABELS[reason] || reason) : '';
            const subject = encodeURIComponent(`Customer Response: ${config.label} – ${qtnNo}`);
            const bodyLines = [
                `Dear Team,`,
                ``,
                `The customer has responded to Quotation No: ${qtnNo}`,
                `Contact Person: ${quotationInfo?.contactPerson || 'N/A'}`,
                ``,
                `Response: ${config.label}`,
                reasonText ? `Reason: ${reasonText}` : '',
                config.newStatus ? `Status Updated to: ${config.newStatus}` : '',
                ``,
                `Please take necessary action.`,
                ``,
                `Regards,`,
                `Siddhi Kabel Corporation Pvt Ltd (Automated Response System)`,
            ].filter(l => l !== undefined).join('\n');

            const mailtoLink = `mailto:${NOTIFY_EMAILS}?subject=${subject}&body=${encodeURIComponent(bodyLines)}`;
            window.open(mailtoLink, '_blank');

            setPageState('done');
        } catch (e: any) {
            setPageState('error');
            setErrorMsg(e?.message || 'Something went wrong. Please try again or contact us directly.');
        }
    };

    const reasonLabel = reason ? (REASON_LABELS[reason] || reason) : null;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f8faff 0%, #e8eeff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '20px',
        }}>
            <div style={{
                background: '#fff',
                borderRadius: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
                maxWidth: '480px',
                width: '100%',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    padding: '24px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                        SIDDHI KABEL CORPORATION PVT LTD
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Quotation No: <strong style={{ color: '#e2e8f0' }}>SKC/QTN/{quotationId}</strong>
                    </div>
                </div>

                <div style={{ padding: '32px 28px' }}>

                    {/* LOADING */}
                    {pageState === 'loading' && (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
                            <p style={{ color: '#64748b', fontSize: '14px' }}>Loading quotation details...</p>
                        </div>
                    )}

                    {/* CONFIRM */}
                    {pageState === 'confirm' && config && (
                        <>
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <div style={{ fontSize: '48px', marginBottom: '8px' }}>{config.emoji}</div>
                                <h2 style={{ fontSize: '22px', fontWeight: 800, color: config.color, margin: '0 0 8px' }}>
                                    {config.label}
                                </h2>
                                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                                    {config.description}
                                </p>
                            </div>

                            {reasonLabel && (
                                <div style={{
                                    background: '#f8fafc',
                                    border: `2px solid ${config.borderColor}`,
                                    borderRadius: '10px',
                                    padding: '12px 16px',
                                    marginBottom: '20px',
                                    textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>REASON</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: config.color }}>{reasonLabel}</div>
                                </div>
                            )}

                            <div style={{
                                background: config.bgColor,
                                border: `1px solid ${config.borderColor}`,
                                borderRadius: '10px',
                                padding: '14px',
                                marginBottom: '24px',
                                fontSize: '12px',
                                color: config.color,
                            }}>
                                <strong>⚠️ Please confirm:</strong> By clicking the button below, your response will be recorded and our sales team will be notified immediately.
                            </div>

                            <button
                                id="btn-confirm-response"
                                onClick={handleConfirm}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    background: `linear-gradient(135deg, ${config.borderColor} 0%, ${config.color} 100%)`,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '15px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    boxShadow: `0 4px 14px ${config.borderColor}66`,
                                    marginBottom: '12px',
                                }}
                            >
                                {config.emoji} Confirm: {config.label}
                            </button>

                            <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                                If you did not intend to click this, simply close this page.
                            </p>
                        </>
                    )}

                    {/* SUBMITTING */}
                    {pageState === 'submitting' && (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
                            <p style={{ fontWeight: 700, color: '#334155', fontSize: '15px' }}>Processing your response...</p>
                        </div>
                    )}

                    {/* DONE */}
                    {pageState === 'done' && config && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '56px', marginBottom: '12px' }}>🎉</div>
                            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#15803d', marginBottom: '8px' }}>
                                Response Recorded!
                            </h2>
                            <div style={{
                                background: '#f0fdf4', border: '1px solid #22c55e',
                                borderRadius: '10px', padding: '16px', marginBottom: '20px',
                            }}>
                                <p style={{ fontSize: '13px', color: '#166534', margin: 0, lineHeight: 1.6 }}>
                                    Your response of <strong>"{config.label}"</strong> for Quotation <strong>SKC/QTN/{quotationId}</strong> has been recorded.
                                    {config.newStatus && <> Status has been updated to <strong>"{config.newStatus}"</strong>.</>}
                                    {' '}Our sales team has been notified.
                                </p>
                            </div>
                            <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                                For any queries, contact us at{' '}
                                <a href="mailto:sales@siddhikabel.com" style={{ color: '#6366f1', fontWeight: 600 }}>
                                    sales@siddhikabel.com
                                </a>
                            </p>
                        </div>
                    )}

                    {/* ALREADY DONE */}
                    {pageState === 'already_done' && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>ℹ️</div>
                            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>
                                Already Responded
                            </h2>
                            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                                This quotation has already been updated. No further action is required.
                                <br /><br />
                                For any queries, contact us at{' '}
                                <a href="mailto:sales@siddhikabel.com" style={{ color: '#6366f1', fontWeight: 600 }}>
                                    sales@siddhikabel.com
                                </a>
                            </p>
                        </div>
                    )}

                    {/* ERROR */}
                    {pageState === 'error' && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
                            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#b91c1c', marginBottom: '8px' }}>
                                Something went wrong
                            </h2>
                            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                                {errorMsg}
                                <br /><br />
                                Please contact us directly at{' '}
                                <a href="mailto:sales@siddhikabel.com" style={{ color: '#6366f1', fontWeight: 600 }}>
                                    sales@siddhikabel.com
                                </a>
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                    padding: '12px 28px', textAlign: 'center',
                    fontSize: '10px', color: '#94a3b8',
                }}>
                    Siddhi Kabel Corporation Pvt Ltd · Tel: 080-26720440 · info@siddhikabel.com
                </div>
            </div>
        </div>
    );
};
