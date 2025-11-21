const { customAlphabet } = require('nanoid');

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nanoid = customAlphabet(alphabet, 6);

const buildAddressCode = () => `SLMD-${nanoid()}`;

module.exports = { buildAddressCode };

