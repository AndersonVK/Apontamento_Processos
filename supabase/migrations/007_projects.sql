-- Projeto: campo obrigatório no apontamento. Cadastro simples (só o nome).
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- nome único, sem diferenciar maiúsculas/minúsculas
CREATE UNIQUE INDEX IF NOT EXISTS projects_name_unique ON projects (lower(trim(name)));

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_select') THEN
    CREATE POLICY "projects_select" ON projects FOR SELECT
      USING (my_role() IN ('director', 'manager', 'leader'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_manage') THEN
    CREATE POLICY "projects_manage" ON projects FOR ALL
      USING (my_role() IN ('director', 'manager'))
      WITH CHECK (my_role() IN ('director', 'manager'));
  END IF;
END $$;

-- Obrigatório. Seguro aplicar com a tabela de apontamentos vazia; com registros
-- antigos, crie um projeto e preencha project_id antes de rodar esta linha.
ALTER TABLE apontamentos ADD COLUMN IF NOT EXISTS project_id UUID NOT NULL REFERENCES projects(id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_project ON apontamentos(project_id);
