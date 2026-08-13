import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "react-email";
import { styles, colors } from "./styles";
import { getDirection } from "@/i18n/routing";
import type { CandidatureData, CandidatureStatus, Locale } from "../types";

export interface StatusUpdateEmailProps {
  candidature: CandidatureData;
  status: CandidatureStatus;
  locale: Locale;
}

const copy = {
  fr: {
    brand: "Silicon Valley Africa",
    footer:
      "Silicon Valley Africa Program 2026 — cet email concerne votre candidature.",
    preselection: {
      preview: "Vous êtes présélectionné(e) — Silicon Valley Africa Program",
      heading: (prenom: string) => `Bonne nouvelle, ${prenom}.`,
      body: "Votre candidature a passé la première étape d'évaluation : vous êtes présélectionné(e) pour le Silicon Valley Africa Program 2026. Notre comité poursuit maintenant l'examen approfondi de votre dossier.",
      next: "Nous reviendrons vers vous par email dès que la décision finale sera prise. Aucune action n'est requise pour l'instant.",
    },
    accepte: {
      preview: "Félicitations — votre candidature est acceptée !",
      heading: (prenom: string) => `Félicitations, ${prenom} !`,
      body: "C'est avec un grand plaisir que nous vous annonçons l'acceptation de votre candidature au Silicon Valley Africa Program 2026.",
      next: "Notre équipe vous contactera très prochainement par email pour finaliser votre inscription et vous communiquer les prochaines étapes (paiement, logistique, préparation au départ).",
    },
    refuse: {
      preview: "Concernant votre candidature — Silicon Valley Africa Program",
      heading: (prenom: string) => `Cher/Chère ${prenom},`,
      body: "Après un examen attentif de votre dossier par notre comité de sélection, nous ne sommes malheureusement pas en mesure de retenir votre candidature pour l'édition 2026 du Silicon Valley Africa Program.",
      next: "La sélectivité de ce programme ne reflète en rien la qualité de votre profil. Nous vous encourageons vivement à candidater à nouveau lors d'une prochaine édition.",
    },
    liste_attente: {
      preview: "Vous êtes sur liste d'attente — Silicon Valley Africa Program",
      heading: (prenom: string) => `Cher/Chère ${prenom},`,
      body: "Votre candidature a retenu l'attention de notre comité, et vous figurez désormais sur la liste d'attente du Silicon Valley Africa Program 2026.",
      next: "Si une place se libère parmi les candidats retenus, nous vous contacterons sans délai par email. Aucune action n'est requise de votre part pour l'instant.",
    },
  },
  en: {
    brand: "Silicon Valley Africa",
    footer:
      "Silicon Valley Africa Program 2026 — this email concerns your application.",
    preselection: {
      preview: "You've been shortlisted — Silicon Valley Africa Program",
      heading: (prenom: string) => `Good news, ${prenom}.`,
      body: "Your application has passed the first stage of review: you've been shortlisted for the Silicon Valley Africa Program 2026. Our committee is now conducting a deeper review of your file.",
      next: "We'll follow up by email as soon as a final decision has been made. No action is needed from you at this time.",
    },
    accepte: {
      preview: "Congratulations — your application has been accepted!",
      heading: (prenom: string) => `Congratulations, ${prenom}!`,
      body: "We're delighted to let you know that your application to the Silicon Valley Africa Program 2026 has been accepted.",
      next: "Our team will reach out shortly by email to finalize your enrollment and share next steps (payment, logistics, departure preparation).",
    },
    refuse: {
      preview: "About your application — Silicon Valley Africa Program",
      heading: (prenom: string) => `Dear ${prenom},`,
      body: "After careful review by our selection committee, we're unable to offer you a place in the 2026 cohort of the Silicon Valley Africa Program.",
      next: "The selectivity of this program is no reflection of the quality of your profile. We strongly encourage you to apply again for a future edition.",
    },
    liste_attente: {
      preview: "You're on the waitlist — Silicon Valley Africa Program",
      heading: (prenom: string) => `Dear ${prenom},`,
      body: "Your application caught our committee's attention, and you're now on the waitlist for the Silicon Valley Africa Program 2026.",
      next: "If a spot opens up among admitted candidates, we'll reach out right away by email. No action is needed from you at this time.",
    },
  },
  // ⚠️ First-pass Arabic, pending professional review — see
  // docs/plan-edition-2026.md §3.
  ar: {
    brand: "Silicon Valley Africa",
    footer: "Silicon Valley Africa Program 2026 — تتعلق هذه الرسالة بترشيحكم.",
    preselection: {
      preview: "تمّ اختياركم أوليًا — Silicon Valley Africa Program",
      heading: (prenom: string) => `خبر سار، ${prenom}.`,
      body: "اجتاز ترشيحكم المرحلة الأولى من التقييم: لقد تمّ اختياركم أوليًا لبرنامج Silicon Valley Africa Program 2026. تواصل لجنتنا الآن الدراسة المعمّقة لملفكم.",
      next: "سنعود إليكم عبر البريد الإلكتروني بمجرد اتخاذ القرار النهائي. لا يُطلب منكم أي إجراء في الوقت الحالي.",
    },
    accepte: {
      preview: "تهانينا — تمّ قبول ترشيحكم!",
      heading: (prenom: string) => `تهانينا، ${prenom}!`,
      body: "يسعدنا أن نعلمكم بقبول ترشيحكم لبرنامج Silicon Valley Africa Program 2026.",
      next: "سيتواصل معكم فريقنا قريبًا عبر البريد الإلكتروني لاستكمال تسجيلكم وإطلاعكم على الخطوات التالية (الدفع، اللوجستيك، التحضير للسفر).",
    },
    refuse: {
      preview: "بخصوص ترشيحكم — Silicon Valley Africa Program",
      heading: (prenom: string) => `عزيزي/عزيزتي ${prenom}،`,
      body: "بعد دراسة متأنية لملفكم من قبل لجنة الاختيار، يؤسفنا أنه لم يكن بإمكاننا قبول ترشيحكم لنسخة 2026 من برنامج Silicon Valley Africa Program.",
      next: "إن انتقائية هذا البرنامج لا تعكس بأي حال جودة ملفكم. نشجعكم بشدة على التقدّم مجددًا في نسخة قادمة.",
    },
    liste_attente: {
      preview: "أنتم على قائمة الانتظار — Silicon Valley Africa Program",
      heading: (prenom: string) => `عزيزي/عزيزتي ${prenom}،`,
      body: "لفت ترشيحكم انتباه لجنتنا، وأنتم الآن على قائمة انتظار برنامج Silicon Valley Africa Program 2026.",
      next: "إذا شغر مقعد بين المترشحين المقبولين، سنتواصل معكم فورًا عبر البريد الإلكتروني. لا يُطلب منكم أي إجراء في الوقت الحالي.",
    },
  },
} as const;

const statusAccent: Record<CandidatureStatus, string> = {
  preselection: colors.blue,
  accepte: colors.terracotta,
  refuse: colors.inkDim,
  liste_attente: colors.blue,
};

export function StatusUpdateEmail({
  candidature,
  status,
  locale,
}: StatusUpdateEmailProps) {
  const t = copy[locale];
  const statusCopy = t[status];

  return (
    <Html lang={locale} dir={getDirection(locale)}>
      <Head />
      <Preview>{statusCopy.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{t.brand}</Text>
          <Heading
            style={{ ...styles.heading, color: statusAccent[status] }}
          >
            {statusCopy.heading(candidature.prenom)}
          </Heading>
          <Text style={styles.paragraph}>{statusCopy.body}</Text>
          <Text style={styles.paragraph}>{statusCopy.next}</Text>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default StatusUpdateEmail;
