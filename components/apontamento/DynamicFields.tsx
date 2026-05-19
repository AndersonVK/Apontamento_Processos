import React from 'react';
import { View } from 'react-native';
import { ActivityField } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface DynamicFieldsProps {
  fields: ActivityField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  errors?: Record<string, string>;
}

export function DynamicFields({ fields, values, onChange, errors = {} }: DynamicFieldsProps) {
  return (
    <View style={{ gap: 16 }}>
      {fields.map((field) => {
        const val = values[field.id] ?? '';
        const err = errors[field.id];

        if (field.field_type === 'select') {
          const options = (field.options ?? []).map((o) => ({
            label: o.label,
            value: o.value,
          }));
          return (
            <Select
              key={field.id}
              label={field.name}
              options={options}
              value={val}
              onChange={(v) => onChange(field.id, v)}
              error={err}
              required={field.required}
            />
          );
        }

        return (
          <Input
            key={field.id}
            label={field.unit ? `${field.name} (${field.unit})` : field.name}
            value={val}
            onChangeText={(v) => onChange(field.id, v)}
            keyboardType="numeric"
            placeholder={field.unit ? `Ex: 40` : '0'}
            error={err}
            required={field.required}
          />
        );
      })}
    </View>
  );
}
