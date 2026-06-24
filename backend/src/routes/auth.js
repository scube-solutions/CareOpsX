const express    = require('express');
const router     = express.Router();
const { verifyToken } = require('../middlewares/auth');
const { register, login, logout, forgotPassword, resetPassword, resetPasswordWithOtp, changePassword, adminRegister, sendOtp, verifyOtp, getInvite, activateInvite } = require('../controllers/authController');

router.post('/register',        register);
router.post('/admin-register',  adminRegister);
router.post('/login',           login);
router.post('/logout',          verifyToken, logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);
router.post('/reset-password-otp', resetPasswordWithOtp);
router.post('/change-password', verifyToken, changePassword);
router.post('/send-otp',        sendOtp);
router.post('/verify-otp',      verifyOtp);
router.get('/invite/:token',    getInvite);
router.post('/activate-invite', activateInvite);

module.exports = router;