import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "react-email";
import { styles } from "./styles";
import { PAYS_LABELS, SECTEUR_LABELS, PACK_LABELS } from "../labels";
import type { CandidatureData, Locale } from "../types";

export interface CandidatureReceivedEmailProps {
  candidature: CandidatureData;
  locale: Locale;
}

const copy = {
  fr: {
    preview: "Votre candidature a bien été reçue — Silicon Valley Africa Program",
    brand: "Silicon Valley Africa",
    heading: (prenom: string) => `Merci, ${prenom}.`,
    intro:
      "Nous avons bien reçu votre candidature au Silicon Valley Africa Program 2026. Notre comité l'examinera avec attention.",
    summaryTitle: "Résumé de votre candidature",
    labels: {
      pack: "Pack souhaité",
      pays: "Pays de résidence",
      secteur: "Secteur d'activité",
      email: "Email",
      telephone: "Téléphone",
    },
    timeline:
      "Vous recevrez une réponse par email sous 72 heures ouvrées. Aucune action n'est requise de votre part pour l'instant.",
    footer:
      "Silicon Valley Africa Program 2026 — cet email a été envoyé automatiquement suite à votre candidature.",
  },
  en: {
    preview: "Your application has been received — Silicon Valley Africa Program",
    brand: "Silicon Valley Africa",
    heading: (prenom: string) => `Thank you, ${prenom}.`,
    intro:
      "We've received your application to the Silicon Valley Africa Program 2026. Our committee will review it carefully.",
    summaryTitle: "Your Application Summary",
    labels: {
      pack: "Desired Pack",
      pays: "Country Of Residence",
      secteur: "Sector Of Activity",
      email: "Email",
      telephone: "Phone Number",
    },
    timeline:
      "You'll hear back by email within 72 business hours. No further action is needed from you at this time.",
    footer:
      "Silicon Valley Africa Program 2026 — this email was sent automatically following your application.",
  },
} as const;

export function CandidatureReceivedEmail({
  candidature,
  locale,
}: CandidatureReceivedEmailProps) {
  const t = copy[locale];

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{t.brand}</Text>
          <Heading style={styles.heading}>{t.heading(candidature.prenom)}</Heading>
          <Text style={styles.paragraph}>{t.intro}</Text>

          <Hr style={styles.hr} />

          <Text style={styles.label}>{t.summaryTitle}</Text>

          <Section style={{ marginTop: "16px" }}>
            <Text style={styles.label}>{t.labels.pack}</Text>
            <Text style={styles.value}>
              {PACK_LABELS[locale][candidature.pack] ?? candidature.pack}
            </Text>

            <Text style={styles.label}>{t.labels.pays}</Text>
            <Text style={styles.value}>
              {PAYS_LABELS[locale][candidature.pays] ?? candidature.pays}
            </Text>

            <Text style={styles.label}>{t.labels.secteur}</Text>
            <Text style={styles.value}>
              {SECTEUR_LABELS[locale][candidature.secteur] ?? candidature.secteur}
            </Text>

            <Text style={styles.label}>{t.labels.email}</Text>
            <Text style={styles.value}>{candidature.email}</Text>

            <Text style={styles.label}>{t.labels.telephone}</Text>
            <Text style={{ ...styles.value, margin: 0 }}>
              {candidature.telephone}
            </Text>
          </Section>

          <Hr style={styles.hr} />

          <Text style={styles.paragraph}>{t.timeline}</Text>

          <Text style={styles.footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default CandidatureReceivedEmail;
