const CryptoJS = require('crypto-js');

const getKey = () => {
  const key = process.env.ENCRYPTION_SECRET;
  if (!key || key.length < 16) {
    throw new Error('ENCRYPTION_SECRET must be at least 16 characters');
  }
  return key;
};

const encrypt = (value) => {
  if (!value) return '';
  const key = getKey();
  return CryptoJS.AES.encrypt(value, key).toString();
};

const decrypt = (cipher) => {
  if (!cipher) return '';
  const key = getKey();
  const bytes = CryptoJS.AES.decrypt(cipher, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

module.exports = { encrypt, decrypt };

