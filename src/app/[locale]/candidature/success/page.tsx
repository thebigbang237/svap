import { getTranslations } from "next-intl/server";
import { CTAButton } from "@/components/marketing/CTAButton";
import { CheckIcon, MailIcon } from "@/components/marketing/icons";

/**
 * Phase-1 outcome: pre-selected.
 *
 * The access code is emailed inside the submission request, so by the time
 * this renders the message has normally already been accepted by Resend. When
 * it has not — `?code=pending` — the send failed and the retry cron carries it
 * within the half hour. Saying so is the difference between a candidate
 * waiting calmly and one concluding the site is broken, and it stops the spam
 * advice below from sending them after a message that does not exist yet.
 */
export default async function CandidatureSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const t = await getTranslations("candidature.success");

  // From the URL, so treated as untrusted: anything other than the one value
  // we set falls back to the ordinary "it has been sent" wording.
  const pending = code === "pending";

  return (
    <section className="flex flex-1 items-center justify-center px-8 py-[120px] text-center">
      <div className="mx-auto max-w-xl">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center border border-terracotta">
          <CheckIcon className="h-8 w-8 text-terracotta" />
        </div>
        <h1 className="font-serif text-[32px] sm:text-[42px] font-normal text-blue-dark mb-8">
          {t("title")}
        </h1>
        <p className="mb-8 text-ink-mid">{t("description")}</p>

        {/* Deliberately its own block rather than another sentence in the
            paragraph above: this is the one thing on the page a candidate has
            to act on if nothing arrives, and prose here gets skimmed. */}
        <div className="mb-12 flex items-start gap-4 border-s-2 border-blue bg-sky-mid/60 p-6 text-start">
          <MailIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue" />
          <p className="text-sm text-ink">
            {t(pending ? "spamPending" : "spamNotice")}
          </p>
        </div>

        <CTAButton href="/" variant="primary">
          {t("ctaLabel")}
        </CTAButton>
      </div>
    </section>
  );
}
