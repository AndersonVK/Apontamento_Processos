-- Novos motivos de justificativa de horário: "chegou atrasado" e "saiu mais cedo".
-- Para bancos que já aplicaram a 004 com os três motivos originais. Idempotente.
ALTER TABLE idle_blocks DROP CONSTRAINT IF EXISTS idle_blocks_reason_type_check;
ALTER TABLE idle_blocks ADD CONSTRAINT idle_blocks_reason_type_check
  CHECK (reason_type IN ('parado', 'deslocamento', 'chegou_atrasado', 'saiu_mais_cedo', 'outro'));
