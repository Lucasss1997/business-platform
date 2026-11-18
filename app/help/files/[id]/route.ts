import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HELP_BUCKET } from "@/lib/help-guides";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return NextResponse.json(
        { error: "Guide not found." },
        { status: 404, headers },
      );
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: "Please sign in to read this guide." },
        { status: 401, headers },
      );
    // RLS checks active organisation membership and archived-guide access.
    const result = await client
      .from("help_guides")
      .select("file_path,file_name")
      .eq("id", id)
      .maybeSingle();
    if (result.error)
      return NextResponse.json(
        { error: "The guide could not be loaded. Please try again." },
        { status: 503, headers },
      );
    if (!result.data?.file_path)
      return NextResponse.json(
        { error: "Guide PDF not found." },
        { status: 404, headers },
      );
    const download = new URL(request.url).searchParams.get("download") === "1";
    const signed = await client.storage
      .from(HELP_BUCKET)
      .createSignedUrl(
        result.data.file_path,
        120,
        download
          ? { download: result.data.file_name || "guide.pdf" }
          : undefined,
      );
    if (signed.error || !signed.data?.signedUrl)
      return NextResponse.json(
        { error: "The PDF is unavailable. Please try again." },
        { status: 503, headers },
      );
    return new NextResponse(null, {
      status: 307,
      headers: { ...headers, Location: signed.data.signedUrl },
    });
  } catch {
    return NextResponse.json(
      { error: "The PDF could not be opened. Please try again." },
      { status: 503, headers },
    );
  }
}
