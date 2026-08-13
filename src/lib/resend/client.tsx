import "server-only";
import { Resend } from "resend";
import { CandidatureReceivedEmail } from "./templates/CandidatureReceivedEmail";
import { StatusUpdateEmail } from "./templates/StatusUpdateEmail";
import { AdminNewCandidatureEmail } from "./templates/AdminNewCandidatureEmail";
import { AccessCodeEmail } from "./templates/AccessCodeEmail";
import { CodeExpiringEmail } from "./templates/CodeExpiringEmail";
import { PaymentReceiptEmail } from "./templates/PaymentReceiptEmail";
import type { CandidatureEmailData, CandidatureStatus, Locale } from "./types";

// Lazily instantiated: the Resend constructor throws immediately if no API
// key is present, and Next.js loads this module during build-time page-data
// collection for the API route — before any real request (and its env
// vars) exists. Constructing on first actual send avoids breaking the build
// in environments without RESEND_API_KEY configured yet.
let resendClient: Resend | undefined;

function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ??
  "Silicon Valley Africa <onboarding@resend.dev>";

const subjects = {
  candidatureReceived: {
    fr: "Votre candidature a bien été reçue",
    en: "Your application has been received",
    ar: "تم استلام ترشيحكم",
  },
  statusUpdate: {
    preselection: {
      fr: "Vous êtes présélectionné(e)",
      en: "You've been shortlisted",
      ar: "تمّ اختياركم أوليًا",
    },
    accepte: {
      fr: "Félicitations — votre candidature est acceptée",
      en: "Congratulations — you're in!",
      ar: "تهانينا — تمّ قبول ترشيحكم",
    },
    refuse: {
      fr: "Concernant votre candidature",
      en: "About your application",
      ar: "بخصوص ترشيحكم",
    },
    liste_attente: {
      fr: "Vous êtes sur liste d'attente",
      en: "You're on the waitlist",
      ar: "أنتم على قائمة الانتظار",
    },
  },
  adminNotification: {
    fr: "Nouvelle candidature reçue",
    en: "New application received",
    ar: "ترشيح جديد",
  },
  accessCode: {
    fr: "Votre code d'accès — Silicon Valley Africa Program",
    en: "Your access code — Silicon Valley Africa Program",
    ar: "رمز الدخول الخاص بكم — Silicon Valley Africa Program",
  },
  codeExpiring: {
    fr: "Votre code d'accès expire bientôt",
    en: "Your access code expires soon",
    ar: "رمز الدخول الخاص بكم ينتهي قريبًا",
  },
  paymentReceipt: {
    fr: "Reçu de paiement — Silicon Valley Africa Program",
    en: "Payment receipt — Silicon Valley Africa Program",
    ar: "إيصال الأداء — Silicon Valley Africa Program",
  },
} as const;

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Deep link to the Phase-2 portal with the code pre-filled.
 *
 * Only the code travels in the URL, never the name — the portal still asks
 * for that, which is what keeps the link alone from being enough if the email
 * is forwarded or the URL ends up in someone's browser history.
 */
export function portalUrl(locale: Locale, code?: string): string {
  const url = new URL(`/${locale}/documents`, siteUrl());
  if (code) url.searchParams.set("code", code);
  return url.toString();
}

export async function sendAccessCodeEmail(params: {
  prenom: string;
  email: string;
  code: string;
  expiresAt: Date;
  locale: Locale;
}) {
  return getResendClient().emails.send({
    from: FROM_EMAIL,
    to: params.email,
    subject: subjects.accessCode[params.locale],
    react: (
      <AccessCodeEmail
        prenom={params.prenom}
        code={params.code}
        portalUrl={portalUrl(params.locale, params.code)}
        expiresAt={params.expiresAt}
        locale={params.locale}
      />
    ),
  });
}

export async function sendPaymentReceiptEmail(params: {
  prenom: string;
  email: string;
  locale: Locale;
  amountUsd: number;
  amountLocal: number;
  currency: string;
  reference: string;
  paidAt: Date;
}) {
  return getResendClient().emails.send({
    from: FROM_EMAIL,
    to: params.email,
    subject: subjects.paymentReceipt[params.locale],
    react: (
      <PaymentReceiptEmail
        prenom={params.prenom}
        amountUsd={params.amountUsd}
        amountLocal={params.amountLocal}
        currency={params.currency}
        reference={params.reference}
        paidAt={params.paidAt}
        locale={params.locale}
      />
    ),
  });
}

export async function sendCodeExpiringEmail(params: {
  prenom: string;
  email: string;
  daysLeft: number;
  locale: Locale;
}) {
  return getResendClient().emails.send({
    from: FROM_EMAIL,
    to: params.email,
    subject: subjects.codeExpiring[params.locale],
    react: (
      <CodeExpiringEmail
        prenom={params.prenom}
        daysLeft={params.daysLeft}
        // No code in the reminder — it isn't recoverable, and this is a
        // lower-trust context than the original delivery.
        portalUrl={portalUrl(params.locale)}
        locale={params.locale}
      />
    ),
  });
}

export async function sendCandidatureReceivedEmail(
  candidature: CandidatureEmailData,
) {
  const { locale, ...data } = candidature;

  return getResendClient().emails.send({
    from: FROM_EMAIL,
    to: candidature.email,
    subject: subjects.candidatureReceived[locale],
    react: <CandidatureReceivedEmail candidature={data} locale={locale} />,
  });
}

export async function sendAdminNotificationEmail(
  candidature: CandidatureEmailData,
) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) {
    throw new Error("ADMIN_NOTIFICATION_EMAIL is not configured");
  }

  const { locale, ...data } = candidature;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const adminUrl = `${siteUrl}/admin/candidatures/${candidature.id}`;

  return getResendClient().emails.send({
    from: FROM_EMAIL,
    to: adminEmail,
    subject: subjects.adminNotification[locale],
    react: (
      <AdminNewCandidatureEmail
        candidature={data}
        adminUrl={adminUrl}
        locale={locale}
      />
    ),
  });
}

export async function sendStatusUpdateEmail(
  candidature: CandidatureEmailData,
  newStatus: CandidatureStatus,
) {
  const { locale, ...data } = candidature;

  return getResendClient().emails.send({
    from: FROM_EMAIL,
    to: candidature.email,
    subject: subjects.statusUpdate[newStatus][locale],
    react: (
      <StatusUpdateEmail candidature={data} status={newStatus} locale={locale} />
    ),
  });
}
