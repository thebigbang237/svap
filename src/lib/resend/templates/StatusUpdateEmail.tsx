import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "react-email";
import { styles, colors } from "./styles";
import { getDirection } from "@/i18n/routing";
import type { CandidatureData, NotifiableStatus, Locale } from "../types";

export interface StatusUpdateEmailProps {
  candidature: CandidatureData;
  status: NotifiableStatus;
  locale: Locale;
}

/**
 * Decision notifications.
 *
 * Keyed on the post-0006 lifecycle names. `non_eligible` and `complet` are
 * Phase-1 outcomes that carry a specific obligation: no fee was ever charged,
 * and the dossier stays eligible for future editions. Saying so is the whole
 * point of sending them.
 */
const copy = {
  fr: {
    brand: "Silicon Valley Africa",
    footer:
      "Silicon Valley Africa Program 2026 — cet email concerne votre candidature.",
    preselectionne: {
      preview: "Vous êtes pré-sélectionné(e) — Silicon Valley Africa Program",
      heading: (prenom: string) => `Bonne nouvelle, ${prenom}.`,
      body: "Votre candidature a passé l'étape de pré-sélection. Vous recevrez sous 72 heures un e-mail contenant votre code d'accès unique, qui vous ouvrira la page « Obtenir mes documents ».",
      next: "Aucune action n'est requise pour l'instant. Surveillez votre boîte de réception, et pensez à vérifier vos spams.",
    },
    non_eligible: {
      preview: "Concernant votre candidature — Silicon Valley Africa Program",
      heading: (prenom: string) => `Cher/Chère ${prenom},`,
      body: "Après vérification, votre candidature ne remplit pas l'un des critères d'éligibilité de l'édition 2026 du Silicon Valley Africa Program.",
      next: "Aucun frais ne vous a été demandé et aucun ne vous sera demandé. Votre dossier reste éligible pour les prochaines éditions du programme.",
    },
    complet: {
      preview: "Votre dossier est éligible, mais ce pack est complet",
      heading: (prenom: string) => `Cher/Chère ${prenom},`,
      body: "Votre candidature remplit tous les critères d'éligibilité. Le nombre de pré-sélections pour le pack choisi a simplement atteint sa limite pour l'édition 2026.",
      next: "Aucun frais ne vous a été demandé. Vous pouvez candidater sur un autre pack encore ouvert, et nous vous recontacterons en priorité pour l'édition suivante.",
    },
    valide: {
      preview: "Félicitations — votre dossier est validé",
      heading: (prenom: string) => `Félicitations, ${prenom} !`,
      body: "Votre dossier a passé l'ensemble des vérifications et il est validé pour l'édition 2026 du Silicon Valley Africa Program.",
      next: "Votre lettre d'invitation, votre lettre de confirmation à l'ambassade et votre accompagnement visa vous seront transmis par e-mail dans les prochains jours.",
    },
    rejete: {
      preview: "Concernant votre dossier — Silicon Valley Africa Program",
      heading: (prenom: string) => `Cher/Chère ${prenom},`,
      body: "Après examen approfondi de votre dossier par notre comité, nous ne sommes malheureusement pas en mesure de le retenir pour l'édition 2026.",
      next: "Si le rejet est intervenu pour un motif administratif ou d'éligibilité, vos frais de vérification vous sont intégralement remboursés sur votre moyen de paiement d'origine. Nous vous encourageons à candidater de nouveau lors d'une prochaine édition.",
    },
  },
  en: {
    brand: "Silicon Valley Africa",
    footer:
      "Silicon Valley Africa Program 2026 — this email concerns your application.",
    preselectionne: {
      preview: "You've been pre-selected — Silicon Valley Africa Program",
      heading: (prenom: string) => `Good news, ${prenom}.`,
      body: "Your application has passed pre-selection. Within 72 hours you'll receive an email containing your unique access code, which opens the “Get my documents” page.",
      next: "No action is needed right now. Keep an eye on your inbox, and do check your spam folder.",
    },
    non_eligible: {
      preview: "About your application — Silicon Valley Africa Program",
      heading: (prenom: string) => `Dear ${prenom},`,
      body: "After review, your application doesn't meet one of the eligibility criteria for the 2026 edition of the Silicon Valley Africa Program.",
      next: "You were not charged anything and you will not be. Your file remains eligible for future editions of the program.",
    },
    complet: {
      preview: "Your application is eligible, but this pack is full",
      heading: (prenom: string) => `Dear ${prenom},`,
      body: "Your application meets every eligibility criterion. The number of pre-selections for your chosen pack has simply reached its limit for the 2026 edition.",
      next: "You were not charged anything. You can apply for another pack that's still open, and we'll contact you as a priority for the next edition.",
    },
    valide: {
      preview: "Congratulations — your file has been validated",
      heading: (prenom: string) => `Congratulations, ${prenom}!`,
      body: "Your file has passed all verifications and is validated for the 2026 edition of the Silicon Valley Africa Program.",
      next: "Your invitation letter, embassy confirmation letter and visa support will be sent to you by email in the coming days.",
    },
    rejete: {
      preview: "About your file — Silicon Valley Africa Program",
      heading: (prenom: string) => `Dear ${prenom},`,
      body: "After in-depth review by our committee, we're unfortunately unable to retain your file for the 2026 edition.",
      next: "If the rejection was on administrative or eligibility grounds, your verification fee is refunded in full to your original payment method. We encourage you to apply again for a future edition.",
    },
  },
  ar: {
    brand: "Silicon Valley Africa",
    footer: "Silicon Valley Africa Program 2026 — تتعلق هذه الرسالة بترشيحكم.",
    preselectionne: {
      preview: "تم اختياركم أوليًا — Silicon Valley Africa Program",
      heading: (prenom: string) => `خبر سار، ${prenom}.`,
      body: "اجتاز ترشيحكم مرحلة الاختيار الأولي. ستتوصّلون خلال 72 ساعة برسالة تتضمّن رمز الدخول الفريد الخاص بكم، الذي يفتح صفحة «احصل على وثائقي».",
      next: "لا يُطلب منكم أي إجراء في الوقت الحالي. تابعوا صندوق بريدكم، ولا تنسوا تفقّد الرسائل غير المرغوب فيها.",
    },
    non_eligible: {
      preview: "بخصوص ترشيحكم — Silicon Valley Africa Program",
      heading: (prenom: string) => `عزيزي/عزيزتي ${prenom}،`,
      body: "بعد التحقّق، لا يستوفي ترشيحكم أحد معايير الأهلية لنسخة 2026 من برنامج Silicon Valley Africa Program.",
      next: "لم تُطلب منكم أي رسوم ولن تُطلب. ويبقى ملفكم مؤهَّلًا للنسخ القادمة من البرنامج.",
    },
    complet: {
      preview: "ملفكم مؤهّل، لكن هذه الباقة مكتملة",
      heading: (prenom: string) => `عزيزي/عزيزتي ${prenom}،`,
      body: "يستوفي ترشيحكم جميع معايير الأهلية. غير أن عدد الاختيارات الأولية للباقة التي اخترتموها بلغ حدّه لنسخة 2026.",
      next: "لم تُطلب منكم أي رسوم. يمكنكم الترشّح لباقة أخرى ما زالت مفتوحة، وسنتواصل معكم بالأولوية في النسخة القادمة.",
    },
    valide: {
      preview: "تهانينا — تمت المصادقة على ملفكم",
      heading: (prenom: string) => `تهانينا، ${prenom}!`,
      body: "اجتاز ملفكم جميع عمليات التحقّق وتمت المصادقة عليه لنسخة 2026 من برنامج Silicon Valley Africa Program.",
      next: "ستصلكم رسالة الدعوة، ورسالة التأكيد الموجَّهة للسفارة، ومواكبة التأشيرة عبر البريد الإلكتروني في الأيام القادمة.",
    },
    rejete: {
      preview: "بخصوص ملفكم — Silicon Valley Africa Program",
      heading: (prenom: string) => `عزيزي/عزيزتي ${prenom}،`,
      body: "بعد دراسة معمّقة لملفكم من طرف لجنتنا، يؤسفنا أنه لم يكن بإمكاننا قبوله لنسخة 2026.",
      next: "إذا كان الرفض لأسباب إدارية أو لعدم الأهلية، تُرَدّ إليكم رسوم التحقّق كاملة على وسيلة الأداء الأصلية. ونشجعكم على الترشّح مجددًا في نسخة قادمة.",
    },
  },
} as const;

const statusAccent: Record<NotifiableStatus, string> = {
  preselectionne: colors.blue,
  non_eligible: colors.inkDim,
  complet: colors.inkDim,
  valide: colors.terracotta,
  rejete: colors.inkDim,
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
          <Heading style={{ ...styles.heading, color: statusAccent[status] }}>
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
