import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteUserForm from "@/components/settings/InviteUserForm";

export default async function UsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!membership?.organisation_id) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        No organisation is available.
      </div>
    );
  }

  const { data: organisation } = await supabase
    .from("organisations")
    .select("name")
    .eq("id", membership.organisation_id)
    .single();

  const { data: members } = await supabase
    .from("organisation_members")
    .select("user_id, role, active")
    .eq("organisation_id", membership.organisation_id)
    .order("created_at");

  const memberIds = members?.map((member) => member.user_id) ?? [];

  const { data: profiles } =
    memberIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", memberIds)
      : { data: [] };

  const rows =
    members?.map((member) => {
      const profile = profiles?.find(
        (item) => item.id === member.user_id
      );

      return {
        id: member.user_id,
        name: profile?.display_name || "Unnamed user",
        email: profile?.email || "",
        role: member.role,
        active: member.active,
      };
    }) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Users & access
        </h1>

        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Invite and manage people who can access {organisation?.name || "your organisation"}.
        </p>
      </div>

      <InviteUserForm />

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-semibold text-[var(--text-primary)]">
            Organisation users
          </h2>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {rows.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {member.name}
                </div>

                <div className="text-sm text-[var(--text-secondary)]">
                  {member.email}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold capitalize">
                  {member.role}
                </span>

                <span className="text-xs text-[var(--text-secondary)]">
                  {member.active ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="px-5 py-8 text-sm text-[var(--text-secondary)]">
              No users found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}