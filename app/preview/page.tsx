import Link from "next/link";
import { ArrowLeft, Boxes, ShieldCheck, Smartphone, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const demoProducts = [
  { sku: "PHN-001", name: "Android Smartphone 128GB", category: "Mobile phones", cost: 420000, price: 520000, stock: 8, reorder: 3 },
  { sku: "ACC-014", name: "USB-C Fast Charger", category: "Accessories", cost: 18000, price: 30000, stock: 2, reorder: 5 },
  { sku: "ACC-021", name: "Type-C Cable 1m", category: "Accessories", cost: 5000, price: 10000, stock: 24, reorder: 8 },
  { sku: "ELC-008", name: "Bluetooth Speaker", category: "Electronics", cost: 55000, price: 75000, stock: 4, reorder: 4 },
  { sku: "PHN-009", name: "Feature Phone Dual SIM", category: "Mobile phones", cost: 45000, price: 60000, stock: 11, reorder: 3 },
];

const money = (value: number) => value.toLocaleString("en-UG", { maximumFractionDigits: 0 });

export default function InventoryPreviewPage() {
  // This page is a synthetic, read-only showcase. It is never a way into operational routes.
  if (process.env.VERCEL_ENV !== "preview") {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>Preview-only page</h1>
          <p>This demonstration is available only on a Vercel Preview deployment.</p>
          <Link href="/" style={styles.link}>Return to OmniPoint</Link>
        </section>
      </main>
    );
  }

  const units = demoProducts.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = demoProducts.filter((product) => product.stock <= product.reorder).length;
  const retailValue = demoProducts.reduce((sum, product) => sum + product.stock * product.price, 0);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <Link href="/" style={styles.link}><ArrowLeft size={14} /> OmniPoint preview</Link>
          <div style={styles.eyebrow}><Boxes size={15} /> RETAIL OPERATIONS · DEMO</div>
          <h1 style={styles.title}>Inventory workspace</h1>
          <p style={styles.muted}>Explore the inventory layout using sample products and fictional UGX amounts.</p>
        </div>
        <span style={styles.badge}><span style={styles.dot} /> READ-ONLY DEMO</span>
      </header>

      <div role="note" style={styles.warning}>
        <ShieldCheck size={20} />
        <div>
          <strong>Safe preview — no production data connected</strong>
          <p>This page uses hard-coded sample data only. It does not read or write the database, authenticate staff, change stock, or perform sales and mobile-money transactions.</p>
        </div>
      </div>

      <section style={styles.stats}>
        <div style={styles.stat}><span>Sample products</span><strong>{demoProducts.length}</strong></div>
        <div style={styles.stat}><span>Sample units on hand</span><strong>{units}</strong></div>
        <div style={styles.stat}><span>At/below reorder level</span><strong>{lowStock}</strong></div>
        <div style={styles.stat}><span>Illustrative retail stock value</span><strong>UGX {money(retailValue)}</strong></div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionTitle}><Smartphone size={19} /><div><h2>Sample product catalogue</h2><p>These records are fictional and reset on every page load.</p></div></div>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead><tr>{["Product", "SKU", "Category", "Cost (UGX)", "Price (UGX)", "On hand", "Reorder at", "Status"].map((heading) => <th key={heading} style={styles.th}>{heading}</th>)}</tr></thead>
            <tbody>{demoProducts.map((product) => {
              const low = product.stock <= product.reorder;
              return <tr key={product.sku}>
                <td style={styles.td}><strong>{product.name}</strong></td>
                <td style={styles.td}><code>{product.sku}</code></td>
                <td style={styles.td}>{product.category}</td>
                <td style={styles.td}>{money(product.cost)}</td>
                <td style={styles.td}>{money(product.price)}</td>
                <td style={styles.td}>{product.stock}</td>
                <td style={styles.td}>{product.reorder}</td>
                <td style={styles.td}><span style={low ? styles.low : styles.ok}>{low ? "Restock soon" : "In stock"}</span></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p style={styles.footnote}>Sample figures only. Do not use these values for purchasing, accounting, tax, or financial decisions.</p>
      </section>

      <footer style={styles.footer}><AlertTriangle size={14} /> Demo only · Staff login and real inventory remain protected</footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: "clamp(18px, 3vw, 40px)", background: "#0c1422", color: "#f0f4fa", fontFamily: "'DM Sans', Arial, sans-serif", maxWidth: 1500, margin: "0 auto" },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 24 },
  link: { display: "inline-flex", alignItems: "center", gap: 7, color: "#a8b8ff", textDecoration: "none", fontSize: 12, marginBottom: 18 },
  eyebrow: { display: "flex", alignItems: "center", gap: 8, color: "#a8b8ff", fontSize: 10, letterSpacing: 1.4, fontWeight: 700, marginBottom: 10 },
  title: { fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: -1.2, margin: "0 0 8px" },
  muted: { color: "#8d9bb0", margin: 0, lineHeight: 1.6, maxWidth: 720 },
  badge: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #66532b", background: "#302719", color: "#ffdb9a", padding: "9px 12px", borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: 1 },
  dot: { width: 7, height: 7, borderRadius: "50%", background: "#ffcf70" },
  warning: { display: "flex", gap: 12, alignItems: "flex-start", padding: 16, border: "1px solid #66532b", background: "#211e18", borderRadius: 12, marginBottom: 22, color: "#ffdb9a", lineHeight: 1.6 },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 },
  stat: { display: "grid", gap: 10, border: "1px solid #243249", background: "#111e30", padding: 18, borderRadius: 12 },
  card: { border: "1px solid #243249", background: "#111e30", borderRadius: 14, padding: "clamp(14px, 2vw, 22px)", marginBottom: 20, minWidth: 0 },
  sectionTitle: { display: "flex", alignItems: "flex-start", gap: 11, color: "#a8b8ff", marginBottom: 18 },
  table: { width: "100%", minWidth: 850, borderCollapse: "collapse", textAlign: "left" },
  th: { padding: "12px 10px", borderBottom: "1px solid #34445c", color: "#8d9bb0", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" },
  td: { padding: "13px 10px", borderBottom: "1px solid #243249", fontSize: 12, verticalAlign: "middle" },
  low: { display: "inline-block", color: "#ffd58d", background: "#49371d", border: "1px solid #6a4e22", borderRadius: 6, padding: "4px 7px", fontWeight: 700, whiteSpace: "nowrap" },
  ok: { display: "inline-block", color: "#a8f0cf", background: "#14362b", border: "1px solid #285e49", borderRadius: 6, padding: "4px 7px", fontWeight: 700, whiteSpace: "nowrap" },
  footnote: { color: "#68778e", fontSize: 11, lineHeight: 1.6, margin: "16px 0 0" },
  footer: { display: "flex", alignItems: "center", gap: 7, color: "#8d9bb0", fontSize: 11, padding: "8px 2px 20px" },
};
