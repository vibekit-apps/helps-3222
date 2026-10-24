import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenFrame } from '../components/ScreenFrame';
import { api } from '../lib/api';
import { palette } from '../lib/theme';
import type { Packet } from '../lib/types';

export default function PacketBuilderScreen() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [title, setTitle] = useState('Clean Water Packet');
  const [billName, setBillName] = useState('HB 1120');
  const [state, setState] = useState('IL');
  const [summary, setSummary] = useState('A short summary of the proposed law, its budget effect, and who it helps.');
  const [foiaNeed, setFoiaNeed] = useState('Agency inspection reports and compliance complaints from the last 24 months.');
  const [sponsorTarget, setSponsorTarget] = useState('Target Senate Environment Committee members first.');
  const [nextStep, setNextStep] = useState('Prepare witness list and submit sponsor letter packet by Friday.');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Packet[]>('GET', '/api/packets').then((data) => {
      setPackets(data);
      setLoading(false);
    }).catch((e) => {
      setError((e as Error).message);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const packet = await api<Packet>('POST', '/api/packets', { title, billName, state, summary, foiaNeed, sponsorTarget, nextStep });
      setPackets((prev) => [packet, ...prev]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenFrame title="Packet Builder" subtitle="Create a legislative review packet with the core parts people actually need: summary, FOIA targets, sponsor strategy, and next actions.">
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.card}>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Packet title" placeholderTextColor="#8d8d8d" />
        <TextInput style={styles.input} value={billName} onChangeText={setBillName} placeholder="Bill or ordinance name" placeholderTextColor="#8d8d8d" />
        <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="State" placeholderTextColor="#8d8d8d" autoCapitalize="characters" maxLength={2} />
        <TextInput style={[styles.input, styles.textArea]} value={summary} onChangeText={setSummary} multiline placeholder="Packet summary" placeholderTextColor="#8d8d8d" />
        <TextInput style={[styles.input, styles.textArea]} value={foiaNeed} onChangeText={setFoiaNeed} multiline placeholder="FOIA documents to request" placeholderTextColor="#8d8d8d" />
        <TextInput style={[styles.input, styles.textArea]} value={sponsorTarget} onChangeText={setSponsorTarget} multiline placeholder="Sponsor outreach target" placeholderTextColor="#8d8d8d" />
        <TextInput style={[styles.input, styles.textArea]} value={nextStep} onChangeText={setNextStep} multiline placeholder="Next step" placeholderTextColor="#8d8d8d" />
        <Pressable style={styles.primaryButton} onPress={save} disabled={saving} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save packet'}</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Saved packets</Text>
        {loading ? <ActivityIndicator color={palette.accent} style={{ marginTop: 12 }} /> : null}
        {packets.map((packet) => (
          <View key={packet.id} style={styles.packetCard}>
            <Text style={styles.packetTitle}>{packet.title}</Text>
            <Text style={styles.packetMeta}>{packet.billName} · {packet.state}</Text>
            <Text style={styles.packetBody}>{packet.summary}</Text>
            <Text style={styles.packetFoot}>FOIA: {packet.foiaNeed}</Text>
            <Text style={styles.packetFoot}>Sponsor plan: {packet.sponsorTarget}</Text>
            <Text style={styles.packetFoot}>Next: {packet.nextStep}</Text>
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.card, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 18, marginBottom: 16 },
  input: { backgroundColor: '#101010', borderRadius: 16, borderWidth: 1, borderColor: palette.line, color: palette.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 12 },
  textArea: { minHeight: 92, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: palette.accent, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#0a0a0a', fontWeight: '800' },
  sectionTitle: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  packetCard: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, paddingTop: 12, marginTop: 12 },
  packetTitle: { color: palette.text, fontSize: 17, fontWeight: '800' },
  packetMeta: { color: palette.softText, fontSize: 13, marginTop: 4, marginBottom: 8 },
  packetBody: { color: '#d4d4d8', fontSize: 14, lineHeight: 21 },
  packetFoot: { color: '#cfcfcf', fontSize: 13, lineHeight: 19, marginTop: 8 },
  error: { color: palette.danger, marginBottom: 12 },
});
