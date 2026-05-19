export type UserRole = 'director' | 'manager' | 'leader' | 'worker';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  role: UserRole;
  team_id: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  registration: string | null;
  team_id: string | null;
  active: boolean;
  created_at: string;
  team?: Team;
}

export type FieldType = 'number' | 'select';

export interface ActivityField {
  id: string;
  activity_id: string;
  name: string;
  field_type: FieldType;
  unit: string | null;
  required: boolean;
  sort_order: number;
  options?: ActivityFieldOption[];
}

export interface ActivityFieldOption {
  id: string;
  field_id: string;
  label: string;
  value: string;
  sort_order: number;
}

export interface Activity {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  fields?: ActivityField[];
}

export interface ApontamentoFieldValue {
  id?: string;
  apontamento_id?: string;
  field_id: string;
  value: string;
  field?: ActivityField;
}

export interface Apontamento {
  id: string;
  local_id: string | null;
  employee_id: string;
  activity_id: string;
  leader_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  synced: boolean;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  activity?: Activity;
  leader?: Profile;
  field_values?: ApontamentoFieldValue[];
}

export interface ApontamentoFormData {
  employee_id: string;
  activity_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  notes: string;
  field_values: Record<string, string>;
}
