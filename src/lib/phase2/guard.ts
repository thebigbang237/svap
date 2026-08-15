import "server-only";
import { redirect } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "@/lib/access-code/session";
import {
  canAccessStep,
  loadPhase2Progress,
  PHASE2_PATHS,
  type Phase2Progress,
  type Phase2Step,
} from "./steps";

/**
 * Server-side guard for every Phase-2 step page.
 *
 * Two checks, in order:
 *   1. a valid signed session — otherwise back to the portal;
 *   2. the requested step is reachable given actual stored progress.
 *
 * The second check reads the database rather than trusting the URL, which is
 * what stops someone opening /documents/pieces to upload documents before
 * paying. Steps already completed stay open, so correcting a typo never
 * needs support.
 *
 * Redirects internally rather than returning a discriminated union: next-intl's
 * `redirect` throws NEXT_REDIRECT, so the caller genuinely cannot continue,
 * and returning progress directly saves every page from re-narrowing a result
 * type it can't actually be holding.
 *
 * `locale` is required because next-intl's redirect needs it to keep the
 * prefix — the plain next/navigation redirect would drop an Arabic candidate
 * onto the French tree.
 */
export async function guardPhase2Step(
  step: Phase2Step,
  locale: string,
): Promise<Phase2Progress> {
  const session = await readSession();
  if (!session) redirect({ href: "/documents", locale });

  const supabase = createAdminClient();
  const progress = await loadPhase2Progress(supabase, session.cid);

  // A live session whose candidature has vanished shouldn't happen; treat it
  // as unauthenticated rather than crashing the page.
  if (!progress) redirect({ href: "/documents", locale });

  // Submitted dossiers are read-only. Without this, a candidate clicking the
  // original email link weeks later would be handed the personal-information
  // form again and could overwrite the data their review is based on.
  if (progress.locked) {
    redirect({ href: "/documents/termine", locale });
  }

  if (!canAccessStep(step, progress)) {
    redirect({ href: PHASE2_PATHS[progress.nextStep], locale });
  }

  return progress;
}
