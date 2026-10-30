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

const initialProducts: Array<{ name: string; sku: string; category: string; stock: number; status: string }> = [];

type DashboardProps = { role: string; displayName: string; agentId: string | null };

export default function Home({ role, displayName, agentId }: DashboardProps) {
  const [section, setSection] = useState<Section>("Overview");
  const [dark, setDark] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [products, setProducts] = useState<Array<{ name: string; sku: string; category: string; stock: number; status: string }>>([]);
  const [inventorySource, setInventorySource] = useState<"cloudflare" | "unavailable">("unavailable");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bridge/products", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || "Cloudflare inventory is not connected.");
        if (!Array.isArray(payload.data)) throw new Error("Cloudflare returned an unexpected inventory response.");
        return payload.data as Array<{ name: string; sku: string; category?: string | null; quantityOnHand: number; isActive: boolean }>;
      })
      .then((items) => {
        if (cancelled) return;
        setProducts(items.filter((p) => p.isActive).map((p) => ({ name: p.name, sku: p.sku, category: p.category || "Uncategorised", stock: p.quantityOnHand, status: p.quantityOnHand <= 7 ? "Low stock" : "In stock" })));
        setInventorySource("cloudflare");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProducts([]);
        setInventorySource("unavailable");
        setNotice(error instanceof Error ? error.message : "Inventory service is currently unavailable.");
      });
    return () => { cancelled = true; };
  }, []);
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
          <div><div className="brand-name">OtyaPoint<span>.</span></div><div className="brand-subtitle">BUSINESS OPERATIONS</div></div>
          <button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19}/></button>
        </div>
        <div className="workspace-select">
          <div className="workspace-icon"><BriefcaseBusiness size={17}/></div>
          <div className="workspace-copy"><strong>OtyaPoint</strong><span>Mbirizi · Main outlet</span></div>
          <ChevronDown size={15} className="muted-icon"/>
        </div>
        <nav className="nav-groups">
          {navigation.map((group) => <div className="nav-group" key={group.title}>
            <div className="nav-label">{group.title}</div>
            {group.items.map(({name, icon: Icon}) => name === "Inventory" ? <Link key={name} href="/inventory" className={`nav-item ${section === name ? "active" : ""}`}><Icon size={18}/><span>{name}</span><span className="nav-count">Open</span></Link> : <button key={name} onClick={() => selectSection(name)} className={`nav-item ${section === name ? "active" : ""}`}><Icon size={18}/><span>{name}</span></button>)}
          </div>)}
        {(role === "MANAGING_DIRECTOR" || role === "CHAIRMAN" || role === "SOVEREIGN") && <div className="nav-group"><div className="nav-label">ACCESS CONTROL</div><Link href="/management/staff" className="nav-item"><ShieldCheck size={18}/><span>Staff onboarding</span></Link></div>}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card"><div className="security-icon"><ShieldCheck size={17}/></div><div><strong>Financial controls enabled by authorization</strong><span>Payment actions require approved provider integrations.</span></div><CheckCircle2 size={15} className="success-icon"/></div>
          <button className="nav-item support-link" onClick={() => setNotice("Help centre is not connected yet. Contact your system administrator for assistance.")}><LifeBuoy size={18}/><span>Help & support</span></button>
          <div className="profile-row"><div className="avatar">{displayName.trim().charAt(0).toUpperCase()}</div><div className="profile-copy"><strong>{displayName}</strong><span>{role.replaceAll("_", " ")} · {agentId ?? "Staff account"}</span></div><MoreHorizontal size={19} className="muted-icon"/></div>
        </div>
      </aside>

      {mobileNav && <button aria-label="Close navigation overlay" className="nav-overlay" onClick={() => setMobileNav(false)}/>}

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button><span>Workspace</span><span className="crumb-slash">/</span><strong>{section}</strong></div>
          <div className="top-actions"><div className="environment-pill"><span/> OTYAPOINT WORKSPACE</div><button className="icon-button theme-toggle" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice("No new notifications.")}><Bell size={18}/><i/></button><div className="top-avatar">{displayName.trim().charAt(0).toUpperCase()}</div></div>
        </header>

        <div className="page-content">
          {notice && <div className="notice-banner"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16}/></button></div>}
          {section === "Overview" ? <>
            <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> {new Intl.DateTimeFormat("en-UG", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</div><h1>Good day, {displayName.split(" ")[0]} <span className="wave">✳</span></h1><p className="page-description">Here’s what’s happening across your business today.</p></div><button className="secondary-button" onClick={() => setNotice("Report export will be enabled when the reporting API is connected.")}><Download size={16}/> Export report</button></div>
            
            <div className="section-heading"><div><h2>Business overview</h2><p>Retail and fintech are tracked independently.</p></div><button className="period-select" onClick={() => setNotice("Date filters will be connected to real reporting data.")}>Today <ChevronDown size={15}/></button></div>
            <div className="metric-grid">
              <Metric icon={<ShoppingBag size={18}/>} label="Retail sales" value="UGX —" detail="No sales recorded for this period" tone="violet" />
              <Metric icon={<Wallet size={18}/>} label="Fintech commissions" value="UGX —" detail="No commission records available" tone="blue" />
              <Metric icon={<Boxes size={18}/>} label="Inventory items" value={inventorySource === "cloudflare" ? String(products.length) : "—"} detail={inventorySource === "cloudflare" ? "Products in catalogue" : "Inventory records unavailable"} tone="amber" />
              <Metric icon={<Activity size={18}/>} label="Reconciliation" value="Not started" detail="No reconciliation records" tone="green" />
            </div>
            <div className="dashboard-grid">
              <div className="panel activity-panel"><div className="panel-header"><div><h3>Business activity</h3><p>Transaction activity across both ledgers</p></div><button className="icon-button" aria-label="Activity options" onClick={() => setNotice("Activity options are not available yet.")}><MoreHorizontal size={19}/></button></div><div className="empty-chart"><div className="chart-icon"><Activity size={22}/></div><strong>No activity to display yet</strong><span>Activity will appear here when transactions are recorded.</span><div className="chart-baseline"><i/><i/><i/><i/><i/><i/><i/></div></div><div className="legend-row"><span><i className="legend-dot retail-dot"/> Retail</span><span><i className="legend-dot fintech-dot"/> Fintech agency</span></div></div>
              <div className="panel split-panel"><div className="panel-header"><div><h3>Ledger separation</h3><p>Two distinct financial records</p></div><ShieldCheck size={19} className="panel-title-icon"/></div><div className="ledger-tile retail-tile"><div className="ledger-tile-icon"><ShoppingBag size={17}/></div><div className="ledger-tile-copy"><strong>Retail ledger</strong><span>Sales · COGS · Tax metadata</span></div><span className="ledger-status">ISOLATED</span></div><div className="ledger-tile fintech-tile"><div className="ledger-tile-icon"><Smartphone size={17}/></div><div className="ledger-tile-copy"><strong>Fintech ledger</strong><span>Float · Cash-in/out · Commission</span></div><span className="ledger-status">ISOLATED</span></div><div className="audit-note"><ShieldCheck size={16}/><span>Privileged actions will require authorization and an audit record.</span></div></div>
            </div>
            <div className="bottom-grid">
              <div className="panel inventory-panel"><div className="panel-header"><div><h3>Inventory watch</h3><p>Products requiring stock attention</p></div><Link href="/inventory" className="text-link">View inventory <ArrowUpRight size={14}/></Link></div><div className="product-list">{products.filter(p => p.stock <= 7).map(p => <div className="product-row" key={p.sku}><div className="product-icon"><Package size={17}/></div><div className="product-info"><strong>{p.name}</strong><span>{p.sku}</span></div><span className="stock-count">{p.stock} left</span><span className="status-low">Low stock</span></div>)}{products.filter(p => p.stock <= 7).length === 0 && <div className="empty-state">No low-stock items to show.</div>}</div></div>
              <div className="panel quick-panel"><div className="panel-header"><div><h3>Quick actions</h3><p>Jump into a workflow</p></div></div><button className="quick-action" onClick={() => selectSection("Retail POS")}><div className="quick-icon violet-bg"><ShoppingBag size={17}/></div><span><strong>Open retail POS</strong><small>Open the retail checkout workspace</small></span><ArrowUpRight size={16}/></button><button className="quick-action" onClick={() => selectSection("Fintech Agency")}><div className="quick-icon blue-bg"><Smartphone size={17}/></div><span><strong>Agency transaction</strong><small>Open mobile money agency tools</small></span><ArrowUpRight size={16}/></button><button className="quick-action" onClick={() => selectSection("Reconciliation")}><div className="quick-icon green-bg"><CircleDollarSign size={17}/></div><span><strong>Reconcile balances</strong><small>Compare cash, float and ledger records</small></span><ArrowUpRight size={16}/></button></div>
            </div>
          </> : <SectionView section={section} products={filteredProducts} query={query} setQuery={setQuery} serviceTab={serviceTab} setServiceTab={setServiceTab} amount={amount} setAmount={setAmount} inventorySource={inventorySource} onNotice={setNotice} />}
          <footer className="footer"><span>© 2026 OtyaPoint <span className="footer-sep">·</span> A business system by Otya Hold Ltd</span><span><i/> Business operations workspace</span></footer>
        </div>
      </section>
    </main>
  );
}

