import Link from "next/link";

export default function HomePage(){
 return <main className="marketing-shell"><div className="marketing-card"><p className="eyebrow">PRINTFLOW PILOT</p><h1>Custom apparel ordering without the bloated platform.</h1><p>The pilot includes a white-label shirt designer, Squarespace checkout handoff, private artwork storage, Google delivery and a protected shop dashboard.</p><p><Link className="secondary-button" href="/s/demo-print-shop">Open demo designer</Link> <Link className="secondary-button" href="/login">Admin login</Link></p></div></main>;
}
