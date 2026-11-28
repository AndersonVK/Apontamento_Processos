-- Trava de dia fechado (para líderes) + resumo do mês para o calendário.
-- Só adiciona; idempotente. Diretor e gerente nunca são travados.

-- 1) O dia da equipe do LÍDER está fechado?
CREATE OR REPLACE FUNCTION day_locked(p_date date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT my_role() = 'leader' AND EXISTS (
    SELECT 1 FROM team_days td
    WHERE td.team_id = my_team_id() AND td.work_date = p_date AND td.closed_at IS NOT NULL
  );
$$;

-- 2) Políticas RESTRITIVAS (somam com as existentes: precisam passar as duas)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['apontamentos', 'absences', 'idle_blocks'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_lock_ins') THEN
      EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT day_locked(work_date))', t||'_lock_ins', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_lock_upd') THEN
      EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE FOR UPDATE USING (NOT day_locked(work_date)) WITH CHECK (NOT day_locked(work_date))', t||'_lock_upd', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_lock_del') THEN
      EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE FOR DELETE USING (NOT day_locked(work_date))', t||'_lock_del', t);
    END IF;
  END LOOP;

  -- valores dos campos: a data vem do apontamento
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='apontamento_field_values' AND policyname='field_values_lock_ins') THEN
    CREATE POLICY field_values_lock_ins ON apontamento_field_values AS RESTRICTIVE FOR INSERT
      WITH CHECK (NOT day_locked((SELECT a.work_date FROM apontamentos a WHERE a.id = apontamento_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='apontamento_field_values' AND policyname='field_values_lock_upd') THEN
    CREATE POLICY field_values_lock_upd ON apontamento_field_values AS RESTRICTIVE FOR UPDATE
      USING (NOT day_locked((SELECT a.work_date FROM apontamentos a WHERE a.id = apontamento_id)))
      WITH CHECK (NOT day_locked((SELECT a.work_date FROM apontamentos a WHERE a.id = apontamento_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='apontamento_field_values' AND policyname='field_values_lock_del') THEN
    CREATE POLICY field_values_lock_del ON apontamento_field_values AS RESTRICTIVE FOR DELETE
      USING (NOT day_locked((SELECT a.work_date FROM apontamentos a WHERE a.id = apontamento_id)));
  END IF;

  -- dia da equipe: líder não reabre nem altera um dia já fechado (pode fechar)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_days' AND policyname='team_days_lock_upd') THEN
    CREATE POLICY team_days_lock_upd ON team_days AS RESTRICTIVE FOR UPDATE
      USING (my_role() <> 'leader' OR closed_at IS NULL) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_days' AND policyname='team_days_lock_del') THEN
    CREATE POLICY team_days_lock_del ON team_days AS RESTRICTIVE FOR DELETE
      USING (my_role() <> 'leader' OR closed_at IS NULL);
  END IF;
END $$;

-- 3) Resumo do mês para o calendário (uma chamada só). Respeita as regras de acesso.
CREATE OR REPLACE FUNCTION team_month_days(p_team uuid, p_from date, p_to date)
RETURNS TABLE (work_date date, has_records boolean, closed boolean, no_work boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH emps AS (SELECT id FROM employees WHERE team_id = p_team),
  recs AS (
    SELECT a.work_date FROM apontamentos a WHERE a.work_date BETWEEN p_from AND p_to AND a.employee_id IN (SELECT id FROM emps)
    UNION SELECT b.work_date FROM absences b WHERE b.work_date BETWEEN p_from AND p_to AND b.employee_id IN (SELECT id FROM emps)
    UNION SELECT i.work_date FROM idle_blocks i WHERE i.work_date BETWEEN p_from AND p_to AND i.employee_id IN (SELECT id FROM emps)
  ),
  days AS (
    SELECT recs.work_date FROM recs
    UNION SELECT td.work_date FROM team_days td WHERE td.team_id = p_team AND td.work_date BETWEEN p_from AND p_to
  )
  SELECT d.work_date,
         EXISTS (SELECT 1 FROM recs r WHERE r.work_date = d.work_date),
         COALESCE((SELECT td.closed_at IS NOT NULL FROM team_days td WHERE td.team_id = p_team AND td.work_date = d.work_date), false),
         COALESCE((SELECT td.no_work FROM team_days td WHERE td.team_id = p_team AND td.work_date = d.work_date), false)
  FROM days d ORDER BY d.work_date;
$$;
GRANT EXECUTE ON FUNCTION team_month_days(uuid, date, date) TO authenticated;
