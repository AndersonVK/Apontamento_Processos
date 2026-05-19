import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Input } from './Input';

interface TimePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function parseTime(str: string): { h: number; m: number } {
  const [h, m] = str.split(':').map(Number);
  return { h: isNaN(h) ? 7 : h, m: isNaN(m) ? 0 : m };
}

export function TimePicker({ label, value, onChange, error, required }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const { h, m } = parseTime(value);
  const [tempH, setTempH] = useState(h);
  const [tempM, setTempM] = useState(m);

  function confirm() {
    onChange(`${pad(tempH)}:${pad(tempM)}`);
    setOpen(false);
  }

  function openPicker() {
    const parsed = parseTime(value);
    setTempH(parsed.h);
    setTempM(parsed.m);
    setOpen(true);
  }

  if (Platform.OS === 'web') {
    return (
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        error={error}
        required={required}
        keyboardType="numeric"
        maxLength={5}
      />
    );
  }

  return (
    <View>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <TouchableOpacity
        style={[styles.trigger, error && styles.triggerError]}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <Ionicons name="time-outline" size={18} color={Colors.primary} />
        <Text style={[styles.timeText, !value && styles.placeholder]}>
          {value || '--:--'}
        </Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.picker}>
            <Text style={styles.pickerTitle}>{label ?? 'Horário'}</Text>

            <View style={styles.wheels}>
              {/* Hours */}
              <View style={styles.wheel}>
                <TouchableOpacity onPress={() => setTempH((h) => (h + 1) % 24)}>
                  <Ionicons name="chevron-up" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.wheelValue}>{pad(tempH)}</Text>
                <TouchableOpacity onPress={() => setTempH((h) => (h - 1 + 24) % 24)}>
                  <Ionicons name="chevron-down" size={24} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.colon}>:</Text>
              {/* Minutes */}
              <View style={styles.wheel}>
                <TouchableOpacity onPress={() => setTempM((m) => (m + 5) % 60)}>
                  <Ionicons name="chevron-up" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.wheelValue}>{pad(tempM)}</Text>
                <TouchableOpacity onPress={() => setTempM((m) => (m - 5 + 60) % 60)}>
                  <Ionicons name="chevron-down" size={24} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick select buttons */}
            <View style={styles.quickRow}>
              {['06:00', '07:00', '08:00', '12:00', '13:00', '17:00', '18:00'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.quick, value === t && styles.quickActive]}
                  onPress={() => {
                    const p = parseTime(t);
                    setTempH(p.h);
                    setTempM(p.m);
                  }}
                >
                  <Text style={[styles.quickText, value === t && styles.quickTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancel} onPress={() => setOpen(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirm} onPress={confirm}>
                <Text style={styles.confirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '500', color: Colors.gray700, marginBottom: 6 },
  required: { color: Colors.danger },
  trigger: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
  },
  triggerError: { borderColor: Colors.danger },
  timeText: { fontSize: 15, color: Colors.text, fontVariant: ['tabular-nums'] },
  placeholder: { color: Colors.gray400 },
  errorText: { fontSize: 12, color: Colors.danger, marginTop: 4 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: 300,
    gap: 16,
  },
  pickerTitle: { fontSize: 17, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  wheel: { alignItems: 'center', gap: 8 },
  wheelValue: { fontSize: 42, fontWeight: '700', color: Colors.text, fontVariant: ['tabular-nums'], minWidth: 64, textAlign: 'center' },
  colon: { fontSize: 36, fontWeight: '700', color: Colors.gray400, marginBottom: 8 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  quick: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.gray100 },
  quickActive: { backgroundColor: Colors.primaryLight },
  quickText: { fontSize: 12, color: Colors.gray600 },
  quickTextActive: { color: Colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12 },
  cancel: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.gray100, alignItems: 'center' },
  cancelText: { color: Colors.gray600, fontWeight: '600' },
  confirm: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  confirmText: { color: Colors.white, fontWeight: '600' },
});
