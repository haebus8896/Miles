import React from 'react';
import { useStore } from '../useStore';

export default function AddressBook({ onView, onBack, filteredCodes, onClearFilter, onEdit, onDelete }) {
    const createdAddressesMap = useStore((state) => state.createdAddressesMap);

    let addresses = Object.values(createdAddressesMap).map(item => item.address).reverse();

    // Filter if active
    if (filteredCodes && filteredCodes.length > 0) {
        addresses = addresses.filter(a => filteredCodes.includes(a.smartAddressCode));
    }

    const handleBack = () => {
        if (filteredCodes) {
            onClearFilter();
        } else {
            onBack();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="panel-header" style={{ padding: '24px 24px 0 24px' }}>
                <button className="small-btn" onClick={handleBack}>← Back</button>
                <h3>{filteredCodes ? 'Nearby Addresses' : 'Address Book'}</h3>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {addresses.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
                        <p>No saved addresses yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {addresses.map((addr, i) => (
                            <div
                                key={addr.smartAddressCode}
                                className="list-item"
                                onClick={() => onView(addr.smartAddressCode)}
                                style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#30363d'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#21262d'}
                            >
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%', background: 'rgba(88, 166, 255, 0.15)',
                                    color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 18
                                }}>
                                    {addr.addressLabel ? addr.addressLabel[0].toUpperCase() : 'A'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <h4 style={{ margin: 0, textTransform: 'none', fontSize: 15, fontWeight: 600 }}>
                                            {addr.addressLabel || 'Unless Address'}
                                        </h4>
                                        <span className="badge" style={{ fontSize: 10 }}>{addr.smartAddressCode}</span>
                                    </div>
                                    <p style={{ fontSize: 13, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {addr.addressDetails?.formatted || `${addr.addressDetails?.houseNumber}, ${addr.addressDetails?.area}`}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                                    <button
                                        className="small-btn"
                                        onClick={(e) => { e.stopPropagation(); onEdit && onEdit(addr.smartAddressCode); }}
                                        style={{ padding: '4px 8px', fontSize: 12, background: 'transparent', border: '1px solid #30363d' }}
                                        title="Edit"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="small-btn"
                                        onClick={(e) => { e.stopPropagation(); onDelete && onDelete(addr.smartAddressCode); }}
                                        style={{ padding: '4px 8px', fontSize: 12, background: 'transparent', border: '1px solid #30363d', color: '#ff6b6b' }}
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>›</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
