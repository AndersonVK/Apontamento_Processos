-- Histórico por data (parte B): regras (funções e gatilhos) e preenchimento do que já existe.
-- NOTA: no projeto atual esta parte foi aplicada em pedaços; os três UPDATE finais (carimbar
-- lançamentos antigos) foram omitidos porque não havia nenhum lançamento. Em um banco que já
-- tenha lançamentos, rode-os ao final.

-- Equipe do funcionário numa data
CREATE OR REPLACE FUNCTION employee_team_on(p_employee uuid, p_date date) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM employee_team_history
  WHERE employee_id = p_employee AND during @> p_date LIMIT 1;
$$;

-- Último dia FECHADO da equipe (NULL se nenhum)
CREATE OR REPLACE FUNCTION team_last_closed(p_team uuid) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT max(work_date) FROM team_days WHERE team_id = p_team AND closed_at IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION team_last_closed(uuid) TO authenticated;

-- Aplica uma mudança de equipe/situação A PARTIR de uma data, sem reescrever dias fechados.
--   p_new_team NULL = fora de qualquer equipe (inativo ou sem equipe).
--   p_eff NULL: primeira atribuição vale "desde sempre" (ou desde o dia seguinte ao último
--   dia fechado da equipe); nos demais casos, hoje.
CREATE OR REPLACE FUNCTION apply_membership(p_employee uuid, p_new_team uuid, p_eff date, p_who uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first boolean;
  v_eff date := p_eff;
  v_cur_team uuid;
  v_lc date;
  v_team uuid;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM employee_team_history WHERE employee_id = p_employee) INTO v_first;
  SELECT team_id INTO v_cur_team FROM employee_team_history
   WHERE employee_id = p_employee AND upper_inf(during) LIMIT 1;

  IF v_cur_team IS NOT DISTINCT FROM p_new_team THEN
    RETURN;
  END IF;

  IF v_eff IS NULL THEN
    IF v_first AND p_new_team IS NOT NULL THEN
      v_lc := team_last_closed(p_new_team);
      v_eff := CASE WHEN v_lc IS NULL THEN NULL ELSE v_lc + 1 END;  -- NULL = desde sempre
    ELSE
      v_eff := current_date;
    END IF;
  END IF;

  IF v_eff IS NOT NULL AND v_eff > current_date THEN
    RAISE EXCEPTION 'A data da mudança não pode ser futura.' USING ERRCODE = 'P0001';
  END IF;

  -- não reescreve dias fechados de nenhuma equipe envolvida
  FOR v_team IN
    SELECT DISTINCT s.t FROM (
      SELECT h.team_id AS t FROM employee_team_history h
       WHERE h.employee_id = p_employee
         AND (v_eff IS NULL OR upper(h.during) IS NULL OR upper(h.during) > v_eff)
      UNION
      SELECT p_new_team WHERE p_new_team IS NOT NULL
    ) s
  LOOP
    v_lc := team_last_closed(v_team);
    IF v_lc IS NOT NULL AND (v_eff IS NULL OR v_eff <= v_lc) THEN
      RAISE EXCEPTION 'Não é possível mudar a partir de %: o dia % da equipe "%" já está fechado. Reabra o dia ou escolha uma data posterior.',
        COALESCE(to_char(v_eff, 'DD/MM/YYYY'), 'sempre'), to_char(v_lc, 'DD/MM/YYYY'),
        (SELECT name FROM teams WHERE id = v_team)
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- reescreve a partir de v_eff (o que veio antes fica intacto)
  IF v_eff IS NULL THEN
    DELETE FROM employee_team_history WHERE employee_id = p_employee;
  ELSE
    DELETE FROM employee_team_history
     WHERE employee_id = p_employee AND lower(during) IS NOT NULL AND lower(during) >= v_eff;
    UPDATE employee_team_history SET during = daterange(lower(during), v_eff)
     WHERE employee_id = p_employee AND (upper(during) IS NULL OR upper(during) > v_eff);
  END IF;

  IF p_new_team IS NOT NULL THEN
    INSERT INTO employee_team_history (employee_id, team_id, during, created_by)
    VALUES (p_employee, p_new_team, daterange(v_eff, NULL), p_who);
  END IF;

  -- reajusta a equipe carimbada nos lançamentos afetados (todos em dias ainda abertos)
  UPDATE apontamentos SET team_id = employee_team_on(employee_id, work_date)
   WHERE employee_id = p_employee AND (v_eff IS NULL OR work_date >= v_eff);
  UPDATE absences SET team_id = employee_team_on(employee_id, work_date)
   WHERE employee_id = p_employee AND (v_eff IS NULL OR work_date >= v_eff);
  UPDATE idle_blocks SET team_id = employee_team_on(employee_id, work_date)
   WHERE employee_id = p_employee AND (v_eff IS NULL OR work_date >= v_eff);
