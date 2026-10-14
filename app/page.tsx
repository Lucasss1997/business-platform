import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import DashboardClient from "@/components/DashboardClient";

export default function Home() {
  return <AppShell><PageHeader title="Business dashboard" subtitle="A clear view of the companies and commercial relationships that need your attention." actionLabel="Add company" actionHref="/companies/new" /><section className="p-6 lg:p-10"><Link href="/companies/calling" className="group mb-7 flex flex-col gap-5 rounded-2xl border border-emerald-400/20 bg-[#0d1728] p-6 text-white shadow-sm transition hover:border-emerald-400/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 sm:flex-row sm:items-center sm:justify-between sm:p-7">
  <div className="flex min-w-0 items-start gap-4">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z" /></svg>
    </span>
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Business development</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">Calling and ratings</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Call your prospects, record the conversation and prioritise the opportunities worth pursuing.</p>
    </div>
  </div>
  <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition group-hover:bg-emerald-300">
    Open calling workspace <span aria-hidden="true">&rarr;</span>
  </span>
</Link>
<DashboardClient /></section></AppShell>;
}
