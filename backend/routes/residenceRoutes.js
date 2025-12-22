const express = require('express');
const router = express.Router();
const controller = require('../controllers/residenceController');

router.post('/check-apartment-name', controller.checkApartmentName);
router.get('/pincode/:pincode', controller.getPincodeDetails);
router.post('/create', controller.createResidence);
router.post('/:id/profiles', controller.addProfile);
router.get('/code/:code', controller.getResidenceByCode);
router.post('/:id/edit-otp', controller.sendEditOtp);
router.post('/:id/verify-edit', controller.verifyEditOtp);
router.put('/:id', controller.updateResidence);

module.exports = router;
