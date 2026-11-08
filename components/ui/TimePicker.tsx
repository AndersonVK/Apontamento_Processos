import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface TimePickerProps {
  label?: string;
  value: string; // "HH:MM" ou ""
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Interpreta só dígitos como horário:
 *  "7" -> 07:00 | "19" -> 19:00 | "730" -> 07:30 | "1900" -> 19:00
 * Retorna "" se inválido (hora > 23 ou minuto > 59).
 */
export function digitsToTime(digits: string): string {
  let h: number;
  let m: number;
  if (digits.length === 0) return '';
  if (digits.length <= 2) {
    h = Number(digits);
    m = 0;
  } else if (digits.length === 3) {
    h = Number(digits[0]);
    m = Number(digits.slice(1));
  } else {
    h = Number(digits.slice(0, 2));
    m = Number(digits.slice(2, 4));
  }
  if (h > 23 || m > 59) return '';
  return `${pad(h)}:${pad(m)}`;
}

export function TimePicker({ label, value, onChange, error, required }: TimePickerProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setRaw(digits);
    // atualiza o valor a cada tecla, assim "Salvar" funciona mesmo com o campo em foco
    onChange(digitsToTime(digits));
  }

  const invalid = focused && raw.length >= 4 && !digitsToTime(raw);
  const shown = focused ? raw : value;

  return (
    <View>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          (error || invalid) && styles.fieldError,
        ]}
      >
        <Ionicons name="time-outline" size={18} color={Colors.primary} />
        <TextInput
          style={styles.input}
          value={shown}
          onChangeText={handleChange}
          onFocus={() => {
            setRaw(value.replace(':', ''));
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
          placeholder="HH:MM"
          placeholderTextColor={Colors.gray400}
          selectTextOnFocus
        />
      </View>
      {focused && !invalid && raw.length > 0 && (
        <Text style={styles.hint}>Digite só números: 1900 = 19:00</Text>
      )}
      {(invalid || error) && (
        <Text style={styles.errorText}>{invalid ? 'Horário inválido' : error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '500', color: Colors.gray700, marginBottom: 6 },
  required: { color: Colors.danger },
  field: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
  },
  fieldFocused: { borderColor: Colors.primary },
  fieldError: { borderColor: Colors.danger },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  hint: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  errorText: { fontSize: 12, color: Colors.danger, marginTop: 4 },
});
