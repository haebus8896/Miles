import React, { useEffect, useState } from 'react';
import { useStore } from '../useStore';
import { requestOtp, addProfile, getProfiles } from '../api';

export default function ProfilePanel() {
  const savedAddress = useStore((state) => state.savedAddress);
  const profileForm = useStore((state) => state.profileForm);
  const setProfileField = useStore((state) => state.setProfileField);
  const resetProfileForm = useStore((state) => state.resetProfileForm);
  const profiles = useStore((state) => state.profiles);
  const setProfiles = useStore((state) => state.setProfiles);
  const otpCountdown = useStore((state) => state.otpCountdown);
  const setOtpCountdown = useStore((state) => state.setOtpCountdown);

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [debugOtp, setDebugOtp] = useState('');

  useEffect(() => {
    if (!savedAddress) return;
    (async () => {
      try {
        const list = await getProfiles(savedAddress.id);
        setProfiles(list);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [savedAddress, setProfiles]);

  useEffect(() => {
    if (!otpCountdown) return undefined;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown, setOtpCountdown]);

  const handleRequestOtp = async () => {
    setError('');
    setStatus('');
    setDebugOtp('');
    if (!profileForm.phone) {
      setError('Enter phone number before requesting OTP.');
      return;
    }
    try {
      const payload = await requestOtp(profileForm.phone);
      setProfileField('otp_reference', payload.reference);
      setOtpCountdown(45);
      setDebugOtp(payload.otp); // dev build only
      setStatus('OTP sent (debug value shown below for quick testing).');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to send OTP');
    }
  };

  const handleSaveProfile = async () => {
    if (!savedAddress) {
      setError('Save a smart address before adding profiles.');
      return;
    }
    if (!profileForm.otp_reference || !profileForm.otp_code) {
      setError('OTP verification is required.');
      return;
    }
    try {
      await addProfile(savedAddress.id, profileForm);
      const list = await getProfiles(savedAddress.id);
      setProfiles(list);
      resetProfileForm();
      setStatus('Profile added successfully.');
      setDebugOtp('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Unable to add profile');
    }
  };

  const disabled = !savedAddress;

  return (
    <section className="panel card">
      <div className="panel-header">
        <div>
          <h3>Household Profiles</h3>
          <p>Add multiple residents under the same Smart Address.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Full name</span>
          <input name="full_name" value={profileForm.full_name} onChange={(e) => setProfileField('full_name', e.target.value)} disabled={disabled} />
        </label>
        <label className="form-field">
          <span>Phone</span>
          <input name="phone" value={profileForm.phone} onChange={(e) => setProfileField('phone', e.target.value)} disabled={disabled} />
        </label>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Relation</span>
          <input name="relation" value={profileForm.relation} onChange={(e) => setProfileField('relation', e.target.value)} disabled={disabled} />
        </label>
        <label className="form-field">
          <span>OTP</span>
          <input name="otp_code" value={profileForm.otp_code} onChange={(e) => setProfileField('otp_code', e.target.value)} disabled={disabled} placeholder="123456" />
        </label>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>OTP Reference</span>
          <input name="otp_reference" value={profileForm.otp_reference} readOnly disabled />
        </label>
        <div className="actions-row">
          <button className="small-btn" onClick={handleRequestOtp} disabled={disabled || otpCountdown > 0}>
            {otpCountdown > 0 ? `Wait ${otpCountdown}s` : 'Request OTP'}
          </button>
          <button className="control-btn" onClick={handleSaveProfile} disabled={disabled}>
            Save Profile
          </button>
        </div>
      </div>

      {debugOtp && <div className="alert info">Debug OTP: {debugOtp}</div>}
      {status && <div className="alert success">{status}</div>}
      {error && <div className="alert danger">{error}</div>}

      <div className="panel-subsection">
        <h4>Saved profiles ({profiles.length})</h4>
        {profiles.length === 0 && <p className="muted">No profiles yet.</p>}
        <div className="list">
          {profiles.map((profile) => (
            <div key={profile.id} className="list-item">
              <div>
                <strong>{profile.name_masked}</strong>
                <div className="muted">{profile.phone_masked}</div>
              </div>
              <span className="badge neutral">{profile.relation}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

