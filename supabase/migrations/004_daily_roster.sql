-- Lote 4: chamada do dia (jornada por equipe/funcionário, faltas, lacunas
-- justificadas, dia sem trabalho e fechamento do dia). Idempotente.

-- 1) Jornada padrão da equipe (almoço opcional: deixe NULL para "sem pausa")
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS shift_start TIME NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS shift_end   TIME NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS break_start TIME DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS break_end   TIME DEFAULT '13:00';

-- 2) Funcionário com jornada própria (custom_schedule = true usa os campos abaixo)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS custom_schedule BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shift_start TIME,
  ADD COLUMN IF NOT EXISTS shift_end   TIME,
  ADD COLUMN IF NOT EXISTS break_start TIME,
  ADD COLUMN IF NOT EXISTS break_end   TIME;

-- 3) Dia da equipe: sem trabalho, horário diferente naquele dia, fechamento
CREATE TABLE IF NOT EXISTS team_days (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  no_work BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  custom_schedule BOOLEAN NOT NULL DEFAULT FALSE,
  shift_start TIME,
  shift_end TIME,
  break_start TIME,
  break_end TIME,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES profiles(id),
  PRIMARY KEY (team_id, work_date)
);

-- 4) Faltas (status do dia, separado das atividades)
CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  reason_type TEXT NOT NULL CHECK (reason_type IN ('atestado', 'sem_justificativa', 'outro')),
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, work_date),
  CHECK (reason_type <> 'outro' OR length(trim(coalesce(note, ''))) > 0)
);

-- 5) Lacunas justificadas (parado, deslocamento, outro) - contam como horário coberto
CREATE TABLE IF NOT EXISTS idle_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason_type TEXT NOT NULL CHECK (reason_type IN ('parado', 'deslocamento', 'outro')),
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time),
  CHECK (reason_type <> 'outro' OR length(trim(coalesce(note, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(work_date);
CREATE INDEX IF NOT EXISTS idx_idle_blocks_emp_date ON idle_blocks(employee_id, work_date);

ALTER TABLE team_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE idle_blocks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON team_days, absences, idle_blocks TO authenticated;

-- Quem lança (diretor, gerente, líder) enxerga e altera os dias; operário não.
DROP POLICY IF EXISTS "team_days_all" ON team_days;
CREATE POLICY "team_days_all" ON team_days FOR ALL
  USING (my_role() IN ('director', 'manager', 'leader'))
  WITH CHECK (my_role() IN ('director', 'manager', 'leader'));

DROP POLICY IF EXISTS "absences_all" ON absences;
CREATE POLICY "absences_all" ON absences FOR ALL
  USING (my_role() IN ('director', 'manager', 'leader'))
  WITH CHECK (my_role() IN ('director', 'manager', 'leader'));

DROP POLICY IF EXISTS "idle_blocks_all" ON idle_blocks;
CREATE POLICY "idle_blocks_all" ON idle_blocks FOR ALL
  USING (my_role() IN ('director', 'manager', 'leader'))
  WITH CHECK (my_role() IN ('director', 'manager', 'leader'));

-- 6) Cobertura entre equipes: o líder precisa ver os apontamentos de QUALQUER
--    líder para saber se um funcionário emprestado já foi apontado.
--    (As listas do app continuam filtrando "só os meus".)
DROP POLICY IF EXISTS "apontamentos_select" ON apontamentos;
CREATE POLICY "apontamentos_select" ON apontamentos FOR SELECT
  USING (my_role() IN ('director', 'manager', 'leader'));

-- 7) Líderes enxergam nomes de outros usuários (para "apontado por fulano")
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (user_id = auth.uid() OR my_role() IN ('director', 'manager', 'leader'));
