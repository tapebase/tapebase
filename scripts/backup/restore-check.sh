#!/usr/bin/env bash
set -euo pipefail

backup_dir="${1:-}"
if [[ -z "$backup_dir" || ! -f "$backup_dir/roles.sql" || ! -f "$backup_dir/schema.sql" || ! -f "$backup_dir/data.sql" || ! -f "$backup_dir/public-data.sql" ]]; then
  echo "Usage: restore-check.sh <decrypted-backup-directory>" >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y postgresql-client

saved_migrations="$(mktemp -d)/migrations"
if [[ -d supabase/migrations ]]; then
  mv supabase/migrations "$saved_migrations"
fi

cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

supabase init --force
timeout 600 supabase start -x studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor

restore_url="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
# Local Supabase already provisions its protected platform roles. Replaying the
# production roles dump would try to alter reserved roles such as
# supabase_admin, which the local postgres user is intentionally forbidden to
# modify. The roles file remains part of every encrypted backup for recovery in
# a fresh hosted project. The complete data dump also remains in the archive,
# while this drill uses the version-independent public application data dump.
psql --dbname "$restore_url" --single-transaction --variable ON_ERROR_STOP=1 \
  --file "$backup_dir/schema.sql" \
  --command "SET session_replication_role = replica" \
  --file "$backup_dir/public-data.sql"

psql --dbname "$restore_url" --variable ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  table_name text;
  row_total bigint;
begin
  foreach table_name in array array['artists', 'albums', 'tracks', 'users'] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Restore check failed: missing public.%', table_name;
    end if;
    execute format('select count(*) from public.%I', table_name) into row_total;
    if row_total = 0 then
      raise exception 'Restore check failed: public.% is empty', table_name;
    end if;
  end loop;
end
$$;
SQL

echo "Restore check completed successfully in an isolated local database."
