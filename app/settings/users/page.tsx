import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteUserForm from "@/components/settings/InviteUserForm";
import UserAccessActions from "@/components/settings/UserAccessActions";

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

  const organisationId = membership.organisation_id;

  const { data: organisation } = await supabase
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .single();

  const { data: invitations } = await supabase
    .from("user_invitations")
    .select("id, email, display_name, role, invited_user_id, created_at")
    .eq("organisation_id", organisationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const pendingUserIds = new Set(
    (invitations ?? [])
      .map((invite) => invite.invited_user_id)
      .filter(Boolean)
  );

  const { data: members } = await supabase
    .from("organisation_members")
    .select("user_id, role, active")
    .eq("organisation_id", organisationId)
    .order("created_at");

  const activeMembers =
    members?.filter(
      (member) => !pendingUserIds.has(member.user_id)
    ) ?? [];

  const memberIds = activeMembers.map(
    (member) => member.user_id
  );

  const { data: profiles } =
    memberIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", memberIds)
      : { data: [] };

  const rows = activeMembers.map((member) => {
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
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Users & access
        </h1>

        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Invite and manage people who can access{" "}
          {organisation?.name || "your organisation"}.
        </p>
      </div>

      <InviteUserForm />

      {(invitations?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="font-semibold text-[var(--text-primary)]">
              Pending invitations
            </h2>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Invitations that have been sent but have not yet been completed.
            </p>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {invitations?.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {invite.display_name || invite.email}
                  </div>

                  <div className="text-sm text-[var(--text-secondary)]">
                    {invite.email}
                  </div>

                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    Role: {invite.role}
                  </div>
                </div>

                <UserAccessActions
                  action="revoke-invite"
                  invitationId={invite.id}
                />
              </div>
            ))}
          </div>
        </div>
      )}

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
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {member.name}
                </div>

                <div className="text-sm text-[var(--text-secondary)]">
                  {member.email}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold capitalize">
                  {member.role}
                </span>

                <span className="text-xs text-[var(--text-secondary)]">
                  {member.active ? "Active" : "Disabled"}
                </span>

                <UserAccessActions
                  action="remove-user"
                  userId={member.id}
                  disabled={member.id === user.id}
                />
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="px-5 py-8 text-sm text-[var(--text-secondary)]">
              No active users found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}