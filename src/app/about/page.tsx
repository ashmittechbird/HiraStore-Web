import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { asset } from '@/lib/config';

const SITE_IMAGES = asset('site-images');

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export default function AboutPage() {
  useReveal();

  return (
    <>
      {/* ① Cinematic Hero */}
      <section className="about-hero">
        <img className="about-hero-img" src={`${SITE_IMAGES}/hero-necklace-1.jpg`} alt="Hira Store Fine Jewelry" />
        <div className="about-hero-overlay" />
        <div className="about-hero-content">
          <div className="about-hero-eyebrow">The Hira Store</div>
          <h1 className="about-hero-title">Crafted with<br />Devotion.</h1>
          <p className="about-hero-subtitle">Est. 2023 &nbsp;·&nbsp; Premium Silver Jewellery</p>
        </div>
        <div className="about-hero-scroll">
          <div className="about-hero-scroll-line" />
          <span>Scroll</span>
        </div>
      </section>

      {/* ② Brand Manifesto */}
      <section className="about-manifesto">
        <div className="about-manifesto-deco" aria-hidden="true">Hira</div>
        <div className="about-manifesto-inner">
          <span className="about-manifesto-gold-mark" aria-hidden="true">&ldquo;</span>
          <p className="about-manifesto-quote reveal">
            We believe that elegance is not a luxury reserved for special<br />
            occasions, it is a feeling you deserve to carry with you, every day.
          </p>
          <div className="about-manifesto-rule reveal reveal-delay-1" />
          <p className="about-manifesto-attr reveal reveal-delay-2">The Hira Store Philosophy</p>
        </div>
      </section>

      {/* ③ Our Story */}
      <section className="about-story-section">
        <div className="about-story-text">
          <div className="section-label reveal"><span>The Beginning</span></div>
          <h2 className="about-story-title reveal">
            A passion project<br />that became<br /><em>something beautiful.</em>
          </h2>
          <div className="about-story-body reveal reveal-delay-1">
            <p>
              What started as a passion project in 2023, soon evolved into a respected
              business that offers beautiful pieces of jewelry for every occasion. We
              emphasize sustainability and ethically sourced materials without compromising
              on the quality of our metals and gemstones.
            </p>
            <p>
              We know jewelry shopping can be intimidating, which is why we provide a
              friendly, no-pressure atmosphere that makes the purchasing process a pleasure.
              No matter what special piece you&apos;re looking for, you&apos;ll be able to find it
              at Hira Jewellery.
            </p>
          </div>
          <Link to="/shop" className="about-story-link reveal reveal-delay-2">
            Explore the Collection
            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        </div>
        <div className="about-story-images reveal reveal-delay-1">
          <div className="about-story-img-main">
            <img src={`${SITE_IMAGES}/cat-earrings.jpg`} alt="Hira Jewelry Craftsmanship" loading="lazy" />
          </div>
          <div className="about-story-img-accent">
            <img src={`${SITE_IMAGES}/cat-necklaces.jpg`} alt="Silver Pendant Detail" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ④ Stats Bar */}
      <div className="about-stats">
        <div className="about-stats-inner">
          {[
            { num: '500', sup: '+', label: 'Unique Designs' },
            { num: '25', sup: 'K+', label: 'Happy Customers' },
            { num: '5', sup: '+', label: 'Years Crafting' },
            { num: '100', sup: '%', label: 'Quality Assured' },
          ].map((s, i) => (
            <div key={s.label} className={`about-stat reveal${i > 0 ? ` reveal-delay-${i}` : ''}`}>
              <div className="about-stat-number">{s.num}<em>{s.sup}</em></div>
              <div className="about-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ⑤ Heritage - Dark Section */}
      <section className="about-heritage">
        <div className="about-heritage-img">
          <img src={`${SITE_IMAGES}/heritage-craft.jpg`} alt="Hira Heritage Jewelry" loading="lazy" />
          <div className="about-heritage-img-overlay" />
        </div>
        <div className="about-heritage-content">
          <div className="about-heritage-eyebrow reveal">Heritage &amp; Craft</div>
          <h2 className="about-heritage-title reveal">
            Rooted in passion,<br />crafted for the world.
          </h2>
          <p className="about-heritage-text reveal reveal-delay-1">
            Every Hira piece is a reflection of our deep commitment to quality and
            sustainability: ethically sourced metals and gemstones, crafted into
            designs that are as meaningful as they are beautiful.
          </p>
          <p className="about-heritage-text reveal reveal-delay-2">
            We believe jewelry should be accessible, joyful, and pressure-free.
            From the moment you browse to the moment it arrives at your door,
            your experience matters to us.
          </p>
          <div className="about-heritage-rule reveal reveal-delay-3" />
          <div className="about-heritage-detail reveal reveal-delay-3">Est. 2023 &nbsp;·&nbsp; Hira Jewellery</div>
        </div>
      </section>

      {/* ⑥ Values */}
      <section className="about-values-section">
        <div className="about-values-inner">
          <div className="about-values-header">
            <div className="section-label reveal" style={{ justifyContent: 'center', marginBottom: '16px' }}>
              <span>What We Stand For</span>
            </div>
            <h2 className="about-values-title reveal">Built on three pillars.</h2>
            <p className="about-values-desc reveal reveal-delay-1">
              Our commitment to quality, heritage, and responsibility shapes every decision
              we make, from sourcing to packaging.
            </p>
          </div>
          <div className="about-values-grid">
            {[
              {
                icon: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
                title: 'Uncompromising Quality',
                text: 'Every piece is carefully crafted and rigorously quality-checked: hypoallergenic, skin-safe, and built to retain its brilliance for years. We don\'t cut corners, because neither should your jewels.',
              },
              {
                icon: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
                title: 'Artisan Crafted',
                text: 'Each design is brought to life by master artisans blending centuries-old hand techniques with precision modern finishing. No two pieces are identical; each carries a human touch.',
              },
              {
                icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
                title: 'Ethically Sourced',
                text: 'We are committed to responsible sourcing at every step. Our artisan partners receive fair wages, and our packaging is thoughtfully minimal, beautiful without waste.',
              },
            ].map((v, i) => (
              <div key={v.title} className={`about-value-card reveal${i > 0 ? ` reveal-delay-${i}` : ''}`}>
                <div className="about-value-icon">
                  <svg viewBox="0 0 24 24">{v.icon}</svg>
                </div>
                <h3 className="about-value-title">{v.title}</h3>
                <p className="about-value-p">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑦ The Craft - Process */}
      <section className="about-process-section">
        <div className="about-process-inner">
          <div className="about-process-header">
            <div className="section-label reveal" style={{ justifyContent: 'center', marginBottom: '16px' }}>
              <span>How We Create</span>
            </div>
            <h2 className="about-process-title reveal">From sketch to skin.</h2>
            <p className="about-process-desc reveal reveal-delay-1">
              Every Hira piece passes through four stages of careful creation before it reaches you.
            </p>
          </div>
          <div className="about-process-grid">
            <div className="about-process-connector" aria-hidden="true" />
            {[
              { num: '01', title: 'Design', desc: 'Every piece begins as a sketch, refined until it captures the perfect balance of tradition and modern sensibility.' },
              { num: '02', title: 'Craft', desc: 'Skilled artisans bring the design to life using time-honoured techniques passed down through generations of craftsmen.' },
              { num: '03', title: 'Polish', desc: 'Each piece is inspected and polished to our highest standards before it earns the right to carry the Hira name.' },
              { num: '04', title: 'Yours', desc: 'Packaged with care and delivered to your door, ready to become part of your story and daily expression.' },
            ].map((step, i) => (
              <div key={step.num} className={`about-process-step reveal${i > 0 ? ` reveal-delay-${i}` : ''}`}>
                <div className="about-process-num-wrap">
                  <span className="about-process-num">{step.num}</span>
                </div>
                <h3 className="about-process-step-title">{step.title}</h3>
                <p className="about-process-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑧ Founder's Note */}
      <section className="about-founder-section">
        <div className="about-founder-deco" aria-hidden="true">&ldquo;</div>
        <div className="about-founder-inner">
          <span className="about-founder-mark reveal" aria-hidden="true">&ldquo;</span>
          <p className="about-founder-quote reveal">
            I started Hira because I wanted my daughter to wear something
            extraordinary every single day, not just on celebrations.
            She deserved that, and so do you. Every piece we make carries
            that intention: to be worthy of your everyday life.
          </p>
          <div className="about-founder-rule reveal reveal-delay-1" />
          <div className="about-founder-name reveal reveal-delay-2">Hira, Founder</div>
          <div className="about-founder-role reveal reveal-delay-3">The Hira Store</div>
        </div>
      </section>

      {/* ⑨ Shop CTA */}
      <section className="about-cta-section">
        <img className="about-cta-bg" src={`${SITE_IMAGES}/hero-necklace-2.jpg`} alt="" aria-hidden="true" loading="lazy" />
        <div className="about-cta-overlay" />
        <div className="about-cta-content">
          <p className="about-cta-eyebrow reveal">The Collection</p>
          <h2 className="about-cta-title reveal">
            Wear the story.<br /><em>Every single day.</em>
          </h2>
          <p className="about-cta-subtitle reveal reveal-delay-1">
            Explore 500+ handcrafted jewellery designs,
            each one crafted with passion, made for your world.
          </p>
          <Link to="/shop" className="about-cta-btn reveal reveal-delay-2">
            Shop the Collection
            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        </div>
      </section>

      <style>{`
        /* Reveal */
        .reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s var(--ease-out); }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .reveal-delay-1 { transition-delay: 0.1s; }
        .reveal-delay-2 { transition-delay: 0.2s; }
        .reveal-delay-3 { transition-delay: 0.3s; }
        .reveal-delay-4 { transition-delay: 0.4s; }

        /* Section label */
        .section-label { display: inline-flex; align-items: center; gap: 14px; margin-bottom: 20px; }
        .section-label::before { content: ''; display: block; width: 36px; height: 1px; background: var(--accent-gold); flex-shrink: 0; }
        .section-label span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 600; color: var(--accent-gold); }

        /* 1. Hero */
        .about-hero { position: relative; height: 78vh; min-height: 540px; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; background: #1a1510; }
        .about-hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.6; animation: aHeroZoom 18s ease-out forwards; }
        @keyframes aHeroZoom { from { transform: scale(1.08); } to { transform: scale(1); } }
        .about-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,8,6,0.82) 0%, rgba(0,0,0,0.1) 55%); }
        .about-hero-content { position: relative; z-index: 10; color: #fff; text-align: center; padding: 0 24px 80px; max-width: 800px; width: 100%; }
        .about-hero-eyebrow { display: inline-flex; align-items: center; gap: 16px; font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 600; color: var(--accent-gold); margin-bottom: 22px; opacity: 0; animation: fadeUp 1s 0.2s var(--ease-out) forwards; }
        .about-hero-eyebrow::before, .about-hero-eyebrow::after { content: ''; display: block; width: 32px; height: 1px; background: var(--accent-gold); }
        .about-hero-title { font-family: var(--font-head); font-style: italic; font-size: clamp(48px, 7vw, 88px); font-weight: 400; line-height: 1.08; margin-bottom: 24px; opacity: 0; animation: fadeUp 1s 0.4s var(--ease-out) forwards; }
        .about-hero-subtitle { font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 500; color: rgba(255,255,255,0.65); opacity: 0; animation: fadeUp 1s 0.65s var(--ease-out) forwards; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        .about-hero-scroll { position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; color: rgba(255,255,255,0.45); font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; z-index: 10; opacity: 0; animation: fadeUp 1s 1s var(--ease-out) forwards; }
        .about-hero-scroll-line { width: 1px; height: 40px; background: rgba(255,255,255,0.3); animation: scrollPulse 2s ease-in-out infinite; }
        @keyframes scrollPulse { 0%, 100% { transform: scaleY(1); opacity: 0.4; } 50% { transform: scaleY(0.5); opacity: 1; } }

        /* 2. Manifesto */
        .about-manifesto { padding: 110px 40px; text-align: center; background: #fff; position: relative; overflow: hidden; }
        .about-manifesto-deco { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); font-family: var(--font-head); font-style: italic; font-size: 300px; line-height: 1; color: var(--surface); user-select: none; pointer-events: none; white-space: nowrap; letter-spacing: -0.05em; }
        .about-manifesto-inner { position: relative; z-index: 1; max-width: 880px; margin: 0 auto; }
        .about-manifesto-gold-mark { font-family: var(--font-head); font-size: 96px; line-height: 0.6; color: var(--accent-gold); font-style: italic; display: block; margin-bottom: 12px; opacity: 0.55; }
        .about-manifesto-quote { font-family: var(--font-head); font-style: italic; font-size: clamp(20px, 2.8vw, 30px); font-weight: 400; line-height: 1.55; color: var(--text-main); margin-bottom: 44px; }
        .about-manifesto-rule { width: 56px; height: 1px; background: var(--accent-gold); margin: 0 auto 28px; }
        .about-manifesto-attr { font-size: 11px; text-transform: uppercase; letter-spacing: 0.22em; font-weight: 600; color: var(--text-light); }

        /* 3. Our Story */
        .about-story-section { padding: 110px 40px; max-width: 1300px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .about-story-title { font-family: var(--font-head); font-size: clamp(32px, 4vw, 50px); font-weight: 400; line-height: 1.2; color: var(--text-main); margin-bottom: 32px; }
        .about-story-body p { font-size: 15px; color: var(--text-light); line-height: 1.9; margin-bottom: 22px; }
        .about-story-link { display: inline-flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-main); margin-top: 8px; padding-bottom: 3px; border-bottom: 1px solid var(--text-main); transition: color 0.3s, border-color 0.3s; }
        .about-story-link:hover { color: var(--accent-gold); border-color: var(--accent-gold); }
        .about-story-link svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; transition: transform 0.3s var(--ease-out); }
        .about-story-link:hover svg { transform: translateX(5px); }
        .about-story-images { position: relative; padding-bottom: 50px; }
        .about-story-img-main { aspect-ratio: 4/5; overflow: hidden; position: relative; z-index: 1; }
        .about-story-img-main img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.9s var(--ease-out); }
        .about-story-images:hover .about-story-img-main img { transform: scale(1.04); }
        .about-story-img-accent { position: absolute; bottom: 0; left: -40px; width: 48%; aspect-ratio: 1; overflow: hidden; border: 7px solid #fff; z-index: 2; box-shadow: 0 24px 64px rgba(0,0,0,0.13); }
        .about-story-img-accent img { width: 100%; height: 100%; object-fit: cover; }

        /* 4. Stats */
        .about-stats { background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 72px 40px; }
        .about-stats-inner { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); }
        .about-stat { padding: 24px 32px; text-align: center; border-right: 1px solid var(--border); }
        .about-stat:last-child { border-right: none; }
        .about-stat-number { font-family: var(--font-head); font-style: italic; font-size: clamp(40px, 4.5vw, 60px); font-weight: 400; color: var(--text-main); line-height: 1; margin-bottom: 14px; }
        .about-stat-number em { color: var(--accent-gold); font-style: normal; }
        .about-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 600; color: var(--text-light); }

        /* 5. Heritage */
        .about-heritage { display: grid; grid-template-columns: 1fr 1fr; background: #1e0b0f; overflow: hidden; }
        .about-heritage-img { position: relative; min-height: 580px; overflow: hidden; }
        .about-heritage-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.8; transition: transform 1.2s var(--ease-out); }
        .about-heritage:hover .about-heritage-img img { transform: scale(1.04); }
        .about-heritage-img-overlay { position: absolute; inset: 0; background: linear-gradient(to right, transparent 60%, #1e0b0f); }
        .about-heritage-content { display: flex; flex-direction: column; justify-content: center; padding: 80px 8% 80px 6%; color: #fff; }
        .about-heritage-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; font-weight: 600; color: var(--accent-gold); margin-bottom: 28px; display: flex; align-items: center; gap: 14px; }
        .about-heritage-eyebrow::before { content: ''; display: block; width: 32px; height: 1px; background: var(--accent-gold); }
        .about-heritage-title { font-family: var(--font-head); font-size: clamp(28px, 3.5vw, 46px); font-weight: 400; line-height: 1.2; margin-bottom: 32px; }
        .about-heritage-text { font-size: 15px; line-height: 1.85; color: rgba(255,255,255,0.65); margin-bottom: 18px; max-width: 440px; }
        .about-heritage-rule { width: 48px; height: 1px; background: var(--accent-gold); margin: 28px 0; }
        .about-heritage-detail { font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.14em; font-weight: 500; }

        /* 6. Values */
        .about-values-section { background: var(--surface); padding: 110px 40px; }
        .about-values-inner { max-width: 1200px; margin: 0 auto; }
        .about-values-header { text-align: center; margin-bottom: 64px; }
        .about-values-title { font-family: var(--font-head); font-size: clamp(28px, 4vw, 38px); font-weight: 400; color: var(--text-main); margin-bottom: 16px; }
        .about-values-desc { font-size: 14px; color: var(--text-light); max-width: 500px; margin: 0 auto; }
        .about-values-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .about-value-card { background: #fff; padding: 52px 44px; border-top: 2px solid var(--accent-gold); transition: transform 0.4s var(--ease-out), box-shadow 0.4s; }
        .about-value-card:hover { transform: translateY(-6px); box-shadow: 0 24px 60px rgba(0,0,0,0.07); }
        .about-value-icon { width: 52px; height: 52px; margin-bottom: 32px; display: flex; align-items: center; justify-content: center; color: var(--accent-gold); }
        .about-value-icon svg { width: 40px; height: 40px; stroke-width: 1.3; fill: none; stroke: currentColor; }
        .about-value-title { font-family: var(--font-head); font-size: 22px; font-weight: 500; color: var(--text-main); margin-bottom: 16px; }
        .about-value-p { font-size: 14px; color: var(--text-light); line-height: 1.8; }

        /* 7. Process */
        .about-process-section { padding: 110px 40px; background: #fff; }
        .about-process-inner { max-width: 1200px; margin: 0 auto; }
        .about-process-header { text-align: center; margin-bottom: 72px; }
        .about-process-title { font-family: var(--font-head); font-size: clamp(28px, 4vw, 38px); font-weight: 400; color: var(--text-main); margin-bottom: 16px; }
        .about-process-desc { font-size: 14px; color: var(--text-light); max-width: 480px; margin: 0 auto; }
        .about-process-grid { display: grid; grid-template-columns: repeat(4, 1fr); position: relative; gap: 0; }
        .about-process-connector { position: absolute; top: 34px; left: calc(12.5% + 1px); right: calc(12.5% + 1px); height: 1px; background: linear-gradient(to right, var(--border) 0%, var(--accent-gold) 50%, var(--border) 100%); }
        .about-process-step { text-align: center; padding: 0 28px; position: relative; }
        .about-process-num-wrap { position: relative; z-index: 1; margin-bottom: 28px; display: inline-flex; align-items: center; justify-content: center; width: 68px; height: 68px; background: #fff; }
        .about-process-num { font-family: var(--font-head); font-style: italic; font-size: 52px; font-weight: 400; color: var(--accent-gold); line-height: 1; }
        .about-process-step-title { font-family: var(--font-head); font-size: 18px; font-weight: 500; color: var(--text-main); margin-bottom: 14px; }
        .about-process-step-desc { font-size: 13px; color: var(--text-light); line-height: 1.75; }

        /* 8. Founder */
        .about-founder-section { background: var(--surface); padding: 110px 40px; text-align: center; position: relative; overflow: hidden; }
        .about-founder-deco { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-family: var(--font-head); font-style: italic; font-size: 320px; line-height: 1; color: rgba(200,169,126,0.07); user-select: none; pointer-events: none; white-space: nowrap; }
        .about-founder-inner { position: relative; z-index: 1; max-width: 720px; margin: 0 auto; }
        .about-founder-mark { font-family: var(--font-head); font-size: 80px; line-height: 0.7; color: var(--accent-gold); font-style: italic; display: block; margin-bottom: 16px; opacity: 0.6; }
        .about-founder-quote { font-family: var(--font-head); font-style: italic; font-size: clamp(18px, 2.6vw, 25px); font-weight: 400; line-height: 1.7; color: var(--text-main); margin-bottom: 44px; }
        .about-founder-rule { width: 48px; height: 1px; background: var(--accent-gold); margin: 0 auto 24px; }
        .about-founder-name { font-family: var(--font-head); font-size: 17px; font-weight: 500; color: var(--text-main); margin-bottom: 6px; }
        .about-founder-role { font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 600; color: var(--text-light); }

        /* 9. CTA */
        .about-cta-section { position: relative; background: #1a1510; overflow: hidden; display: flex; align-items: center; justify-content: center; text-align: center; min-height: 460px; padding: 80px 40px; }
        .about-cta-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.18; transition: transform 1.2s var(--ease-out); }
        .about-cta-section:hover .about-cta-bg { transform: scale(1.04); }
        .about-cta-overlay { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(26,21,16,0.4) 0%, rgba(26,21,16,0.85) 100%); }
        .about-cta-content { position: relative; z-index: 10; color: #fff; max-width: 620px; }
        .about-cta-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.28em; font-weight: 600; color: var(--accent-gold); margin-bottom: 22px; }
        .about-cta-title { font-family: var(--font-head); font-size: clamp(34px, 5vw, 56px); font-weight: 400; line-height: 1.12; margin-bottom: 22px; }
        .about-cta-title em { font-family: var(--font-head); font-weight: 400; }
        .about-cta-subtitle { font-size: 15px; color: rgba(255,255,255,0.6); margin-bottom: 44px; line-height: 1.7; }
        .about-cta-btn { display: inline-flex; align-items: center; gap: 12px; background: var(--accent-gold); color: #fff; padding: 18px 52px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; transition: background 0.35s, transform 0.35s var(--ease-out); border-radius: 2px; }
        .about-cta-btn:hover { background: #b8946a; transform: translateY(-3px); }
        .about-cta-btn svg { width: 16px; height: 16px; stroke: #fff; stroke-width: 2; fill: none; transition: transform 0.3s var(--ease-out); }
        .about-cta-btn:hover svg { transform: translateX(4px); }

        /* Responsive */
        @media (max-width: 1024px) {
          .about-stats-inner { grid-template-columns: repeat(2, 1fr); }
          .about-process-grid { grid-template-columns: repeat(2, 1fr); gap: 48px; }
          .about-process-connector { display: none; }
        }
        @media (max-width: 900px) {
          .about-story-section { grid-template-columns: 1fr; gap: 64px; padding: 70px 24px; }
          .about-heritage { grid-template-columns: 1fr; }
          .about-heritage-img { min-height: 380px; }
          .about-heritage-img-overlay { background: linear-gradient(to bottom, transparent 50%, #1e0b0f); }
          .about-heritage-content { padding: 56px 24px; }
          .about-values-grid { grid-template-columns: 1fr; gap: 20px; }
        }
        @media (max-width: 768px) {
          .about-hero { height: 80vh; }
          .about-manifesto { padding: 72px 24px; }
          .about-stats-inner { grid-template-columns: repeat(2, 1fr); }
          .about-stat { border-right: none; border-bottom: 1px solid var(--border); padding: 28px 16px; }
          .about-stat:last-child { border-bottom: none; }
          .about-values-section { padding: 72px 24px; }
          .about-process-section { padding: 72px 24px; }
          .about-process-grid { grid-template-columns: 1fr; gap: 40px; }
          .about-founder-section { padding: 72px 24px; }
          .about-cta-section { padding: 72px 24px; }
          .about-story-img-accent { left: -12px; bottom: 0; width: 44%; border-width: 5px; }
        }
        @media (max-width: 480px) {
          .about-stats-inner { grid-template-columns: 1fr; }
          .about-stat { border-right: none; }
          .about-process-step { padding: 0 8px; }
        }
      `}</style>
    </>
  );
}
