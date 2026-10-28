import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ROUTER_BASE, HOME_URL } from '@/lib/config'
import { FrappeProvider } from '@/lib/frappe'
import { Seo } from '@/lib/seo'
import Navbar from './components/Navbar'
import ScrollToTop from './components/ScrollToTop'
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
import Help from './app/help/page'
import Checkout from './app/checkout/page'
import Payment from './app/payment/page'
import OrderSuccess from './app/order-success/page'
import Product from './app/product/[id]/page'
import UpdatePassword from './app/update-password/page'

// The admin panel is the single largest thing in the app and no shopper ever
// opens it, so it is fetched only when /admin is visited rather than riding
// along in the bundle every customer downloads.
const Admin = lazy(() => import('./app/admin/page'))

// Empty string = same origin (works in Frappe context and with Vite proxy in dev)
const FRAPPE_URL = (import.meta.env.VITE_FRAPPE_URL as string) || ''

export default function App() {
  return (
    <FrappeProvider url={FRAPPE_URL} enableSocket={false}>
    <BrowserRouter basename={ROUTER_BASE}>
      <ScrollToTop />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<><Seo path="/" /><Home /></>} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/cart" element={<><Seo title="Your Cart" noindex /><Cart /></>} />
          <Route path="/login" element={<><Seo title="Sign In" noindex /><Login /></>} />
          <Route path="/signup" element={<><Seo title="Create an Account" noindex /><Signup /></>} />
          <Route path="/account" element={<><Seo title="My Account" noindex /><Account /></>} />
          <Route path="/wishlist" element={<><Seo title="Wishlist" noindex /><Wishlist /></>} />
          <Route path="/about" element={<><Seo title="Our Story" description="The Hira Store began in 2023 as a passion project: handcrafted, ethically sourced silver and fine jewelry made to be worn every day, not saved for special occasions." path="/about" /><About /></>} />
          <Route path="/help" element={<><Seo title="Shipping, Returns & Size Guide" description="Shipping costs and times, our returns policy, and ring, necklace and bangle size charts — everything to know before and after you order from The Hira Store." path="/help" /><Help /></>} />
          <Route path="/checkout" element={<><Seo title="Checkout" noindex /><Checkout /></>} />
          <Route path="/payment" element={<><Seo title="Payment" noindex /><Payment /></>} />
          <Route path="/order-success" element={<><Seo title="Order Confirmed" noindex /><OrderSuccess /></>} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/update-password" element={<><Seo title="Choose a Password" noindex /><UpdatePassword /></>} />
          <Route path="/admin" element={<><Seo title="Admin" noindex />
            <Suspense fallback={
              <div style={{ textAlign: 'center', padding: '120px 24px', minHeight: '60vh', color: '#737373', fontSize: '14px' }}>
                Loading the admin panel…
              </div>
            }>
              <Admin />
            </Suspense></>
          } />
          <Route path="*" element={<><Seo title="Page Not Found" noindex />
            <div style={{ textAlign: 'center', padding: '120px 24px 80px', minHeight: '60vh' }}>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '48px', fontWeight: 400, color: '#005969', marginBottom: '16px' }}>Page Not Found</h1>
              <p style={{ fontSize: '15px', color: '#737373', marginBottom: '32px' }}>The page you are looking for does not exist or has been moved.</p>
              <a href={HOME_URL} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 32px', background: '#005969', color: '#fff', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' as any, letterSpacing: '0.1em', textDecoration: 'none' }}>Back to Home</a>
            </div></>
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
