import Image from "next/image";
import { notFound } from "next/navigation";
import PublicLeadForm from "@/components/PublicLeadForm";
import { createClient } from "@/lib/supabase/server";

type PublicForm = { name: string; heading: string; description: string | null; success_message: string };

// The public page for a form. Anyone with the link can open it, no login needed.
export default async function PublicFormPage({ params }: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_form", { form_slug: slug });
  const form = data as PublicForm | null;
  if (!form) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{form.heading}</h1>
        {form.description && <p className="mt-2 text-sm text-slate-600">{form.description}</p>}
        <div className="mt-6">
          <PublicLeadForm slug={slug} successMessage={form.success_message} />
        </div>
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <Image src="/logo-icon.png" alt="" width={20} height={20} className="rounded" />
        Powered by LeadTrove
      </p>
    </main>
  );
}
