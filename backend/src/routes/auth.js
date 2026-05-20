const express    = require('express');
const router     = express.Router();
const { verifyToken } = require('../middlewares/auth');
const { register, login, forgotPassword, resetPassword, changePassword, adminRegister } = require('../controllers/authController');

router.post('/register',        register);
router.post('/admin-register',  adminRegister);
router.post('/login',           login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);
router.post('/change-password', verifyToken, changePassword);

module.exports = router;