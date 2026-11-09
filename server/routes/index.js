const express = require('express');
const Subscriber = require('../models/Subscriber');
const AppError = require('../utils/AppError');
const { EMAIL_RE, str } = require('../utils/validators');
const { protect, optionalAuth, protectAdmin } = require('../middleware/auth');
const { authLimiter, checkoutLimiter, resetLimiter } = require('../middleware/rateLimit');
const { uploadImage } = require('../middleware/upload');
const auth = require('../controllers/authController');
const account = require('../controllers/accountController');
const catalog = require('../controllers/catalogController');
const checkout = require('../controllers/checkoutController');
const admin = require('../controllers/adminController');
const salesInventory = require('../controllers/salesInventoryController');

const router = express.Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.get('/config', checkout.publicConfig);

// Auth
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.post('/auth/admin-login', authLimiter, auth.adminLogin);
router.post('/auth/admin-logout', auth.adminLogout);
router.post('/auth/logout', auth.logout);
router.post('/auth/forgot-password', resetLimiter, auth.forgotPassword);
router.post('/auth/reset-password', authLimiter, auth.resetPassword);
router.get('/auth/me', optionalAuth, auth.me);

// Customer account
router.put('/account/profile', protect, account.updateProfile);
router.post('/account/addresses', protect, account.addAddress);
router.put('/account/addresses/:id', protect, account.updateAddress);
router.delete('/account/addresses/:id', protect, account.deleteAddress);
router.get('/account/orders', protect, account.myOrders);
router.get('/account/orders/:id', protect, account.myOrder);

// Catalogue
router.get('/products', catalog.listProducts);
router.get('/products/:slug', catalog.getProduct);
router.get('/categories', catalog.listCategories);
router.post('/cart/validate', catalog.validateCart);

// Checkout
router.post('/checkout/quote', checkout.quote);
router.post('/checkout/session', checkoutLimiter, optionalAuth, checkout.createSession);
router.get('/checkout/session/:sessionId', checkout.getSessionOrder);
router.post('/checkout/cancel', checkout.cancelSession);

// Newsletter
router.post('/newsletter', async (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new AppError('Please enter a valid email address.', 422, { email: 'Invalid email' });
  await Subscriber.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true });
  res.status(201).json({ message: 'Thanks for subscribing! Watch your inbox for weekly deals.' });
});

// Admin (every route requires an authenticated admin)
const adminRouter = express.Router();
adminRouter.use(protectAdmin);
adminRouter.get('/stats', admin.stats);
adminRouter.get('/products', admin.listProducts);
adminRouter.get('/products/:id', admin.getProduct);
adminRouter.post('/products', admin.createProduct);
adminRouter.put('/products/:id', admin.updateProduct);
adminRouter.patch('/products/:id/inventory', admin.updateInventory);
adminRouter.delete('/products/:id', admin.deleteProduct);
adminRouter.post('/uploads', uploadImage, admin.uploadImage);
adminRouter.post('/categories', admin.createCategory);
adminRouter.put('/categories/:id', admin.updateCategory);
adminRouter.delete('/categories/:id', admin.deleteCategory);
adminRouter.get('/orders', admin.listOrders);
adminRouter.post('/orders/delete', salesInventory.deleteMany);
adminRouter.get('/orders/:id', admin.getOrder);
adminRouter.patch('/orders/:id/status', admin.updateOrderStatus);
adminRouter.post('/orders/:id/returns', admin.recordReturn);
adminRouter.delete('/orders/:id', salesInventory.deleteOne);
adminRouter.get('/sales', salesInventory.sales);
adminRouter.get('/inventory', salesInventory.inventory);
adminRouter.post('/inventory/adjust', salesInventory.adjust);
adminRouter.get('/inventory/history', salesInventory.history);
adminRouter.get('/email', salesInventory.emailSettings);
adminRouter.post('/email/test', salesInventory.emailTest);
adminRouter.get('/promotions', admin.listPromotions);
adminRouter.post('/promotions', admin.createPromotion);
adminRouter.put('/promotions/:id', admin.updatePromotion);
adminRouter.delete('/promotions/:id', admin.deletePromotion);
router.use('/admin', adminRouter);

module.exports = router;
