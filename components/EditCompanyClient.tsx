"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import CompanyForm from "@/components/CompanyForm";
import type { CompanyFormValues } from "@/lib/types/company";

export default function EditCompanyClient({ id }: { id: string }) {
  const [values, setValues] = useState<CompanyFormValues | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { async function load() { const { data, error } = await supabase.from("companies").select("*").eq("id", id).single(); if (error) setError(error.message); else setValues(data as CompanyFormValues); } load(); }, [id]);
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>;
  if (!values) return <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-sm text-slate-500">Loading company...</div>;
  return <CompanyForm companyId={id} initialValues={values} />;
}
