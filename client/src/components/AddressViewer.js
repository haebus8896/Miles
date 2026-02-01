import React, { useState, useRef, useEffect } from 'react';
import { GoogleMap, StreetViewPanorama, Polyline, Marker } from '@react-google-maps/api';
import { addResidenceProfile, sendEditOtp, verifyEditOtp } from '../api';
import { pathDistanceMeters } from '../PolylineUtils';

const defaultCenter = { lat: 28.6139, lng: 77.209 };

export default function AddressViewer({ data, onEdit, onBack, onViewMap }) {
    const { address, household } = data;
    const [addingMember, setAddingMember] = useState(false);
    const [newMember, setNewMember] = useState({ name: '', phone: '', relationship: '' });
    const [verifyingEdit, setVerifyingEdit] = useState(false);
    const [editOtp, setEditOtp] = useState('');
    const [editOtpSent, setEditOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);

    // Route Info State
    const [startLocationName, setStartLocationName] = useState('Entry Point');

    // Reverse Geocode Start Point
    useEffect(() => {
        if (address.polylineOptimized?.length > 0) {
            const start = address.polylineOptimized[0];
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: start }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    // Try to get a colloquial name (POI or Neighborhood)
                    // results[0] is usually precise address. results[1] or [2] might be area.
                    // Let's use formatted address but strip country/code to be shorter.
                    const name = results[0].formatted_address.split(',')[0];
                    setStartLocationName(name);
                }
            });
        }
    }, [address]);

    // Derived Stats
    const polyline = address.polylineOptimized || [];
    const distMeters = pathDistanceMeters(polyline);
    const steps = Math.round(distMeters / 0.762);
    const mode = address.transport_mode || address.transportMode || 'car'; // Handle potential casing

    let timeMin = 0;
    if (mode === 'walking') timeMin = Math.round(distMeters / 83); // ~5km/h
    else if (mode === 'bike') timeMin = Math.round(distMeters / 250); // ~15km/h
    else timeMin = Math.round(distMeters / 500); // ~30km/h
    if (timeMin < 1) timeMin = 1;

    // Last Mile Instruction Text
    const instruction = mode === 'walking'
        ? `Reach ${startLocationName} by Vehicle, then Walk:`
        : mode === 'bike'
            ? `Reach ${startLocationName}, then Bike:`
            : `Drive via ${startLocationName} directly to Gate:`;

    // Refs
    // const panoramaRef = useRef(null); // If needed for imperative API

    // --- Add Member Logic ---
    const handleAddMember = async () => {
        if (!newMember.name || !newMember.phone) return;
        setLoading(true);
        try {
            await addResidenceProfile(address._id, {
                ...newMember,
                verified: true
            });
            alert('Member added!');
            window.location.reload();
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
            onEdit(address);
        } catch (err) {
            alert('Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    // Derived Data
    const gateImage = address.gateImage;
    const gatePov = address.gatePov;
    const gatePosition = address.gatePosition;
    const pathLength = address.polylineOptimized?.length || 0;

    // Robust Center Point extraction (Gate -> Polyline Start -> Destination -> Default)
    let mapCenter = defaultCenter;
    if (gatePosition) mapCenter = gatePosition;
    else if (address.polylineOptimized?.length > 0) mapCenter = address.polylineOptimized[0];
    else if (address.destination_point?.coordinates) {
        mapCenter = { lat: address.destination_point.coordinates[1], lng: address.destination_point.coordinates[0] };
    } else if (address.destination_point?.lat) {
        mapCenter = address.destination_point;
    }

    return (
        <div className="panel card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Header / Nav */}
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--panel-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <button className="small-btn" onClick={onBack}>← Back</button>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{address.smartAddressCode}</div>
                <button className="small-btn" onClick={onViewMap}>Map ↗</button>
            </div>

            {/* Route Info Card */}
            <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                padding: '16px',
                borderRadius: '12px',
                margin: '16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>{mode === 'walking' ? '🚶' : mode === 'bike' ? '🚴' : '🚗'}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8' }}>Route Guide</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '8px 0', marginBottom: 20, fontSize: 13 }}>
                    <div style={{ color: '#64748b', fontWeight: 600, fontSize: 11, alignSelf: 'center' }}>FROM</div>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{startLocationName}</div>

                    <div style={{ color: '#64748b', fontWeight: 600, fontSize: 11, alignSelf: 'center' }}>TO</div>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Residence Gate</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#38bdf8' }}>{timeMin}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Min</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80' }}>{Math.round(distMeters)}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Meters</div>
                    </div>
                    {mode === 'walking' && (
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#f472b6' }}>{steps}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Steps</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="viewer-content" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>

                {/* Visual Header (Gate View) */}
                <div className="summary-visual" style={{ height: 240, borderRadius: 0 }}>
                    {gateImage && !gateImage.includes('svg') ? (
                        <img src={gateImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Gate" />
                    ) : (
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            zoom={18}
                            center={mapCenter}
                            options={{ disableDefaultUI: true }}
                        >
                            <StreetViewPanorama
                                position={mapCenter}
                                visible={true}
                                options={{
                                    disableDefaultUI: true,
                                    clickToGo: false,
                                    linksControl: false,
                                    panControl: false,
                                    enableCloseButton: false,
                                    pov: gatePov,
                                    zoom: address.gateZoom
                                }}
                            />
                        </GoogleMap>
                    )}

                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', color: 'white', padding: 20, zIndex: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{address.addressLabel || 'Address'}</div>
                            {address.gateVerified && <span style={{ background: '#238636', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>VERIFIED GATE</span>}
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.9 }}>{address.userName} • {pathLength} Steps to Door</div>
                    </div>
                </div>

                {/* Details List */}
                <div style={{ padding: 16 }}>

                    <div className="section mb-4">
                        <h4 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 12 }}>Location Details</h4>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div className="info-box">
                                <label className="muted" style={{ fontSize: 11 }}>HOUSE NO.</label>
                                <div style={{ fontWeight: 600 }}>{address.addressDetails.houseNumber || 'N/A'}</div>
                            </div>
                            <div className="info-box">
                                <label className="muted" style={{ fontSize: 11 }}>FLOOR</label>
                                <div style={{ fontWeight: 600 }}>{address.apartmentDetails?.floorNumber || address.floorNumber || 'N/A'}</div>
                            </div>
                        </div>

                        {address.blockName && (
                            <div className="info-box mb-2">
                                <label className="muted" style={{ fontSize: 11 }}>BLOCK / TOWER</label>
                                <div style={{ fontWeight: 600 }}>{address.blockName}</div>
                            </div>
                        )}

                        <div className="info-box mb-2">
                            <label className="muted" style={{ fontSize: 11 }}>AREA / LOCALITY</label>
                            <div style={{ fontWeight: 600 }}>{address.addressDetails.area}</div>
                        </div>

                        <div className="info-box mb-2">
                            <label className="muted" style={{ fontSize: 11 }}>LANDMARK</label>
                            <div style={{ fontWeight: 600 }}>{address.landmark || 'None'}</div>
                        </div>

                        {address.addressDetails.formatted && (
                            <div className="info-box" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', padding: 10, borderRadius: 8 }}>
                                <label className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>OFFICIAL POSTAL ADDRESS</label>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{address.addressDetails.formatted}</div>
                            </div>
                        )}
                    </div>

                    <div className="section mb-4">
                        <h4 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 12 }}>Route Map</h4>
                        <div style={{ height: 180, position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                            <GoogleMap
                                mapContainerStyle={{ width: '100%', height: '100%' }}
                                zoom={18}
                                center={mapCenter}
                                options={{ disableDefaultUI: true, mapTypeId: 'hybrid' }}
                            >
                                {address.polylineOptimized && (
                                    <Polyline
                                        path={address.polylineOptimized}
                                        options={{
                                            strokeColor:
                                                (address.transportMode || address.transport_mode) === 'bike' ? '#FFFF00' : // High-vis Yellow (Satellite friendly)
                                                    (address.transportMode || address.transport_mode) === 'walking' ? '#00E5FF' : // Cyan
                                                        '#4285F4', // Default/Car Blue
                                            strokeWeight: 4,
                                            strokeOpacity: 1.0,
                                            zIndex: 100
                                        }}
                                    />
                                )}
                                {address.polylineOptimized && address.polylineOptimized.map((pt, i) => {
                                    const modeColor =
                                        (address.transportMode || address.transport_mode) === 'bike' ? '#FFFF00' :
                                            (address.transportMode || address.transport_mode) === 'walking' ? '#00E5FF' :
                                                '#4285F4';

                                    return (
                                        <Marker
                                            key={i}
                                            position={pt}
                                            icon={{
                                                path: window.google?.maps?.SymbolPath?.CIRCLE,
                                                scale: i === address.polylineOptimized.length - 1 ? 6 : 4,
                                                fillColor: i === address.polylineOptimized.length - 1 ? '#E91E63' : modeColor,
                                                fillOpacity: 1,
                                                strokeWeight: 2,
                                                strokeColor: 'white' // Keep white border for contrast
                                            }}
                                        />
                                    );
                                })}
                            </GoogleMap>
                            <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'white', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                SATELLITE VIEW
                            </div>
                        </div>
                    </div>

                    <div className="section mb-4">
                        <h4 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 12 }}>Residents</h4>
                        <div className="list">
                            <div className="list-item">
                                <div className="avatar" style={{ background: 'var(--accent-color)', color: 'white' }}>{household.maskedDisplayData.primary.maskedName[0]}</div>
                                <div>
                                    <div><strong>{household.maskedDisplayData.primary.maskedName}</strong> <span className="badge">Primary</span></div>
                                    <div className="muted">{household.maskedDisplayData.primary.maskedPhone}</div>
                                </div>
                            </div>
                            {household.maskedDisplayData.members.map((m, i) => (
                                <div key={i} className="list-item">
                                    <div className="avatar">{m.maskedName[0]}</div>
                                    <div>
                                        <div><strong>{m.maskedName}</strong> <span className="muted" style={{ fontSize: 13 }}>({m.relationship})</span></div>
                                        <div className="muted">{m.maskedPhone}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {!addingMember && <button className="small-btn outline" style={{ width: '100%', marginTop: 8 }} onClick={() => setAddingMember(true)}>+ Add Member</button>}

                        {addingMember && (
                            <div className="add-member-form form-grid" style={{ marginTop: 16, background: 'var(--bg-app)', padding: 12, borderRadius: 8 }}>
                                <input className="modern-input" placeholder="Name" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} />
                                <input className="modern-input" placeholder="Phone" value={newMember.phone} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} />
                                <input className="modern-input" placeholder="Relationship" value={newMember.relationship} onChange={e => setNewMember({ ...newMember, relationship: e.target.value })} />
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button className="control-btn" onClick={handleAddMember} disabled={loading}>Save</button>
                                    <button className="control-btn outline" onClick={() => setAddingMember(false)}>Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="section actions">
                        <button className="control-btn outline" style={{ width: '100%', marginBottom: 12 }} onClick={handleRequestEdit}>Edit Address Details</button>
                    </div>
                </div>
            </div>

            {verifyingEdit && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h4>Verify Identity</h4>
                        <p className="muted mb-4">To edit this address, we need to verify you are the primary resident.</p>
                        <p className="mb-4">OTP will be sent to: <br /><strong>{household.maskedDisplayData.primary.maskedPhone}</strong></p>

                        {!editOtpSent ? (
                            <button className="control-btn" onClick={handleSendEditOtp} disabled={loading}>Send OTP</button>
                        ) : (
                            <div className="otp-input-group" style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                                <input
                                    className="modern-input"
                                    style={{ textAlign: 'center', letterSpacing: 4, fontSize: 20 }}
                                    placeholder="0 0 0 0"
                                    value={editOtp}
                                    onChange={e => setEditOtp(e.target.value)}
                                    maxLength={4}
                                />
                                <button className="control-btn" onClick={handleVerifyEditOtp} disabled={loading}>Verify</button>
                            </div>
                        )}
                        <button className="small-btn" style={{ marginTop: 16 }} onClick={() => setVerifyingEdit(false)}>Cancel</button>
                    </div>
                </div>
            )}

            <style>{`
                .info-box {
                    
                }
            `}</style>
        </div>
    );
}
