import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/config/theme';

const tips = [
  {
    icon: 'clipboard-check-outline' as const,
    title: 'Open assigned checks',
    text: 'Use the dashboard to see every assigned check and open the one you are working on.',
  },
  {
    icon: 'microphone-outline' as const,
    title: 'Record statements carefully',
    text: 'Speak clearly in Marathi, review the English translation, then save the final statement.',
  },
  {
    icon: 'camera-outline' as const,
    title: 'Upload clear evidence',
    text: 'Take or upload sharp photos so the review team can use them without follow-up calls.',
  },
];

export default function ExploreScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Quick guide</Text>
        <Text style={styles.heroTitle}>A smoother field workflow</Text>
        <Text style={styles.heroText}>
          This screen keeps the essential steps handy so vendors can move confidently without extra training.
        </Text>
      </View>

      {tips.map((tip) => (
        <View key={tip.title} style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <MaterialCommunityIcons name={tip.icon} size={22} color={theme.colors.primary} />
          </View>
          <Text style={styles.tipTitle}>{tip.title}</Text>
          <Text style={styles.tipText}>{tip.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
    paddingTop: 28,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    ...theme.shadows.card,
  },
  heroEyebrow: {
    color: '#DCEEFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#F4F8FD',
  },
  tipCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  tipIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    marginBottom: 14,
  },
  tipTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  tipText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
});
