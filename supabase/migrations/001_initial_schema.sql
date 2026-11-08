-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  leader_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (linked to Supabase auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('director', 'manager', 'leader', 'worker')),
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leader') THEN
    ALTER TABLE teams ADD CONSTRAINT fk_leader
      FOREIGN KEY (leader_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Employees (workers tracked in apontamentos – not necessarily app users)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  registration TEXT,
  team_id UUID REFERENCES teams(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extra fields per activity
CREATE TABLE IF NOT EXISTS activity_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('number', 'select')),
  unit TEXT,
  required BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

-- Options for select-type fields
CREATE TABLE IF NOT EXISTS activity_field_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID REFERENCES activity_fields(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Apontamentos (production records)
CREATE TABLE IF NOT EXISTS apontamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id TEXT UNIQUE,
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
CREATE TABLE IF NOT EXISTS apontamento_field_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  apontamento_id UUID REFERENCES apontamentos(id) ON DELETE CASCADE,
  field_id UUID REFERENCES activity_fields(id),
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_apontamentos_work_date ON apontamentos(work_date);
CREATE INDEX IF NOT EXISTS idx_apontamentos_leader ON apontamentos(leader_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_employee ON apontamentos(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apontamentos_updated_at ON apontamentos;
CREATE TRIGGER trg_apontamentos_updated_at
  BEFORE UPDATE ON apontamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles(user_id, name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      split_part(NEW.email, '@', 1),
      'Usuário'
    ),
    COALESCE(
      CASE WHEN NEW.raw_user_meta_data->>'role' IN ('director','manager','leader','worker')
           THEN NEW.raw_user_meta_data->>'role' END,
      'worker'
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
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

-- Helper functions
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

-- Policies (drop before recreate to allow idempotent runs)
DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  DROP POLICY IF EXISTS "teams_select" ON teams;
  DROP POLICY IF EXISTS "teams_manage" ON teams;
  DROP POLICY IF EXISTS "employees_select" ON employees;
  DROP POLICY IF EXISTS "employees_manage" ON employees;
  DROP POLICY IF EXISTS "employees_update" ON employees;
  DROP POLICY IF EXISTS "activities_select" ON activities;
  DROP POLICY IF EXISTS "activities_manage" ON activities;
  DROP POLICY IF EXISTS "fields_select" ON activity_fields;
  DROP POLICY IF EXISTS "fields_manage" ON activity_fields;
  DROP POLICY IF EXISTS "field_options_select" ON activity_field_options;
  DROP POLICY IF EXISTS "field_options_manage" ON activity_field_options;
  DROP POLICY IF EXISTS "apontamentos_select" ON apontamentos;
  DROP POLICY IF EXISTS "apontamentos_insert" ON apontamentos;
  DROP POLICY IF EXISTS "apontamentos_delete" ON apontamentos;
  DROP POLICY IF EXISTS "field_values_select" ON apontamento_field_values;
  DROP POLICY IF EXISTS "field_values_insert" ON apontamento_field_values;
  DROP POLICY IF EXISTS "field_values_delete" ON apontamento_field_values;
END $$;

CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (user_id = auth.uid() OR my_role() IN ('director', 'manager'));
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "teams_select" ON teams FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "teams_manage" ON teams FOR ALL
  USING (my_role() IN ('director', 'manager'));

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

CREATE POLICY "activities_select" ON activities FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "activities_manage" ON activities FOR ALL
  USING (my_role() IN ('director', 'manager', 'leader'));

CREATE POLICY "fields_select" ON activity_fields FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fields_manage" ON activity_fields FOR ALL
  USING (my_role() IN ('director', 'manager', 'leader'));

CREATE POLICY "field_options_select" ON activity_field_options FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "field_options_manage" ON activity_field_options FOR ALL
  USING (my_role() IN ('director', 'manager', 'leader'));

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
