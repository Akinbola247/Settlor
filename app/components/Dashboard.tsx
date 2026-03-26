/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { setCookie } from "cookies-next";
import SendModal from "@/app/components/SendModal";
import InvoiceModal from "@/app/components/InvoiceModal";
import InvoiceDetailModal from "@/app/components/InvoiceDetailModal";
import { useInvoices, Invoice, invoiceTotal, formatUSDC, getStatusColor, InvoiceStatus } from "@/app/lib/useInvoices";

type Wallet = { id: string; address: string; blockchain: string; [key: string]: unknown };
type Tab = "overview" | "invoices" | "payments";
type InvoiceView = "sent" | "received";

export default function Dashboard({ wallet, usdcBalance }: { wallet: Wallet; usdcBalance: string | null }) {
  const [activeTab,       setActiveTab]       = useState<Tab>("overview");
  const [showSend,        setShowSend]        = useState(false);
  const [showNewInvoice,  setShowNewInvoice]  = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceView,     setInvoiceView]     = useState<InvoiceView>("received");
  const [filterStatus,    setFilterStatus]    = useState<InvoiceStatus | "all">("all");
  const [copied,          setCopied]          = useState(false);

  const { invoices, refresh, create, markPaid, remove } = useInvoices(wallet.address);
  useEffect(() => { void refresh(); }, [refresh]);

  const handlePaid = async (inv: Invoice, txSteps: any[]) => {
    const txHash = txSteps?.find((s: any) => s.name === "mint")?.explorerUrl;
    await markPaid(inv.id, txHash);
    setSelectedInvoice(null);
  };

  const handleLogout = () => {
    ["userToken","encryptionKey","deviceToken","deviceEncryptionKey","appId","google.clientId"]
      .forEach(k => setCookie(k, ""));
    window.location.reload();
  };

  const balance = usdcBalance ? parseFloat(usdcBalance) : 0;
  const displayedInvoices = (invoiceView === "sent" ? invoices.sent : invoices.received)
    .filter(inv => filterStatus === "all" || inv.status === filterStatus);

  const stats = {
    totalSent:        invoices.sent.length,
    paid:             invoices.sent.filter(i => i.status === "paid").length,
    pendingReceived:  invoices.received.filter(i => i.status === "pending").length,
    totalReceived:    invoices.sent.filter(i => i.status === "paid").reduce((s, i) => s + invoiceTotal(i), 0),
    totalOutstanding: invoices.received.filter(i => i.status === "pending").reduce((s, i) => s + invoiceTotal(i), 0),
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="glass-nav sticky top-0 z-40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-extrabold gradient-text tracking-tight">iPayX</h1>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="nav-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 mr-1">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Log out
            </button>
            {/* <div className="avatar">{wallet.address.slice(2, 4).toUpperCase()}</div> */}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto flex gap-8 p-8">
        <aside className="w-60 flex-shrink-0">
          <div className="glass-card rounded-2xl p-2">
            {(["overview","invoices","payments"] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`sidebar-item ${activeTab === tab ? "active" : ""}`}>
                {tab === "overview" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                {tab === "invoices" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>}
                {tab === "payments" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>}
                <span className="capitalize">{tab}</span>
                {tab === "invoices" && stats.pendingReceived > 0 && (
                  <span className="ml-auto bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {stats.pendingReceived}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {activeTab === "overview" && (
            <>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-white">Welcome back</h2>
                <button onClick={() => setShowNewInvoice(true)} className="primary-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>
                  New Invoice
                </button>
              </div>

              <div className="balance-card rounded-2xl p-8 mb-6">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Unified USDC Balance · Arc Testnet</p>
                    <h1 className="text-5xl font-extrabold text-white leading-none">
                      ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xl font-semibold text-slate-400 ml-2">USDC</span>
                    </h1>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowSend(true)} className="action-btn">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                      Send
                    </button>
                    {/* <button onClick={() => setShowSend(true)} className="action-btn">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                      Receive
                    </button> */}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider block mb-2">Your Arc Address</span>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-slate-200 font-mono text-sm overflow-hidden text-ellipsis">
                        {wallet.address}
                      </code>
                      <button className="copy-btn" onClick={() => {
                        navigator.clipboard.writeText(wallet.address);
                        setCopied(true); setTimeout(() => setCopied(false), 2000);
                      }}>
                        {copied
                          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-emerald-400"><path d="M20 6L9 17l-5-5"/></svg>
                          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs font-medium uppercase tracking-wider block mb-2">Network</span>
                    <span className="network-badge">{wallet.blockchain}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="stat-card">
                  <div className="text-2xl">📤</div>
                  <div>
                    <p className="text-slate-400 text-xs font-medium mb-1">Invoices Sent</p>
                    <p className="text-white text-3xl font-bold">{stats.totalSent}</p>
                    {stats.totalReceived > 0 && <p className="text-emerald-400 text-xs">${formatUSDC(stats.totalReceived)} received</p>}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="text-2xl">✅</div>
                  <div>
                    <p className="text-slate-400 text-xs font-medium mb-1">Paid</p>
                    <p className="text-white text-3xl font-bold">{stats.paid}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="text-2xl">📥</div>
                  <div>
                    <p className="text-slate-400 text-xs font-medium mb-1">Awaiting Payment</p>
                    <p className="text-white text-3xl font-bold">{stats.pendingReceived}</p>
                    {stats.totalOutstanding > 0 && <p className="text-amber-400 text-xs">${formatUSDC(stats.totalOutstanding)} due</p>}
                  </div>
                </div>
              </div>

              {invoices.received.filter(i => i.status === "pending").length > 0 && (
                <div className="glass-card rounded-2xl p-6 mb-4 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-amber-400">⚠️ Invoices Awaiting Your Payment</h3>
                    <button onClick={() => { setActiveTab("invoices"); setInvoiceView("received"); }}
                      className="text-xs text-amber-400 hover:text-amber-300">View all →</button>
                  </div>
                  <div className="space-y-2">
                    {invoices.received.filter(i => i.status === "pending").slice(0, 3).map(inv => (
                      <InvoiceRow key={inv.id} invoice={inv} onClick={() => setSelectedInvoice(inv)} isReceived />
                    ))}
                  </div>
                </div>
              )}

              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-white">Recent Invoices Sent</h3>
                  {invoices.sent.length > 0 && (
                    <button onClick={() => { setActiveTab("invoices"); setInvoiceView("sent"); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300">View all →</button>
                  )}
                </div>
                {invoices.sent.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-400 text-sm mb-1">No invoices sent yet</p>
                    <p className="text-slate-600 text-xs">Create your first invoice above</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invoices.sent.slice(0, 5).map(inv => (
                      <InvoiceRow key={inv.id} invoice={inv} onClick={() => setSelectedInvoice(inv)} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "invoices" && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Invoices</h2>
                <button onClick={() => setShowNewInvoice(true)} className="primary-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>
                  New Invoice
                </button>
              </div>
              <div className="flex gap-1 p-1 bg-black/30 rounded-xl mb-4 w-fit">
                {(["received","sent"] as InvoiceView[]).map(v => (
                  <button key={v} onClick={() => setInvoiceView(v)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all flex items-center gap-2 ${invoiceView === v ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
                    {v === "received" ? "📥 To Pay" : "📤 Sent"}
                    {v === "received" && stats.pendingReceived > 0 && (
                      <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{stats.pendingReceived}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 p-1 bg-black/20 rounded-xl mb-5 w-fit">
                {(["all","pending","paid","draft","overdue"] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filterStatus === s ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}>
                    {s}
                  </button>
                ))}
              </div>
              {displayedInvoices.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center"><p className="text-slate-500 text-sm">No invoices found</p></div>
              ) : (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 text-xs text-slate-500 uppercase tracking-wider">
                    <span className="col-span-1">#</span>
                    <span className="col-span-3">{invoiceView === "sent" ? "To" : "From"}</span>
                    <span className="col-span-2">Amount</span>
                    <span className="col-span-2">Due</span>
                    <span className="col-span-2">Status</span>
                    <span className="col-span-2 text-right">Actions</span>
                  </div>
                  {displayedInvoices.map(inv => (
                    <div key={inv.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors items-center">
                      <span className="col-span-1 text-slate-500 text-xs font-mono">{inv.invoiceNumber}</span>
                      <div className="col-span-3 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {invoiceView === "sent" ? inv.recipientName : (inv.creatorName ?? "Unknown")}
                        </p>
                        <p className="text-slate-500 text-xs truncate">
                          {invoiceView === "sent" ? inv.recipientEmail : inv.creatorAddress.slice(0,12)+"…"}
                        </p>
                      </div>
                      <span className="col-span-2 text-white font-semibold text-sm">${formatUSDC(invoiceTotal(inv))}</span>
                      <span className="col-span-2 text-slate-400 text-xs">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</span>
                      <span className="col-span-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(inv.status)}`}>{inv.status}</span>
                      </span>
                      <div className="col-span-2 flex justify-end gap-2">
                        <button onClick={() => setSelectedInvoice(inv)}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${inv.status === "pending" && invoiceView === "received" ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" : "text-indigo-400 hover:text-indigo-300 hover:bg-white/5"}`}>
                          {inv.status === "pending" && invoiceView === "received" ? "Pay Now" : "View"}
                        </button>
                        {invoiceView === "sent" && (
                          <button onClick={() => remove(inv.id)} className="text-xs text-slate-600 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-white/5">Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "payments" && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Payments</h2>
                <button onClick={() => setShowSend(true)} className="primary-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                  Send / Withdraw
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="glass-card rounded-2xl p-6">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Total Received</p>
                  <p className="text-3xl font-bold text-emerald-400">${formatUSDC(stats.totalReceived)}</p>
                  <p className="text-slate-500 text-xs mt-1">from {stats.paid} paid invoice{stats.paid !== 1 ? "s" : ""}</p>
                </div>
                <div className="glass-card rounded-2xl p-6">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Outstanding (you owe)</p>
                  <p className="text-3xl font-bold text-amber-400">${formatUSDC(stats.totalOutstanding)}</p>
                  <p className="text-slate-500 text-xs mt-1">{stats.pendingReceived} invoice{stats.pendingReceived !== 1 ? "s" : ""} to pay</p>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-5">Received Payments</h3>
                {invoices.sent.filter(i => i.status === "paid").length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No payments received yet</p>
                ) : (
                  <div className="space-y-3">
                    {invoices.sent.filter(i => i.status === "paid").map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-4 bg-white/2 rounded-xl border border-white/5">
                        <div>
                          <p className="text-white text-sm font-medium">{inv.recipientName}</p>
                          <p className="text-slate-500 text-xs">{inv.invoiceNumber} · {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}</p>
                          {inv.txHash && <p className="text-slate-600 text-xs font-mono truncate max-w-xs mt-0.5">{inv.txHash.slice(0,50)}…</p>}
                        </div>
                        <span className="text-emerald-400 font-bold">+${formatUSDC(invoiceTotal(inv))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {showSend && (
        <SendModal
          myArcAddress={wallet.address}
          myWalletId={wallet.id}
          onClose={() => setShowSend(false)}
        />
      )}

      {showNewInvoice && (
        <InvoiceModal
          walletAddress={wallet.address}
          // Fix for type error: ensure onSave returns void, not Promise<Invoice>
          onSave={async (data) => {
            await create(data);
          }}
          onClose={() => setShowNewInvoice(false)}
        />
      )}

      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          currentUserAddress={wallet.address}
          onPaid={txSteps => handlePaid(selectedInvoice, txSteps)}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

    </div>
  );
}

function InvoiceRow({ invoice, onClick, isReceived }: { invoice: Invoice; onClick: () => void; isReceived?: boolean }) {
  return (
    <div onClick={onClick} className="flex items-center justify-between p-4 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 cursor-pointer transition-all group">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isReceived ? "bg-amber-500/10 border border-amber-500/20" : "bg-indigo-500/10 border border-indigo-500/20"}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 ${isReceived ? "text-amber-400" : "text-indigo-400"}`}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
          </svg>
        </div>
        <div>
          <p className="text-white text-sm font-medium">{isReceived ? (invoice.creatorName ?? "Unknown") : invoice.recipientName}</p>
          <p className="text-slate-500 text-xs">{invoice.invoiceNumber}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(invoice.status)}`}>{invoice.status}</span>
        <span className="text-white font-semibold text-sm">${formatUSDC(invoiceTotal(invoice))}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-600 group-hover:text-slate-400"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>
  );
}