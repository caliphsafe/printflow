import Link from "next/link";

const features = [
  ["Branded ordering studio", "Give customers a guided product, artwork, quantity, mockup, and checkout experience that carries your brand."],
  ["Live supplier catalog", "Import S&S products with real colors, images, size-level costs, inventory, and exact supplier SKUs."],
  ["Production pricing", "Build Screen Print, DTF, and Embroidery pricing from actual garment cost, setup, artwork size, colors, stitches, and quantity."],
  ["Native payments", "Send customers directly into your connected Stripe or Square checkout and update order status automatically."],
  ["Production files", "Keep original artwork, customer mockups, placement information, and size breakdowns together on every order."],
  ["Blank purchasing", "Prepare and submit S&S blank orders from the job record before or after customer payment."],
];

const plans = [
  { code: "starter", name: "Starter", price: 49, copy: "For new shops launching online ordering.", features: ["Branded storefront", "Stripe or Square", "S&S catalog", "75 orders / month", "Guided onboarding"] },
  { code: "growth", name: "Growth", price: 99, copy: "For established shops processing steady volume.", features: ["Everything in Starter", "300 orders / month", "Advanced pricing", "Supplier ordering", "Priority onboarding"], featured: true },
  { code: "scale", name: "Scale", price: 199, copy: "For high-volume production teams.", features: ["Everything in Growth", "Unlimited orders", "Advanced controls", "Priority support", "Launch assistance"] }
];

export default function HomePage() {
  return <main className="launch-site launch-glass-site">
    <nav className="launch-nav glass-nav"><Link href="/" className="launch-wordmark"><span>PF</span> PRINTFLOW</Link><div><a href="#platform">Features</a><a href="#workflow">How it works</a><a href="#pricing">Pricing</a><Link href="/login">Sign in</Link><Link href="/signup" className="launch-nav-cta">Start free</Link></div></nav>

    <section className="launch-hero glass-hero"><div className="launch-hero-copy"><p className="launch-kicker">THE ONLINE ORDERING SYSTEM FOR PRINT SHOPS</p><h1>Turn custom apparel requests into paid, production-ready orders.</h1><p>PrintFlow connects your storefront, supplier catalog, pricing, artwork, payment, and blank purchasing so customers can order confidently and your team can produce without chasing details.</p><div className="launch-hero-actions"><Link className="launch-primary" href="/signup?plan=growth">Start your 14-day trial</Link><a className="launch-secondary" href="#workflow">See the workflow</a></div><div className="launch-mini-proof"><span>Live supplier costs</span><span>100 MB artwork</span><span>Front + back mockups</span><span>Stripe or Square</span></div></div>
      <div className="launch-product-preview glass-panel"><div className="launch-preview-top"><span>ORDER PF-1048</span><b>Paid · Ready</b></div><div className="launch-preview-body"><div className="launch-shirt-visual"><div>PF</div></div><div className="launch-preview-lines"><span>Heavyweight garment</span><strong>48 pieces</strong><small>Front left-chest · 2 colors</small><small>Back full print · 1 color</small></div></div><div className="launch-preview-total"><span>Customer total</span><strong>$1,248.00</strong></div><div className="launch-preview-steps"><span className="done">Artwork</span><span className="done">Payment</span><span className="active">Blanks</span><span>Production</span></div></div>
    </section>

    <section className="launch-logo-strip glass-strip"><span>SUPPLIER</span><b>S&amp;S ACTIVEWEAR</b><span>PAYMENTS</span><b>STRIPE</b><b>SQUARE</b><span>PRODUCTION</span><b>SCREEN PRINT · DTF · EMBROIDERY</b></section>

    <section id="platform" className="launch-feature-section"><div className="launch-section-heading"><p className="launch-kicker">ONE CONNECTED WORKFLOW</p><h2>Built around the way apparel orders are actually produced.</h2><p>Each choice a customer makes becomes usable order data for pricing, purchasing, artwork review, and production.</p></div><div className="launch-feature-grid expanded">{features.map(([title, copy], index) => <article className="glass-feature" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

    <section id="workflow" className="launch-workflow glass-workflow"><div><p className="launch-kicker">EASY FOR CUSTOMERS</p><h2>A guided order experience anyone can finish.</h2><p>Customers see the real product, choose every production option in plain language, position artwork on the garment, review pricing, and pay securely.</p><Link className="launch-primary" href="/signup?plan=starter">Build your storefront</Link></div><ol><li><span>1</span><div><b>Choose a garment</b><small>Live supplier or shop-created products.</small></div></li><li><span>2</span><div><b>Build the decoration</b><small>Side, placement size, method, colors, and quantity.</small></div></li><li><span>3</span><div><b>Upload and position artwork</b><small>High-resolution originals and downloadable mockups.</small></div></li><li><span>4</span><div><b>Review and pay</b><small>Verified price and hosted secure checkout.</small></div></li></ol></section>

    <section id="pricing" className="launch-pricing-section"><div className="launch-section-heading"><p className="launch-kicker">PLANS THAT GROW WITH THE SHOP</p><h2>Start with the workflow you need today.</h2><p>All plans include onboarding, storefront branding, production pricing, and secure account access.</p></div><div className="launch-plan-grid">{plans.map((plan) => <article key={plan.code} className={plan.featured ? "launch-plan-card featured" : "launch-plan-card"}>{plan.featured && <span className="plan-popular">Most popular</span>}<p>{plan.name}</p><h3>${plan.price}<small>/month</small></h3><p>{plan.copy}</p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><Link className={plan.featured ? "launch-primary" : "launch-secondary"} href={`/signup?plan=${plan.code}`}>Choose {plan.name}</Link></article>)}</div><p className="launch-pricing-note">14-day trial · No customer transaction percentage added by PrintFlow · Cancel anytime</p></section>

    <section className="launch-final-cta glass-final"><p className="launch-kicker">READY TO ACCEPT BETTER ORDERS?</p><h2>Launch a storefront your customers understand and your production team can use.</h2><Link className="launch-primary light" href="/signup?plan=growth">Start your free trial</Link></section>
    <footer className="launch-footer"><Link href="/" className="launch-wordmark"><span>PF</span> PRINTFLOW</Link><p>Custom apparel commerce and production operations.</p><div><Link href="/login">Sign in</Link><Link href="/signup">Create account</Link></div></footer>
  </main>;
}
