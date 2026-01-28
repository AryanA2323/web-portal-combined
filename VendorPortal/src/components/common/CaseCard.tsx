// Case Card Component

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, STATUS_COLORS, CASE_TYPES } from '../../utils/constants';
import type { Case } from '../../types';

interface CaseCardProps {
  case_item: Case;
  onPress: () => void;
}

const CaseCard: React.FC<CaseCardProps> = ({ case_item, onPress }) => {
  const statusColor = STATUS_COLORS[case_item.status] || COLORS.gray;
  const statusText = case_item.status.replace('_', ' ').toUpperCase();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.caseNumber}>Case #{case_item.case_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>
      
      <Text style={styles.caseType}>
        {CASE_TYPES[case_item.case_type as keyof typeof CASE_TYPES] || case_item.case_type}
      </Text>
      
      {case_item.status === 'in_progress' && (
        <View style={styles.infoRow}>
          <View style={styles.statusIndicator} />
          <Text style={styles.statusLabel}>In Progress</Text>
          <Text style={styles.dueDate}>Due: {formatDate(case_item.due_date)}</Text>
        </View>
      )}
      
      {case_item.status === 'awaiting_submission' && (
        <View style={styles.infoRow}>
          <Text style={styles.statusLabel}>Awaiting Submission</Text>
          <Text style={styles.dueDate}>Due: {formatDate(case_item.due_date)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  caseNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  caseType: {
    fontSize: 14,
    color: COLORS.dark,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 13,
    color: COLORS.gray,
    flex: 1,
  },
  dueDate: {
    fontSize: 13,
    color: COLORS.gray,
  },
});

export default CaseCard;
