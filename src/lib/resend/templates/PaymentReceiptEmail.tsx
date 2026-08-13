import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";
import { styles } from "./styles";
import { getDirection } from "@/i18n/routing";
import type { Locale } from "../types";

export interface PaymentReceiptEmailProps {
  prenom: string;
  amountUsd: number;
  amountLocal: number;
  currency: string;
  reference: string;
  paidAt: Date;
  locale: Locale;
}

const copy = {
  fr: {
    preview: "Reçu de paiement — Silicon Valley Africa Program",
    brand: "Silicon Valley Africa",
    heading: "Paiement reçu.",
    intro: (prenom: string) =>
      `${prenom}, nous confirmons la réception de vos frais de vérification. Les vérifications de votre dossier ont été lancées.`,
    labels: {
      amount: "Montant réglé",
      reference: "Référence de transaction",
      date: "Date",
    },
    covers:
      "Ces frais couvrent la vérification d'identité, le contrôle du casier judiciaire, le test d'évaluation du risque de non-retour et le traitement de votre dossier.",
    refund:
      "En cas de rejet pour motif administratif ou d'éligibilité, ces frais vous sont intégralement remboursés sur votre moyen de paiement d'origine.",
    footer:
      "Silicon Valley Africa Program 2026 — conservez ce reçu. Toute demande de paiement en dehors du site officiel est une tentative de fraude.",
  },
  en: {
    preview: "Payment receipt — Silicon Valley Africa Program",
    brand: "Silicon Valley Africa",
    heading: "Payment received.",
    intro: (prenom: string) =>
      `${prenom}, we confirm receipt of your verification fee. The checks on your file have started.`,
    labels: {
      amount: "Amount paid",
      reference: "Transaction reference",
      date: "Date",
    },
    covers:
      "This fee covers identity verification, the criminal record check, the non-return risk assessment and the processing of your file.",
    refund:
      "If your file is rejected on administrative or eligibility grounds, this fee is refunded in full to your original payment method.",
    footer:
      "Silicon Valley Africa Program 2026 — keep this receipt. Any request for payment outside the official site is an attempted fraud.",
  },
  ar: {
    preview: "إيصال الأداء — Silicon Valley Africa Program",
    brand: "Silicon Valley Africa",
    heading: "تم استلام الأداء.",
    intro: (prenom: string) =>
      `${prenom}، نؤكّد توصّلنا برسوم التحقّق الخاصة بكم. انطلقت عمليات التحقّق من ملفكم.`,
    labels: {
      amount: "المبلغ المؤدّى",
      reference: "مرجع المعاملة",
      date: "التاريخ",
    },
    covers:
      "تغطّي هذه الرسوم التحقّق من الهوية، ومراقبة السجل العدلي، واختبار تقييم خطر عدم العودة، ومعالجة ملفكم.",
    refund:
      "في حال رفض ملفكم لأسباب إدارية أو لعدم الأهلية، تُرَدّ إليكم هذه الرسوم كاملة على وسيلة الأداء الأصلية.",
    footer:
      "Silicon Valley Africa Program 2026 — احتفظوا بهذا الإيصال. أي طلب أداء خارج الموقع الرسمي هو محاولة احتيال.",
  },
} as const;

/**
 * Payment receipt — sent from the webhook, once settlement is confirmed by a
 * verified provider event. Never from the browser's return from a hosted
 * page: that would issue receipts for payments that never completed.
 */
export function PaymentReceiptEmail({
  prenom,
  amountUsd,
  amountLocal,
  currency,
  reference,
  paidAt,
  locale,
}: PaymentReceiptEmailProps) {
  const t = copy[locale];
  const dir = getDirection(locale);

  // Latin digits in every locale, including Arabic: this is a figure someone
  // may need to quote to their bank or read back to support, and
  // Arabic-Indic numerals invite transcription errors there.
  const nf = new Intl.NumberFormat(
    locale === "ar" ? "ar-MA-u-nu-latn" : locale,
    { minimumFractionDigits: 0, maximumFractionDigits: 2 },
  );

  const amountLine =
    currency === "USD"
      ? `$${nf.format(amountUsd)}`
      : `${nf.format(amountLocal)} ${currency} ($${nf.format(amountUsd)})`;

  return (
    <Html lang={locale} dir={dir}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{t.brand}</Text>
          <Heading style={styles.heading}>{t.heading}</Heading>
          <Text style={styles.paragraph}>{t.intro(prenom)}</Text>

          <Hr style={styles.hr} />

          <Section>
            <Text style={styles.label}>{t.labels.amount}</Text>
            {/* dir="ltr" on all three: currency symbols, transaction
                references and dates all get reordered by the bidi algorithm
                inside an RTL paragraph. */}
            <Text style={{ ...styles.value, fontSize: "20px" }} dir="ltr">
              {amountLine}
            </Text>

            <Text style={styles.label}>{t.labels.reference}</Text>
            <Text
              style={{
                ...styles.value,
                fontFamily: "'Courier New', Courier, monospace",
              }}
              dir="ltr"
            >
              {reference}
            </Text>

            <Text style={styles.label}>{t.labels.date}</Text>
            <Text style={{ ...styles.value, margin: 0 }} dir="ltr">
              {new Intl.DateTimeFormat(
                locale === "ar" ? "ar-MA-u-nu-latn" : locale,
                { dateStyle: "long", timeStyle: "short", timeZone: "UTC" },
              ).format(paidAt)}
            </Text>
          </Section>

          <Hr style={styles.hr} />

          <Text style={styles.paragraph}>{t.covers}</Text>
          <Text style={dir === "rtl" ? styles.quoteRtl : styles.quote}>
            {t.refund}
          </Text>

          <Text style={styles.footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PaymentReceiptEmail;
