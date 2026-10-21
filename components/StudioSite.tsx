import React, { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Menu, X } from 'lucide-react';
import './studio-site.css';

const services = [
  { number: '01', name: 'Websites', detail: 'Distinctive, responsive websites built to turn a first visit into a lasting impression.' },
  { number: '02', name: 'Brand identity', detail: 'A clear visual language that makes your business feel unmistakably yours.' },
  { number: '03', name: 'Digital experiences', detail: 'Thoughtful interfaces that make the complicated feel effortless.' },
];

export const StudioSite = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '');
    const email = String(form.get('email') || '');
    const business = String(form.get('business') || '');
    const service = String(form.get('service') || '');
    const message = String(form.get('message') || '');
    const subject = encodeURIComponent(`New website enquiry${business ? ` — ${business}` : ''}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nBusiness: ${business}\nInterested in: ${service}\n\nProject details:\n${message}`);
    window.location.href = `mailto:hello@yourstudio.com?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="studio-site">
      <header className="studio-nav">
        <a className="studio-wordmark" href="#home" aria-label="Morrow Studio home"><span className="wordmark-mark">m.</span>morrow<span className="wordmark-studio">® STUDIO</span></a>
        <button className="studio-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X /> : <Menu />}</button>
        <nav className={menuOpen ? 'studio-links is-open' : 'studio-links'}>
          <a href="#work" onClick={() => setMenuOpen(false)}>Selected work</a><a href="#services" onClick={() => setMenuOpen(false)}>What we do</a><a href="#about" onClick={() => setMenuOpen(false)}>Our approach</a>
          <a className="nav-contact" href="#contact" onClick={() => setMenuOpen(false)}>Start a project <ArrowUpRight size={15} /></a>
        </nav>
      </header>

      <main>
        <section id="home" className="studio-hero">
          <div className="hero-copy"><p className="eyebrow"><span className="status-dot" /> INDEPENDENT DIGITAL STUDIO · EST. 2024</p>
            <h1>Make your<br />next move <span className="serif-italic">matter.</span></h1>
            <p className="hero-intro">We create thoughtful websites and identities for people building something meaningful.</p>
            <a className="pill-link" href="#work">Explore our work <ArrowDown size={16} /></a>
          </div>
          <div className="hero-art" aria-label="Abstract composition representing digital design">
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-sun" />
            <div className="art-card art-card-top"><span>DESIGN WITH<br />INTENTION</span><span className="art-card-dot">✳</span></div>
            <div className="art-card art-card-bottom"><span>GOOD THINGS<br />TAKE SHAPE.</span><span className="art-card-small">MORROW / 001</span></div>
            <span className="art-caption">DIGITAL, MADE HUMAN</span>
          </div>
          <div className="hero-footer"><span>STRATEGY · DESIGN · DEVELOPMENT</span><span>SCROLL TO DISCOVER <ArrowDown size={13} /></span></div>
        </section>

        <section className="studio-intro" id="about"><p className="eyebrow">A SMALL STUDIO FOR BIG IDEAS</p><h2>Good design gets noticed.<br /><span className="serif-italic">Great design moves</span> people.</h2><div className="intro-bottom"><p>We partner with ambitious founders and growing teams to make the internet a little more considered—and their next chapter a little more compelling.</p><a className="text-link" href="#contact">A little more about us <ArrowUpRight size={16} /></a></div></section>

        <section className="work-section" id="work"><div className="section-heading"><div><p className="eyebrow">A FEW RECENT FAVOURITES</p><h2>Made with <span className="serif-italic">purpose.</span></h2></div><span className="section-index">01 — 03</span></div>
          <div className="work-grid">
            <a href="#contact" className="work-card work-large"><div className="work-visual visual-one"><span className="visual-sun" /><div className="visual-window"><div className="window-bar"><i /><i /><i /></div><div className="window-content"><span>Fieldnotes</span><b>A slower<br />kind of living.</b><small>Objects for the everyday ritual.</small><div className="window-button">DISCOVER THE COLLECTION ↗</div></div></div><span className="visual-side">FIELDNOTES / BRAND & DIGITAL</span></div><div className="work-meta"><div><h3>Fieldnotes Supply</h3><p>Brand identity · E-commerce</p></div><span className="work-arrow"><ArrowUpRight /></span></div></a>
            <a href="#contact" className="work-card work-offset"><div className="work-visual visual-two"><div className="visual-typography"><span>Casa</span><span>Verde</span><i>PLANTS THAT FEEL LIKE HOME</i></div><div className="plant-shape plant-a" /><div className="plant-shape plant-b" /><span className="visual-stamp">GROW<br />WELL</span></div><div className="work-meta"><div><h3>Casa Verde</h3><p>Strategy · Brand · Website</p></div><span className="work-arrow"><ArrowUpRight /></span></div></a>
            <a href="#contact" className="work-card work-third"><div className="work-visual visual-three"><div className="arc-shape" /><div className="studio-type">MONO<br /><span>FORM</span><small>ARCHITECTURE & OBJECTS</small></div><span className="mono-number">M—24</span></div><div className="work-meta"><div><h3>Monoform Studio</h3><p>Art direction · Digital</p></div><span className="work-arrow"><ArrowUpRight /></span></div></a>
          </div>
          <p className="work-note">Visual concepts shown as studio explorations. Your project could be next.</p>
        </section>

        <section className="services-section" id="services"><div className="services-intro"><p className="eyebrow">WHAT WE BRING TO THE TABLE</p><h2>From first thought<br />to <span className="serif-italic">finished thing.</span></h2><p>One close-knit team, working alongside you at every step. No handoffs, no mystery—just good people making good work.</p><a className="pill-link pill-light" href="#contact">Tell us what you need <ArrowRight size={16} /></a></div>
          <div className="service-list">{services.map((item) => <div className="service-row" key={item.number}><span className="service-number">{item.number}</span><div><h3>{item.name}</h3><p>{item.detail}</p></div><ArrowUpRight className="service-arrow" size={19} /></div>)}</div>
        </section>

        <section className="process-section"><div className="process-head"><p className="eyebrow">SIMPLE BY DESIGN</p><h2>Clear steps.<br /><span className="serif-italic">Lovely results.</span></h2></div><div className="process-steps"><div><span>01 / LISTEN</span><p>We start with a conversation about what you want to change and where you want to go.</p></div><div><span>02 / MAKE</span><p>We turn the big picture into a clear plan, then make the work together, one step at a time.</p></div><div><span>03 / LAUNCH</span><p>We get your new site out into the world and make sure you feel confident taking it forward.</p></div></div></section>

        <section className="contact-section" id="contact"><div className="contact-copy"><p className="eyebrow"><span className="status-dot" /> YOUR NEXT CHAPTER STARTS HERE</p><h2>Have a good<br /><span className="serif-italic">feeling?</span></h2><p>Tell us a little about what you're working on. We'll get back to you to talk through the possibilities.</p><div className="contact-note"><span className="note-star">✳</span><span>Good projects start with<br />a simple hello.</span></div></div>
          <form className="enquiry-form" onSubmit={handleSubmit}><div className="form-title"><span>PROJECT ENQUIRY</span><span>TAKES 2 MINUTES</span></div><label>Your name<input name="name" placeholder="How should we call you?" required /></label><div className="form-row"><label>Email address<input name="email" type="email" placeholder="you@example.com" required /></label><label>Business name<input name="business" placeholder="Your company" /></label></div><label>What can we help with?<select name="service" defaultValue=""><option value="" disabled>Choose a service</option><option>Website design & development</option><option>Brand identity</option><option>Digital experience</option><option>Something else</option></select></label><label>A little about your project<textarea name="message" placeholder="The idea, the dream, the challenge…" rows={3} required /></label><button className="submit-button" type="submit">{sent ? <>Email draft opened <Check size={17} /></> : <>Send your enquiry <ArrowRight size={17} /></>}</button><p className="form-footnote">By sending this, you're happy for us to reply about your project.</p></form>
        </section>
      </main>
      <footer className="studio-footer"><a className="studio-wordmark footer-wordmark" href="#home"><span className="wordmark-mark">m.</span>morrow<span className="wordmark-studio">® STUDIO</span></a><span>Independent by nature. Thoughtful by design.</span><a href="#home">BACK TO TOP ↑</a><span>© MORROW STUDIO 2026</span></footer>
    </div>
  );
};
