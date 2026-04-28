import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

export type DynamicSieve = {
  sieve_name: string;
  objective: string;
  required_tool: string;
};

export type ForensicReportData = {
  critical_red_flags: string[];
  missing_metadata: string[];
  contextual_verdict: string;
};

type AutopsyReportProps = {
  reportData: ForensicReportData;
  active_sieves: DynamicSieve[];
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 30,
    paddingHorizontal: 30,
    backgroundColor: "#f3f5f8",
    color: "#0f172a",
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    backgroundColor: "#1e293b",
    color: "#ffffff",
    borderBottomWidth: 2,
    borderBottomColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 7,
    color: "#c7d6ea",
    marginBottom: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 6,
  },
  section: {
    borderWidth: 1,
    borderColor: "#d6dee8",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
    color: "#111827",
  },
  detailValue: {
    fontSize: 10,
    lineHeight: 1.4,
    color: "#0f172a",
  },
  verdict: {
    fontSize: 11,
    lineHeight: 1.55,
    color: "#ffffff",
  },
  sieveCard: {
    borderWidth: 1,
    borderColor: "#dce4ee",
    borderRadius: 8,
    padding: 9,
    marginBottom: 7,
    backgroundColor: "#f9fbff",
  },
  sieveHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 4,
  },
  sieveName: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0f172a",
    flex: 1,
  },
  sieveTool: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#475569",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
    paddingRight: 8,
  },
  bullet: {
    width: 10,
    fontSize: 11,
    color: "#0b1f3a",
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.42,
    color: "#0f172a",
  },
  emptyValue: {
    fontSize: 10,
    color: "#475569",
    fontStyle: "italic",
  },
  footer: {
    marginTop: 6,
    fontSize: 8,
    color: "#64748b",
    textAlign: "center",
  },
});

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <Text style={styles.emptyValue}>No entries reported.</Text>;
  }

  return (
    <View>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function AutopsyReport({ reportData, active_sieves }: AutopsyReportProps) {
  const { contextual_verdict, critical_red_flags, missing_metadata } = reportData;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.label}>Aegis-Verify Forensic Autopsy</Text>
          <Text style={styles.title}>Contextual Verdict</Text>
          <Text style={styles.verdict}>{contextual_verdict}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sieves Used In Investigation</Text>
          {active_sieves.length > 0 ? (
            active_sieves.map((sieve, index) => (
              <View key={`${sieve.sieve_name}-${index}`} style={styles.sieveCard}>
                <View style={styles.sieveHeader}>
                  <Text style={styles.sieveName}>{sieve.sieve_name}</Text>
                  <Text style={styles.sieveTool}>{sieve.required_tool}</Text>
                </View>
                <Text style={styles.detailValue}>{sieve.objective}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyValue}>No sieves were provided for this report.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Critical Red Flags</Text>
          <BulletList items={critical_red_flags} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Missing Metadata</Text>
          <BulletList items={missing_metadata} />
        </View>

        <Text style={styles.footer}>
          Aegis-Verify | Generated for enterprise forensic review only.
        </Text>
      </Page>
    </Document>
  );
}
