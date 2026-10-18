CREATE FUNCTION public.ensure_ledger_source_balanced()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  total_debits numeric(18, 2);
  total_credits numeric(18, 2);
BEGIN
  SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0)
    INTO total_debits, total_credits
  FROM public."LedgerEntry"
  WHERE "ledgerType" = NEW."ledgerType"
    AND "sourceType" = NEW."sourceType"
    AND "sourceId" = NEW."sourceId"
    AND "currency" = NEW."currency";

  IF total_debits <> total_credits THEN
    RAISE EXCEPTION 'Ledger source %/% is unbalanced for currency %.', NEW."sourceType", NEW."sourceId", NEW."currency"
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_ledger_source_balanced() FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER "LedgerEntry_source_balanced"
  AFTER INSERT ON public."LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.ensure_ledger_source_balanced();
