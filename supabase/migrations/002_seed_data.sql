-- Atividades iniciais (só insere se ainda não existir)
INSERT INTO activities (name)
SELECT name FROM (VALUES ('Colheita'), ('Desfolha'), ('Irrigação'), ('Poda')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM activities WHERE activities.name = v.name);

-- Colheita → campo "Quantidade" (número, obrigatório)
INSERT INTO activity_fields (activity_id, name, field_type, unit, required, sort_order)
SELECT a.id, 'Quantidade', 'number', 'caixas', TRUE, 0
FROM activities a
WHERE a.name = 'Colheita'
  AND NOT EXISTS (
    SELECT 1 FROM activity_fields af WHERE af.activity_id = a.id AND af.name = 'Quantidade'
  );

-- Desfolha → campo "Qualidade" (seleção)
INSERT INTO activity_fields (activity_id, name, field_type, required, sort_order)
SELECT a.id, 'Qualidade', 'select', FALSE, 0
FROM activities a
WHERE a.name = 'Desfolha'
  AND NOT EXISTS (
    SELECT 1 FROM activity_fields af WHERE af.activity_id = a.id AND af.name = 'Qualidade'
  );

-- Opções A, B, C para Qualidade
INSERT INTO activity_field_options (field_id, label, value, sort_order)
SELECT af.id, opt.label, opt.val, opt.ord
FROM activity_fields af
JOIN activities a ON a.id = af.activity_id AND a.name = 'Desfolha'
CROSS JOIN (VALUES ('A', 'a', 0), ('B', 'b', 1), ('C', 'c', 2)) AS opt(label, val, ord)
WHERE af.name = 'Qualidade'
  AND NOT EXISTS (
    SELECT 1 FROM activity_field_options afo WHERE afo.field_id = af.id
  );
