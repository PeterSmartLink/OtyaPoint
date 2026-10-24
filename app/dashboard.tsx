"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, Boxes, BriefcaseBusiness,
  CheckCircle2, ChevronDown, CircleDollarSign, Command,
  Download, LayoutDashboard, LifeBuoy, Menu, Moon, MoreHorizontal,
  Package, Plus, Search, Settings2, ShieldCheck, ShoppingBag,
  Smartphone, Sun, Wallet, X
} from "lucide-react";

type Section = "Overview" | "Retail POS" | "Inventory" | "Fintech Agency" | "Reconciliation" | "Reports" | "Team & Access" | "Settings";

const navigation: { title: string; items: { name: Section; icon: typeof LayoutDashboard }[] }[] = [
  { title: "WORKSPACE", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "Retail POS", icon: ShoppingBag }, { name: "Inventory", icon: Boxes }, { name: "Fintech Agency", icon: Smartphone }] },
  { title: "MANAGEMENT", items: [{ name: "Reconciliation", icon: Activity }, { name: "Reports", icon: BriefcaseBusiness }, { name: "Team & Access", icon: ShieldCheck }, { name: "Settings", icon: Settings2 }] },
];

type Product = { id: string; name: string; sku: string; category: string; stock: number; status: string; sellingPrice: number; costPrice: number; reorderLevel: number };
const initialProducts: Product[] = [];
type Summary = {
  currency: string;
  inventory: { activeProducts: number; lowStock: number };
  retail: { completedSales: number; completedSalesTotal: number; ledgerBalanced: boolean };
  agency: { transactions: number; providerConfirmedAmount: number; ledgerBalanced: boolean };
};

type DashboardProps = { role: string; displayName: string; agentId: string | null };

