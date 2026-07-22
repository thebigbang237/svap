"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="border border-ink-dim/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-mid transition hover:border-terracotta hover:text-terracotta"
    >
      Déconnexion
    </button>
  );
}
