import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import { RequireAdmin, RequireAuth } from './components/RouteGuards';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import AccountPage from './pages/AccountPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/AdminOrders';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminSales from './pages/admin/AdminSales';
import AdminInventory from './pages/admin/AdminInventory';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ScrollToTop />
      <Header />
      <main id="main" className="main">
        <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:id" element={<AdminProductForm />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="sales" element={<AdminSales />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="in-store" element={<Navigate to="/admin?tab=in-store" replace />} />
            <Route path="promotions" element={<AdminPromotions />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
