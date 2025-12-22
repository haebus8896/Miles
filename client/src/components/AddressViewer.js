import React, { useState } from 'react';
import { addResidenceProfile, sendEditOtp, verifyEditOtp } from '../api';

export default function AddressViewer({ data, onEdit, onBack }) {
    const { address, household } = data;
    const [addingMember, setAddingMember] = useState(false);
    const [newMember, setNewMember] = useState({ name: '', phone: '', relationship: '' });
    const [verifyingEdit, setVerifyingEdit] = useState(false);
    const [editOtp, setEditOtp] = useState('');
    const [editOtpSent, setEditOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);

    // --- Add Member Logic ---
    const handleAddMember = async () => {
        if (!newMember.name || !newMember.phone) return;
        setLoading(true);
        try {
            // Simplified: Direct add for now (assuming open access as per request "freely")
            // User requested "ability to add the profiles freely"
            await addResidenceProfile(address._id, {
                ...newMember,
                verified: true // Auto-verify for demo
            });
            alert('Member added!');
            window.location.reload(); // Simple reload to refresh data
        } catch (err) {
            alert('Failed to add member');
        } finally {
            setLoading(false);
        }
    };

    // --- Edit Verification Logic ---
    const handleRequestEdit = async () => {
        setVerifyingEdit(true);
    };

    const handleSendEditOtp = async () => {
        setLoading(true);
        try {
            const res = await sendEditOtp(address._id);
            setEditOtpSent(true);
            alert(`[OTP DEBUGGER] Edit OTP: ${res.debugOtp}`);
        } catch (err) {
            alert('Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyEditOtp = async () => {
        setLoading(true);
        try {
            await verifyEditOtp(address._id, editOtp);
            onEdit(address); // Switch to Edit Mode in Parent
        } catch (err) {
            alert('Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="panel card">
            <div className="panel-header">
                <button className="small-btn" onClick={onBack}>← Back</button>
                <h3>{address.smartAddressCode}</h3>
            </div>

            <div className="viewer-content">
                <div className="section">
                    <h4>Address Details</h4>
                    <p><strong>Type:</strong> {address.residenceType}</p>
                    {address.residenceType === 'apartment' && (
                        <>
                            <p><strong>Apartment:</strong> {address.apartmentDetails?.name}</p>
                            <p><strong>Block/Floor:</strong> {address.apartmentDetails?.block} - {address.apartmentDetails?.floorNumber}</p>
                        </>
                    )}
                    <p><strong>House/Flat:</strong> {address.addressDetails.houseNumber}</p>
                    <p><strong>Area:</strong> {address.addressDetails.area}</p>
                    <p><strong>City:</strong> {address.addressDetails.city}, {address.addressDetails.state}</p>
                </div>

                <div className="section">
                    <h4>Household Profile</h4>
                    <div className="list">
                        <div className="list-item">
                            <div className="avatar">{household.maskedDisplayData.primary.maskedName[0]}</div>
                            <div>
                                <div><strong>{household.maskedDisplayData.primary.maskedName}</strong> <span className="badge">Primary</span></div>
                                <div className="muted">{household.maskedDisplayData.primary.maskedPhone}</div>
                            </div>
                        </div>
                        {household.maskedDisplayData.members.map((m, i) => (
                            <div key={i} className="list-item">
                                <div className="avatar">{m.maskedName[0]}</div>
                                <div>
                                    <div><strong>{m.maskedName}</strong> <span className="muted">({m.relationship})</span></div>
                                    <div className="muted">{m.maskedPhone}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {addingMember ? (
                        <div className="add-member-form">
                            <input placeholder="Name" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} />
                            <input placeholder="Phone" value={newMember.phone} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} />
                            <input placeholder="Relationship" value={newMember.relationship} onChange={e => setNewMember({ ...newMember, relationship: e.target.value })} />
                            <button className="control-btn" onClick={handleAddMember} disabled={loading}>Save</button>
                            <button className="small-btn" onClick={() => setAddingMember(false)}>Cancel</button>
                        </div>
                    ) : (
                        <button className="small-btn full-width" onClick={() => setAddingMember(true)}>+ Add Member</button>
                    )}
                </div>

                <div className="section actions">
                    <button className="control-btn full-width" onClick={handleRequestEdit}>Edit Address Details</button>
                </div>
            </div>

            {verifyingEdit && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h4>Verify Identity</h4>
                        <p>To edit this address, we need to verify you are the primary resident.</p>
                        <p>OTP will be sent to: <strong>{household.maskedDisplayData.primary.maskedPhone}</strong></p>

                        {!editOtpSent ? (
                            <button className="control-btn" onClick={handleSendEditOtp} disabled={loading}>Send OTP</button>
                        ) : (
                            <div className="otp-input-group">
                                <input
                                    placeholder="Enter OTP"
                                    value={editOtp}
                                    onChange={e => setEditOtp(e.target.value)}
                                    maxLength={4}
                                />
                                <button className="control-btn" onClick={handleVerifyEditOtp} disabled={loading}>Verify</button>
                            </div>
                        )}
                        <button className="text-btn" onClick={() => setVerifyingEdit(false)}>Cancel</button>
                    </div>
                </div>
            )}

            <style>{`
        .viewer-content { padding: 16px; }
        .section { margin-bottom: 24px; }
        .list-item { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
        .avatar { width: 32px; height: 32px; background: #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .badge { font-size: 10px; background: #e3f2fd; color: #1565c0; padding: 2px 4px; borderRadius: 4px; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: white; padding: 24px; borderRadius: 12px; width: 90%; max-width: 320px; text-align: center; }
        .otp-input-group { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
      `}</style>
        </div>
    );
}
