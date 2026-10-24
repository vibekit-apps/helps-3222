import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '../lib/theme';
import type { ReactNode } from 'react';

export function ScreenFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={20} color={palette.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Pressable style={styles.homeButton} onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Go home">
            <Ionicons name="home-outline" size={20} color={palette.text} />
          </Pressable>
        </View>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  scroll: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  homeButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1 },
  backText: { color: palette.text, fontSize: 15, fontWeight: '600' },
  title: { color: palette.text, fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: palette.softText, fontSize: 15, lineHeight: 22, marginBottom: 20 },
});
