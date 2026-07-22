import "server-only";
import { Resend } from "resend";
import { CandidatureReceivedEmail } from "./templates/CandidatureReceivedEmail";
import { StatusUpdateEmail } from "./templates/StatusUpdateEmail";
import { AdminNewCandidatureEmail } from "./templates/AdminNewCandidatureEmail";
import type { CandidatureEmailData, CandidatureStatus } from "./types";

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
  },
  statusUpdate: {
    preselection: {
      fr: "Vous êtes présélectionné(e)",
      en: "You've been shortlisted",
    },
    accepte: {
      fr: "Félicitations — votre candidature est acceptée",
      en: "Congratulations — you're in!",
    },
    refuse: {
      fr: "Concernant votre candidature",
      en: "About your application",
    },
    liste_attente: {
      fr: "Vous êtes sur liste d'attente",
      en: "You're on the waitlist",
    },
  },
  adminNotification: {
    fr: "Nouvelle candidature reçue",
    en: "New application received",
  },
} as const;

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
