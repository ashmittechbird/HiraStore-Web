import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FREE_SHIPPING_OVER, SHIPPING_FLAT } from '@/lib/config';
import { whatsappLink } from '@/lib/contact';

/**
 * Shipping, Returns and Size Guide — the three pages the footer has always
 * linked to and the site has never had. Every link pointed at /about#shipping
 * and friends, where no such section existed, so they quietly did nothing.
 *
 * ── A note on what is written here ───────────────────────────────────────────
 *
 * The shipping figures are not prose: they are the same constants checkout
 * charges with, imported rather than retyped, so this page cannot drift from
 * what a customer actually pays.
 *
 * The size charts are industry-standard reference data — ISO ring diameters,
 * the usual necklace length names, Indian bangle sizing. They are facts about
 * jewellery, not claims about this shop, so they are safe to state plainly.
 *
 * POLICY below is the part that is neither. Dispatch times and the returns
 * window are commitments only the store can make, and inventing them would put
 * promises on the site that nobody agreed to. The values are conservative
 * placeholders, gathered in one place so they are easy to correct — change them
 * here and both the page and its summary update together.
 */
const POLICY = {
  /** Working days between an order being placed and leaving the studio. */
  dispatchDays: '2-3',
  /** Working days in transit within the United States, after dispatch. */
  deliveryDaysUS: '3-7',
  /** Days from delivery within which a problem must be reported. */
  returnWindowDays: 7,
  /** Who pays return postage when an item is unwanted rather than faulty. */
  returnPostage: 'the customer',
};

const SECTIONS = [
  { id: 'shipping', label: 'Shipping' },
  { id: 'returns', label: 'Returns & Exchanges' },
  { id: 'size-guide', label: 'Size Guide' },
];

/** US ring sizes against ISO inner measurements. Standard reference values. */
const RING_SIZES = [
  ['4', '14.9', '46.8'],
  ['5', '15.7', '49.3'],
  ['6', '16.5', '51.9'],
  ['7', '17.3', '54.4'],
  ['8', '18.1', '57.0'],
  ['9', '18.9', '59.5'],
  ['10', '19.8', '62.1'],
  ['11', '20.6', '64.6'],
  ['12', '21.4', '67.2'],
];

/** The conventional necklace lengths and where each one sits. */
const NECKLACE_LENGTHS = [
  ['Collar', '12-13 in', 'Snug around the base of the neck'],
  ['Choker', '14-16 in', 'Sits at the hollow of the throat'],
  ['Princess', '17-19 in', 'Just below the collarbone — the most common length'],
  ['Matinee', '20-24 in', 'Rests on the upper chest'],
  ['Opera', '28-36 in', 'Below the bust; can be doubled'],
];

/** Indian bangle sizing, given as inner diameter. */
const BANGLE_SIZES = [
  ['2-4', '2.375 in', '6.0 cm'],
  ['2-6', '2.500 in', '6.4 cm'],
  ['2-8', '2.625 in', '6.7 cm'],
  ['2-10', '2.750 in', '7.0 cm'],
  ['2-12', '2.875 in', '7.3 cm'],
];

