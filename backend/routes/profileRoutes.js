const express = require('express');
const router = express.Router();
const controller = require('../controllers/profileController');
const { validateBody, validateParams } = require('../middlewares/validateRequest');
const { profileBodySchema, addressParamSchema } = require('../validators/profileValidators');

router.get('/:addressId', validateParams(addressParamSchema), controller.getProfiles);
router.post('/:addressId', validateParams(addressParamSchema), validateBody(profileBodySchema), controller.addProfile);

module.exports = router;

