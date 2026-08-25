import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ROUTER_BASE, HOME_URL } from '@/lib/config'
import { FrappeProvider } from '@/lib/frappe'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import DemoBadge from './components/DemoBadge'
import FloatingActions from './components/FloatingActions'
import Home from './app/page'
import Shop from './app/shop/page'
import Cart from './app/cart/page'
import Login from './app/login/page'
import Signup from './app/signup/page'
import Account from './app/account/page'
import Wishlist from './app/wishlist/page'
import About from './app/about/page'
import Checkout from './app/checkout/page'
import Payment from './app/payment/page'
import OrderSuccess from './app/order-success/page'
import Product from './app/product/[id]/page'
import Admin from './app/admin/page'

// Empty string = same origin (works in Frappe context and with Vite proxy in dev)
const FRAPPE_URL = (import.meta.env.VITE_FRAPPE_URL as string) || ''

export default function App() {
  return (
    <FrappeProvider url={FRAPPE_URL} enableSocket={false}>
    <BrowserRouter basename={ROUTER_BASE}>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/account" element={<Account />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/about" element={<About />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={
            <div style={{ textAlign: 'center', padding: '120px 24px 80px', minHeight: '60vh' }}>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '48px', fontWeight: 400, color: '#005969', marginBottom: '16px' }}>Page Not Found</h1>
              <p style={{ fontSize: '15px', color: '#737373', marginBottom: '32px' }}>The page you are looking for does not exist or has been moved.</p>
              <a href={HOME_URL} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 32px', background: '#005969', color: '#fff', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' as any, letterSpacing: '0.1em', textDecoration: 'none' }}>Back to Home</a>
            </div>
          } />
        </Routes>
      </main>
      <Footer />
      <FloatingActions />
      <DemoBadge />
    </BrowserRouter>
    </FrappeProvider>
  )
}
