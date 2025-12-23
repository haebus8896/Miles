const express = require('express');
const router = express.Router();
const { createAddress, getAddresses, getAddressByCode } = require('./addressController');

router.post('/', createAddress);
router.get('/', getAddresses);
router.get('/:code', getAddressByCode);

module.exports = router;