export default function Home({ role, displayName, agentId }: DashboardProps) {
  const [section, setSection] = useState<Section>("Overview");
  const [dark, setDark] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [inventorySource, setInventorySource] = useState<"unavailable" | "cloudflare">("unavailable");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (!["Overview", "Inventory", "Retail POS"].includes(section)) return;
    let cancelled = false;
    fetch("/api/bridge/products", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || "Inventory service is unavailable.");
        if (!Array.isArray(payload.data)) throw new Error("The operations service returned an invalid inventory response.");
        return payload.data as Array<{ id: string; name: string; sku: string; category?: string | null; quantity_on_hand?: number; quantityOnHand?: number; selling_price?: number; sellingPrice?: number; cost_price?: number; costPrice?: number; reorder_level?: number; reorderLevel?: number; is_active?: number; isActive?: boolean }>;
      })
      .then((items) => {
        if (cancelled) return;
        setProducts(items.filter((p) => p.isActive !== false && p.is_active !== 0).map((p) => {
          const stock = Number(p.quantityOnHand ?? p.quantity_on_hand ?? 0);
          return { id: p.id, name: p.name, sku: p.sku, category: p.category || "General", stock, status: stock <= Number(p.reorderLevel ?? p.reorder_level ?? 0) ? "Low stock" : "In stock", sellingPrice: Number(p.sellingPrice ?? p.selling_price ?? 0), costPrice: Number(p.costPrice ?? p.cost_price ?? 0), reorderLevel: Number(p.reorderLevel ?? p.reorder_level ?? 0) };
        }));
        setInventorySource("cloudflare");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProducts([]);
        setInventorySource("unavailable");
        setNotice(error instanceof Error ? error.message : "Inventory service is unavailable. No sample records are shown.");
      });
    return () => { cancelled = true; };
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    fetch("/api/bridge/summary", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || "Business summary is unavailable.");
        return payload as Summary;
      })
      .then(data => { if (!cancelled) setSummary(data); })
      .catch(() => { if (!cancelled) setSummary(null); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [section]);

  const [serviceTab, setServiceTab] = useState<"Cash in" | "Cash out">("Cash in");
  const [amount, setAmount] = useState("");

  const filteredProducts = products.filter((p) => [p.name, p.sku, p.category].some((v) => v.toLowerCase().includes(query.toLowerCase())));

  function selectSection(name: Section) {
    setSection(name);
    setMobileNav(false);
    setNotice("");
  }

  return (
    <main className={dark ? "app-shell" : "app-shell light"}>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Command size={22} strokeWidth={2.5} /></div>
          <div><div className="brand-name">OmniPoint<span>.</span></div><div className="brand-subtitle">BUSINESS OPERATIONS</div></div>
          <button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19}/></button>
        </div>
        <div className="workspace-select">
          <div className="workspace-icon"><BriefcaseBusiness size={17}/></div>
          <div className="workspace-copy"><strong>OmniPoint UG Ltd</strong><span>Mbiriizi · Main outlet</span></div>
          <ChevronDown size={15} className="muted-icon"/>
        </div>
        <nav className="nav-groups">
          {navigation.map((group) => <div className="nav-group" key={group.title}>
            <div className="nav-label">{group.title}</div>
            {group.items.map(({name, icon: Icon}) => name === "Inventory" ? <Link key={name} href="/inventory" className={`nav-item ${section === name ? "active" : ""}`}><Icon size={18}/><span>{name}</span><span className="nav-count">Live</span></Link> : <button key={name} onClick={() => selectSection(name)} className={`nav-item ${section === name ? "active" : ""}`}><Icon size={18}/><span>{name}</span></button>)}
          </div>)}
        {(role === "MANAGING_DIRECTOR" || role === "CHAIRMAN" || role === "SOVEREIGN") && <div className="nav-group"><div className="nav-label">ACCESS CONTROL</div><Link href="/management/staff" className="nav-item"><ShieldCheck size={18}/><span>Staff onboarding</span></Link></div>}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card"><div className="security-icon"><ShieldCheck size={17}/></div><div><strong>Protected operations</strong><span>Staff access and provider status are enforced server-side.</span></div><CheckCircle2 size={15} className="success-icon"/></div>
          <button className="nav-item support-link" onClick={() => setNotice("Support centre is a prototype placeholder. Connect a support channel before launch.")}><LifeBuoy size={18}/><span>Help & support</span></button>
          <div className="profile-row"><div className="avatar">{displayName.trim().charAt(0).toUpperCase()}</div><div className="profile-copy"><strong>{displayName}</strong><span>{role.replaceAll("_", " ")} · {agentId ?? "Staff account"}</span></div><MoreHorizontal size={19} className="muted-icon"/></div>
        </div>
      </aside>

      {mobileNav && <button aria-label="Close navigation overlay" className="nav-overlay" onClick={() => setMobileNav(false)}/>}

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button><span>Workspace</span><span className="crumb-slash">/</span><strong>{section}</strong></div>
          <div className="top-actions"><div className="environment-pill"><span/> OPERATIONS WORKSPACE</div><button className="icon-button theme-toggle" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice("No live alerts are connected in this prototype.")}><Bell size={18}/><i/></button><div className="top-avatar">{displayName.trim().charAt(0).toUpperCase()}</div></div>
        </header>

        <div className="page-content">
          {notice && <div className="notice-banner"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16}/></button></div>}
          {section === "Overview" ? <>
            <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> {new Date().toLocaleDateString("en-UG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).toUpperCase()}</div><h1>Good day, {displayName.split(" ")[0]} <span className="wave">✳</span></h1><p className="page-description">Here’s what’s happening across your business today.</p></div><button className="secondary-button" onClick={() => setNotice("Report export will be enabled when the reporting API is connected.")}><Download size={16}/> Export report</button></div>
            
            <div className="section-heading"><div><h2>Business overview</h2><p>Retail and fintech are tracked independently.</p></div><button className="period-select" onClick={() => setNotice("Date filters will be connected to real reporting data.")}>Today <ChevronDown size={15}/></button></div>
            <div className="metric-grid">
              <Metric icon={<ShoppingBag size={18}/>} label="Retail sales" value={summaryLoading ? "Loading…" : `UGX ${Number(summary?.retail.completedSalesTotal ?? 0).toLocaleString("en-UG")}`} detail={`${summary?.retail.completedSales ?? 0} completed sales`} tone="violet" />
              <Metric icon={<Wallet size={18}/>} label="Confirmed agency volume" value={summaryLoading ? "Loading…" : `UGX ${Number(summary?.agency.providerConfirmedAmount ?? 0).toLocaleString("en-UG")}`} detail={`${summary?.agency.transactions ?? 0} recorded agency transactions`} tone="blue" />
              <Metric icon={<Boxes size={18}/>} label="Inventory items" value={summaryLoading ? "Loading…" : String(summary?.inventory.activeProducts ?? "—")} detail={`${summary?.inventory.lowStock ?? 0} at or below reorder level`} tone="amber" />
              <Metric icon={<Activity size={18}/>} label="Ledger integrity" value={summaryLoading ? "Checking…" : summary && summary.retail.ledgerBalanced && summary.agency.ledgerBalanced ? "Balanced" : "Review required"} detail="Retail and agency ledgers checked separately" tone="green" />
            </div>
            <div className="dashboard-grid">
              <div className="panel activity-panel"><div className="panel-header"><div><h3>Business activity</h3><p>Transaction activity across both ledgers</p></div><button className="icon-button" aria-label="Activity options" onClick={() => setNotice("Activity options will be available with live data.")}><MoreHorizontal size={19}/></button></div><div className="empty-chart"><div className="chart-icon"><Activity size={22}/></div><strong>No activity to display yet</strong><span>Live data will appear here after integrations and recording workflows are configured.</span><div className="chart-baseline"><i/><i/><i/><i/><i/><i/><i/></div></div><div className="legend-row"><span><i className="legend-dot retail-dot"/> Retail</span><span><i className="legend-dot fintech-dot"/> Fintech agency</span></div></div>
              <div className="panel split-panel"><div className="panel-header"><div><h3>Ledger separation</h3><p>Two distinct financial records</p></div><ShieldCheck size={19} className="panel-title-icon"/></div><div className="ledger-tile retail-tile"><div className="ledger-tile-icon"><ShoppingBag size={17}/></div><div className="ledger-tile-copy"><strong>Retail ledger</strong><span>Sales · COGS · Tax metadata</span></div><span className="ledger-status">ISOLATED</span></div><div className="ledger-tile fintech-tile"><div className="ledger-tile-icon"><Smartphone size={17}/></div><div className="ledger-tile-copy"><strong>Fintech ledger</strong><span>Float · Cash-in/out · Commission</span></div><span className="ledger-status">ISOLATED</span></div><div className="audit-note"><ShieldCheck size={16}/><span>Privileged actions will require authorization and an audit record.</span></div></div>
            </div>
            <div className="bottom-grid">
              <div className="panel inventory-panel"><div className="panel-header"><div><h3>Inventory watch</h3><p>Products at or below reorder level</p></div><Link href="/inventory" className="text-link">View inventory <ArrowUpRight size={14}/></Link></div><div className="product-list">{products.filter(p => p.stock <= 7).map(p => <div className="product-row" key={p.sku}><div className="product-icon"><Package size={17}/></div><div className="product-info"><strong>{p.name}</strong><span>{p.sku}</span></div><span className="stock-count">{p.stock} left</span><span className="status-low">Low stock</span></div>)}</div>{products.length === 0 && <div className="sample-caption">No low-stock product records to display.</div>}</div>
              <div className="panel quick-panel"><div className="panel-header"><div><h3>Quick actions</h3><p>Jump into a workflow</p></div></div><button className="quick-action" onClick={() => selectSection("Retail POS")}><div className="quick-icon violet-bg"><ShoppingBag size={17}/></div><span><strong>Open retail POS</strong><small>Start a retail sale workflow</small></span><ArrowUpRight size={16}/></button><button className="quick-action" onClick={() => selectSection("Fintech Agency")}><div className="quick-icon blue-bg"><Smartphone size={17}/></div><span><strong>Agency transaction</strong><small>Record a cash-in or cash-out</small></span><ArrowUpRight size={16}/></button><button className="quick-action" onClick={() => selectSection("Reconciliation")}><div className="quick-icon green-bg"><CircleDollarSign size={17}/></div><span><strong>Reconcile balances</strong><small>Review differences by ledger</small></span><ArrowUpRight size={16}/></button></div>
            </div>
          </> : <SectionView section={section} products={filteredProducts} query={query} setQuery={setQuery} serviceTab={serviceTab} setServiceTab={setServiceTab} amount={amount} setAmount={setAmount} inventorySource={inventorySource} onNotice={setNotice} />}
          <footer className="footer"><span>© 2026 OmniPoint UG Limited <span className="footer-sep">·</span> Powered by Otya Hold</span><span><i/> Operational records from OmniPoint services</span></footer>
        </div>
      </section>
    </main>
  );
}

