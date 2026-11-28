-- Histórico por data (parte A): estruturas.
-- Equipe do funcionário, versões de jornada e equipe carimbada em cada lançamento.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- 1) Em qual equipe o funcionário estava, e quando. during = [início, fim):
--    início NULL = desde sempre; fim NULL = em aberto. Sem sobreposição por pessoa.
CREATE TABLE IF NOT EXISTS employee_team_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  during DATERANGE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT employee_team_history_no_overlap
    EXCLUDE USING gist (employee_id WITH =, during WITH &&)
);
CREATE INDEX IF NOT EXISTS idx_eth_team_during ON employee_team_history USING gist (team_id, during);
CREATE INDEX IF NOT EXISTS idx_eth_employee ON employee_team_history (employee_id);

-- 2) Versões da jornada da equipe (valid_from NULL = desde sempre)
CREATE TABLE IF NOT EXISTS team_schedule_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  valid_from DATE,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS team_sched_unique
  ON team_schedule_versions (team_id, COALESCE(valid_from, '-infinity'::date));

-- 3) Versões da jornada própria do funcionário (custom = false: volta a seguir a equipe)
CREATE TABLE IF NOT EXISTS employee_schedule_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  valid_from DATE,
  custom BOOLEAN NOT NULL,
  shift_start TIME,
  shift_end TIME,
  break_start TIME,
  break_end TIME,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_sched_unique
  ON employee_schedule_versions (employee_id, COALESCE(valid_from, '-infinity'::date));

-- 4) Equipe carimbada nos lançamentos (preenchida pelo banco, usando a data do trabalho)
ALTER TABLE apontamentos
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id),
  ADD COLUMN IF NOT EXISTS leader_team_id UUID REFERENCES teams(id);
ALTER TABLE absences ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE idle_blocks ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

CREATE INDEX IF NOT EXISTS idx_apont_team_date ON apontamentos (team_id, work_date);
CREATE INDEX IF NOT EXISTS idx_apont_leader_team_date ON apontamentos (leader_team_id, work_date);
CREATE INDEX IF NOT EXISTS idx_apont_employee_date ON apontamentos (employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_apont_project_date ON apontamentos (project_id, work_date);
CREATE INDEX IF NOT EXISTS idx_abs_team_date ON absences (team_id, work_date);
CREATE INDEX IF NOT EXISTS idx_idle_team_date ON idle_blocks (team_id, work_date);

-- 5) Leitura liberada a quem lança; ESCRITA só pelas funções (security definer)
ALTER TABLE employee_team_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_schedule_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON employee_team_history, team_schedule_versions, employee_schedule_versions TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['employee_team_history', 'team_schedule_versions', 'employee_schedule_versions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_select') THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (my_role() IN (''director'', ''manager'', ''leader''))', t||'_select', t);
    END IF;
  END LOOP;
END $$;
