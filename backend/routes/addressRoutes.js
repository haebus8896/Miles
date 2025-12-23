const express = require('express');
const router = express.Router();
const controller = require('../controllers/addressController');
const { validateBody, validateQuery, validateParams } = require('../middlewares/validateRequest');
const {
  createAddressSchema,
  updateAddressSchema,
  proximityQuerySchema,
  duplicateQuerySchema,
  codeParamSchema,
  idParamSchema
} = require('../validators/addressValidators');

router.post('/', validateBody(createAddressSchema), controller.createAddress);
router.patch('/:id', validateParams(idParamSchema), validateBody(updateAddressSchema), controller.updateAddress);
router.get('/nearby', validateQuery(proximityQuerySchema), controller.getNearby);
router.get('/check-duplicate', validateQuery(duplicateQuerySchema), controller.checkDuplicate);
router.get('/code/:codeOrId', validateParams(codeParamSchema), controller.getAddressByCode);
router.get('/:codeOrId', validateParams(codeParamSchema), controller.getAddressByCode);

module.exports = router;
