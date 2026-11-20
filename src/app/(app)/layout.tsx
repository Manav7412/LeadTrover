import Sidebar from "@/components/Sidebar";
import { requireProfile } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { can } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  const initials = profile.full_name.slice(0, 2).toUpperCase();
  return (
    <>
      <Sidebar hidden={[...(can(profile, "dashboard.view") ? [] : ["/dashboard"]), ...(can(profile, "forms.manage") ? [] : ["/forms"])]} />
      <div className="pl-56">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-4 border-b border-slate-200 bg-white/90 px-8 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-slate-900">{profile.full_name}</p>
              <p className="text-xs text-slate-500">{profile.roleName}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{initials}</span>
            <form action={logout}>
              <button className="btn-secondary !py-1.5 text-xs">Sign out</button>
            </form>
          </div>
        </header>
        <main className="px-8 py-6">{children}</main>
      </div>
    </>
  );
}
