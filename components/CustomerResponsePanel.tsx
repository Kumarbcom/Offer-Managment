
import React, { useState, useEffect } from 'react';
import type { Quotation, QuotationStatus } from '../types';

interface CustomerResponsePanelProps {
    quotation: Quotation;
    customerName: string;
    onStatusUpdate: (newStatus: QuotationStatus) => Promise<void>;
}

type PanelStep =
    | 'idle'
    | 'under-review'
    | 'need-amendment'
    | 'offer-rejected'
    | 'done-accepted'
    | 'done-review'
    | 'done-amendment'
    | 'done-rejected';

const AMENDMENT_REASONS = [
    'Need Price Revision',
    'MOQ Not Matching',
    'Lead Time Improvement',
];

const REJECTION_REASONS = [
    'Price Not Matching',
    'MOQ Not Matching',
    'Lead Time is Too Long',
];

const NOTIFY_EMAILS = ['sales@siddhikabel.com', 'info@siddhikabel.com', 'enquiry@siddhikabel.com'];

const REMINDER_KEY = (qtnId: number) => `crp_reminder_${qtnId}`;

function formatReminderDeadline(isoString: string) {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function getRemainingTime(isoString: string): string {
    const diff = new Date(isoString).getTime() - Date.now();
    if (diff <= 0) return 'overdue';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m remaining`;
}

export const CustomerResponsePanel: React.FC<CustomerResponsePanelProps> = ({
    quotation,
    customerName,
    onStatusUpdate,
}) => {
    const [step, setStep] = useState<PanelStep>('idle');
    const [selectedAmendmentReason, setSelectedAmendmentReason] = useState<string>('');
    const [selectedRejectionReason, setSelectedRejectionReason] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [reminderInfo, setReminderInfo] = useState<string | null>(null);
    const [remainingTime, setRemainingTime] = useState<string>('');

    const qtnNo = quotation.id > 0 ? `SKC/QTN/${quotation.id}` : 'DRAFT';

    // Load existing reminder from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(REMINDER_KEY(quotation.id));
        if (stored) {
            setReminderInfo(stored);
            setRemainingTime(getRemainingTime(stored));
        }
    }, [quotation.id]);

    // Update remaining time every minute
    useEffect(() => {
        if (!reminderInfo) return;
        const interval = setInterval(() => {
            setRemainingTime(getRemainingTime(reminderInfo));
        }, 60000);
        return () => clearInterval(interval);
    }, [reminderInfo]);

    const handleOfferAccepted = async () => {
        setIsUpdating(true);
        try {
            await onStatusUpdate('PO received');
            // Clear any reminder
            localStorage.removeItem(REMINDER_KEY(quotation.id));
            setReminderInfo(null);
            setStep('done-accepted');
        } catch (e) {
            alert('Failed to update status. Please try again.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUnderReview = async () => {
        setIsUpdating(true);
        try {
            // Schedule 24-hour reminder in localStorage
            const reminderAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            localStorage.setItem(REMINDER_KEY(quotation.id), reminderAt);
            setReminderInfo(reminderAt);
            setRemainingTime(getRemainingTime(reminderAt));
            setStep('done-review');
        } catch (e) {
            alert('Failed to schedule reminder.');
        } finally {
            setIsUpdating(false);
        }
    };

    const buildAmendmentMailto = () => {
        const subject = encodeURIComponent(`Amendment Required – Quotation ${qtnNo}`);
        const body = encodeURIComponent(
            `Dear Team,\n\nRegarding Quotation No: ${qtnNo}\nCustomer: ${customerName}\n\nThe customer has requested an amendment.\nReason: ${selectedAmendmentReason}\n\nPlease review and revert at the earliest.\n\nRegards,\nSiddhi Kabel Corporation Pvt Ltd`
        );
        return `mailto:${NOTIFY_EMAILS.join(',')}?subject=${subject}&body=${body}`;
    };

    const buildRejectionMailto = () => {
        const subject = encodeURIComponent(`Offer Rejected – Quotation ${qtnNo}`);
        const body = encodeURIComponent(
            `Dear Team,\n\nRegarding Quotation No: ${qtnNo}\nCustomer: ${customerName}\n\nThe customer has rejected our offer.\nReason: ${selectedRejectionReason}\n\nKindly take note and plan accordingly.\n\nRegards,\nSiddhi Kabel Corporation Pvt Ltd`
        );
        return `mailto:${NOTIFY_EMAILS.join(',')}?subject=${subject}&body=${body}`;
    };

    const handleSendAmendmentMail = async () => {
        if (!selectedAmendmentReason) { alert('Please select a reason.'); return; }
        window.location.href = buildAmendmentMailto();
        setStep('done-amendment');
    };

    const handleSendRejectionMail = async () => {
        if (!selectedRejectionReason) { alert('Please select a reason.'); return; }
        setIsUpdating(true);
        try {
            await onStatusUpdate('Lost');
            window.location.href = buildRejectionMailto();
            localStorage.removeItem(REMINDER_KEY(quotation.id));
            setReminderInfo(null);
            setStep('done-rejected');
        } catch (e) {
            alert('Failed to update status.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDismissReminder = () => {
        localStorage.removeItem(REMINDER_KEY(quotation.id));
        setReminderInfo(null);
    };

    return (
        <div
            className="no-print"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
            {/* Reminder Banner */}
            {reminderInfo && step !== 'done-review' && step !== 'done-accepted' && step !== 'done-rejected' && (
                <div style={{
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    border: '1px solid #f59e0b',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(245,158,11,0.2)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>⏰</span>
                        <div>
                            <div style={{ fontWeight: 700, color: '#92400e', fontSize: '12px' }}>
                                Follow-up Reminder Active
                            </div>
                            <div style={{ color: '#78350f', fontSize: '11px' }}>
                                Scheduled for {formatReminderDeadline(reminderInfo)} · <strong>{remainingTime}</strong>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDismissReminder}
                        style={{
                            background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px',
                            padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Main Panel */}
            <div style={{
                background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)',
                border: '2px solid #6366f1',
                borderRadius: '14px',
                padding: '20px 24px',
                boxShadow: '0 4px 20px rgba(99,102,241,0.12)',
                marginBottom: '16px',
            }}>
                <div style={{ marginBottom: '16px' }}>
                    <h3 style={{
                        fontSize: '15px', fontWeight: 800, color: '#3730a3',
                        margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <span style={{ fontSize: '18px' }}>📋</span>
                        Customer Response — {qtnNo}
                    </h3>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0', fontWeight: 500 }}>
                        Record the customer's response to update the offer status and notify the team.
                    </p>
                </div>

                {/* IDLE: Show 4 buttons */}
                {step === 'idle' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {/* Offer Accepted */}
                        <button
                            id="btn-offer-accepted"
                            onClick={handleOfferAccepted}
                            disabled={isUpdating}
                            style={{
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                color: '#fff', border: 'none', borderRadius: '10px',
                                padding: '12px 8px', cursor: 'pointer', fontSize: '12px',
                                fontWeight: 700, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '6px',
                                boxShadow: '0 3px 10px rgba(34,197,94,0.3)',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                                opacity: isUpdating ? 0.6 : 1,
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
                        >
                            <span style={{ fontSize: '22px' }}>✅</span>
                            Offer Accepted
                            <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 500 }}>Updates status → PO Received</span>
                        </button>

                        {/* Under Review */}
                        <button
                            id="btn-under-review"
                            onClick={() => setStep('under-review')}
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: '#fff', border: 'none', borderRadius: '10px',
                                padding: '12px 8px', cursor: 'pointer', fontSize: '12px',
                                fontWeight: 700, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '6px',
                                boxShadow: '0 3px 10px rgba(245,158,11,0.3)',
                                transition: 'transform 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
                        >
                            <span style={{ fontSize: '22px' }}>🔍</span>
                            Under Review
                            <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 500 }}>Sets 24-hr follow-up reminder</span>
                        </button>

                        {/* Need Amendment */}
                        <button
                            id="btn-need-amendment"
                            onClick={() => setStep('need-amendment')}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: '#fff', border: 'none', borderRadius: '10px',
                                padding: '12px 8px', cursor: 'pointer', fontSize: '12px',
                                fontWeight: 700, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '6px',
                                boxShadow: '0 3px 10px rgba(99,102,241,0.3)',
                                transition: 'transform 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
                        >
                            <span style={{ fontSize: '22px' }}>✏️</span>
                            Need Amendment
                            <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 500 }}>Notify team with reason</span>
                        </button>

                        {/* Offer Rejected */}
                        <button
                            id="btn-offer-rejected"
                            onClick={() => setStep('offer-rejected')}
                            style={{
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                color: '#fff', border: 'none', borderRadius: '10px',
                                padding: '12px 8px', cursor: 'pointer', fontSize: '12px',
                                fontWeight: 700, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '6px',
                                boxShadow: '0 3px 10px rgba(239,68,68,0.3)',
                                transition: 'transform 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
                        >
                            <span style={{ fontSize: '22px' }}>❌</span>
                            Offer Rejected
                            <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 500 }}>Updates status → Lost + Notify</span>
                        </button>
                    </div>
                )}

                {/* UNDER REVIEW: Confirmation */}
                {step === 'under-review' && (
                    <div style={{ animation: 'fadeIn 0.2s ease' }}>
                        <div style={{
                            background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px',
                            padding: '12px', marginBottom: '12px', fontSize: '12px', color: '#78350f',
                        }}>
                            <strong>⏰ Set 24-Hour Follow-up Reminder</strong>
                            <p style={{ margin: '6px 0 0' }}>
                                A reminder will be saved in your browser. When you next open this quotation after 24 hours, you'll be prompted to follow up with <strong>{customerName}</strong>.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleUnderReview}
                                disabled={isUpdating}
                                style={{
                                    flex: 1, background: '#f59e0b', color: '#fff', border: 'none',
                                    borderRadius: '8px', padding: '10px', fontWeight: 700, fontSize: '12px',
                                    cursor: 'pointer', opacity: isUpdating ? 0.6 : 1,
                                }}
                            >
                                {isUpdating ? 'Setting...' : '✅ Confirm & Set Reminder'}
                            </button>
                            <button
                                onClick={() => setStep('idle')}
                                style={{
                                    flex: 1, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0',
                                    borderRadius: '8px', padding: '10px', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                                }}
                            >
                                ← Back
                            </button>
                        </div>
                    </div>
                )}

                {/* NEED AMENDMENT: Reason selection */}
                {step === 'need-amendment' && (
                    <div style={{ animation: 'fadeIn 0.2s ease' }}>
                        <p style={{ fontWeight: 700, color: '#4338ca', fontSize: '12px', marginBottom: '8px' }}>
                            Select Amendment Reason:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                            {AMENDMENT_REASONS.map(reason => (
                                <label
                                    key={reason}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: selectedAmendmentReason === reason ? '#eef2ff' : '#fff',
                                        border: `2px solid ${selectedAmendmentReason === reason ? '#6366f1' : '#e2e8f0'}`,
                                        borderRadius: '8px', padding: '10px 12px', cursor: 'pointer',
                                        fontSize: '12px', fontWeight: selectedAmendmentReason === reason ? 700 : 500,
                                        color: selectedAmendmentReason === reason ? '#4338ca' : '#334155',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="amendmentReason"
                                        value={reason}
                                        checked={selectedAmendmentReason === reason}
                                        onChange={() => setSelectedAmendmentReason(reason)}
                                        style={{ accentColor: '#6366f1' }}
                                    />
                                    {reason}
                                </label>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                id="btn-send-amendment-mail"
                                onClick={handleSendAmendmentMail}
                                disabled={!selectedAmendmentReason}
                                style={{
                                    flex: 1, background: selectedAmendmentReason ? '#6366f1' : '#c7d2fe',
                                    color: '#fff', border: 'none', borderRadius: '8px',
                                    padding: '10px', fontWeight: 700, fontSize: '12px',
                                    cursor: selectedAmendmentReason ? 'pointer' : 'not-allowed',
                                }}
                            >
                                📧 Send Notification Email
                            </button>
                            <button
                                onClick={() => setStep('idle')}
                                style={{
                                    flex: 1, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0',
                                    borderRadius: '8px', padding: '10px', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                                }}
                            >
                                ← Back
                            </button>
                        </div>
                    </div>
                )}

                {/* OFFER REJECTED: Reason selection + status update */}
                {step === 'offer-rejected' && (
                    <div style={{ animation: 'fadeIn 0.2s ease' }}>
                        <div style={{
                            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
                            padding: '10px 12px', marginBottom: '10px', fontSize: '11px', color: '#7f1d1d',
                        }}>
                            <strong>⚠️ Important:</strong> This will update the quotation status to <strong>"Lost"</strong> and send a notification email to the sales team.
                        </div>
                        <p style={{ fontWeight: 700, color: '#b91c1c', fontSize: '12px', marginBottom: '8px' }}>
                            Select Rejection Reason:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                            {REJECTION_REASONS.map(reason => (
                                <label
                                    key={reason}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: selectedRejectionReason === reason ? '#fef2f2' : '#fff',
                                        border: `2px solid ${selectedRejectionReason === reason ? '#ef4444' : '#e2e8f0'}`,
                                        borderRadius: '8px', padding: '10px 12px', cursor: 'pointer',
                                        fontSize: '12px', fontWeight: selectedRejectionReason === reason ? 700 : 500,
                                        color: selectedRejectionReason === reason ? '#b91c1c' : '#334155',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="rejectionReason"
                                        value={reason}
                                        checked={selectedRejectionReason === reason}
                                        onChange={() => setSelectedRejectionReason(reason)}
                                        style={{ accentColor: '#ef4444' }}
                                    />
                                    {reason}
                                </label>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                id="btn-confirm-rejection"
                                onClick={handleSendRejectionMail}
                                disabled={!selectedRejectionReason || isUpdating}
                                style={{
                                    flex: 1, background: selectedRejectionReason && !isUpdating ? '#ef4444' : '#fca5a5',
                                    color: '#fff', border: 'none', borderRadius: '8px',
                                    padding: '10px', fontWeight: 700, fontSize: '12px',
                                    cursor: selectedRejectionReason && !isUpdating ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {isUpdating ? 'Updating...' : '❌ Update Status & Send Email'}
                            </button>
                            <button
                                onClick={() => setStep('idle')}
                                style={{
                                    flex: 1, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0',
                                    borderRadius: '8px', padding: '10px', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                                }}
                            >
                                ← Back
                            </button>
                        </div>
                    </div>
                )}

                {/* SUCCESS STATES */}
                {step === 'done-accepted' && (
                    <div style={{
                        textAlign: 'center', padding: '20px',
                        background: '#f0fdf4', border: '2px solid #22c55e',
                        borderRadius: '10px',
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
                        <div style={{ fontWeight: 800, color: '#15803d', fontSize: '15px' }}>Offer Accepted!</div>
                        <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px' }}>
                            Status updated to <strong>"PO Received"</strong> successfully.
                        </div>
                        <button onClick={() => setStep('idle')} style={{ marginTop: '12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
                            ← Reset
                        </button>
                    </div>
                )}

                {step === 'done-review' && (
                    <div style={{
                        textAlign: 'center', padding: '20px',
                        background: '#fffbeb', border: '2px solid #f59e0b',
                        borderRadius: '10px',
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '8px' }}>⏰</div>
                        <div style={{ fontWeight: 800, color: '#92400e', fontSize: '15px' }}>Reminder Set!</div>
                        <div style={{ fontSize: '12px', color: '#78350f', marginTop: '4px' }}>
                            Follow-up reminder scheduled for <strong>24 hours from now</strong>.<br />
                            You'll be notified when you next open this quotation.
                        </div>
                        <button onClick={() => setStep('idle')} style={{ marginTop: '12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
                            ← Reset
                        </button>
                    </div>
                )}

                {step === 'done-amendment' && (
                    <div style={{
                        textAlign: 'center', padding: '20px',
                        background: '#eef2ff', border: '2px solid #6366f1',
                        borderRadius: '10px',
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '8px' }}>📧</div>
                        <div style={{ fontWeight: 800, color: '#3730a3', fontSize: '15px' }}>Email Notification Sent!</div>
                        <div style={{ fontSize: '12px', color: '#4338ca', marginTop: '4px' }}>
                            Amendment request for <strong>"{selectedAmendmentReason}"</strong> has been notified to the team.
                        </div>
                        <button onClick={() => { setStep('idle'); setSelectedAmendmentReason(''); }} style={{ marginTop: '12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
                            ← Reset
                        </button>
                    </div>
                )}

                {step === 'done-rejected' && (
                    <div style={{
                        textAlign: 'center', padding: '20px',
                        background: '#fef2f2', border: '2px solid #ef4444',
                        borderRadius: '10px',
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '8px' }}>📩</div>
                        <div style={{ fontWeight: 800, color: '#b91c1c', fontSize: '15px' }}>Rejection Recorded!</div>
                        <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '4px' }}>
                            Status updated to <strong>"Lost"</strong>. Email notification for <strong>"{selectedRejectionReason}"</strong> sent to the sales team.
                        </div>
                        <button onClick={() => { setStep('idle'); setSelectedRejectionReason(''); }} style={{ marginTop: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
                            ← Reset
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
