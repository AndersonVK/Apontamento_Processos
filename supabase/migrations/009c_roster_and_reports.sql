-- Histórico por data (parte C): chamada em UMA consulta, calendário e base para relatórios.

-- Chamada do dia: tudo que a tela precisa em uma ida ao servidor.
-- Quem estava na equipe NAQUELE dia (histórico), com a jornada que valia nele.
CREATE OR REPLACE FUNCTION team_roster(p_team uuid, p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE v_me uuid; v_ids uuid[]; v_result jsonb;
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid() LIMIT 1;

  SELECT array_agg(DISTINCT s.id) INTO v_ids FROM (
    SELECT h.employee_id AS id FROM employee_team_history h
     WHERE h.team_id = p_team AND h.during @> p_date
    UNION
    SELECT a.employee_id FROM apontamentos a
     WHERE a.work_date = p_date AND (a.team_id = p_team OR a.leader_id = v_me)
  ) s;
  v_ids := COALESCE(v_ids, ARRAY[]::uuid[]);

  SELECT jsonb_build_object(
    'team', (SELECT to_jsonb(t) FROM teams t WHERE t.id = p_team),
    'team_day', (SELECT to_jsonb(d) FROM team_days d WHERE d.team_id = p_team AND d.work_date = p_date),
    'employees', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'registration', e.registration, 'active', e.active,
        'is_member', (et.team_id = p_team),
        'team_id', et.team_id, 'team_name', tm.name,
        'schedule', (SELECT to_jsonb(sc) FROM schedule_for(e.id, COALESCE(et.team_id, p_team), p_date) sc)
      ) ORDER BY e.name)
      FROM employees e
      CROSS JOIN LATERAL (SELECT employee_team_on(e.id, p_date) AS team_id) et
      LEFT JOIN teams tm ON tm.id = et.team_id
      WHERE e.id = ANY (v_ids)
    ), '[]'::jsonb),
    'apontamentos', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object(
        'activity', jsonb_build_object('id', ac.id, 'name', ac.name),
        'project', jsonb_build_object('id', pr.id, 'name', pr.name),
        'leader', jsonb_build_object('id', lp.id, 'name', lp.name),
        'field_values', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('value', fv.value,
                 'field', jsonb_build_object('name', f.name, 'unit', f.unit, 'field_type', f.field_type)))
          FROM apontamento_field_values fv JOIN activity_fields f ON f.id = fv.field_id
          WHERE fv.apontamento_id = a.id), '[]'::jsonb)
      ) ORDER BY a.start_time)
      FROM apontamentos a
      LEFT JOIN activities ac ON ac.id = a.activity_id
      LEFT JOIN projects pr ON pr.id = a.project_id
      LEFT JOIN profiles lp ON lp.id = a.leader_id
      WHERE a.work_date = p_date AND (a.team_id = p_team OR a.leader_id = v_me)
    ), '[]'::jsonb),
    'absences', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM absences b
                           WHERE b.work_date = p_date AND b.employee_id = ANY (v_ids)), '[]'::jsonb),
    'idle', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM idle_blocks i
                       WHERE i.work_date = p_date AND i.employee_id = ANY (v_ids)), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION team_roster(uuid, date) TO authenticated;

-- Calendário: agora usa a equipe carimbada (correto para o passado)
CREATE OR REPLACE FUNCTION team_month_days(p_team uuid, p_from date, p_to date)
RETURNS TABLE (work_date date, has_records boolean, closed boolean, no_work boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH recs AS (
    SELECT a.work_date FROM apontamentos a WHERE a.work_date BETWEEN p_from AND p_to AND a.team_id = p_team
    UNION SELECT b.work_date FROM absences b WHERE b.work_date BETWEEN p_from AND p_to AND b.team_id = p_team
    UNION SELECT i.work_date FROM idle_blocks i WHERE i.work_date BETWEEN p_from AND p_to AND i.team_id = p_team
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

-- Base para relatórios (ainda sem telas): colunas já carimbadas, sem depender do histórico.
-- security_invoker: respeita as regras de acesso de quem consulta.
CREATE OR REPLACE VIEW report_apontamentos WITH (security_invoker = true) AS
SELECT a.id, a.work_date, a.start_time, a.end_time,
       (EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 60)::int AS minutes,
       a.employee_id, e.name AS employee_name, e.registration AS employee_registration,
       a.team_id, t.name AS team_name,
       a.leader_id, lp.name AS leader_name, a.leader_team_id, lt.name AS leader_team_name,
       a.project_id, pr.name AS project_name, a.activity_id, ac.name AS activity_name,
       a.notes, a.created_at
FROM apontamentos a
JOIN employees e ON e.id = a.employee_id
LEFT JOIN teams t ON t.id = a.team_id
LEFT JOIN profiles lp ON lp.id = a.leader_id
LEFT JOIN teams lt ON lt.id = a.leader_team_id
LEFT JOIN projects pr ON pr.id = a.project_id
LEFT JOIN activities ac ON ac.id = a.activity_id;

CREATE OR REPLACE VIEW report_field_values WITH (security_invoker = true) AS
SELECT fv.apontamento_id, a.work_date, a.employee_id, a.team_id, a.leader_team_id,
       a.project_id, a.activity_id, f.name AS field_name, f.field_type, f.unit, fv.value,
       CASE WHEN f.field_type = 'number' AND fv.value ~ '^-?[0-9]+([.,][0-9]+)?$'
            THEN replace(fv.value, ',', '.')::numeric END AS numeric_value
FROM apontamento_field_values fv
JOIN apontamentos a ON a.id = fv.apontamento_id
JOIN activity_fields f ON f.id = fv.field_id;

CREATE OR REPLACE VIEW report_absences WITH (security_invoker = true) AS
SELECT b.id, b.work_date, b.employee_id, e.name AS employee_name, b.team_id, t.name AS team_name,
       b.reason_type, b.note
FROM absences b
JOIN employees e ON e.id = b.employee_id
LEFT JOIN teams t ON t.id = b.team_id;

GRANT SELECT ON report_apontamentos, report_field_values, report_absences TO authenticated;