function Metric({icon,label,value,detail,tone}:{icon:React.ReactNode;label:string;value:string;detail:string;tone:string}) {
  return <div className="metric-card"><div className="metric-top"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-period">TODAY</span></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}

function SectionView({section,products,query,setQuery,serviceTab,setServiceTab,amount,setAmount,inventorySource,onNotice}:{section:Section;products:Product[];query:string;setQuery:(s:string)=>void;serviceTab:"Cash in"|"Cash out";setServiceTab:(s:"Cash in"|"Cash out")=>void;amount:string;setAmount:(s:string)=>void;inventorySource:"unavailable"|"cloudflare";onNotice:(s:string)=>void}) {
  const [search, setSearch] = useState("");
  const [selectedSku, setSelectedSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", sku: "", category: "General", costPrice: "0", sellingPrice: "0", openingStock: "0", reorderLevel: "3" });
  const [adjustProductId, setAdjustProductId] = useState("");
  const [quantityDelta, setQuantityDelta] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const titles:Record<Section,string> = {"Retail POS":"Retail point of sale","Inventory":"Inventory management","Fintech Agency":"Fintech agency desk","Reconciliation":"Daily reconciliation","Reports":"Reports & exports","Team & Access":"Team & access control","Settings":"Workspace settings","Overview":"Overview"};
  const descriptions:Record<Section,string> = {"Retail POS":"Sell stocked products and record confirmed cash sales.","Inventory":"Manage the real product catalogue, opening stock, and auditable stock adjustments.","Fintech Agency":"Track provider-backed agency services. Transactions are recorded only after provider confirmation.","Reconciliation":"Review financial records and capture counted balances separately for each ledger.","Reports":"Export actual operational records for business review.","Team & Access":"Review role-based access to the OmniPoint workspace.","Settings":"Review workspace identity and integration status.","Overview":""};

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/bridge/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: newProduct.name, sku: newProduct.sku, category: newProduct.category,
        costPrice: Number(newProduct.costPrice), sellingPrice: Number(newProduct.sellingPrice),
        openingStock: Number(newProduct.openingStock), reorderLevel: Number(newProduct.reorderLevel)
      }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { onNotice(payload.message || payload.error || "Product was not saved."); return; }
      onNotice("Product saved to OmniPoint, including its opening-stock record.");
      window.location.reload();
    } catch { onNotice("Inventory service unavailable. Product was not saved."); }
    finally { setSaving(false); }
  }

  async function adjustStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/bridge/stock-adjustments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        productId: adjustProductId, quantityDelta: Number(quantityDelta), reason: adjustmentReason
      }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { onNotice(payload.message || payload.error || "Stock adjustment was not saved."); return; }
      onNotice("Stock adjustment recorded with an audit event.");
      window.location.reload();
    } catch { onNotice("Inventory service unavailable. No stock adjustment was confirmed."); }
    finally { setSaving(false); }
  }

  async function completeSale(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = products.find(p => p.sku === selectedSku);
    const qty = Number(quantity);
    if (!selected) { onNotice("Select an available product first."); return; }
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > selected.stock) { onNotice("Enter a whole quantity within the available stock."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/bridge/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ paymentMethod: "CASH", items: [{ productId: selected.id, quantity: qty }] })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { onNotice(payload.message || payload.detail || payload.error || "Sale was not completed. No success was recorded."); return; }
      onNotice("Cash sale recorded. Receipt: " + (payload.data?.receiptNumber || "issued by OmniPoint"));
      window.location.reload();
    } catch { onNotice("Sales service unavailable. No sale was confirmed."); }
    finally { setSaving(false); }
  }

  async function submitAgencyRequest() {
    if (!amount || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0) { onNotice("Enter a valid amount in UGX."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/bridge/agency-transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionType: serviceTab === "Cash in" ? "CASH_IN" : "CASH_OUT", amount: Number(amount), currency: "UGX" }) });
      const payload = await response.json().catch(() => ({}));
      onNotice(payload.detail || payload.message || payload.error || "Provider operation was not confirmed.");
    } catch { onNotice("Agency provider service unavailable. No transaction was confirmed."); }
    finally { setSaving(false); }
  }

  async function exportLedger(type: "RETAIL" | "FINTECH_AGENCY") {
    setSaving(true);
    try {
      const response = await fetch("/api/bridge/ledger?type=" + type, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload.data)) { onNotice(payload.message || payload.error || "Ledger export is unavailable."); return; }
      const rows = payload.data as Array<Record<string, unknown>>;
      const keys = ["effective_at","ledger_type","account_code","currency","debit","credit","source_type","source_id","description"];
      const quote = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
      const csv = [keys.join(","), ...rows.map(row => keys.map(key => quote(row[key])).join(","))].join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = "omnipoint-" + type.toLowerCase() + "-ledger-" + new Date().toISOString().slice(0,10) + ".csv";
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      onNotice("Ledger export created from " + rows.length + " stored entries.");
    } catch { onNotice("Ledger export service unavailable."); }
    finally { setSaving(false); }
  }

  const selectedProduct = products.find(p => p.sku === selectedSku);
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
  return <div className="subpage">
    <div className="welcome-row"><div><div className="eyebrow">OMNIPOINT WORKSPACE</div><h1>{titles[section]}</h1><p className="page-description">{descriptions[section]}</p></div></div>
    {section === "Inventory" && <>
      <div className="panel table-panel">
        <div className="panel-header"><div><h3>Product catalogue</h3><p>{inventorySource === "cloudflare" ? "Current inventory records from OmniPoint's operations database" : "The operations service is unavailable. No sample records are displayed."}</p></div><button className="secondary-button" onClick={() => setShowProductForm(!showProductForm)}><Plus size={16}/>{showProductForm ? "Cancel" : "Add product"}</button></div>
        {showProductForm && <form onSubmit={createProduct} className="product-form">
          <label className="field-label">Product name<input required minLength={2} maxLength={180} className="form-input" value={newProduct.name} onChange={e=>setNewProduct({...newProduct,name:e.target.value})}/></label>
          <label className="field-label">SKU / code<input required pattern="[A-Za-z0-9][A-Za-z0-9._-]{1,63}" className="form-input" value={newProduct.sku} onChange={e=>setNewProduct({...newProduct,sku:e.target.value.toUpperCase()})}/></label>
          <label className="field-label">Category<input maxLength={80} className="form-input" value={newProduct.category} onChange={e=>setNewProduct({...newProduct,category:e.target.value})}/></label>
          <label className="field-label">Cost price (UGX)<input required type="number" min="0" step="1" className="form-input" value={newProduct.costPrice} onChange={e=>setNewProduct({...newProduct,costPrice:e.target.value})}/></label>
          <label className="field-label">Selling price (UGX)<input required type="number" min="0" step="1" className="form-input" value={newProduct.sellingPrice} onChange={e=>setNewProduct({...newProduct,sellingPrice:e.target.value})}/></label>
          <label className="field-label">Opening stock<input required type="number" min="0" step="1" className="form-input" value={newProduct.openingStock} onChange={e=>setNewProduct({...newProduct,openingStock:e.target.value})}/></label>
          <label className="field-label">Reorder level<input required type="number" min="0" step="1" className="form-input" value={newProduct.reorderLevel} onChange={e=>setNewProduct({...newProduct,reorderLevel:e.target.value})}/></label>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save product and opening stock"}</button>
        </form>}
        <div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, SKU, category…"/></div>
        <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>STOCK</th><th>SELLING PRICE (UGX)</th><th>STATUS</th></tr></thead><tbody>{products.filter(p=>[p.name,p.sku,p.category].some(v=>v.toLowerCase().includes(query.toLowerCase()))).map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td className="mono">{p.sku}</td><td>{p.category}</td><td>{p.stock}</td><td>{p.sellingPrice.toLocaleString("en-UG")}</td><td><span className={p.stock<=p.reorderLevel?"status-low":"status-ok"}>{p.status}</span></td></tr>)}</tbody></table></div>
        {products.length===0 && <p className="empty-state">{inventorySource==="cloudflare" ? "No products have been recorded yet. Add your first real product above." : "Inventory records could not be loaded."}</p>}
      </div>
      {products.length>0 && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Stock adjustment</h3><p>Every adjustment records the operator and reason.</p></div><Boxes size={20} className="panel-title-icon"/></div>
        <form className="product-form" onSubmit={adjustStock}>
          <label className="field-label">Product<select className="form-input" required value={adjustProductId} onChange={e=>setAdjustProductId(e.target.value)}><option value="">Select product</option>{products.map(p=><option value={p.id} key={p.id}>{p.name} · {p.sku} · {p.stock} on hand</option>)}</select></label>
          <label className="field-label">Quantity change (+/-)<input className="form-input" required type="number" step="1" min="-100000000" value={quantityDelta} onChange={e=>setQuantityDelta(e.target.value)}/></label>
          <label className="field-label">Reason<input className="form-input" required minLength={4} maxLength={500} value={adjustmentReason} onChange={e=>setAdjustmentReason(e.target.value)}/></label>
          <button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Record stock adjustment"}</button>
        </form>
      </div>}
    </>}
    {section === "Retail POS" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>New cash sale</h3><p>Stock, receipt, ledger entries, and audit history are posted together.</p></div><ShoppingBag size={20} className="panel-title-icon"/></div><form onSubmit={completeSale} className="product-form"><label className="field-label">Find a product<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or SKU"/></label><label className="field-label">Product<select className="form-input" required value={selectedSku} onChange={e=>setSelectedSku(e.target.value)}><option value="">Select product</option>{filtered.filter(p=>p.stock>0).map(p=><option key={p.id} value={p.sku}>{p.name} · {p.sku} · {p.stock} available · UGX {p.sellingPrice.toLocaleString("en-UG")}</option>)}</select></label><label className="field-label">Quantity<input className="form-input" required type="number" min="1" max={selectedProduct?.stock ?? 1} step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><div className="sale-total"><span>Total due</span><strong>UGX {((selectedProduct?.sellingPrice ?? 0) * Math.max(0, Number(quantity)||0)).toLocaleString("en-UG")}</strong></div><button className="primary-button" type="submit" disabled={saving || products.length===0}>{saving ? "Posting sale…" : "Complete cash sale"}</button></form>{products.length===0 && <p className="empty-state">No available stock is recorded. Add inventory before creating a sale.</p>}</div>}
    {section === "Fintech Agency" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Agency transaction</h3><p>Mobile-money execution requires a verified provider connection.</p></div><Smartphone size={20} className="panel-title-icon"/></div><div className="segmented"><button type="button" className={serviceTab==="Cash in"?"selected":""} onClick={()=>setServiceTab("Cash in")}>Cash in</button><button type="button" className={serviceTab==="Cash out"?"selected":""} onClick={()=>setServiceTab("Cash out")}>Cash out</button></div><label className="field-label">Amount (UGX)</label><input className="form-input" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9]/g,""))} placeholder="Enter amount"/><div className="inline-warning"><ShieldCheck size={17}/><span>Provider execution is not yet configured. No mobile-money request will be sent or marked successful from this workspace until an approved adapter and callback verification are enabled.</span></div><button className="primary-button" disabled>Provider connection required</button></div>}
    {section === "Reconciliation" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Ledger reconciliation</h3><p>Export actual ledger entries to compare with cash counts and provider statements.</p></div><Activity size={20} className="panel-title-icon"/></div><div className="report-item"><div><strong>Retail ledger</strong><span>Sales receipts, cash and cost-of-goods entries</span></div><button className="secondary-button" onClick={()=>exportLedger("RETAIL")} disabled={saving}>Export ledger CSV</button></div><div className="report-item"><div><strong>Agency ledger</strong><span>Provider-confirmed activity only</span></div><button className="secondary-button" onClick={()=>exportLedger("FINTECH_AGENCY")} disabled={saving}>Export ledger CSV</button></div><div className="inline-warning"><ShieldCheck size={17}/><span>Final reconciliation approval requires counted balances and provider statements; no reconciliation is marked complete automatically.</span></div></div>}
    {section === "Reports" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Operational reports</h3><p>Exports are generated from stored records, not illustrative figures.</p></div><Download size={20} className="panel-title-icon"/></div><div className="report-item"><div className="quick-icon violet-bg"><ShoppingBag size={18}/></div><div><strong>Retail ledger</strong><span>Posted sales, cash and inventory accounting entries</span></div><button className="secondary-button" onClick={()=>exportLedger("RETAIL")} disabled={saving}>Export CSV <Download size={14}/></button></div><div className="report-item"><div className="quick-icon blue-bg"><Wallet size={18}/></div><div><strong>Agency ledger</strong><span>Provider-confirmed agency accounting entries</span></div><button className="secondary-button" onClick={()=>exportLedger("FINTECH_AGENCY")} disabled={saving}>Export CSV <Download size={14}/></button></div></div>}
    {section === "Team & Access" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Team access</h3><p>Access is granted only to identities with an active OmniPoint staff membership.</p></div><ShieldCheck size={20} className="panel-title-icon"/></div><div className="inline-warning"><ShieldCheck size={17}/><span>Staff provisioning is restricted to the approved management process. No users or roles are fabricated on this screen.</span></div><p className="empty-state">Staff records are managed through the secured staff administration workflow.</p></div>}
    {section === "Settings" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Workspace configuration</h3><p>Business configuration and integration readiness.</p></div><Settings2 size={20} className="panel-title-icon"/></div>{[["Business identity","OmniPoint UG Limited"],["Base currency","UGX — Ugandan shilling"],["Accounting streams","Retail and fintech agency · separate"],["Tax integration","EFRIS · integration approval required"],["Mobile money","Provider adapter and credentials required"],["Alerts","Notification provider configuration required"]].map(([k,v])=><div className="setting-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>}
  </div>;
}
