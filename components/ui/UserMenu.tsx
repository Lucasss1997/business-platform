"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserInfo = {
  name: string;
  email: string;
  role: string;
  organisation: string | null;
  initials: string;
};

export default function UserMenu() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email, is_super_admin")
        .eq("id", authUser.id)
        .single();

      let role = "User";
      let organisation: string | null = null;

      if (profile?.is_super_admin) {
        role = "Platform Super Admin";
      } else {
        const { data: membership } = await supabase
          .from("organisation_members")
          .select(`
            role,
            organisations (
              name
            )
          `)
          .eq("user_id", authUser.id)
          .eq("active", true)
          .limit(1)
          .maybeSingle();

        if (membership) {
          role =
            membership.role === "admin"
              ? "Admin"
              : membership.role === "viewer"
                ? "Viewer"
                : "User";

          const org = Array.isArray(membership.organisations)
            ? membership.organisations[0]
            : membership.organisations;

          organisation = org?.name ?? null;
        }
      }

      const email = profile?.email || authUser.email || "";
      const name =
        profile?.display_name?.trim() ||
        email.split("@")[0] ||
        "User";

      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase())
        .join("");

      setUser({
        name,
        email,
        role,
        organisation,
        initials: initials || "?",
      });
    }

    loadUser();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-left transition hover:border-[var(--accent)]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
          {user.initials}
        </div>

        <div className="hidden min-w-0 sm:block">
          <p className="max-w-40 truncate text-sm font-semibold text-[var(--text-primary)]">
            {user.name}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {user.role}
          </p>
        </div>

        <span
          className={`text-xs text-[var(--text-secondary)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          &#9662;
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="border-b border-[var(--border)] px-4 py-4">
            <p className="font-semibold text-[var(--text-primary)]">
              {user.name}
            </p>

            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
              {user.email}
            </p>

            {user.organisation && (
              <p className="mt-3 text-xs font-medium text-[var(--accent)]">
                {user.organisation}
              </p>
            )}

            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {user.role}
            </p>
          </div>

          <div className="p-2">
            <button
              type="button"
              onClick={signOut}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-soft)]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