END $$;

CREATE OR REPLACE FUNCTION employees_sync_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new uuid; v_old uuid;
BEGIN
  v_new := CASE WHEN NEW.active THEN NEW.team_id END;
  IF TG_OP = 'UPDATE' THEN
    v_old := CASE WHEN OLD.active THEN OLD.team_id END;
    IF v_new IS NOT DISTINCT FROM v_old THEN RETURN NEW; END IF;
  END IF;
  PERFORM apply_membership(
    NEW.id, v_new,
    NULLIF(current_setting('app.effective_date', true), '')::date,
    (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );
  RETURN NEW;
END $$;

-- Chamada do app: muda equipe e/ou situação com data de início.
CREATE OR REPLACE FUNCTION set_employee_membership(
  p_employee uuid, p_team uuid, p_active boolean, p_effective date DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF my_role() NOT IN ('director', 'manager', 'leader') THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.effective_date', COALESCE(p_effective::text, ''), true);
  UPDATE employees SET team_id = p_team, active = p_active WHERE id = p_employee;
  PERFORM set_config('app.effective_date', '', true);
END $$;
GRANT EXECUTE ON FUNCTION set_employee_membership(uuid, uuid, boolean, date) TO authenticated;

-- ---------- Jornada com versões ----------
CREATE OR REPLACE FUNCTION apply_team_schedule(
  p_team uuid, p_start time, p_end time, p_bs time, p_be time, p_eff date, p_who uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_eff date := p_eff; v_first boolean; v_lc date;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM team_schedule_versions WHERE team_id = p_team) INTO v_first;
  IF v_first THEN
    v_eff := NULL;                                  -- primeira versão vale desde sempre
  ELSIF v_eff IS NULL THEN
    v_eff := current_date;
  END IF;
  IF v_eff IS NOT NULL AND v_eff > current_date THEN
    RAISE EXCEPTION 'A data da mudança não pode ser futura.' USING ERRCODE = 'P0001';
  END IF;
  v_lc := team_last_closed(p_team);
  IF v_eff IS NOT NULL AND v_lc IS NOT NULL AND v_eff <= v_lc THEN
    RAISE EXCEPTION 'Não é possível alterar a jornada a partir de %: o dia % da equipe já está fechado. Reabra o dia ou escolha uma data posterior.',
      to_char(v_eff, 'DD/MM/YYYY'), to_char(v_lc, 'DD/MM/YYYY') USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM team_schedule_versions WHERE team_id = p_team AND valid_from IS NOT DISTINCT FROM v_eff;
  INSERT INTO team_schedule_versions (team_id, valid_from, shift_start, shift_end, break_start, break_end, created_by)
  VALUES (p_team, v_eff, p_start, p_end, p_bs, p_be, p_who);
END $$;

CREATE OR REPLACE FUNCTION teams_sync_schedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.shift_start IS NOT DISTINCT FROM OLD.shift_start AND NEW.shift_end IS NOT DISTINCT FROM OLD.shift_end
     AND NEW.break_start IS NOT DISTINCT FROM OLD.break_start AND NEW.break_end IS NOT DISTINCT FROM OLD.break_end
  THEN RETURN NEW; END IF;
  PERFORM apply_team_schedule(
    NEW.id, NEW.shift_start, NEW.shift_end, NEW.break_start, NEW.break_end,
    NULLIF(current_setting('app.effective_date', true), '')::date,
    (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION set_team_schedule(
  p_team uuid, p_start time, p_end time, p_bs time, p_be time, p_effective date DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF my_role() NOT IN ('director', 'manager') THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.effective_date', COALESCE(p_effective::text, ''), true);
  UPDATE teams SET shift_start = p_start, shift_end = p_end, break_start = p_bs, break_end = p_be WHERE id = p_team;
  PERFORM set_config('app.effective_date', '', true);
END $$;
GRANT EXECUTE ON FUNCTION set_team_schedule(uuid, time, time, time, time, date) TO authenticated;

CREATE OR REPLACE FUNCTION apply_employee_schedule(
  p_employee uuid, p_custom boolean, p_start time, p_end time, p_bs time, p_be time, p_eff date, p_who uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_eff date := p_eff; v_first boolean; v_lc date; v_team uuid;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM employee_schedule_versions WHERE employee_id = p_employee) INTO v_first;
  IF v_first AND NOT p_custom THEN RETURN; END IF;   -- nada a desfazer
  -- sem data informada: a primeira versão vale desde sempre (cadastro novo); com data, vale a data
  IF v_first AND p_eff IS NULL THEN
    v_eff := NULL;
  ELSIF v_eff IS NULL THEN
    v_eff := current_date;
  END IF;
  IF v_eff IS NOT NULL AND v_eff > current_date THEN
    RAISE EXCEPTION 'A data da mudança não pode ser futura.' USING ERRCODE = 'P0001';
  END IF;
  v_team := employee_team_on(p_employee, COALESCE(v_eff, current_date));
  v_lc := CASE WHEN v_team IS NULL THEN NULL ELSE team_last_closed(v_team) END;
  IF v_eff IS NOT NULL AND v_lc IS NOT NULL AND v_eff <= v_lc THEN
    RAISE EXCEPTION 'Não é possível alterar a jornada a partir de %: o dia % da equipe já está fechado. Reabra o dia ou escolha uma data posterior.',
      to_char(v_eff, 'DD/MM/YYYY'), to_char(v_lc, 'DD/MM/YYYY') USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM employee_schedule_versions WHERE employee_id = p_employee AND valid_from IS NOT DISTINCT FROM v_eff;
  INSERT INTO employee_schedule_versions (employee_id, valid_from, custom, shift_start, shift_end, break_start, break_end, created_by)
  VALUES (p_employee, v_eff, p_custom,
          CASE WHEN p_custom THEN p_start END, CASE WHEN p_custom THEN p_end END,
          CASE WHEN p_custom THEN p_bs END, CASE WHEN p_custom THEN p_be END, p_who);
END $$;

CREATE OR REPLACE FUNCTION employees_sync_schedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.custom_schedule IS NOT DISTINCT FROM OLD.custom_schedule
     AND NEW.shift_start IS NOT DISTINCT FROM OLD.shift_start AND NEW.shift_end IS NOT DISTINCT FROM OLD.shift_end
     AND NEW.break_start IS NOT DISTINCT FROM OLD.break_start AND NEW.break_end IS NOT DISTINCT FROM OLD.break_end
  THEN RETURN NEW; END IF;
  PERFORM apply_employee_schedule(
    NEW.id, NEW.custom_schedule, NEW.shift_start, NEW.shift_end, NEW.break_start, NEW.break_end,
    NULLIF(current_setting('app.effective_date', true), '')::date,
    (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION set_employee_schedule(
  p_employee uuid, p_custom boolean, p_start time, p_end time, p_bs time, p_be time, p_effective date DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF my_role() NOT IN ('director', 'manager', 'leader') THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.effective_date', COALESCE(p_effective::text, ''), true);
  UPDATE employees SET custom_schedule = p_custom,
         shift_start = CASE WHEN p_custom THEN p_start END, shift_end = CASE WHEN p_custom THEN p_end END,
         break_start = CASE WHEN p_custom THEN p_bs END, break_end = CASE WHEN p_custom THEN p_be END
   WHERE id = p_employee;
  PERFORM set_config('app.effective_date', '', true);
END $$;
GRANT EXECUTE ON FUNCTION set_employee_schedule(uuid, boolean, time, time, time, time, date) TO authenticated;

-- Jornada que valia para o funcionário numa data (equipe = a equipe dele naquele dia):
-- jornada própria > exceção do dia > versão da equipe > padrão do sistema.
CREATE OR REPLACE FUNCTION schedule_for(
  p_employee uuid, p_team uuid, p_date date,
  OUT shift_start time, OUT shift_end time, OUT break_start time, OUT break_end time
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ev record; td record; tv record;
BEGIN
  SELECT * INTO ev FROM employee_schedule_versions
   WHERE employee_id = p_employee AND (valid_from IS NULL OR valid_from <= p_date)
   ORDER BY valid_from DESC NULLS LAST LIMIT 1;
  IF FOUND AND ev.custom THEN
    shift_start := ev.shift_start; shift_end := ev.shift_end; break_start := ev.break_start; break_end := ev.break_end;
    RETURN;
  END IF;
  SELECT * INTO td FROM team_days WHERE team_id = p_team AND work_date = p_date;
  IF FOUND AND td.custom_schedule AND td.shift_start IS NOT NULL THEN
    shift_start := td.shift_start; shift_end := td.shift_end; break_start := td.break_start; break_end := td.break_end;
    RETURN;
  END IF;
  SELECT * INTO tv FROM team_schedule_versions
   WHERE team_id = p_team AND (valid_from IS NULL OR valid_from <= p_date)
   ORDER BY valid_from DESC NULLS LAST LIMIT 1;
  IF FOUND THEN
    shift_start := tv.shift_start; shift_end := tv.shift_end; break_start := tv.break_start; break_end := tv.break_end;
    RETURN;
  END IF;
  shift_start := '07:00'; shift_end := '17:00'; break_start := '12:00'; break_end := '13:00';
END $$;

-- Carimba a equipe nos lançamentos (usa a DATA DO TRABALHO, não a do envio)
CREATE OR REPLACE FUNCTION stamp_record_team() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.team_id := employee_team_on(NEW.employee_id, NEW.work_date);
  IF TG_TABLE_NAME = 'apontamentos' AND TG_OP = 'INSERT' THEN
    NEW.leader_team_id := (SELECT team_id FROM profiles WHERE id = NEW.leader_id);
  END IF;
  RETURN NEW;
END $$;

-- Gatilhos (criados só se ainda não existirem)
DO $$
DECLARE t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_employees_membership') THEN
    CREATE TRIGGER trg_employees_membership AFTER INSERT OR UPDATE OF team_id, active ON employees
      FOR EACH ROW EXECUTE FUNCTION employees_sync_membership();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_employees_schedule') THEN
    CREATE TRIGGER trg_employees_schedule AFTER INSERT OR UPDATE OF custom_schedule, shift_start, shift_end, break_start, break_end ON employees
      FOR EACH ROW EXECUTE FUNCTION employees_sync_schedule();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_teams_schedule') THEN
    CREATE TRIGGER trg_teams_schedule AFTER INSERT OR UPDATE OF shift_start, shift_end, break_start, break_end ON teams
      FOR EACH ROW EXECUTE FUNCTION teams_sync_schedule();
  END IF;
  FOREACH t IN ARRAY ARRAY['apontamentos', 'absences', 'idle_blocks'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_stamp_ins_' || t) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION stamp_record_team()', 'trg_stamp_ins_' || t, t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_stamp_upd_' || t) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF employee_id, work_date ON %I FOR EACH ROW EXECUTE FUNCTION stamp_record_team()', 'trg_stamp_upd_' || t, t);
    END IF;
  END LOOP;
END $$;

-- Preenche o que já existe (sem lançamentos antigos: tudo "desde sempre")
INSERT INTO employee_team_history (employee_id, team_id, during)
SELECT e.id, e.team_id, daterange(NULL, NULL) FROM employees e
 WHERE e.active AND e.team_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM employee_team_history h WHERE h.employee_id = e.id);

INSERT INTO team_schedule_versions (team_id, valid_from, shift_start, shift_end, break_start, break_end)
SELECT t.id, NULL, t.shift_start, t.shift_end, t.break_start, t.break_end FROM teams t
 WHERE NOT EXISTS (SELECT 1 FROM team_schedule_versions v WHERE v.team_id = t.id);

INSERT INTO employee_schedule_versions (employee_id, valid_from, custom, shift_start, shift_end, break_start, break_end)
SELECT e.id, NULL, true, e.shift_start, e.shift_end, e.break_start, e.break_end FROM employees e
 WHERE e.custom_schedule AND e.shift_start IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM employee_schedule_versions v WHERE v.employee_id = e.id);

UPDATE apontamentos a SET team_id = employee_team_on(a.employee_id, a.work_date),
  leader_team_id = (SELECT p.team_id FROM profiles p WHERE p.id = a.leader_id);
UPDATE absences b SET team_id = employee_team_on(b.employee_id, b.work_date);
UPDATE idle_blocks i SET team_id = employee_team_on(i.employee_id, i.work_date);
