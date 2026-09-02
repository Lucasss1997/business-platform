import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data: membership } = await supabase
      .from("organisation_members")
      .select("organisation_id, role")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!membership?.organisation_id) {
      return NextResponse.json(
        { error: "No organisation found." },
        { status: 400 }
      );
    }

    if (membership.role !== "admin" && !profile?.is_super_admin) {
      return NextResponse.json(
        { error: "Organisation admin access is required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = String(body.action || "");
    const targetUserId = String(body.userId || "");
    const invitationId = String(body.invitationId || "");

    const admin = createAdminClient();
    const organisationId = membership.organisation_id;

    if (action === "revoke-invite") {
      if (!invitationId) {
        return NextResponse.json(
          { error: "Invitation ID is required." },
          { status: 400 }
        );
      }

      const { data: invitation, error: invitationError } = await admin
        .from("user_invitations")
        .select("id, invited_user_id, status")
        .eq("id", invitationId)
        .eq("organisation_id", organisationId)
        .single();

      if (invitationError || !invitation) {
        return NextResponse.json(
          { error: "Invitation not found." },
          { status: 404 }
        );
      }

      if (invitation.status !== "pending") {
        return NextResponse.json(
          { error: "This invitation is no longer pending." },
          { status: 400 }
        );
      }

      if (invitation.invited_user_id === user.id) {
        return NextResponse.json(
          { error: "You cannot revoke your own account." },
          { status: 400 }
        );
      }

      const { error: revokeError } = await admin
        .from("user_invitations")
        .update({ status: "revoked" })
        .eq("id", invitation.id);

      if (revokeError) {
        throw revokeError;
      }

      if (invitation.invited_user_id) {
        const { error: membershipError } = await admin
          .from("organisation_members")
          .delete()
          .eq("organisation_id", organisationId)
          .eq("user_id", invitation.invited_user_id);

        if (membershipError) {
          throw membershipError;
        }

        const { data: otherMemberships } = await admin
          .from("organisation_members")
          .select("organisation_id")
          .eq("user_id", invitation.invited_user_id)
          .limit(1);

        if (!otherMemberships || otherMemberships.length === 0) {
          const { error: deleteUserError } =
            await admin.auth.admin.deleteUser(
              invitation.invited_user_id
            );

          if (deleteUserError) {
            console.error(
              "Could not delete revoked invited auth user:",
              deleteUserError
            );
          }
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === "remove-user") {
      if (!targetUserId) {
        return NextResponse.json(
          { error: "User ID is required." },
          { status: 400 }
        );
      }

      if (targetUserId === user.id) {
        return NextResponse.json(
          { error: "You cannot remove your own access." },
          { status: 400 }
        );
      }

      const { data: targetMembership, error: targetError } =
        await admin
          .from("organisation_members")
          .select("user_id, role")
          .eq("organisation_id", organisationId)
          .eq("user_id", targetUserId)
          .maybeSingle();

      if (targetError || !targetMembership) {
        return NextResponse.json(
          { error: "Organisation user not found." },
          { status: 404 }
        );
      }

      const { error: removeError } = await admin
        .from("organisation_members")
        .delete()
        .eq("organisation_id", organisationId)
        .eq("user_id", targetUserId);

      if (removeError) {
        throw removeError;
      }

      await admin
        .from("user_invitations")
        .update({ status: "revoked" })
        .eq("organisation_id", organisationId)
        .eq("invited_user_id", targetUserId)
        .eq("status", "pending");

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Unknown user-management action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("User management error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The user-management action failed.",
      },
      { status: 500 }
    );
  }
}