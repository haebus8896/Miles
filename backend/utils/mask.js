const maskName = (value = '') => {
  if (!value) return '';
  const parts = value.split(' ').filter(Boolean);
  return parts
    .map((part, idx) => {
      if (part.length <= 2) {
        return part[0] + '*';
      }
      const visible = idx === 0 ? 2 : 1;
      const hiddenCount = Math.max(part.length - (visible + 1), 1);
      return part.slice(0, visible) + 'x'.repeat(hiddenCount) + part.slice(-1);
    })
    .join(' ');
};

const maskPhone = (phone = '') => {
  if (!phone) return '';
  return phone
    .split('')
    .map((digit, idx) => (idx < 2 || idx >= phone.length - 2 ? digit : 'x'))
    .join('');
};

module.exports = { maskName, maskPhone };

