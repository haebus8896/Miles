import React, { useState, useMemo } from 'react';
import { useStore } from '../useStore';
import { createAddress, getAddressByCode, updateAddress } from '../api';

const Field = ({ label, children }) => (
  <label className="form-field">
    <span>{label}</span>
    {children}
  </label>
);

export default function AddressComposer() {
  const addressForm = useStore((state) => state.addressForm);
  const setAddressField = useStore((state) => state.setAddressField);
  const resetAddressForm = useStore((state) => state.resetAddressForm);
  const selectedRoadPoint = useStore((state) => state.selectedRoadPoint);
  const polyline = useStore((state) => state.polyline);
  const savedAddress = useStore((state) => state.savedAddress);
  const setSavedAddress = useStore((state) => state.setSavedAddress);
  const duplicates = useStore((state) => state.duplicates);
  const setDuplicates = useStore((state) => state.setDuplicates);
  const nearbyAddresses = useStore((state) => state.nearbyAddresses);
  const setProfiles = useStore((state) => state.setProfiles);
  const resetProfileForm = useStore((state) => state.resetProfileForm);
  const setFocusPoint = useStore((state) => state.setFocusPoint);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loadingCode, setLoadingCode] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const routeReady = selectedRoadPoint && polyline.length >= 2;

  const tagsArray = useMemo(
    () =>
      addressForm.tags
        ? addressForm.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    [addressForm.tags]
  );

  const handleInput = (e) => {
    const { name, value } = e.target;
    setAddressField(name, value);
  };

  const loadAddress = async (codeOrId) => {
    if (!codeOrId) return;
    setLoadingCode(codeOrId);
    setError('');
    setStatus('');
    try {
      const address = await getAddressByCode(codeOrId);
      if (address) {
        setSavedAddress(address);
        setIsEditing(true);
        // Populate form with address data
        Object.keys(addressForm).forEach((key) => {
          if (address[key] !== undefined) {
            setAddressField(key, address[key] || (typeof addressForm[key] === 'number' ? 0 : ''));
          }
        });
        // Handle tags array
        if (address.tags && Array.isArray(address.tags)) {
          setAddressField('tags', address.tags.join(', '));
        }
        // Load polyline and road point from saved address
        if (address.polyline_smoothed && address.polyline_smoothed.length > 0) {
          useStore.getState().setPolyline(address.polyline_smoothed);
        }
        if (address.road_point) {
          useStore.getState().setSelectedRoadPoint(address.road_point);
        }
        if (address.destination_point) {
          useStore.getState().setFocusPoint(address.destination_point);
        }
        setStatus(`Loaded address ${address.code}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load address');
    } finally {
      setLoadingCode('');
    }
  };

  const handleSave = async () => {
    if (!routeReady && !isEditing) {
      setError('Please select a road point and draw the route to your doorstep.');
      return;
    }
    if (!addressForm.official_address) {
      setError('Official address is required.');
      return;
    }
    setError('');
    setStatus('');
    setSaving(true);
    try {
      const payload = {
        ...addressForm,
        floor_no: Number(addressForm.floor_no) || 0,
        tags: tagsArray
      };

      let address;
      if (isEditing && savedAddress) {
        // Update existing address
        payload.road_point = selectedRoadPoint || savedAddress.road_point;
        payload.destination_point = polyline.length > 0 ? polyline[polyline.length - 1] : savedAddress.destination_point;
        payload.polyline = polyline.length > 0 ? polyline : savedAddress.polyline_smoothed || [];
        address = await updateAddress(savedAddress.id, payload);
        setStatus(`Address ${address.code} updated successfully.`);
      } else {
        // Create new address
        payload.road_point = selectedRoadPoint;
        payload.destination_point = polyline[polyline.length - 1];
        payload.polyline = polyline;
        const result = await createAddress(payload);
        address = result.address;
        setDuplicates(result.duplicates || []);
        setProfiles([]);
        resetProfileForm();
        setStatus(`Smart address saved. Code: ${address.code}`);
      }
      setSavedAddress(address);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    resetAddressForm();
    setSavedAddress(null);
    setIsEditing(false);
    setStatus('');
    setDuplicates([]);
    useStore.getState().setPolyline([]);
    useStore.getState().setSelectedRoadPoint(null);
  };

  return (
    <section className="panel card">
      <div className="panel-header">
        <div>
          <h3>Smart Address Builder</h3>
          <p>Create the permanent, last-50m route tied to your doorstep.</p>
        </div>
        {savedAddress && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="badge success">{savedAddress.code}</span>
            {savedAddress.official_address && (
              <div style={{ fontSize: '12px', color: '#666', textAlign: 'right', maxWidth: '200px' }}>
                {savedAddress.official_address}
                {savedAddress.locality && `, ${savedAddress.locality}`}
                {savedAddress.city && `, ${savedAddress.city}`}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <Field label="Load address by code">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Enter code (e.g. SLMD-AB12CD)"
              style={{ flex: 1 }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  loadAddress(e.target.value.trim());
                }
              }}
            />
            <button className="small-btn" onClick={() => {
              const code = document.querySelector('input[placeholder*="Enter code"]')?.value?.trim();
              if (code) loadAddress(code);
            }} disabled={!!loadingCode}>
              {loadingCode ? 'Loading...' : 'Load'}
            </button>
          </div>
        </Field>
      </div>

      <div className="form-grid">
        <Field label="Official address">
          <input name="official_address" value={addressForm.official_address} onChange={handleInput} placeholder="House 12, MG Road, Shastri Nagar" />
        </Field>
        <Field label="Landmark">
          <input name="landmark" value={addressForm.landmark} onChange={handleInput} placeholder="Opp. Community Park" />
        </Field>
        <Field label="Locality / Area">
          <input name="locality" value={addressForm.locality} onChange={handleInput} placeholder="Shastri Nagar" />
        </Field>
        <Field label="City">
          <input name="city" value={addressForm.city} onChange={handleInput} placeholder="New Delhi" />
        </Field>
        <Field label="Postal code">
          <input name="postal_code" value={addressForm.postal_code} onChange={handleInput} placeholder="110052" />
        </Field>
        <Field label="Floor number">
          <input type="number" name="floor_no" value={addressForm.floor_no} onChange={handleInput} min={-2} max={50} />
        </Field>
        <Field label="Flat / House number">
          <input name="flat_no" value={addressForm.flat_no} onChange={handleInput} placeholder="A1-234" />
        </Field>
        <Field label="Tags (comma separated)">
          <input name="tags" value={addressForm.tags} onChange={handleInput} placeholder="gated,pet-friendly" />
        </Field>
      </div>

      <Field label="Delivery instructions">
        <textarea name="instructions" value={addressForm.instructions} onChange={handleInput} placeholder="Ring the bell near the red gate, lift available till 3rd floor" rows={3} />
      </Field>

      <div className="form-grid">
        <Field label="Owner full name">
          <input name="owner_full_name" value={addressForm.owner_full_name} onChange={handleInput} placeholder="Rajesh Kumar" />
        </Field>
        <Field label="Owner phone">
          <input name="owner_phone" value={addressForm.owner_phone} onChange={handleInput} placeholder="9876543210" />
        </Field>
      </div>

      <div className="stack gap-sm">
        <div className="route-summary">
          <div>
            <strong>Route status:</strong> {routeReady ? `${polyline.length} points captured` : 'Awaiting road point & polyline'}
          </div>
          <div>
            <strong>Start:</strong>{' '}
            {selectedRoadPoint ? `${selectedRoadPoint.lat.toFixed(6)}, ${selectedRoadPoint.lng.toFixed(6)}` : 'Not selected'}
          </div>
          <div>
            <strong>Finish:</strong>{' '}
            {polyline.length ? `${polyline[polyline.length - 1].lat.toFixed(6)}, ${polyline[polyline.length - 1].lng.toFixed(6)}` : 'Not drawn'}
          </div>
        </div>

        {status && <div className="alert success">{status}</div>}
        {error && <div className="alert danger">{error}</div>}
      </div>

      <div className="actions-row">
        <button className="control-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Update Address' : 'Save Smart Address'}
        </button>
        <button className="small-btn" onClick={handleReset}>
          {isEditing ? 'Clear & Start New' : 'Reset form'}
        </button>
      </div>

      {duplicates.length > 0 && (
        <div className="panel-subsection">
          <h4>Possible duplicates ({duplicates.length})</h4>
          <p className="muted">We found saved addresses within 40m of your destination. Verify before creating a new one.</p>
          <div className="list">
            {duplicates.map((dup) => (
              <div key={dup.id} className="list-item">
                <div>
                  <strong>{dup.code}</strong>
                  <div className="muted">{dup.official_address}</div>
                </div>
                <button className="small-btn" onClick={() => setFocusPoint(dup.destination_point)}>
                  Focus
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel-subsection">
        <h4>Nearby saved addresses ({nearbyAddresses.length})</h4>
        {nearbyAddresses.length === 0 && <p className="muted">None within 50m yet.</p>}
        <div className="list">
          {nearbyAddresses.map((addr) => (
            <div key={addr.id} className="list-item">
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => loadAddress(addr.code || addr.id)}>
                <strong>{addr.official_address || addr.code}</strong>
                <div className="muted">{addr.code}</div>
                {addr.locality && <div className="muted" style={{ fontSize: '11px' }}>{addr.locality}, {addr.city || ''}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="small-btn" onClick={() => setFocusPoint(addr.destination_point)}>
                  Focus
                </button>
                <button className="small-btn" onClick={() => loadAddress(addr.code || addr.id)}>
                  Load
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

