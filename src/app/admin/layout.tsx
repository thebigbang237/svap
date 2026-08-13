import Link from "next/link";
import { ebGaramond, inter } from "@/lib/fonts";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/admin/LogoutButton";
import "../globals.css";

export const metadata = {
  title: "SVAP Admin",
};

// Every /admin/* route is session-dependent. Without this, Next tries to
// statically prerender them at build time — normally cookies() throws a
// special internal signal to force dynamic rendering, but our try/catch
// below (needed to fail closed on real Supabase errors) would swallow that
// signal too, so declare it explicitly instead of relying on the throw.
export const dynamic = "force-dynamic";

const navLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/candidatures", label: "Candidatures" },
  { href: "/admin/revue", label: "File de revue" },
  { href: "/admin/journal", label: "Journal d'audit" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let adminName: string | null = null;
  let adminRole: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("admin_profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        adminName = profile.full_name ?? user.email ?? null;
        adminRole = profile.role;
      }
    }
  } catch (error) {
    // Same fail-closed rule as proxy.ts: a Supabase client/network error
    // must render as "not authenticated" (bare login page), never crash
    // the whole /admin/* request.
    console.error("Failed to resolve admin session in layout:", error);
  }

  // Middleware guarantees this layout only ever renders unauthenticated
  // for /admin/login — every other /admin/* path is already gated. So an
  // absent adminRole here means we're on the login page: render it bare,
  // without the sidebar shell.
  const isAuthenticated = adminRole !== null;

  return (
    <html
      lang="fr"
      className={`${ebGaramond.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-sky text-ink">
        {isAuthenticated ? (
          <div className="flex min-h-screen">
            <aside className="w-56 shrink-0 border-r border-ink-dim/20 bg-white">
              <div className="border-b border-ink-dim/20 px-6 py-5">
                <span className="font-serif text-lg font-normal text-blue-dark">
                  SVAP Admin
                </span>
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-2 text-sm font-medium text-ink-mid transition-colors hover:bg-sky-mid hover:text-blue"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </aside>
            <div className="flex flex-1 flex-col">
              <header className="flex items-center justify-between border-b border-ink-dim/20 bg-white px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-ink">{adminName}</p>
                  <p className="text-xs uppercase tracking-wide text-ink-dim">
                    {adminRole === "super_admin" ? "Super Admin" : "Reviewer"}
                  </p>
                </div>
                <LogoutButton />
              </header>
              <main className="flex-1 p-8">{children}</main>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
