import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenFrame } from '../components/ScreenFrame';
import { api } from '../lib/api';
import { palette, states } from '../lib/theme';
import type { StateDirectory } from '../lib/types';

export default function SenatorDirectoryScreen() {
  const [directory, setDirectory] = useState<StateDirectory | null>(null);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('IL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDirectory(await api<StateDirectory>('GET', `/api/state-legislators?state=${state}`));
    } catch (e) {
      setDirectory(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => { load(); }, [load]);

  const legislators = useMemo(() => (directory?.legislators || []).filter((legislator) => {
    const haystack = `${legislator.name} ${legislator.party} ${legislator.chamber} ${legislator.district}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [directory, query]);

  return (
    <ScreenFrame title="State Legislator Directory" subtitle="Pick a state to find its official legislature directory. When an OpenStates key is connected, the app also loads individual state legislators, districts, and contact details.">
      <View style={styles.controls}>
        <Text style={styles.label}>State</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {states.map((item) => (
            <Pressable key={item} style={[styles.filterChip, state === item && styles.filterChipActive]} onPress={() => setState(item)} accessibilityRole="button">
              <Text style={[styles.filterText, state === item && styles.filterTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {loading ? <ActivityIndicator color={palette.accent} style={{ marginTop: 24 }} /> : null}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {directory && (
        <>
          <View style={styles.card}>
            <Text style={styles.directoryTitle}>{directory.name}</Text>
            <Text style={styles.directoryCopy}>{directory.source === 'openstates' ? 'Current legislator records are loaded for this state.' : 'Use the official state legislature directory to find current legislators and district contact information.'}</Text>
            <View style={styles.actionRow}>
              <Pressable style={styles.primaryButton} onPress={() => Linking.openURL(directory.directoryUrl)} accessibilityRole="link">
                <Text style={styles.primaryButtonText}>Official directory</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(directory.legislatureUrl)} accessibilityRole="link">
                <Text style={styles.secondaryButtonText}>Legislature site</Text>
              </Pressable>
            </View>
          </View>
          {!!directory.legislators.length && (
            <>
              <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Search name, district, chamber, or party" placeholderTextColor="#8d8d8d" />
              {legislators.map((legislator) => (
                <View key={legislator.id} style={styles.card}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{legislator.name}</Text>
                      <Text style={styles.meta}>{legislator.chamber} · District {legislator.district || 'not listed'} · {legislator.party || 'Nonpartisan'}</Text>
                    </View>
                    <View style={styles.badge}><Text style={styles.badgeText}>{legislator.state}</Text></View>
                  </View>
                  {!!legislator.phone && <Text style={styles.detailText}>{legislator.phone}</Text>}
                  <View style={styles.actionRow}>
                    {!!legislator.email && <Pressable style={styles.primaryButton} onPress={() => Linking.openURL(legislator.email!)} accessibilityRole="link"><Text style={styles.primaryButtonText}>Contact</Text></Pressable>}
                    {!!legislator.website && <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(legislator.website!)} accessibilityRole="link"><Text style={styles.secondaryButtonText}>Website</Text></Pressable>}
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  controls: { marginBottom: 16 },
  label: { color: palette.softText, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  filters: { gap: 8, paddingRight: 6 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: palette.line, backgroundColor: '#101010' },
  filterChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  filterText: { color: palette.text, fontWeight: '700', fontSize: 13 },
  filterTextActive: { color: '#0a0a0a' },
  input: { backgroundColor: '#101010', borderRadius: 16, borderWidth: 1, borderColor: palette.line, color: palette.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 12 },
  error: { color: palette.danger, marginBottom: 12 },
  card: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 18, marginBottom: 12 },
  directoryTitle: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  directoryCopy: { color: '#d4d4d8', fontSize: 14, lineHeight: 21 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  name: { color: palette.text, fontSize: 19, fontWeight: '800' },
  meta: { color: '#d4d4d8', fontSize: 14, marginTop: 5 },
  badge: { backgroundColor: '#101010', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-start' },
  badgeText: { color: palette.accent, fontWeight: '800' },
  detailText: { color: palette.text, fontSize: 14, lineHeight: 21, marginTop: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryButton: { flex: 1, backgroundColor: palette.accent, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: '#0a0a0a', fontWeight: '800' },
  secondaryButton: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: palette.line, backgroundColor: '#101010' },
  secondaryButtonText: { color: palette.text, fontWeight: '700' },
});
