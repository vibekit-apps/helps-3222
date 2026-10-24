import { StyleSheet, Text, View } from 'react-native';
import { ScreenFrame } from '../components/ScreenFrame';
import { palette } from '../lib/theme';

const steps = [
  {
    title: '1. Draft and introduce the bill',
    body: 'A legislator files a bill or resolution and gives it a number. This is where the purpose, legal text, and early co-sponsors are locked in.',
  },
  {
    title: '2. Committee review and hearing',
    body: 'Committee chairs decide whether the bill gets a hearing. Testimony, amendments, agency records, and staff analysis matter here more than slogans.',
  },
  {
    title: '3. Floor debate in the first chamber',
    body: 'If committee advances the bill, the full chamber debates it, can amend it again, and votes. If it fails here, it is dead unless reintroduced later.',
  },
  {
    title: '4. Repeat the process in the other chamber',
    body: 'The second chamber runs the same gauntlet: committee, debate, amendments, and a vote. Both chambers must pass the same text.',
  },
  {
    title: '5. Reconcile differences and send to the governor',
    body: 'If versions differ, legislators reconcile them. The final enrolled bill goes to the governor, who signs it, vetoes it, or in some states lets it become law without a signature.',
  },
];

export default function LawStepsScreen() {
  return (
    <ScreenFrame title="The steps it takes to get a law passed" subtitle="This is the plain-language legislative path most states follow, adapted for people building packets and outreach.">
      <View style={styles.card}>
        <Text style={styles.lead}>The brutal truth: good ideas die in committee all the time. This screen focuses on the steps where your packet, FOIA records, and sponsor letters actually move the needle.</Text>
      </View>
      {steps.map((step) => (
        <View key={step.title} style={styles.stepCard}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepBody}>{step.body}</Text>
        </View>
      ))}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.card, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 18, marginBottom: 16 },
  lead: { color: '#ece7ff', fontSize: 15, lineHeight: 23 },
  stepCard: { backgroundColor: palette.card, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 18, marginBottom: 14 },
  stepTitle: { color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  stepBody: { color: '#d4d4d8', fontSize: 14, lineHeight: 22 },
});