export default function HelpPage() {
  const [active, setActive] = useState('shipping');

  // Highlight whichever section the reader is in.
  useEffect(() => {
    const els = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px' }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const wa = whatsappLink('Hi, I have a question about my order.');

  return (
    <div className="help-page">
      <header className="help-hero">
        <p className="help-eyebrow">Customer Care</p>
        <h1>Shipping, Returns &amp; Sizing</h1>
        <p className="help-lede">
          Everything you need before and after you order. If anything here doesn't answer
          your question, we'd rather you asked than guessed.
        </p>
      </header>

      <div className="help-body">
        <nav className="help-nav" aria-label="On this page">
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} className={active === s.id ? 'on' : ''}>{s.label}</a>
          ))}
          <div className="help-nav-contact">
            <p>Still stuck?</p>
            <a href="mailto:info@Thehirastore.com">info@Thehirastore.com</a>
            <a href={wa} target="_blank" rel="noopener noreferrer">Message on WhatsApp</a>
          </div>
        </nav>

        <main className="help-main">
          {/* ── Shipping ─────────────────────────────────────────────────── */}
          <section id="shipping" className="help-section">
            <h2>Shipping</h2>

            <div className="help-cards">
              <div className="help-card">
                <span className="help-card-k">Free delivery</span>
                <span className="help-card-v">Over ${FREE_SHIPPING_OVER}</span>
              </div>
              <div className="help-card">
                <span className="help-card-k">Below ${FREE_SHIPPING_OVER}</span>
                <span className="help-card-v">${SHIPPING_FLAT} flat</span>
              </div>
              <div className="help-card">
                <span className="help-card-k">Dispatch</span>
                <span className="help-card-v">{POLICY.dispatchDays} working days</span>
              </div>
            </div>

            <p>
              Orders over <strong>${FREE_SHIPPING_OVER}</strong> ship free. Below that a flat{' '}
              <strong>${SHIPPING_FLAT}</strong> is added at checkout — you'll always see the exact
              figure before you pay.
            </p>
            <p className="help-note">
              Shipping charge and tax applicable as per delivery address.
            </p>
            <p>
              Every piece is packed by hand at our studio in <strong>San Jose, California</strong> and
              leaves within <strong>{POLICY.dispatchDays} working days</strong>. Delivery within the
              United States usually takes a further <strong>{POLICY.deliveryDaysUS} working days</strong>.
            </p>
            <p>
              Shipping outside the United States, and any duties or customs charges that come with it,
              are assessed on your delivery address. Those charges are set by the destination country
              and are payable by the recipient. If you'd like a quote before ordering,{' '}
              <a href={wa} target="_blank" rel="noopener noreferrer">message us</a> and we'll work it out
              with you.
            </p>
            <p>
              Once your order is on its way you'll get a confirmation by email. If a piece in your order
              turns out to be unavailable we'll contact you before shipping anything.
            </p>
          </section>

          {/* ── Returns ──────────────────────────────────────────────────── */}
          <section id="returns" className="help-section">
            <h2>Returns &amp; Exchanges</h2>

            <p>
              If something arrives damaged, faulty, or simply isn't what you ordered, tell us within{' '}
              <strong>{POLICY.returnWindowDays} days</strong> of delivery and we will put it right —
              repair, replacement or refund, whichever you'd prefer. Return postage is on us in that case.
            </p>
            <p>
              Changed your mind? We'll accept a return within <strong>{POLICY.returnWindowDays} days</strong>{' '}
              of delivery provided the piece is unworn, in its original packaging, and with any tags
              still attached. Return postage is paid by {POLICY.returnPostage}, and the refund goes back
              to the card you paid with once the piece reaches us.
            </p>

            <h3>How to start a return</h3>
            <ol className="help-steps">
              <li>
                Email <a href="mailto:info@Thehirastore.com">info@Thehirastore.com</a> or{' '}
                <a href={wa} target="_blank" rel="noopener noreferrer">message us on WhatsApp</a> with your
                order number — it looks like <code>SAL-ORD-2026-00042</code> and is on your confirmation.
              </li>
              <li>Tell us which piece and what's wrong. A photo helps enormously if it's damaged.</li>
              <li>We'll reply with the return address and next steps.</li>
            </ol>

            <h3>A few things we can't take back</h3>
            <ul className="help-list">
              <li>Earrings that have been worn — a hygiene rule, and a common one in jewellery.</li>
              <li>Pieces made or altered to your specification.</li>
              <li>Anything damaged by ordinary wear, accident, or an attempted repair elsewhere.</li>
            </ul>

            <h3>Warranty</h3>
            <p>
              Every piece carries a <strong>one year warranty</strong> against manufacturing defects — a
              clasp that fails, a stone that comes loose on its own, plating that lifts without cause.
              Tarnishing from normal wear isn't a defect, but silver is easily brought back; ask us and
              we'll tell you how, or clean it for you.
            </p>
          </section>

          {/* ── Size guide ───────────────────────────────────────────────── */}
          <section id="size-guide" className="help-section">
            <h2>Size Guide</h2>
            <p>
              Where a piece has a weight, it's shown on its product page in grams, taken from our own
              records. Measurements below are standard, so you can check them against jewellery you
              already own.
            </p>

            <h3>Rings</h3>
            <p>
              Wrap a strip of paper around the base of your finger, mark where it overlaps, and measure
              the length in millimetres — that's your circumference. Measure at the end of the day, when
              fingers are at their largest, and make sure it slides over the knuckle.
            </p>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr><th>US size</th><th>Inner diameter</th><th>Circumference</th></tr>
                </thead>
                <tbody>
                  {RING_SIZES.map(([us, dia, circ]) => (
                    <tr key={us}><td>{us}</td><td>{dia} mm</td><td>{circ} mm</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="help-note">
              Our toe rings are adjustable and need no size.
            </p>

            <h3>Necklaces &amp; chains</h3>
            <p>
              Measure a chain you already wear and like, end to end including the clasp. If you're
              between lengths, the longer one is the safer choice.
            </p>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr><th>Style</th><th>Length</th><th>Where it sits</th></tr>
                </thead>
                <tbody>
                  {NECKLACE_LENGTHS.map(([style, len, where]) => (
                    <tr key={style}><td>{style}</td><td>{len}</td><td>{where}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Bangles</h3>
            <p>
              Bring your thumb towards your little finger as though slipping a bangle on, and measure
              around the widest part of that shape. Match it to the inner diameter below — a bangle has
              to pass the hand, not just the wrist.
            </p>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr><th>Size</th><th>Inner diameter</th><th>Metric</th></tr>
                </thead>
                <tbody>
                  {BANGLE_SIZES.map(([size, inch, cm]) => (
                    <tr key={size}><td>{size}</td><td>{inch}</td><td>{cm}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Caring for silver</h3>
            <p>
              Put jewellery on last, after perfume and hairspray, and take it off before swimming or
              sleeping. Store pieces apart from each other in a dry place — the pouch it arrived in is
              ideal. A soft dry cloth restores most of the shine; for anything more stubborn, ask us
              before reaching for a chemical dip.
            </p>
          </section>

          <div className="help-foot">
            <p>Still have a question?</p>
            <div className="help-foot-actions">
              <a className="help-btn" href="mailto:info@Thehirastore.com">Email us</a>
              <a className="help-btn ghost" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <Link className="help-btn ghost" to="/shop">Back to the shop</Link>
            </div>
          </div>
        </main>
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .help-page { background: #fdfbf6; padding-bottom: 80px; }

  .help-hero { max-width: 1180px; margin: 0 auto; padding: 56px 24px 36px; }
  .help-eyebrow {
    font-size: 10px; letter-spacing: .28em; text-transform: uppercase;
    color: #c8a97e; font-weight: 600; margin-bottom: 10px;
  }
  .help-hero h1 {
    font-family: 'Playfair Display', serif; font-weight: 400;
    font-size: clamp(2rem, 4vw, 3rem); color: #005969; line-height: 1.1; margin-bottom: 14px;
  }
  .help-lede { font-size: 15px; line-height: 1.7; color: #5b7a80; max-width: 58ch; }

  .help-body {
    max-width: 1180px; margin: 0 auto; padding: 0 24px;
    display: grid; grid-template-columns: 220px 1fr; gap: 56px; align-items: start;
  }
  /* Grid children default to min-width:auto, so the column would grow to fit
     the widest size table and push the whole page sideways instead of letting
     .help-table-wrap scroll it. */
  .help-body > * { min-width: 0; }

  .help-nav { position: sticky; top: 96px; display: flex; flex-direction: column; gap: 2px; }
  .help-nav a {
    padding: 9px 14px; font-size: 13px; color: #5b7a80; border-left: 2px solid #eee5d3;
    transition: color .18s, border-color .18s, background .18s;
  }
  .help-nav a:hover { color: #005969; background: #f5f9f9; }
  .help-nav a.on { color: #005969; font-weight: 600; border-left-color: #005969; background: #f2fafb; }
  .help-nav-contact { margin-top: 26px; padding: 16px 14px; background: #fff; border: 1px solid #eee5d3; border-radius: 10px; }
  .help-nav-contact p { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #8aa5aa; margin-bottom: 9px; }
  .help-nav-contact a { display: block; padding: 3px 0; border: 0; font-size: 12.5px; color: #005969; }
  .help-nav-contact a:hover { text-decoration: underline; background: none; }

  .help-section { padding-bottom: 52px; margin-bottom: 44px; border-bottom: 1px solid #eee5d3; scroll-margin-top: 96px; }
  .help-section:last-of-type { border-bottom: 0; }
  .help-section h2 {
    font-family: 'Playfair Display', serif; font-weight: 400;
    font-size: clamp(1.5rem, 2.4vw, 2rem); color: #005969; margin-bottom: 20px;
  }
  .help-section h3 {
    font-size: 12px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
    color: #25454a; margin: 32px 0 12px;
  }
  .help-section p { font-size: 14.5px; line-height: 1.75; color: #5b7a80; margin-bottom: 14px; max-width: 66ch; }
  .help-section strong { color: #25454a; font-weight: 600; }
  .help-section a { color: #005969; text-decoration: underline; text-underline-offset: 3px; }
  .help-section code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: #f2fafb; padding: 2px 6px; border-radius: 4px; color: #005969; }

  .help-note {
    padding: 11px 14px; background: #fff8ee; border: 1px solid #f0e0c4; border-radius: 8px;
    font-size: 13px !important; color: #8a6d3b !important;
  }

  .help-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .help-card { background: #fff; border: 1px solid #eee5d3; border-radius: 10px; padding: 16px; }
  .help-card-k { display: block; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #8aa5aa; margin-bottom: 6px; }
  .help-card-v { display: block; font-family: 'Playfair Display', serif; font-size: 20px; color: #005969; }

  .help-steps, .help-list { margin: 0 0 16px 20px; max-width: 66ch; }
  .help-steps li, .help-list li { font-size: 14.5px; line-height: 1.75; color: #5b7a80; margin-bottom: 9px; }

  .help-table-wrap { overflow-x: auto; margin-bottom: 18px; -webkit-overflow-scrolling: touch; }
  .help-table { width: 100%; border-collapse: collapse; min-width: 380px; background: #fff; border: 1px solid #eee5d3; border-radius: 10px; overflow: hidden; }
  .help-table th {
    text-align: left; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase;
    color: #8aa5aa; font-weight: 600; padding: 11px 14px; background: #faf8f5; border-bottom: 1px solid #eee5d3;
  }
  .help-table td { padding: 10px 14px; font-size: 13.5px; color: #5b7a80; border-bottom: 1px solid #f4efe6; }
  .help-table tbody tr:last-child td { border-bottom: 0; }
  .help-table td:first-child { color: #25454a; font-weight: 600; }

  .help-foot { background: #fff; border: 1px solid #eee5d3; border-radius: 12px; padding: 26px; text-align: center; }
  .help-foot p { font-family: 'Playfair Display', serif; font-size: 19px; color: #005969; margin-bottom: 16px; }
  .help-foot-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .help-btn {
    padding: 11px 22px; background: #005969; color: #fff; border-radius: 8px;
    font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
    text-decoration: none; transition: background .18s;
  }
  .help-btn:hover { background: #003d4a; }
  .help-btn.ghost { background: transparent; color: #005969; border: 1px solid #cfe6ea; }
  .help-btn.ghost:hover { background: #f2fafb; }

  @media (max-width: 900px) {
    .help-body { grid-template-columns: 1fr; gap: 24px; }
    .help-nav {
      position: static; flex-direction: row; gap: 8px; overflow-x: auto;
      padding-bottom: 6px; scrollbar-width: none;
    }
    .help-nav::-webkit-scrollbar { display: none; }
    .help-nav a { white-space: nowrap; border-left: 0; border-bottom: 2px solid #eee5d3; }
    .help-nav a.on { border-left: 0; border-bottom-color: #005969; }
    .help-nav-contact { display: none; }
    .help-hero { padding: 36px 20px 24px; }
    .help-body { padding: 0 20px; }
  }
`;
