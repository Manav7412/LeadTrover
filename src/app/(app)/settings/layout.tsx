import SettingsNav from "@/components/SettingsNav";
import { requireProfile } from "@/lib/auth";
import { can } from "@/lib/permissions";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  const items = [
    { href: "/settings", label: "Profile", hint: "Your details and password" },
    ...(can(profile, "team.manage") ? [{ href: "/settings/team", label: "Team", hint: "People and logins" }] : []),
    { href: "/settings/roles", label: "Roles & permissions", hint: "What each role can do" },
    { href: "/settings/sharing", label: "Sharing rules", hint: "Who sees whose records" },
    { href: "/settings/objects", label: "Objects", hint: "Standard and custom objects" },
    { href: "/settings/workspace", label: "Workspace", hint: "Automations and basics" },
  ];
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[230px_1fr]">
        <SettingsNav items={items} />
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
