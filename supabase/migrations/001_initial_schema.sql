-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  leader_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (linked to Supabase auth users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('director', 'manager', 'leader', 'worker')),
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams ADD CONSTRAINT fk_leader
  FOREIGN KEY (leader_id) REFERENCES profiles(id);

-- Employees (workers tracked in apontamentos – not necessarily app users)
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  registration TEXT,
  team_id UUID REFERENCES teams(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extra fields per activity
CREATE TABLE activity_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('number', 'select')),
  unit TEXT,
  required BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

-- Options for select-type fields
CREATE TABLE activity_field_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID REFERENCES activity_fields(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Apontamentos (production records)
CREATE TABLE apontamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id TEXT UNIQUE,             -- set when created offline
  employee_id UUID REFERENCES employees(id),
  activity_id UUID REFERENCES activities(id),
  leader_id UUID REFERENCES profiles(id),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Field values for each apontamento
CREATE TABLE apontamento_field_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  apontamento_id UUID REFERENCES apontamentos(id) ON DELETE CASCADE,
  field_id UUID REFERENCES activity_fields(id),
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_apontamentos_work_date ON apontamentos(work_date);
CREATE INDEX idx_apontamentos_leader ON apontamentos(leader_id);
CREATE INDEX idx_apontamentos_employee ON apontamentos(employee_id);
CREATE INDEX idx_employees_team ON employees(team_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apontamentos_updated_at
  BEFORE UPDATE ON apontamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on new auth user (optional helper)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles(user_id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
          COALESCE(NEW.raw_user_meta_data->>'role', 'worker'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ──────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_field_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE apontamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apontamento_field_values ENABLE ROW LEVEL SECURITY;

-- Helper: current user's profile
CREATE OR REPLACE FUNCTION my_profile()
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION my_team_id()
RETURNS UUID AS $$
  SELECT team_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: everyone sees their own; director/manager see all
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR my_role() IN ('director', 'manager')
  );
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Teams: all authenticated users can read
CREATE POLICY "teams_select" ON teams FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "teams_manage" ON teams FOR ALL
  USING (my_role() IN ('director', 'manager'));

-- Employees: leaders see their team; managers/directors see all
CREATE POLICY "employees_select" ON employees FOR SELECT
  USING (
    my_role() IN ('director', 'manager')
    OR team_id = my_team_id()
    OR my_role() = 'leader'
  );
CREATE POLICY "employees_manage" ON employees FOR INSERT
  WITH CHECK (my_role() IN ('director', 'manager', 'leader'));
CREATE POLICY "employees_update" ON employees FOR UPDATE
  USING (my_role() IN ('director', 'manager', 'leader'));

-- Activities: all can read; non-workers can manage
CREATE POLICY "activities_select" ON activities FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "activities_manage" ON activities FOR ALL
  USING (my_role() IN ('director', 'manager', 'leader'));

CREATE POLICY "fields_select" ON activity_fields FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fields_manage" ON activity_fields FOR ALL
  USING (my_role() IN ('director', 'manager', 'leader'));

CREATE POLICY "field_options_select" ON activity_field_options FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "field_options_manage" ON activity_field_options FOR ALL
  USING (my_role() IN ('director', 'manager', 'leader'));

-- Apontamentos: leaders see own; managers/directors see all
CREATE POLICY "apontamentos_select" ON apontamentos FOR SELECT
  USING (
    my_role() IN ('director', 'manager')
    OR (my_role() = 'leader' AND leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1))
  );
CREATE POLICY "apontamentos_insert" ON apontamentos FOR INSERT
  WITH CHECK (
    my_role() IN ('director', 'manager', 'leader')
    AND leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "apontamentos_delete" ON apontamentos FOR DELETE
  USING (
    my_role() IN ('director', 'manager')
    OR (my_role() = 'leader' AND leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1))
  );

CREATE POLICY "field_values_select" ON apontamento_field_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM apontamentos a WHERE a.id = apontamento_id
      AND (
        my_role() IN ('director', 'manager')
        OR a.leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );
CREATE POLICY "field_values_insert" ON apontamento_field_values FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM apontamentos a WHERE a.id = apontamento_id
      AND a.leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );
CREATE POLICY "field_values_delete" ON apontamento_field_values FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM apontamentos a WHERE a.id = apontamento_id
      AND (
        my_role() IN ('director', 'manager')
        OR a.leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

-- ──────────────────────────────
-- SEED DATA (examples)
-- ──────────────────────────────

INSERT INTO activities (name) VALUES ('Colheita'), ('Desfolha'), ('Irrigação'), ('Poda');

-- Colheita: quantidade (number)
INSERT INTO activity_fields (activity_id, name, field_type, unit, required, sort_order)
SELECT id, 'Quantidade', 'number', 'caixas', TRUE, 0 FROM activities WHERE name = 'Colheita';

-- Desfolha: qualidade (select)
INSERT INTO activity_fields (activity_id, name, field_type, required, sort_order)
SELECT id, 'Qualidade', 'select', FALSE, 0 FROM activities WHERE name = 'Desfolha';

INSERT INTO activity_field_options (field_id, label, value, sort_order)
SELECT af.id, opt.label, opt.val, opt.ord
FROM activity_fields af
JOIN activities a ON a.id = af.activity_id AND a.name = 'Desfolha'
CROSS JOIN (VALUES ('A', 'a', 0), ('B', 'b', 1), ('C', 'c', 2)) AS opt(label, val, ord)
WHERE af.name = 'Qualidade';
