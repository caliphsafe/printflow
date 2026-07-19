import Link from "next/link";

export default function PageBackLink({ href, label }: { href: string; label: string }) {
  return <Link className="page-back-link" href={href}><span>←</span>{label}</Link>;
}
