import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { whatsappLink } from '@/lib/contact';

function readSocialLinks() {
  return {
    instagram: localStorage.getItem('hs_sm_instagram') || '',
    facebook:  localStorage.getItem('hs_sm_facebook')  || '',
    pinterest: localStorage.getItem('hs_sm_pinterest') || '',
    tiktok:    localStorage.getItem('hs_sm_tiktok')    || '',
    // Falls back to the store's own line so the icon isn't missing by default.
    whatsapp:  whatsappLink(),
  };
}

export default function Footer() {
  const [social, setSocial] = useState(readSocialLinks);
  const [nlEmail, setNlEmail] = useState('');
  const [nlMsg, setNlMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const handler = () => setSocial(readSocialLinks());
    window.addEventListener('hs_social_updated', handler);
    return () => window.removeEventListener('hs_social_updated', handler);
  }, []);

  function handleNewsletter(e: React.FormEvent) {
    e.preventDefault();
    setNlMsg(null);
    const email = nlEmail.trim();
    if (!/.+@.+\..+/.test(email)) {
      setNlMsg({ ok: false, text: 'Please enter a valid email.' });
      return;
    }
    try {
      const key = 'hs_newsletter_subscribers';
      const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!list.includes(email)) {
        list.push(email);
        localStorage.setItem(key, JSON.stringify(list));
      }
      setNlMsg({ ok: true, text: 'Thanks! You\'re on the list.' });
      setNlEmail('');
    } catch {
      setNlMsg({ ok: false, text: 'Could not subscribe. Please try again later.' });
    }
  }

  return (
    <footer>
      <div className="footer-grid">
        <div className="footer-brand">
          <img src={`${import.meta.env.BASE_URL}site-images/hira-logo.png`} alt="The Hira Store" />
          <p className="footer-text">Handcrafted fine jewelry designed for every day. Each piece tells a story of elegance and artistry.</p>
          <div className="footer-social">
            {social.instagram && <a href={social.instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg></a>}
            {social.facebook && <a href={social.facebook} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>}
            {social.pinterest && <a href={social.pinterest} aria-label="Pinterest" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.18-.77 1.24-5.24 1.24-5.24s-.32-.63-.32-1.57c0-1.47.85-2.57 1.91-2.57.9 0 1.34.68 1.34 1.49 0 .91-.58 2.27-.88 3.53-.25 1.05.52 1.91 1.56 1.91 1.87 0 3.13-2.4 3.13-5.23 0-2.16-1.46-3.67-3.55-3.67-2.42 0-3.84 1.82-3.84 3.7 0 .73.28 1.52.63 1.94.07.08.08.16.06.24l-.24.96c-.04.15-.12.18-.28.11-1.04-.48-1.69-2-1.69-3.22 0-2.62 1.9-5.02 5.48-5.02 2.88 0 5.12 2.05 5.12 4.79 0 2.86-1.8 5.16-4.3 5.16-.84 0-1.63-.44-1.9-.95l-.52 1.93c-.19.71-.69 1.61-1.03 2.15.78.24 1.6.37 2.45.37 5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg></a>}
            {social.tiktok && <a href={social.tiktok} aria-label="TikTok" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.85 4.85 0 01-1.01-.04z"/></svg></a>}
            {social.whatsapp && <a href={social.whatsapp} aria-label="WhatsApp" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg></a>}
          </div>
          <div className="footer-contact-info">
            <div className="footer-contact-item">
              <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>San Jose, CA</span>
            </div>
            <div className="footer-contact-item">
              <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <a href="mailto:info@Thehirastore.com">info@Thehirastore.com</a>
            </div>
          </div>
        </div>

        <div className="footer-col">
          <h4>Shop</h4>
          <ul>
            <li><Link to="/shop">All Jewelry</Link></li>
            <li><Link to="/shop?cat=Necklaces">Necklaces</Link></li>
            <li><Link to="/shop?cat=Earrings">Earrings</Link></li>
            <li><Link to="/shop?cat=Rings">Rings</Link></li>
            <li><Link to="/shop?cat=Bracelets">Bracelets</Link></li>
            <li><Link to="/shop?cat=Sets">Gift Sets</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Help</h4>
          <ul>
            <li><Link to="/about">Our Story</Link></li>
            <li><Link to="/account">My Account</Link></li>
            <li><Link to="/about#shipping">Shipping Info</Link></li>
            <li><Link to="/about#returns">Returns</Link></li>
            <li><Link to="/about#size-guide">Size Guide</Link></li>
            <li><a href="mailto:info@Thehirastore.com">Contact Us</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Stay in Touch</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
            Subscribe for exclusive offers, new arrivals and jewelry care tips.
          </p>
          <form className="newsletter-form" onSubmit={handleNewsletter}>
            <input type="email" placeholder="your@email.com" value={nlEmail} onChange={e => setNlEmail(e.target.value)} required />
            <button type="submit">Subscribe</button>
          </form>
          {nlMsg && (
            <div style={{ fontSize: 12, marginTop: 8, color: nlMsg.ok ? '#16a34a' : '#dc2626' }}>{nlMsg.text}</div>
          )}
        </div>
      </div>

      <div className="footer-bottom" style={{ maxWidth: '1300px', margin: '0 auto', marginTop: '60px' }}>
        <span>© {new Date().getFullYear()} The Hira Store. All rights reserved.</span>
        <span>Handcrafted with <svg viewBox="0 0 24 24" width="12" height="12" fill="#e11d48" stroke="none" style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></span>
      </div>

      <style>{`
        footer { background: #effcff; color: var(--text-main); padding: 80px 40px 40px; border-top: 1px solid var(--border); }
        .footer-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1.5fr; gap: 60px; max-width: 1300px; margin: 0 auto; }
        .footer-brand img { height: 62px; margin-bottom: 24px; filter: contrast(1.2); }
        .footer-text { font-size: 13px; color: var(--text-light); line-height: 1.6; margin-bottom: 24px; max-width: 300px; }
        .footer-social { display: flex; gap: 16px; }
        .footer-social a { color: var(--text-main); transition: color 0.3s; }
        .footer-social a:hover { color: var(--accent-gold); }
        .footer-social svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.5; }
        .footer-contact-info { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
        .footer-contact-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-light); }
        .footer-contact-item svg { width: 14px; height: 14px; fill: none; stroke: var(--text-light); stroke-width: 1.8; flex-shrink: 0; }
        .footer-contact-item a { color: var(--text-light); transition: color 0.3s; }
        .footer-contact-item a:hover { color: var(--accent-gold); }
        .footer-col h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 600; margin-bottom: 20px; }
        .footer-col ul { list-style: none; }
        .footer-col ul li { margin-bottom: 12px; }
        .footer-col ul li a { font-size: 13px; color: var(--text-light); transition: color 0.3s; }
        .footer-col ul li a:hover { color: var(--accent-gold); }
        .newsletter-form { display: flex; border-bottom: 1px solid var(--text-main); padding-bottom: 8px; margin-top: 16px; }
        .newsletter-form input { flex: 1; border: none; background: transparent; font-size: 13px; font-family: var(--font-body); outline: none; }
        .newsletter-form button { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-main); }
        .footer-bottom { border-top: 1px solid var(--border); padding-top: 24px; text-align: center; font-size: 12px; color: var(--text-light); display: flex; justify-content: space-between; align-items: center; }
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr; gap: 40px; }
          footer { padding: 60px 20px 40px; }
          .footer-bottom { flex-direction: column; gap: 16px; }
        }
      `}</style>
    </footer>
  );
}
