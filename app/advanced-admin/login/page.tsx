import Link from "next/link";
import AdvancedAdminLoginForm from "@/components/AdvancedAdminLoginForm";

export default async function AdvancedAdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const message = query.error === "not-authorized"
    ? "This login is not attached to the Advanced Embroidery PrintFlow account."
    : "";

  return (
    <main className="ae-login-shell">
      <section className="ae-login-brand">
        <div className="ae-mark large">AE</div>
        <p className="ae-kicker">ADVANCED EMBROIDERY & SCREEN PRINTING</p>
        <h1>Your shop, without the software clutter.</h1>
        <p>Orders, products, pricing, customers, school uniforms, SanMar and Square—all in one simple staff workspace.</p>
        <Link href="https://adv-emb-sp.vercel.app/" className="ae-text-link">← Return to Advanced website</Link>
      </section>
      <section className="ae-login-card">
        <p className="ae-kicker red">STAFF LOGIN</p>
        <h2>Advanced Admin</h2>
        <p>Use the email or Google account attached to the Advanced PrintFlow organization.</p>
        <AdvancedAdminLoginForm initialError={message} />
      </section>
    </main>
  );
}