function Metric({icon,label,value,detail,tone}:{icon:React.ReactNode;label:string;value:string;detail:string;tone:string}) {
  return <div className="metric-card"><div className="metric-top"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-period">TODAY</span></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}

function SectionView({section,products,query,setQuery,serviceTab,setServiceTab,amount,setAmount,inventorySource,onNotice}:{section:Section;products:typeof initialProducts;query:string;setQuery:(s:string)=>void;serviceTab:"Cash in"|"Cash out";setServiceTab:(s:"Cash in"|"Cash out")=>void;amount:string;setAmount:(s:string)=>void;inventorySource:"cloudflare"|"unavailable";onNotice:(s:string)=>void}) {
  const [search, setSearch] = useState("");
  const [sku, setSku] = useState("");
  const titles:Record<Section,string> = {"Retail POS":"Retail point of sale","Inventory":"Inventory management","Fintech Agency":"Fintech agency desk","Reconciliation":"Daily reconciliation","Reports":"Reports & exports","Team & Access":"Team & access control","Settings":"Workspace settings","Overview":"Overview"};
  const descriptions:Record<Section,string> = {"Retail POS":"Build a retail cart and prepare a sale.","Inventory":"Track product records, variants, and stock alerts.","Fintech Agency":"Record agency service activity separately from retail.","Reconciliation":"Review retail cash and agency balances independently.","Reports":"Prepare clear, auditable business reports.","Team & Access":"Manage staff roles and privileged permissions.","Settings":"Configure the OtyaPoint workspace.","Overview":""};
  return <div className="subpage"><div className="welcome-row"><div><div className="eyebrow">OTYAPOINT WORKSPACE</div><h1>{titles[section]}</h1><p className="page-description">{descriptions[section]}</p></div></div>
    
    {section === "Inventory" && <div className="panel table-panel"><div className="panel-header"><div><h3>Product catalogue</h3><p>{inventorySource === "cloudflare" ? "Product records" : "Product catalogue"}</p></div><button className="secondary-button" onClick={() => onNotice("Product creation requires the inventory API and database.")}><Plus size={16}/> Add product</button></div><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, SKU, category…"/></div><div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>STOCK</th><th>STATUS</th></tr></thead><tbody>{products.map(p=><tr key={p.sku}><td><strong>{p.name}</strong></td><td className="mono">{p.sku}</td><td>{p.category}</td><td>{p.stock}</td><td><span className={p.stock<=7?"status-low":"status-ok"}>{p.status}</span></td></tr>)}{products.length===0&&<tr><td colSpan={5} className="empty-state">{inventorySource==="unavailable"?"Inventory records are not available right now. Try again later.":"No products have been added yet."}</td></tr>}</tbody></table></div></div>}
    {section === "Retail POS" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>New retail sale</h3><p>Create a sale from the current product catalogue.</p></div><ShoppingBag size={20} className="panel-title-icon"/></div><label className="field-label">Find a product by name or SKU</label><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"/></div><div className="pos-product-grid">{products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.sku.toLowerCase().includes(search.toLowerCase())).map(p=><button className="pos-product" key={p.sku} onClick={()=>setSku(p.sku)}><div className="product-icon"><Package size={20}/></div><strong>{p.name}</strong><span>{p.sku}</span><small>{p.stock} units</small></button>)}{products.length===0&&<div className="empty-state">No products are available. Add products to the catalogue before starting a sale.</div>}</div><div className="cart-summary"><div><strong>Selected item</strong><span>{sku ? products.find(p=>p.sku===sku)?.name : "No item selected"}</span></div><button className="primary-button" onClick={()=>onNotice(sku ? "Sale review is not available until the sales API is configured." : "Choose a product first.")}>Review sale <ArrowUpRight size={15}/></button></div></div>}
    {section === "Fintech Agency" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Agency service record</h3><p>Record and review agency service activity.</p></div><Smartphone size={20} className="panel-title-icon"/></div><div className="segmented"><button className={serviceTab==="Cash in"?"selected":""} onClick={()=>setServiceTab("Cash in")}><ArrowDownLeft size={16}/> Cash in</button><button className={serviceTab==="Cash out"?"selected":""} onClick={()=>setServiceTab("Cash out")}><ArrowUpRight size={16}/> Cash out</button></div><label className="field-label">Amount (UGX)</label><input className="form-input" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9]/g,""))} placeholder="Enter amount"/><div className="inline-warning"><ShieldCheck size={17}/><span>Never enter a customer PIN or OTP here. Provider execution must use an approved, secure integration.</span></div><button className="primary-button" onClick={()=>onNotice(amount && Number(amount)>0 ? `Draft amount entered: UGX ${Number(amount).toLocaleString("en-UG")}. No transaction was submitted or recorded.` : "Enter a valid amount.")}>Prepare draft <ArrowUpRight size={16}/></button></div>}
    {section === "Reconciliation" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Ledger reconciliation</h3><p>Separate checks for each accounting stream</p></div><Activity size={20} className="panel-title-icon"/></div><div className="recon-row"><div className="ledger-tile-icon"><ShoppingBag size={18}/></div><div className="ledger-tile-copy"><strong>Retail cash reconciliation</strong><span>Expected cash vs counted cash · Retail ledger only</span></div><span className="status-pending">NOT STARTED</span></div><div className="recon-row"><div className="ledger-tile-icon"><Smartphone size={18}/></div><div className="ledger-tile-copy"><strong>Agency float reconciliation</strong><span>Cash, provider balances and recorded float movements</span></div><span className="status-pending">NOT STARTED</span></div><button className="secondary-button" onClick={()=>onNotice("Reconciliation needs persisted transactions, counted balances, and provider statements.")}>Review requirements</button></div>}
    {section === "Reports" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Available report templates</h3><p>Exports will be enabled after backend and compliance validation.</p></div><Download size={20} className="panel-title-icon"/></div><div className="report-item"><div className="quick-icon violet-bg"><ShoppingBag size={18}/></div><div><strong>Retail sales & stock</strong><span>Sales, COGS, stock movements, invoice metadata</span></div><button className="secondary-button" onClick={()=>onNotice("Report generation is not available until reporting data is connected.")}>Export <Download size={14}/></button></div><div className="report-item"><div className="quick-icon blue-bg"><Wallet size={18}/></div><div><strong>Fintech agency ledger</strong><span>Cash-in/out, float changes, commissions, volumes</span></div><button className="secondary-button" onClick={()=>onNotice("No report generated: provider and ledger data are not connected.")}>Export <Download size={14}/></button></div><div className="report-item"><div className="quick-icon green-bg"><ShieldCheck size={18}/></div><div><strong>Audit trail</strong><span>Privileged actions, approvals and change history</span></div><button className="secondary-button" onClick={()=>onNotice("Audit export will be available after audit storage is implemented.")}>Export <Download size={14}/></button></div></div>}
    {section === "Team & Access" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Access model</h3><p>Role definitions and access boundaries</p></div><ShieldCheck size={20} className="panel-title-icon"/></div>{[["Attendant","POS access, permitted service records, own shift"],["Manager","Shift oversight, stock management, approved reversals"],["Managing director","Reports, controls, team and operational oversight"],["Chairman / root admin","Privileged configuration with strong verification and audit"]].map(([role,desc])=><div className="report-item" key={role}><div className="avatar role-avatar">{role[0]}</div><div><strong>{role}</strong><span>{desc}</span></div><span className="status-pending">PLANNED</span></div>)}<div className="inline-warning"><ShieldCheck size={17}/><span>Root access must not bypass audit logging. High-risk actions should require re-authentication and, where possible, a second approver.</span></div></div>}
    {section === "Settings" && <div className="panel workflow-panel"><div className="panel-header"><div><h3>Workspace configuration</h3><p>Core settings for OtyaPoint T/A OmniPoint</p></div><Settings2 size={20} className="panel-title-icon"/></div>{[["Business identity","OtyaPoint"],["Base currency","UGX — Ugandan shilling"],["Accounting streams","Retail and fintech agency · separate"],["Tax integration","EFRIS integration requires validation"],["Mobile money","MTN / Airtel provider adapters planned"],["Alerts","Telegram notifications require bot configuration"]].map(([k,v])=><div className="setting-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>}
  </div>;
}
