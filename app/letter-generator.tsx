import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenFrame } from '../components/ScreenFrame';
import { api } from '../lib/api';
import { palette, states } from '../lib/theme';
import type { SavedLetter } from '../lib/types';

type Template = { id: string; title: string; topic: string; opening: string; talkingPoints: string[]; closing: string };
type LetterResponse = { text: string; saved: SavedLetter };

export default function LetterGeneratorScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [recipient, setRecipient] = useState('State senator');
  const [topic, setTopic] = useState('Education funding');
  const [state, setState] = useState('');
  const [tone, setTone] = useState('Firm and respectful');
  const [notes, setNotes] = useState('Please support the proposal and explain how it helps constituents in practical terms.');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('education-funding');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<Template[]>('GET', '/api/letter-templates'),
      api<SavedLetter[]>('GET', '/api/letters').catch(() => []),
    ]).then(([templateData, savedData]) => {
      setTemplates(templateData);
      setSavedLetters(savedData);
      setLoading(false);
    }).catch((e) => {
      setError((e as Error).message);
      setLoading(false);
    });
  }, []);

  const activeTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplate), [selectedTemplate, templates]);

  const generate = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await api<LetterResponse>('POST', '/api/letters/generate', {
        recipient,
        topic,
        tone,
        state,
        notes,
        templateId: selectedTemplate,
      });
      setDraft(result.text);
      setSavedLetters((prev) => [result.saved, ...prev]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenFrame title="Letter Generator" subtitle="Use built-in templates for specific legislative topics, then generate a sponsor letter that can be customized for constituents.">
      {loading ? <ActivityIndicator color={palette.accent} style={{ marginTop: 24 }} /> : null}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.card}>
        <Text style={styles.label}>Template topic</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {templates.map((template) => (
            <Pressable key={template.id} style={[styles.chip, selectedTemplate === template.id && styles.chipActive]} onPress={() => { setSelectedTemplate(template.id); setTopic(template.topic); }} accessibilityRole="button">
              <Text style={[styles.chipText, selectedTemplate === template.id && styles.chipTextActive]}>{template.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {activeTemplate && (
          <View style={styles.templateCard}>
            <Text style={styles.templateTitle}>{activeTemplate.title}</Text>
            <Text style={styles.templateText}>{activeTemplate.opening}</Text>
            {activeTemplate.talkingPoints.map((point) => <Text key={point} style={styles.bullet}>- {point}</Text>)}
            <Text style={styles.templateText}>{activeTemplate.closing}</Text>
          </View>
        )}
        <TextInput style={styles.input} value={recipient} onChangeText={setRecipient} placeholder="Recipient" placeholderTextColor="#8d8d8d" />
        <TextInput style={styles.input} value={topic} onChangeText={setTopic} placeholder="Legislative topic" placeholderTextColor="#8d8d8d" />
        <Text style={styles.label}>State</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {states.map((item) => (
            <Pressable key={item} style={[styles.stateChip, state === item && styles.chipActive]} onPress={() => setState(item)} accessibilityRole="button">
              <Text style={[styles.chipText, state === item && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput style={styles.input} value={tone} onChangeText={setTone} placeholder="Tone" placeholderTextColor="#8d8d8d" />
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} multiline placeholder="What should this letter argue?" placeholderTextColor="#8d8d8d" />
        <Pressable style={styles.primaryButton} onPress={generate} disabled={submitting} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>{submitting ? 'Generating...' : 'Generate sponsor letter'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Draft</Text>
        <Text style={styles.draft}>{draft || 'Your generated letter will appear here.'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recent letters</Text>
        {savedLetters.slice(0, 4).map((letter) => (
          <View key={letter.id} style={styles.savedItem}>
            <Text style={styles.savedTitle}>{letter.topic}</Text>
            <Text style={styles.savedMeta}>{letter.recipient} · {letter.state || 'No state set'} · {letter.tone}</Text>
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.card, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 18, marginBottom: 16 },
  label: { color: palette.softText, fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  chips: { gap: 8, paddingBottom: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: palette.line, backgroundColor: '#101010', paddingHorizontal: 14, paddingVertical: 10 },
  stateChip: { borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: '#101010', paddingHorizontal: 12, paddingVertical: 10 },
  chipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  chipText: { color: palette.text, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#0a0a0a' },
  templateCard: { backgroundColor: '#101010', borderRadius: 18, borderWidth: 1, borderColor: palette.line, padding: 14, marginBottom: 14, marginTop: 10 },
  templateTitle: { color: palette.text, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  templateText: { color: '#d4d4d8', fontSize: 14, lineHeight: 21 },
  bullet: { color: '#d4d4d8', fontSize: 14, lineHeight: 21, marginTop: 6 },
  input: { backgroundColor: '#101010', borderRadius: 16, borderWidth: 1, borderColor: palette.line, color: palette.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginTop: 12 },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: palette.accent, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryButtonText: { color: '#0a0a0a', fontWeight: '800', fontSize: 15 },
  sectionTitle: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  draft: { color: '#ece7ff', fontSize: 15, lineHeight: 24 },
  savedItem: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  savedTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  savedMeta: { color: '#cfcfcf', fontSize: 13, marginTop: 4 },
  error: { color: palette.danger, marginBottom: 12 },
});
