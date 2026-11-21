import { createClient } from "@/lib/supabase/server";
import { FILES_BUCKET } from "@/lib/files";

// Opens (or, with ?download=1, downloads) one attached file. It runs as the signed-in user, so only people
// who can see the contact can get the file. The link it redirects to expires after a minute.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Please sign in first.", { status: 401 });

  const { data: file } = await supabase.from("contact_files").select("name, storage_path").eq("id", id).maybeSingle();
  if (!file) return new Response("File not found.", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(file.storage_path, 60, download ? { download: file.name } : undefined);
  if (error || !data) return new Response("Couldn't open that file.", { status: 500 });
  return Response.redirect(data.signedUrl, 302);
}
