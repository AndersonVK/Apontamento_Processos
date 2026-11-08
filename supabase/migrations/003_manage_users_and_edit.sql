-- Lote 3: gerenciar usuários/equipes pelo app e editar apontamentos.
-- Pode rodar mais de uma vez (idempotente).

-- 1) Perfis: só Diretor edita qualquer perfil; Gerente edita líderes/operários
--    (e não pode promover ninguém a gerente/diretor).
--    Remove a política antiga que deixava qualquer usuário editar o PRÓPRIO
--    perfil, inclusive trocar o próprio role para 'director'.
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (
    my_role() = 'director'
    OR (my_role() = 'manager' AND role IN ('leader', 'worker'))
  )
  WITH CHECK (
    my_role() = 'director'
    OR (my_role() = 'manager' AND role IN ('leader', 'worker'))
  );

-- 2) Apontamentos: editar (líder só os próprios; gerente/diretor todos)
DROP POLICY IF EXISTS "apontamentos_update" ON apontamentos;
CREATE POLICY "apontamentos_update" ON apontamentos FOR UPDATE
  USING (
    my_role() IN ('director', 'manager')
    OR (my_role() = 'leader' AND leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1))
  )
  WITH CHECK (
    my_role() IN ('director', 'manager')
    OR (my_role() = 'leader' AND leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1))
  );

-- 3) Valores dos campos: inserir/atualizar também por gerente/diretor
DROP POLICY IF EXISTS "field_values_insert" ON apontamento_field_values;
CREATE POLICY "field_values_insert" ON apontamento_field_values FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM apontamentos a WHERE a.id = apontamento_id
      AND (
        my_role() IN ('director', 'manager')
        OR a.leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );

DROP POLICY IF EXISTS "field_values_update" ON apontamento_field_values;
CREATE POLICY "field_values_update" ON apontamento_field_values FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM apontamentos a WHERE a.id = apontamento_id
      AND (
        my_role() IN ('director', 'manager')
        OR a.leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM apontamentos a WHERE a.id = apontamento_id
      AND (
        my_role() IN ('director', 'manager')
        OR a.leader_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
  );
