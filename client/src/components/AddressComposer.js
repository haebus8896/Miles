import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../useStore';
import { GoogleMap, StreetViewPanorama, Autocomplete, Marker, Polyline } from '@react-google-maps/api';
import { createResidence, requestOtp, verifyOtp } from '../api';
import { chaikinSmooth, pathDistanceMeters } from '../PolylineUtils';

const defaultCenter = { lat: 28.6139, lng: 77.209 };

const MinimalField = ({ label, children }) => (
  <label style={{ display: 'block', marginBottom: 20 }}>
    <span className="field-label">{label}</span>
    {children}
  </label>
);

export default function AddressComposer({ initialData, onSaveSuccess }) {
  // Global Store
  const selectedRoadPoint = useStore((state) => state.selectedRoadPoint);

  const isEditMode = !!initialData;
  const polyline = useStore((state) => state.polyline);
  const setPolyline = useStore((state) => state.setPolyline);
  const setSelectedRoadPoint = useStore((state) => state.setSelectedRoadPoint);
  const setMapType = useStore((state) => state.setMapType);
  const setFocusPoint = useStore((state) => state.setFocusPoint);
  const setWizardStep = useStore((state) => state.setWizardStep);

  // Multi-mode
  const currentMode = useStore((state) => state.currentMode);
  const setCurrentMode = useStore((state) => state.setCurrentMode);
  const polylineSegments = useStore((state) => state.polylineSegments);
  const setPolylineSegments = useStore((state) => state.setPolylineSegments);
  const waypoints = useStore((state) => state.waypoints); // Added subscription

  // Wizard State
  const [activeSlide, setActiveSlide] = useState(0);

  // Sync to global store for Layout Control (App.js uses this to hide/show Map)
  useEffect(() => {
    setWizardStep(activeSlide);
  }, [activeSlide, setWizardStep]);

  const [locationSource, setLocationSource] = useState('current'); // 'current' or 'manual'

  // Form Data
  const [formData, setFormData] = useState({
    userName: '',
    addressContext: 'self',
    gateImage: null,
    otp: '',
    userPhone: '',
    houseNumber: '',
    floorNumber: '',
    blockName: '',
    landmark: '',
    addressLabel: '', // Added label field
    tempDetails: {},
    tempFormatted: ''
  });

  // Pre-fill on Edit
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        userName: initialData.userName || '',
        addressLabel: initialData.addressLabel || '',
        houseNumber: initialData.addressDetails?.houseNumber || '',
        floorNumber: initialData.apartmentDetails?.floorNumber || '',
        blockName: initialData.apartmentDetails?.block || '',
        // If gateImage is needed for preview we can set it, but we don't show it in slide 0
        gateImage: initialData.gateImage,
        addressContext: 'self' // Default for edit
      }));
    }
  }, [initialData]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successCode, setSuccessCode] = useState(null);

  // Route Info State
  const [startLocationName, setStartLocationName] = useState('Entry Point');

  useEffect(() => {
    if (activeSlide === 3 && waypoints.length > 0) {
      const start = waypoints[0];
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: start }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const name = results[0].formatted_address.split(',')[0];
          setStartLocationName(name);
        }
      });
    }
  }, [activeSlide, waypoints]);

  // Refs
  const panoramaRef = useRef(null);
  const autocompleteRef = useRef(null);

  // Handlers
  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, gateImage: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSnap = () => {
    // Capture the current view (POV) so the summary looks exactly the same
    if (panoramaRef.current) {
      const pov = panoramaRef.current.getPov();
      const zoom = panoramaRef.current.getZoom();
      const position = panoramaRef.current.getPosition();
      const lat = position.lat();
      const lng = position.lng();

      // Construct Static Street View Image URL
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      // Approximate FOV from Zoom (Zoom 1 ~ 90, Zoom 3 ~ 45?) - Simplified mapping or default
      // Standard Street View FOV is usually 90. Let's stick to default or slight zoom.
      const fov = 180 / Math.pow(2, zoom);

      const staticImageUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&heading=${pov.heading}&pitch=${pov.pitch}&fov=${fov}&key=${apiKey}`;

      // Store explicit POV and finalized position (in case they moved down the street)
      setFormData(prev => ({
        ...prev,
        gateVerified: true,
        gatePov: pov,
        gateZoom: zoom,
        gatePosition: { lat, lng },
        gateImage: staticImageUrl // Set the image to reveal confirm button
      }));
    } else {
      setFormData(prev => ({ ...prev, gateVerified: true }));
    }
  };

  const handleConstructRoute = () => {
    // Direct Connect Mode: "Connect the dots no matter what"
    const dots = waypoints;
    if (dots.length < 1) return; // Allow single dot (On-road house)

    setLoading(true);

    let finalPath = dots;

    // Only smooth if we have a path (2+ dots)
    if (dots.length >= 2) {
      finalPath = chaikinSmooth(dots, 4);
    }

    // 2. Commit to Store
    setPolyline(finalPath);
    setPolylineSegments([{ points: finalPath, mode: currentMode }]);

    // 3. Move to Next Slide
    setLoading(false);
    nextSlide();
  };

  // Geocoding Helper
  const extractAddressDetails = (place) => {
    let details = {
      houseNumber: '',
      area: '',
      city: '',
      state: '',
      postal_code: ''
    };

    if (place.address_components) {
      place.address_components.forEach(component => {
        const types = component.types;
        if (types.includes('street_number')) details.houseNumber = component.long_name;
        if (types.includes('sublocality') || types.includes('neighborhood')) details.area = component.long_name;
        if (types.includes('locality')) details.city = component.long_name;
        if (types.includes('administrative_area_level_1')) details.state = component.long_name;
        if (types.includes('postal_code')) details.postal_code = component.long_name;
      });
    }

    // Fallback for Area if empty
    if (!details.area && place.formatted_address) {
      const parts = place.formatted_address.split(',');
      if (parts.length > 1) details.area = parts[parts.length - 2].trim();
    }

    return details;
  };

  const reverseGeocode = (lat, lng) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const details = extractAddressDetails(results[0]);
        setFormData(prev => ({ ...prev, tempDetails: details, tempFormatted: results[0].formatted_address }));
      }
    });
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry) {
        setFocusPoint({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        });

        const details = extractAddressDetails(place);
        setFormData(prev => ({
          ...prev,
          tempLocation: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
          tempDetails: details,
          tempFormatted: place.formatted_address
        }));
      }
    }
  };

  const nextSlide = () => setActiveSlide(prev => Math.min(prev + 1, 3));
  const prevSlide = () => setActiveSlide(prev => Math.max(prev - 1, 0));

  // Sync Map Mode
  useEffect(() => {
    useStore.getState().setWizardStep(activeSlide);

    // Set Map Type: Satellite for drawing (Slide 1) and verification (Slide 2)
    if (activeSlide >= 1 && activeSlide <= 2) {
      setMapType('hybrid');
    } else {
      setMapType('roadmap');
    }

    // Toggle Drawing Logic (Only Slide 1 - Trace Path)
    if (activeSlide === 1) {
      useStore.getState().setDrawing(true);
      // Logic for 'Self' vs 'Other' handled in render/effect below
    } else {
      useStore.getState().setDrawing(false);
    }
  }, [activeSlide, locationSource]);

  // Trigger Reverse Geocode / Locate on Slide 1 (Map) if 'Self'
  useEffect(() => {
    if (activeSlide === 1) {
      if (locationSource === 'current' && waypoints.length === 0) {
        useStore.getState().setTriggerLocate(true);
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          reverseGeocode(latitude, longitude);
        });
      }
    }
  }, [activeSlide, locationSource]);


  // Save Logic
  const handleSave = async (isEditSave = false) => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      // Generate Unique Code OR Use Existing
      let code = successCode;

      if (initialData && initialData.code) {
        code = initialData.code;
      } else if (!code) {
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        code = `M-${randomPart}-NEW`;
      }

      setSuccessCode(code);

      // Construct Final Address Object
      const capturedDetails = formData.tempDetails || {
        houseNumber: '', area: 'Unknown Area', city: 'Unknown City', state: ''
      };

      // Construct Destination Point (GeoJSON) from Gate Position or Polyline End
      let destLat, destLng;
      const gPos = isEditSave ? initialData?.gatePosition : formData.gatePosition;
      const poly = isEditSave ? (initialData?.polylineOptimized || []) : polyline;

      if (gPos && gPos.lat) {
        destLat = gPos.lat;
        destLng = gPos.lng;
      } else if (poly && poly.length > 0) {
        destLat = poly[poly.length - 1].lat;
        destLng = poly[poly.length - 1].lng;
      }

      // GeoJSON construction
      let finalDestPoint = null;
      if (destLat && destLng) {
        finalDestPoint = { type: 'Point', coordinates: [destLng, destLat] };
      } else if (isEditSave && initialData?.destination_point) {
        finalDestPoint = initialData.destination_point;
      }

      const finalAddress = {
        smartAddressCode: code,
        residenceType: 'house',
        userName: formData.userName,
        addressLabel: formData.addressLabel,
        // Ensure destination_point is set for MapScreen compatibility
        destination_point: finalDestPoint,
        addressDetails: {
          houseNumber: formData.houseNumber || capturedDetails.houseNumber || 'N/A',
          area: capturedDetails.area || 'Current Location',
          city: capturedDetails.city,
          state: capturedDetails.state,
          postal_code: capturedDetails.postal_code,
          formatted: formData.tempFormatted
        },
        apartmentDetails: {
          block: formData.blockName,
          floorNumber: formData.floorNumber
        },
        // Preserve spatial data if editing, else use current store
        polylineOptimized: isEditSave ? (initialData?.polylineOptimized || []) : (polyline || []),
        gateImage: isEditSave ? (initialData?.gateImage) : formData.gateImage,
        gateVerified: isEditSave ? (initialData?.gateVerified) : formData.gateVerified,
        gatePosition: isEditSave ? (initialData?.gatePosition) : formData.gatePosition,
        gatePov: isEditSave ? (initialData?.gatePov) : formData.gatePov,
        gateZoom: isEditSave ? (initialData?.gateZoom) : formData.gateZoom,
        transportMode: isEditSave ? (initialData?.transportMode || 'car') : currentMode
      };

      // Override text fields if form has data (already synced via state)
      // Note: formData is initialized from initialData in useEffect, so formData is truth

      // Save to "Fake Backend" Map
      useStore.getState().addCreatedAddress(code, {
        address: finalAddress,
        household: {
          maskedDisplayData: {
            primary: { maskedName: formData.userName || 'User', maskedPhone: '+91 ******9999' },
            members: []
          }
        }
      });

      setLoading(false);

      if (isEditSave && onSaveSuccess) {
        onSaveSuccess();
      } else {
        nextSlide();
      }
    }, 1500);
  };

  return (
    <div className="wizard-container" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>

      {/* Track */}
      <div className="wizard-track" style={{
        transform: `translateX(-${activeSlide * 25}%)`,
        width: '400%',
        height: '100%',
        display: 'flex',
        transition: 'transform 0.3s ease'
      }}>

        {/* Slide 0: Identity & Address Details */}
        <div className="wizard-slide" style={{ width: '25%', height: '100%', overflowY: 'auto' }}>
          <h3>Welcome</h3>
          <p className="muted">Let's create a delivery address.</p>

          <MinimalField label="Account Name / User Name">
            <input className="modern-input" name="userName" value={formData.userName} onChange={handleInput} placeholder="e.g. John Doe" />
          </MinimalField>

          <MinimalField label="Save Address As (e.g. Home, Hostel)">
            <input className="modern-input" name="addressLabel" value={formData.addressLabel || ''} onChange={handleInput} placeholder="e.g. My Flat, School" />
            <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
              {['Home', 'Office', 'School', 'Hostel'].map(tag => (
                <span key={tag} className="tag-pill" onClick={() => setFormData(p => ({ ...p, addressLabel: tag }))}>
                  {tag}
                </span>
              ))}
            </div>
          </MinimalField>

          <label className="field-label">For whom is this address?</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <button
              className={`pill ${formData.addressContext === 'self' ? 'active' : ''}`}
              onClick={() => { setFormData({ ...formData, addressContext: 'self' }); setLocationSource('current'); }}
            >
              👤 Myself (Use Current Location)
            </button>
            <button
              className={`pill ${formData.addressContext === 'other' ? 'active' : ''}`}
              onClick={() => { setFormData({ ...formData, addressContext: 'other' }); setLocationSource('manual'); }}
            >
              👥 Someone Else (Search Location)
            </button>

            {formData.addressContext === 'other' && (
              <div style={{ marginTop: 8, padding: 12, background: '#f8f9fa', borderRadius: 8, border: '1px solid #e0e0e0' }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 500 }}>Search their location:</div>
                <Autocomplete onLoad={ref => autocompleteRef.current = ref} onPlaceChanged={onPlaceChanged}>
                  <input className="modern-input" placeholder="🔍 Enter Area / Colony / City" autoFocus style={{ border: '1px solid #4285F4', borderRadius: 4 }} />
                </Autocomplete>
              </div>
            )}
          </div>

          <label className="field-label">Address Details</label>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <input className="modern-input" name="houseNumber" value={formData.houseNumber} onChange={handleInput} placeholder="House No." />
            </div>
            <div>
              <input className="modern-input" name="floorNumber" value={formData.floorNumber} onChange={handleInput} placeholder="Floor No." />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <input className="modern-input" name="blockName" value={formData.blockName} onChange={handleInput} placeholder="Block / Tower" />
          </div>

          <MinimalField label="Nearby Landmark (Optional)">
            <input className="modern-input" name="landmark" value={formData.landmark} onChange={handleInput} placeholder="e.g. Near Mother Dairy" />
          </MinimalField>

          <div style={{ marginTop: 12, paddingBottom: 20 }}>
            {isEditMode ? (
              <button
                className="control-btn"
                onClick={() => handleSave(true)}
                style={{ background: '#4ade80', color: '#000' }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            ) : (
              <button className="control-btn" onClick={nextSlide}>
                Continue to Map →
              </button>
            )}
          </div>
        </div>

        {/* Slide 1: Map & Draw */}
        <div className="wizard-slide">
          {/* Smart Header: Locate Logic - Search occurs in Slide 0 */}

          <h3>Trace Path to Gate</h3>
          <p className="muted">1. Tap dots along the road to your gate.<br />2. Click "Construct".</p>

          <div className="floating-mode-bar">
            {['walking', 'bike', 'car'].map(mode => (
              <div key={mode} className={`mode-icon ${currentMode === mode ? 'active' : ''}`} onClick={() => setCurrentMode(mode)}>
                <span style={{ fontSize: 20 }}>{mode === 'walking' ? '🚶' : mode === 'bike' ? '🚴' : '🚗'}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{mode.toUpperCase()}</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 15, fontWeight: 500 }}>
              {waypoints.length === 0 ? '👇 Tap on the road to start tracing' :
                waypoints.length === 1 ? '✅ Last Point = Gate. Add more path points if needed.' :
                  `${waypoints.length} path points placed.`}
            </div>

            {waypoints.length > 0 && (
              <button
                className="small-btn"
                style={{ margin: '0 auto', display: 'flex', gap: 6, alignItems: 'center' }}
                onClick={() => useStore.getState().setWaypoints(waypoints.slice(0, -1))}
              >
                ↩ Undo Last Point
              </button>
            )}
          </div>
        </div>

        {/* Slide 2: Verification */}
        <div className="wizard-slide">
          <h3>Gate Verification</h3>
          <p className="minimal-label">Confirm the gate view.</p>

          <div className="camera-box">
            {!formData.gateImage ? (
              activeSlide === 2 && (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  zoom={18}
                  center={waypoints.length > 0 ? waypoints[waypoints.length - 1] : defaultCenter}
                >
                  <StreetViewPanorama
                    position={waypoints.length > 0 ? waypoints[waypoints.length - 1] : defaultCenter}
                    visible={true}
                    options={{ disableDefaultUI: true, enableCloseButton: false }}
                    onLoad={pano => panoramaRef.current = pano}
                  />
                </GoogleMap>
              )
            ) : (
              <img src={formData.gateImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}

            <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12, zIndex: 10 }}>
              {!formData.gateImage && <button className="control-btn" style={{ width: 'auto', padding: '0 24px' }} onClick={handleSnap}>📸 Snap</button>}
              <label className="control-btn outline" style={{ width: 'auto', padding: '0 24px' }}>
                📂 Upload
                <input type="file" hidden onChange={handleFileUpload} accept="image/*" />
              </label>
            </div>
          </div>
          {formData.gateImage && (
            <div style={{ marginTop: 12 }}>
              <button
                className="control-btn"
                style={{ width: '100%', marginBottom: 8, background: '#4ade80', color: '#000' }}
                onClick={() => handleSave(false)}
              >
                {loading ? 'Creating...' : 'Confirm & Create Address'}
              </button>
              <button
                className="small-btn"
                style={{ width: '100%' }}
                onClick={() => setFormData(prev => ({ ...prev, gateImage: null }))}
              >
                Retake Photo
              </button>
            </div>
          )}
        </div>

        {/* Slide 3: Summary */}
        <div className="wizard-slide" style={{ overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h3>Address Created! 🎉</h3>
            <p className="muted">Your Miles code is ready.</p>
          </div>

          <div className="list-item" style={{ display: 'block', padding: 0, overflow: 'hidden', gap: 0 }}>
            <div className="summary-visual">
              {formData.gateImage && !formData.gateImage.includes('svg') ? (
                <img src={formData.gateImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  zoom={18}
                  center={waypoints.length > 0 ? waypoints[waypoints.length - 1] : defaultCenter}
                  options={{ disableDefaultUI: true }}
                >
                  <StreetViewPanorama
                    position={formData.gatePosition || (waypoints.length > 0 ? waypoints[waypoints.length - 1] : defaultCenter)}
                    visible={true}
                    options={{
                      disableDefaultUI: true,
                      clickToGo: false,
                      linksControl: false,
                      panControl: false,
                      enableCloseButton: false,
                      pov: formData.gatePov,
                      zoom: formData.gateZoom
                    }}
                  />
                </GoogleMap>
              )}

              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', color: 'white', padding: 20, zIndex: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>{formData.addressLabel || 'My Address'}</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>{formData.userName} • {formData.addressContext}</div>
              </div>
            </div>

            <div style={{ padding: 24, textAlign: 'center', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>Miles Code</div>
              <div style={{ fontSize: 40, fontWeight: '800', color: 'var(--accent-color)', letterSpacing: -1, margin: '8px 0' }}>{successCode || '...'}</div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                {formData.blockName ? `${formData.blockName}, ` : ''} {formData.floorNumber ? `${formData.floorNumber}, ` : ''} {formData.houseNumber}
              </div>

              {/* Route Guide */}
              {(() => {
                const dist = pathDistanceMeters(waypoints);
                const steps = Math.round(dist / 0.762);
                const mode = currentMode;
                let tMin = mode === 'walking' ? Math.round(dist / 83) : mode === 'bike' ? Math.round(dist / 250) : Math.round(dist / 500);
                if (tMin < 1) tMin = 1;

                const instr = mode === 'walking' ? `Reach ${startLocationName}, then Walk:`
                  : mode === 'bike' ? `Reach ${startLocationName}, then Bike:`
                    : `Drive via ${startLocationName} to Gate:`;

                return (
                  <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    padding: '16px',
                    borderRadius: '12px',
                    margin: '20px 0',
                    textAlign: 'left',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>{mode === 'walking' ? '🚶' : mode === 'bike' ? '🚴' : '🚗'}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8' }}>Route Stats</span>
                    </div>

                    <div style={{ fontSize: 13, marginBottom: 16, color: '#e2e8f0', lineHeight: 1.4 }}>{instr}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>{tMin}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Min</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>{Math.round(dist)}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Meters</div>
                      </div>
                      {mode === 'walking' && (
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#f472b6' }}>{steps}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Steps</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div style={{ height: 180, position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  zoom={18}
                  center={waypoints.length > 0 ? waypoints[waypoints.length - 1] : defaultCenter}
                  options={{ disableDefaultUI: true, mapTypeId: 'hybrid' }}
                >
                  {polylineSegments.map((seg, i) => (
                    <Polyline
                      key={i}
                      path={seg.points}
                      options={{
                        strokeColor:
                          seg.mode === 'bike' ? '#FFFF00' :
                            seg.mode === 'walking' ? '#00E5FF' :
                              '#4285F4',
                        strokeWeight: 4,
                        strokeOpacity: 1.0
                      }}
                    />
                  ))}
                  {waypoints.map((pt, i) => (
                    <Marker key={i} position={pt} icon={{ path: window.google?.maps?.SymbolPath?.CIRCLE, scale: 3, fillColor: 'white', fillOpacity: 1 }} />
                  ))}
                </GoogleMap>
                <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'white', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {polyline.length - 1} Steps
                </div>
              </div>
            </div>

            <div style={{ padding: 16 }}>
              <button className="control-btn outline" style={{ width: '100%' }} onClick={() => window.location.reload()}>
                Create Another
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Navigation Bars */}
      {activeSlide < 4 && (
        <div className="wizard-nav" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
          {activeSlide > 0 && activeSlide < 3 ? <button className="small-btn" onClick={prevSlide}>Back</button> : <div />}

          <div className="nav-dots">
            {[0, 1, 2, 3].map(i => <div key={i} className={`dot ${activeSlide === i ? 'active' : ''}`} />)}
          </div>

          {activeSlide === 1 && (
            <button
              className="control-btn"
              style={{ width: 'auto', padding: '0 32px' }}
              onClick={handleConstructRoute}
              disabled={(activeSlide === 1 && waypoints.length === 0)}
            >
              Construct Route
            </button>
          )}
          {activeSlide === 2 && (
            <button
              className="control-btn"
              style={{ width: 'auto', padding: '0 32px' }}
              onClick={handleSave}
              disabled={!formData.gateImage && !formData.gateVerified}
            >
              Finish
            </button>
          )}
        </div>
      )}

    </div>
  );
}
