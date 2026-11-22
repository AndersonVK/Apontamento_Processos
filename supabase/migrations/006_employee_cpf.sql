-- CPF opcional no cadastro do funcionário (somente os 11 dígitos, único quando informado).
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cpf TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_cpf_format') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_cpf_format
      CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS employees_cpf_unique ON employees (cpf) WHERE cpf IS NOT NULL;
