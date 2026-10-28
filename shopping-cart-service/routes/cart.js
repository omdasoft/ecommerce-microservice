const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authenticate = require('../middleware/authenticate');

router.get('/', authenticate, cartController.CartList);
router.post('/', authenticate, cartController.CartStore);
router.delete('/:id', authenticate, cartController.DeleteItem);
router.put('/:id', authenticate, cartController.UpdateQuantity);

module.exports = router;