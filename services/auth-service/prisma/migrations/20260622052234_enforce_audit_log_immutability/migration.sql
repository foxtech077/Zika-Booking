-- Create trigger function to reject UPDATE or DELETE on AuditLog
CREATE OR REPLACE FUNCTION auth.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AuditLog is immutable. UPDATE and DELETE operations are not permitted.';
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to auth."AuditLog" table
DROP TRIGGER IF EXISTS check_audit_log_immutable ON auth."AuditLog";
CREATE TRIGGER check_audit_log_immutable
BEFORE UPDATE OR DELETE ON auth."AuditLog"
FOR EACH ROW
EXECUTE FUNCTION auth.prevent_audit_log_modification();