import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/access-code/rate-limit";

export type AuditAction =
  | "document.view"
  | "passport.reveal"
  | "candidature.status"
  | "candidature.export"
  | "payment.refund"
  | "access_code.resend"
  | "claim.decision";

/**
 * Writes an entry to the append-only audit log (§8).
 *
 * Never throws. A failed audit write must not block the action the
 * administrator is performing — but it does leave a hole in the trail, so it
 * is logged at error level rather than swallowed.
 *
 * Deliberately NOT awaited-and-checked at most call sites: the log records
 * that access happened, and blocking a reviewer on a logging round-trip
 * would push people towards working around the tool.
 */
export async function recordAudit(input: {
  actorId: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  request?: Request;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      actor_id: input.actorId,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      ip: input.request ? clientIp(input.request) : null,
      user_agent:
        input.request?.headers.get("user-agent")?.slice(0, 500) ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.error("AUDIT WRITE FAILED:", input.action, error);
  }
}
