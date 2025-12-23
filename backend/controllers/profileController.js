const { verifyOtp } = require('../services/otpService');
const { createProfile, listProfiles } = require('../services/profileService');

const serializeProfile = (profile) => ({
  id: profile._id,
  name_masked: profile.name_masked,
  phone_masked: profile.phone_masked,
  relation: profile.relation,
  is_default: profile.is_default,
  verifiedAt: profile.verifiedAt
});

exports.addProfile = async (req, res) => {
  const { addressId } = req.params;
  const { full_name, phone, relation, is_default = false, otp_reference, otp_code } = req.body;

  const { phone: verifiedPhone } = await verifyOtp(otp_reference, otp_code);
  if (verifiedPhone !== phone) {
    return res.status(400).json({ error: 'Phone number mismatch for OTP' });
  }
  const profile = await createProfile(addressId, {
    fullName: full_name,
    phone,
    relation,
    isDefault: is_default,
    otpReference: otp_reference
  });

  res.status(201).json({ profile: serializeProfile(profile) });
};

exports.getProfiles = async (req, res) => {
  const { addressId } = req.params;
  const profiles = await listProfiles(addressId);
  res.json({ results: profiles.map(serializeProfile) });
};

