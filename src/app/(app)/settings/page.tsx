import { requireProfile } from "@/lib/auth";
import { ProfileForm, PasswordForm } from "@/components/SettingsForms";
import { PERMISSION_GROUPS, can } from "@/lib/permissions";
import { changePassword, updateProfile } from "./actions";

export default async function ProfileSettingsPage() {
  const { profile } = await requireProfile();
  const items = PERMISSION_GROUPS.flatMap((g) => g.items);
  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="mb-5 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {profile.full_name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-900">{profile.full_name}</p>
            <p className="text-sm text-slate-500">{[profile.job_title, profile.email].filter(Boolean).join(" · ")}</p>
            <span className="mt-1 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">{profile.roleName}</span>
          </div>
        </div>
        <ProfileForm action={updateProfile} defaults={{ full_name: profile.full_name, job_title: profile.job_title, phone: profile.phone }} />
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Your access</h2>
        <p className="mb-4 mt-0.5 text-sm text-slate-500">
          Your role is <b>{profile.roleName}</b>. You can see {profile.scope === "all" ? "everyone's records" : "only the records assigned to you (and anything shared with you)"}. Only an administrator can change this.
        </p>
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {items.map((i) => {
            const on = can(profile, i.key);
            return (
              <li key={i.key} className={`flex items-center gap-2 text-sm ${on ? "text-slate-800" : "text-slate-400"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`} aria-hidden>{on ? "✓" : "–"}</span>
                {i.label}
                <span className="sr-only">{on ? "allowed" : "not allowed"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Password</h2>
        <p className="mb-4 mt-0.5 text-sm text-slate-500">Choose a new password for signing in.</p>
        <PasswordForm action={changePassword} />
      </section>
    </div>
  );
}
