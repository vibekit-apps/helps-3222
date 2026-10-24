import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenFrame } from '../components/ScreenFrame';
import { api } from '../lib/api';
import { palette } from '../lib/theme';

type FoiaResource = { id: string; title: string; description: string; steps: string[]; template: string; link?: string };

export default function FoiaGuideScreen() {
  const [resources, setResources] = useState<FoiaResource[]>([]);
  const [recordType, setRecordType] = useState('Inspection reports');
  const [agency, setAgency] = useState('State Department of Public Health');
  const [purpose, setPurpose] = useState('I am requesting records relevant to public oversight and legislative review.');
  const [template, setTemplate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<FoiaResource[]>('GET', '/api/foia/resources').then((data) => {
      setResources(data);
      setTemplate(data[0]?.template || '');
    }).catch((e) => setError((e as Error).message));
  }, []);

  const buildTemplate = async () => {
    try {
      const result = await api<{ template: string }>('POST', '/api/foia/template', { recordType, agency, purpose });
      setTemplate(result.template);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ScreenFrame title="FOIA Guide" subtitle="Access paperwork templates and the actual steps to obtain public records for legislative review.">
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Build a request</Text>
        <TextInput style={styles.input} value={recordType} onChangeText={setRecordType} placeholder="Records needed" placeholderTextColor="#8d8d8d" />
        <TextInput style={styles.input} value={agency} onChangeText={setAgency} placeholder="Agency" placeholderTextColor="#8d8d8d" />
        <TextInput style={[styles.input, styles.textArea]} value={purpose} onChangeText={setPurpose} multiline placeholder="Purpose" placeholderTextColor="#8d8d8d" />
        <Pressable style={styles.primaryButton} onPress={buildTemplate} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Generate FOIA template</Text>
        </Pressable>
        <View style={styles.templateCard}>
          <Text style={styles.templateText}>{template || 'Your FOIA request template will appear here.'}</Text>
        </View>
      </View>

      {resources.map((resource) => (
        <View key={resource.id} style={styles.card}>
          <Text style={styles.sectionTitle}>{resource.title}</Text>
          <Text style={styles.copy}>{resource.description}</Text>
          {resource.steps.map((step) => (
            <View key={step} style={styles.stepRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={palette.accent} />
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <View style={styles.templateCard}>
            <Text style={styles.templateText}>{resource.template}</Text>
          </View>
          {resource.link ? (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(resource.link!)} accessibilityRole="link">
              <Text style={styles.linkText}>Open source guidance</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.card, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 18, marginBottom: 16 },
  sectionTitle: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  input: { backgroundColor: '#101010', borderRadius: 16, borderWidth: 1, borderColor: palette.line, color: palette.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 12 },
  textArea: { minHeight: 92, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: palette.accent, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#0a0a0a', fontWeight: '800' },
  templateCard: { backgroundColor: '#101010', borderRadius: 18, borderWidth: 1, borderColor: palette.line, padding: 14, marginTop: 14 },
  templateText: { color: '#ece7ff', fontSize: 14, lineHeight: 22 },
  copy: { color: '#d4d4d8', fontSize: 14, lineHeight: 21 },
  stepRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'flex-start' },
  stepText: { color: palette.text, fontSize: 14, lineHeight: 21, flex: 1 },
  linkButton: { borderRadius: 14, borderWidth: 1, borderColor: palette.line, paddingVertical: 12, alignItems: 'center', marginTop: 14, backgroundColor: '#101010' },
  linkText: { color: palette.text, fontWeight: '700' },
  error: { color: palette.danger, marginBottom: 12 },
});
