const Profile = require('../models/Profile');
const Address = require('../models/Address');
const { maskName, maskPhone } = require('../utils/mask');
const { encrypt } = require('../utils/encryption');

async function createProfile(addressId, { fullName, phone, relation = 'primary', isDefault = false, otpReference }) {
  const address = await Address.findById(addressId);
  if (!address) {
    throw new Error('Address not found');
  }

  if (isDefault) {
    await Profile.updateMany({ address: addressId }, { is_default: false });
  }

  const profile = await Profile.create({
    address: addressId,
    name_masked: maskName(fullName),
    phone_masked: maskPhone(phone),
    name_encrypted: encrypt(fullName),
    phone_encrypted: encrypt(phone),
    relation,
    otp_reference: otpReference,
    is_default: isDefault,
    verifiedAt: new Date()
  });

  if (!address.owner_phone_encrypted) {
    address.owner_phone_encrypted = encrypt(phone);
    address.owner_phone_masked = maskPhone(phone);
    address.owner_name_encrypted = encrypt(fullName);
    address.owner_name_masked = maskName(fullName);
    await address.save();
  }

  return profile;
}

async function listProfiles(addressId) {
  return Profile.find({ address: addressId }).sort({ createdAt: -1 });
}

module.exports = {
  createProfile,
  listProfiles
};

