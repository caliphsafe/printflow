import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">PRINTFLOW ADMIN</p>
        <h1>Manage custom orders.</h1>
        <p>Sign in with the email invited to your print shop account.</p>
        <LoginForm />
      </section>
    </main>
  );
}
