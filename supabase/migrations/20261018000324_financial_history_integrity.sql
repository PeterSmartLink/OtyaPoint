ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_nonnegative_amounts_check"
    CHECK ("debit" >= 0 AND "credit" >= 0),
  ADD CONSTRAINT "LedgerEntry_single_sided_amount_check"
    CHECK (
      ("debit" > 0 AND "credit" = 0) OR
      ("credit" > 0 AND "debit" = 0)
    );

CREATE FUNCTION public.prevent_financial_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Financial history is append-only; record a compensating entry instead of changing or deleting history.';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_financial_history_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER "LedgerEntry_append_only"
  BEFORE UPDATE OR DELETE ON public."LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_history_mutation();

CREATE TRIGGER "AuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON public."AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_history_mutation();
