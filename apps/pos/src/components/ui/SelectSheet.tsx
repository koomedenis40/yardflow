import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, Plus, Search, X } from 'lucide-react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';

export interface SelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SelectSheetProps {
  label: string;
  placeholder?: string;
  value: SelectOption | null;
  options: SelectOption[];
  onSelect: (option: SelectOption) => void;
  onQuickCreate?: (name: string) => void;
  quickCreateLabel?: string;
  error?: string | null;
  loading?: boolean;
}

export function SelectSheet({
  label,
  placeholder = 'Select…',
  value,
  options,
  onSelect,
  onQuickCreate,
  quickCreateLabel = 'Add new',
  error,
  loading,
}: SelectSheetProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (option: SelectOption) => {
    onSelect(option);
    setOpen(false);
    setSearch('');
  };

  const handleCreate = () => {
    if (onQuickCreate && search.trim()) {
      onQuickCreate(search.trim());
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.trigger, error ? styles.triggerError : null]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={value ? styles.triggerValue : styles.triggerPlaceholder} numberOfLines={1}>
          {value ? value.label : placeholder}
        </Text>
        <ChevronDown size={16} color={colors.muted} strokeWidth={1.75} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <X size={20} color={colors.neutral[700]} strokeWidth={1.75} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Search size={16} color={colors.muted} strokeWidth={1.75} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search…"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          {loading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.id === value?.id && styles.optionSelected]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {item.sublabel ? (
                    <Text style={styles.optionSublabel}>{item.sublabel}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No results</Text>
              }
            />
          )}

          {onQuickCreate && search.trim() ? (
            <TouchableOpacity style={styles.createRow} onPress={handleCreate}>
              <Plus size={16} color={colors.green[800]} strokeWidth={1.75} />
              <Text style={styles.createLabel}>
                {quickCreateLabel}: "{search.trim()}"
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing[4] },
  label: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.medium,
    color: colors.neutral[700],
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    minHeight: 48,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  triggerError: { borderColor: colors.red[700] },
  triggerValue: { fontSize: fontSize.body, color: colors.text, flex: 1, marginRight: spacing[2] },
  triggerPlaceholder: { fontSize: fontSize.body, color: colors.muted, flex: 1, marginRight: spacing[2] },
  errorText: { marginTop: 4, fontSize: fontSize.caption, color: colors.red[700] },

  // Sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.semibold, color: colors.text },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing[4],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.neutral[100],
    borderRadius: radius.sm,
    height: 40,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: fontSize.body, color: colors.text },
  option: {
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  optionSelected: { backgroundColor: colors.green[50] },
  optionLabel: { fontSize: fontSize.body, color: colors.text },
  optionSublabel: { fontSize: fontSize.caption, color: colors.muted, marginTop: 2 },
  emptyText: { padding: spacing[4], color: colors.muted, textAlign: 'center', fontSize: fontSize.body },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createLabel: { fontSize: fontSize.body, color: colors.green[800], fontWeight: fontWeight.medium },
});
