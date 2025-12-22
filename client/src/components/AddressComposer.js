import React, { useState, useEffect } from 'react';
import { useStore } from '../useStore';
import { checkApartmentName, createResidence, requestOtp, verifyOtp, updateResidence, addResidenceProfile, getPincodeDetails } from '../api';

// --- Sub-components ---

const StepCard = ({ title, active, completed, onClick, children, stepNumber }) => (
  <div className={`step-card ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}>
    <div className="step-header" onClick={onClick}>
      <div className="step-indicator">
        {completed ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : stepNumber}
      </div>
      <div className="step-title">{title}</div>
    </div>
    {active && <div className="step-content">{children}</div>}
  </div>
);

const Field = ({ label, required, error, children }) => (
  <label className="form-field">
    <span>{label} {required && <span style={{ color: 'red' }}>*</span>}</span>
    {children}
    {error && <span className="field-error">{error}</span>}
  </label>
);

// --- Main Component ---

export default function AddressComposer({ initialData, onSaveSuccess }) {
  // Global Store
  const selectedRoadPoint = useStore((state) => state.selectedRoadPoint);
  const polyline = useStore((state) => state.polyline);
  const userLocation = useStore((state) => state.userLocation);
  const setPolyline = useStore((state) => state.setPolyline);
  const setSelectedRoadPoint = useStore((state) => state.setSelectedRoadPoint);

  // Local State
  // Steps: 
  // 1. Type
  // 2. Apartment Details (Only if Apt)
  // 3. Address Details
  // 4. Map & Media
  // 5. Verification
  const [activeStep, setActiveStep] = useState(initialData ? 3 : 1); // Skip to details if editing
  const [residenceType, setResidenceType] = useState(initialData?.residenceType || '');

  // Form Data
  const [formData, setFormData] = useState({
    apartmentName: initialData?.apartmentDetails?.name || '',
    block: initialData?.apartmentDetails?.block || '',
    floorNumber: initialData?.apartmentDetails?.floorNumber || '',
    totalFloors: initialData?.apartmentDetails?.totalFloors || '',
    entranceType: initialData?.apartmentDetails?.entranceType || '',

    houseNumber: initialData?.addressDetails?.houseNumber || '',
    area: initialData?.addressDetails?.area || '',
    landmark: initialData?.addressDetails?.landmark || '',
    pincode: initialData?.addressDetails?.pincode || '',
    city: initialData?.addressDetails?.city || '',
    state: initialData?.addressDetails?.state || '',
    tags: initialData?.addressDetails?.tags?.join(', ') || '',
    instructions: initialData?.addressDetails?.instructionsText || '',
    gateImage: initialData?.addressDetails?.gateImageUrl || null,
    audioInstruction: initialData?.addressDetails?.instructionsAudioUrl || null,

    userName: '', // Not needed for edit
    userPhone: '', // Not needed for edit
    otp: ''
  });

  // If editing, load map data
  useEffect(() => {
    if (initialData) {
      if (initialData.polylineOptimized) setPolyline(initialData.polylineOptimized);
      if (initialData.road_point) setSelectedRoadPoint(initialData.road_point);
    }
  }, [initialData, setPolyline, setSelectedRoadPoint]);

  // UI State
  const [apartmentSuggestions, setApartmentSuggestions] = useState([]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [otpReference, setOtpReference] = useState(null);

  // Add Member State
  const [addingMember, setAddingMember] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', phone: '', otp: '', relationship: '' });
  const [newMemberOtpSent, setNewMemberOtpSent] = useState(false);
  const [newMemberOtpVerified, setNewMemberOtpVerified] = useState(false);

  // Derived State
  const routeReady = selectedRoadPoint && polyline.length >= 2;

  // --- Handlers ---

  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      setFormData(prev => ({ ...prev, [name]: 'fake_url_' + files[0].name }));
    }
  };

  const handleApartmentSearch = async (e) => {
    const val = e.target.value;
    handleInput(e);
    if (val.length > 2) {
      try {
        const results = await checkApartmentName(val);
        setApartmentSuggestions(results);
      } catch (err) {
        console.error(err);
      }
    } else {
      setApartmentSuggestions([]);
    }
  };

  const selectApartment = (apt) => {
    setFormData(prev => ({
      ...prev,
      apartmentName: apt.apartmentDetails.name,
      area: apt.addressDetails?.area || prev.area,
      city: apt.addressDetails?.city || prev.city,
      state: apt.addressDetails?.state || prev.state
    }));
    setApartmentSuggestions([]);
  };

  const handlePincode = async (e) => {
    const val = e.target.value;
    handleInput(e);
    if (val.length === 6) {
      try {
        const data = await getPincodeDetails(val);
        if (data.city && data.state) {
          setFormData(prev => ({ ...prev, city: data.city, state: data.state }));
          setError('');
        } else {
          setError('Invalid Pincode');
          setFormData(prev => ({ ...prev, city: '', state: '' }));
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch pincode details');
        setFormData(prev => ({ ...prev, city: '', state: '' }));
      }
    }
  };

  // --- Validation Helpers ---

  const validateApartmentDetails = () => {
    if (!formData.apartmentName) return 'Apartment Name is required';
    if (!formData.floorNumber) return 'Floor Number is required';
    return null;
  };

  const validateAddressDetails = () => {
    if (!formData.pincode) return 'Pincode is required';
    if (!formData.city || !formData.state) return 'City/State required (check pincode)';
    if (!formData.houseNumber) return 'Flat/House No. is required';
    if (!formData.area) return 'Area/Colony is required';
    return null;
  };

  // --- Navigation ---

  const nextStep = () => {
    setError('');
    let err = null;

    if (activeStep === 2 && residenceType === 'apartment') {
      err = validateApartmentDetails();
    } else if (activeStep === 3) {
      err = validateAddressDetails();
    }

    if (err) {
      setError(err);
      return;
    }

    setActiveStep(prev => prev + 1);
  };

  // --- API Calls ---

  const handleSendOtp = async () => {
    if (!formData.userPhone || formData.userPhone.length < 10) {
      setError('Invalid phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      console.log('[DEBUG] Sending OTP to:', formData.userPhone);
      const res = await requestOtp(formData.userPhone);
      setOtpSent(true);
      setOtpReference(res.reference);
      alert(`[OTP DEBUGGER] SMS sent to ${formData.userPhone}. OTP is: ${res.otp}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!formData.otp) return;
    setLoading(true);
    setError('');
    try {
      console.log('[DEBUG] Verifying with reference:', otpReference);
      await verifyOtp(otpReference, formData.otp);
      setOtpVerified(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!initialData && !otpVerified) {
      setError('Please verify OTP first');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        type: residenceType,
        apartmentDetails: residenceType === 'apartment' ? {
          name: formData.apartmentName,
          block: formData.block,
          floorNumber: Number(formData.floorNumber),
          totalFloors: Number(formData.totalFloors),
          entranceType: formData.entranceType
        } : undefined,
        address: {
          houseNumber: formData.houseNumber,
          area: formData.area,
          landmark: formData.landmark,
          pincode: formData.pincode,
          city: formData.city,
          state: formData.state,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          instructionsText: formData.instructions,
          gateImageUrl: formData.gateImage,
          instructionsAudioUrl: formData.audioInstruction
        },
        // User data only for new creation
        user: !initialData ? {
          name: formData.userName,
          phone: formData.userPhone,
          verified: true
        } : undefined,
        polylineData: {
          polyline,
          road_point: selectedRoadPoint,
          destination_point: polyline[polyline.length - 1],
          source: userLocation
        }
      };

      if (initialData) {
        // Update Mode
        await updateResidence(initialData._id, payload);
        alert('Address Updated!');
        if (onSaveSuccess) onSaveSuccess();
      } else {
        // Create Mode
        const res = await createResidence(payload);
        setSuccessData({
          code: res.addressCode,
          household: res.household,
          addressId: res.addressId
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  // --- Add Member Handlers ---

  const handleNewMemberInput = (e) => {
    setNewMember({ ...newMember, [e.target.name]: e.target.value });
  };

  const handleNewMemberSendOtp = async () => {
    if (!newMember.phone || newMember.phone.length < 10) return;
    setLoading(true);
    try {
      const res = await requestOtp(newMember.phone);
      setNewMemberOtpSent(true);
      alert(`[OTP DEBUGGER] SMS sent to ${newMember.phone}. OTP is: ${res.otp}`);
    } catch (err) {
      alert('Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleNewMemberVerifyOtp = async () => {
    setLoading(true);
    try {
      await verifyOtp(newMember.phone, newMember.otp);
      setNewMemberOtpVerified(true);
    } catch (err) {
      alert('Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberOtpVerified) return;
    setLoading(true);
    try {
      const payload = {
        name: newMember.name,
        phone: newMember.phone,
        relationship: newMember.relationship,
        isPrimary: false
      };
      const res = await addResidenceProfile(successData.addressId, payload);
      // Update the successData with the new household data if returned, or just alert
      // Assuming res.household contains the updated household with masked data
      if (res.household) {
        setSuccessData(prev => ({ ...prev, household: res.household }));
      }
      alert('Member added successfully');
      setAddingMember(false);
      setNewMember({ name: '', phone: '', otp: '', relationship: '' });
      setNewMemberOtpSent(false);
      setNewMemberOtpVerified(false);
    } catch (err) {
      console.error(err);
      alert('Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  // --- Render ---

  if (successData) {
    return (
      <section className="panel card success-view">
        <div style={{ padding: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
            <h3>Smart Address Created!</h3>
            <div className="code-display" style={{
              fontSize: '24px',
              fontWeight: 'bold',
              margin: '20px 0',
              padding: '15px',
              background: '#e8f5e9',
              borderRadius: '8px',
              color: '#2e7d32'
            }}>
              {successData.code}
            </div>
          </div>

          <div className="house-profile">
            <h4>House Profile</h4>
            <div className="list">
              {/* Primary */}
              <div className="list-item">
                <div className="avatar">{successData.household.maskedDisplayData.primary.maskedName[0]}</div>
                <div style={{ flex: 1 }}>
                  <div><strong>{successData.household.maskedDisplayData.primary.maskedName}</strong> <span className="badge">Primary</span></div>
                  <div className="muted">{successData.household.maskedDisplayData.primary.maskedPhone}</div>
                </div>
                <div className="verified-badge">Verified</div>
              </div>

              {/* Members */}
              {successData.household.maskedDisplayData.members.map((u, i) => (
                <div key={i} className="list-item">
                  <div className="avatar">{u.maskedName[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div><strong>{u.maskedName}</strong> {u.relationship && <span className="muted">({u.relationship})</span>}</div>
                    <div className="muted">{u.maskedPhone}</div>
                  </div>
                  <div className="verified-badge">Verified</div>
                </div>
              ))}
            </div>

            {addingMember ? (
              <div className="add-member-form" style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                <h5>Add New Member</h5>
                <div className="form-grid">
                  <input name="name" placeholder="Name" value={newMember.name} onChange={handleNewMemberInput} />
                  <input name="relationship" placeholder="Relationship (e.g. Spouse)" value={newMember.relationship} onChange={handleNewMemberInput} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input name="phone" placeholder="Phone" value={newMember.phone} onChange={handleNewMemberInput} disabled={newMemberOtpVerified} />
                    {!newMemberOtpVerified && (
                      <button className="small-btn" onClick={handleNewMemberSendOtp} disabled={loading || newMemberOtpSent}>
                        {newMemberOtpSent ? 'Resend' : 'OTP'}
                      </button>
                    )}
                  </div>
                  {newMemberOtpSent && !newMemberOtpVerified && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input name="otp" placeholder="OTP" value={newMember.otp} onChange={handleNewMemberInput} maxLength={4} />
                      <button className="small-btn" onClick={handleNewMemberVerifyOtp}>Verify</button>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button className="control-btn" onClick={handleAddMember} disabled={!newMemberOtpVerified}>Add</button>
                  <button className="small-btn" onClick={() => setAddingMember(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="small-btn full-width" style={{ marginTop: 10 }} onClick={() => setAddingMember(true)}>
                + Add Another Member
              </button>
            )}
          </div>

          <div style={{ marginTop: 30, textAlign: 'center' }}>
            <button className="control-btn" onClick={() => window.location.reload()}>
              Create Another Address
            </button>
          </div>
        </div>
        <style>{`
          .house-profile { margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; }
          .avatar { width: 32px; height: 32px; background: #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 10px; }
          .verified-badge { font-size: 10px; background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px; }
          .badge { font-size: 10px; background: #e3f2fd; color: #1565c0; padding: 2px 4px; border-radius: 4px; margin-left: 5px; }
        `}</style>
      </section>
    );
  }

  return (
    <section className="panel card">
      <div className="panel-header">
        <h3>Create Smart Address</h3>
      </div>

      <div className="steps-container">
        {/* Step 1: Residence Type */}
        <StepCard
          title="1. Residence Type"
          active={activeStep === 1}
          completed={activeStep > 1}
          onClick={() => setActiveStep(1)}
          stepNumber={1}
        >
          <div className="type-selection">
            <button
              className={`type-card ${residenceType === 'villa' ? 'selected' : ''}`}
              onClick={() => { setResidenceType('villa'); setActiveStep(3); }}
            >
              <div className="icon-box">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <span>Villa / House</span>
            </button>
            <button
              className={`type-card ${residenceType === 'apartment' ? 'selected' : ''}`}
              onClick={() => { setResidenceType('apartment'); setActiveStep(2); }}
            >
              <div className="icon-box">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                  <line x1="9" y1="22" x2="9" y2="22.01"></line>
                  <line x1="15" y1="22" x2="15" y2="22.01"></line>
                  <line x1="12" y1="22" x2="12" y2="22.01"></line>
                  <line x1="12" y1="18" x2="12" y2="18.01"></line>
                  <line x1="9" y1="18" x2="9" y2="18.01"></line>
                  <line x1="15" y1="18" x2="15" y2="18.01"></line>
                  <line x1="12" y1="14" x2="12" y2="14.01"></line>
                  <line x1="9" y1="14" x2="9" y2="14.01"></line>
                  <line x1="15" y1="14" x2="15" y2="14.01"></line>
                  <line x1="12" y1="10" x2="12" y2="10.01"></line>
                  <line x1="9" y1="10" x2="9" y2="10.01"></line>
                  <line x1="15" y1="10" x2="15" y2="10.01"></line>
                  <line x1="12" y1="6" x2="12" y2="6.01"></line>
                  <line x1="9" y1="6" x2="9" y2="6.01"></line>
                  <line x1="15" y1="6" x2="15" y2="6.01"></line>
                </svg>
              </div>
              <span>Apartment</span>
            </button>
          </div>
        </StepCard>

        {/* Step 2: Apartment Details (Only for Apartment) */}
        {residenceType === 'apartment' && (
          <StepCard
            title="2. Apartment Details"
            active={activeStep === 2}
            completed={activeStep > 2}
            onClick={() => activeStep > 1 && setActiveStep(2)}
            stepNumber={2}
          >
            <div className="form-grid">
              <Field label="Apartment Name" required>
                <input
                  className="modern-input"
                  name="apartmentName"
                  value={formData.apartmentName}
                  onChange={handleApartmentSearch}
                  placeholder="Search apartment..."
                  autoComplete="off"
                />
                {apartmentSuggestions.length > 0 && (
                  <div className="suggestions-list">
                    {apartmentSuggestions.map((apt, i) => (
                      <div key={i} className="suggestion-item" onClick={() => selectApartment(apt)}>
                        {apt.apartmentDetails.name} <small>({apt.addressDetails?.city || 'Unknown'})</small>
                        {apt.source === 'places_api' && <span style={{ fontSize: '10px', float: 'right', color: '#999' }}>Places API</span>}
                      </div>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="Block / Tower">
                <input className="modern-input" name="block" value={formData.block} onChange={handleInput} placeholder="Block A" />
              </Field>
              <Field label="Floor No." required>
                <input className="modern-input" type="number" name="floorNumber" value={formData.floorNumber} onChange={handleInput} />
              </Field>
              <Field label="Total Floors">
                <input className="modern-input" type="number" name="totalFloors" value={formData.totalFloors} onChange={handleInput} />
              </Field>
              <Field label="Entrance Type">
                <select className="modern-input" name="entranceType" value={formData.entranceType} onChange={handleInput}>
                  <option value="">Select...</option>
                  <option value="Main Gate">Main Gate</option>
                  <option value="Side Entrance">Side Entrance</option>
                  <option value="Basement">Basement</option>
                  <option value="Lift Lobby">Lift Lobby</option>
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="control-btn" onClick={nextStep}>Next: Address</button>
            </div>
          </StepCard>
        )}

        {/* Step 3: Address Details (Common) */}
        <StepCard
          title={residenceType === 'apartment' ? "3. Address Details" : "2. Address Details"}
          active={activeStep === 3}
          completed={activeStep > 3}
          onClick={() => activeStep > 2 && setActiveStep(3)}
          stepNumber={residenceType === 'apartment' ? 3 : 2}
        >
          <div className="form-grid">
            <Field label="Pincode" required>
              <input className="modern-input" name="pincode" value={formData.pincode} onChange={handlePincode} maxLength={6} placeholder="110001" />
            </Field>
            <Field label="City" required>
              <input className="modern-input" name="city" value={formData.city} readOnly placeholder="Auto-filled" />
            </Field>
            <Field label="State" required>
              <input className="modern-input" name="state" value={formData.state} readOnly placeholder="Auto-filled" />
            </Field>
            <Field label={residenceType === 'villa' ? "House No." : "Flat No."} required>
              <input className="modern-input" name="houseNumber" value={formData.houseNumber} onChange={handleInput} placeholder="#" />
            </Field>
            <Field label="Area / Colony" required>
              <input className="modern-input" name="area" value={formData.area} onChange={handleInput} placeholder="Sector 4" />
            </Field>
            <Field label="Landmark">
              <input className="modern-input" name="landmark" value={formData.landmark} onChange={handleInput} />
            </Field>
            <Field label="Tags">
              <input className="modern-input" name="tags" value={formData.tags} onChange={handleInput} placeholder="e.g. Green Gate" />
            </Field>
            <Field label="Instructions">
              <input className="modern-input" name="instructions" value={formData.instructions} onChange={handleInput} placeholder="Leave at door" />
            </Field>
          </div>

          <div className="form-grid" style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 10 }}>
            <Field label="Gate Image (For Delivery)">
              <label className="upload-box">
                {formData.gateImage ? 'Image Selected' : 'Tap to upload Gate Image'}
                <input type="file" name="gateImage" onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
              </label>
            </Field>
            <Field label="Audio Instructions">
              <label className="upload-box">
                {formData.audioInstruction ? 'Audio Selected' : 'Tap to upload Audio'}
                <input type="file" name="audioInstruction" onChange={handleFileChange} accept="audio/*" style={{ display: 'none' }} />
              </label>
            </Field>
          </div>

          {error && <div className="alert danger" style={{ marginTop: 10 }}>{error}</div>}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button className="control-btn" onClick={nextStep}>Next: Map & Route</button>
          </div>
        </StepCard>

        {/* Step 4: Map & Route */}
        <StepCard
          title={residenceType === 'apartment' ? "4. Smart Route" : "3. Smart Route"}
          active={activeStep === 4}
          completed={activeStep > 4}
          onClick={() => activeStep > 3 && setActiveStep(4)}
          stepNumber={residenceType === 'apartment' ? 4 : 3}
        >
          <div className="route-instructions">
            <p>1. Tap on the road to set the vehicle drop-off point.</p>
            <p>2. Draw the path to your doorstep.</p>
          </div>

          <div className="route-summary" style={{ margin: '10px 0' }}>
            <div><strong>Road Point:</strong> {selectedRoadPoint ? 'Set ✅' : 'Not set'}</div>
            <div><strong>Path:</strong> {polyline.length > 1 ? `${polyline.length} points` : 'Not drawn'}</div>
          </div>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button
              className="control-btn"
              disabled={!routeReady}
              onClick={() => setActiveStep(5)}
            >
              Next: Verification
            </button>
          </div>
        </StepCard>

        {/* Step 5: Verification (Only for New Creation) */}
        {!initialData && (
          <StepCard
            title={residenceType === 'apartment' ? "5. Verification" : "4. Verification"}
            active={activeStep === 5}
            completed={false}
            onClick={() => activeStep > 4 && setActiveStep(5)}
            stepNumber={residenceType === 'apartment' ? 5 : 4}
          >
            <div className="form-grid">
              <Field label="Your Name">
                <input className="modern-input" name="userName" value={formData.userName} onChange={handleInput} placeholder="John Doe" />
              </Field>
              <Field label="Phone Number">
                <div className="input-with-button">
                  <input
                    className="modern-input"
                    name="userPhone"
                    value={formData.userPhone}
                    onChange={handleInput}
                    placeholder="9876543210"
                    disabled={otpVerified}
                  />
                  {!otpVerified && (
                    <button className="otp-btn" onClick={handleSendOtp} disabled={loading}>
                      {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  )}
                  {otpVerified && <span style={{ position: 'absolute', right: 10, color: 'green' }}>✅</span>}
                </div>
              </Field>

              {otpSent && !otpVerified && (
                <Field label="Enter OTP">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="modern-input"
                      name="otp"
                      value={formData.otp}
                      onChange={handleInput}
                      placeholder="1234"
                      maxLength={4}
                    />
                    <button className="small-btn" onClick={handleVerifyOtp} disabled={loading}>
                      Verify
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: 4 }}>
                    * Check screen for OTP alert (Mock Mode)
                  </div>
                </Field>
              )}
            </div>

            {error && <div className="alert danger" style={{ marginTop: 10 }}>{error}</div>}

            <div style={{ marginTop: 20 }}>
              <button
                className="control-btn full-width"
                disabled={!otpVerified || loading}
                onClick={handleSave}
              >
                {loading ? 'Saving...' : 'Save Smart Address'}
              </button>
            </div>
          </StepCard>
        )}

        {/* Save Button for Edit Mode */}
        {initialData && activeStep === 4 && (
          <div style={{ marginTop: 20 }}>
            <button className="control-btn full-width" onClick={handleSave} disabled={loading}>
              Update Address
            </button>
          </div>
        )}
      </div>

      <style>{`
        .suggestions-list {
          position: absolute;
          background: white;
          border: 1px solid #ddd;
          width: 100%;
          z-index: 10;
          max-height: 200px;
          overflow-y: auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .suggestion-item {
          padding: 8px 12px;
          cursor: pointer;
        }
        .suggestion-item:hover {
          background: #f5f5f5;
        }
        .control-btn.full-width {
          width: 100%;
          padding: 12px;
          font-size: 16px;
        }
        .house-profile { margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; }
        .avatar { width: 32px; height: 32px; background: #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 10px; }
        .verified-badge { font-size: 10px; background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px; }
        .badge { font-size: 10px; background: #e3f2fd; color: #1565c0; padding: 2px 4px; border-radius: 4px; margin-left: 5px; }
      `}</style>
    </section>
  );
}
