#!/usr/bin/env bash
set -euo pipefail

# import-ibd-to-mysql.sh
# Automate import of .ibd files into a local MySQL database, then dump to SQL.
# IMPORTANT: You must create the tables first (matching exact CREATE TABLE DDL).
# Usage:
#   ./scripts/import-ibd-to-mysql.sh \
#       --ibd-dir /path/to/ibd_files \
#       --db-name comfortpay \
#       --db-user root \
#       --db-pass secret \
#       --datadir /var/lib/mysql \
#       [--socket /var/run/mysqld/mysqld.sock]

usage(){
  sed -n '1,120p' <<'EOF'
Usage: import-ibd-to-mysql.sh --ibd-dir DIR --db-name NAME --db-user USER --db-pass PASS [--datadir PATH] [--socket SOCKET]

Notes/requirements:
- MySQL server must be running and `innodb_file_per_table=ON`.
- You must have created the database and tables with the exact same table definitions.
  Use `node src/lib/init-db.js` or your known DDL to create the tables before importing.
- The script must be run on the machine hosting the MySQL datadir or have write access
  to the MySQL datadir. Copying .ibd files into datadir requires proper ownership (usually mysql:mysql).
- Import may fail if the .ibd files come from a different MySQL version or are not transportable.
- Always keep backups.
EOF
}

# Default values
DATADIR="/var/lib/mysql"
SOCKET=""

IBD_DIR=""
DB_NAME=""
DB_USER=""
DB_PASS=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ibd-dir) IBD_DIR="$2"; shift 2;;
    --db-name) DB_NAME="$2"; shift 2;;
    --db-user) DB_USER="$2"; shift 2;;
    --db-pass) DB_PASS="$2"; shift 2;;
    --datadir) DATADIR="$2"; shift 2;;
    --socket) SOCKET="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 2;;
  esac
done

if [[ -z "$IBD_DIR" || -z "$DB_NAME" || -z "$DB_USER" ]]; then
  echo "Missing required args."; usage; exit 2
fi

if [[ -z "$DB_PASS" ]]; then
  echo "Warning: empty DB password string provided; will attempt auth without password if mysql client allows it."
fi

MYSQL_CMD=(mysql -u"$DB_USER")
if [[ -n "$DB_PASS" ]]; then
  MYSQL_CMD+=( -p"$DB_PASS" )
fi
if [[ -n "$SOCKET" ]]; then
  MYSQL_CMD+=( -S "$SOCKET" )
fi

echo "IBD dir: $IBD_DIR"
echo "Database: $DB_NAME"
echo "MySQL datadir: $DATADIR"

# Quick checks
if [[ ! -d "$IBD_DIR" ]]; then
  echo "ibd dir not found: $IBD_DIR"; exit 1
fi

# Ensure database exists
"${MYSQL_CMD[@]}" -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;" || { echo "Failed to ensure database exists"; exit 1; }

# IMPORTANT: remind user to create table definitions first
cat <<EOF
Ensure you have CREATED each table in database '$DB_NAME' BEFORE importing its .ibd file.
A recommended step: run 'node src/lib/init-db.js' or your DDL to create tables.
If you haven't done that yet, stop now and create tables, then re-run this script.
Press ENTER to continue (or Ctrl-C to abort) after you've created the tables.
EOF
read -r || true

FAILED=()
SUCCEEDED=()

for ibd in "$IBD_DIR"/*.ibd; do
  [[ -e "$ibd" ]] || { echo "No .ibd files found in $IBD_DIR"; break; }
  table=$(basename "$ibd" .ibd)
  echo "\n=== Importing table: $table ==="

  # Check table exists
  if ! "${MYSQL_CMD[@]}" -D "$DB_NAME" -e "SHOW TABLES LIKE '$table'" | grep -q "$table"; then
    echo "Table '$table' does not exist in DB '$DB_NAME'. Skipping."; FAILED+=("$table (no-table)"); continue
  fi

  set +e
  "${MYSQL_CMD[@]}" -D "$DB_NAME" -e "ALTER TABLE \`$table\` DISCARD TABLESPACE;"
  rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "ALTER TABLE DISCARD TABLESPACE failed for $table (rc=$rc). Skipping."; FAILED+=("$table (discard-failed)"); continue
  fi

  # Copy .ibd to datadir
  dest_dir="$DATADIR/$DB_NAME"
  if [[ ! -d "$dest_dir" ]]; then
    echo "Destination datadir for DB does not exist: $dest_dir"; FAILED+=("$table (datadir-missing)"); continue
  fi

  echo "Copying $ibd -> $dest_dir/"
  sudo cp -f "$ibd" "$dest_dir/" || { echo "Copy failed"; FAILED+=("$table (copy-failed)"); continue; }

  echo "Setting ownership to mysql:mysql"
  sudo chown mysql:mysql "$dest_dir/$(basename "$ibd")" || echo "chown failed; continue anyway"

  set +e
  "${MYSQL_CMD[@]}" -D "$DB_NAME" -e "ALTER TABLE \`$table\` IMPORT TABLESPACE;"
  rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "ALTER TABLE IMPORT TABLESPACE failed for $table (rc=$rc)."
    FAILED+=("$table (import-failed)"); continue
  fi

  echo "Table $table imported successfully."
  SUCCEEDED+=("$table")
done

# Summary
cat <<EOF

Import summary:
Succeeded: ${#SUCCEEDED[@]}
Failed: ${#FAILED[@]}

Succeeded list:
EOF
for s in "${SUCCEEDED[@]}"; do echo " - $s"; done

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "\nFailed list:"
  for f in "${FAILED[@]}"; do echo " - $f"; done
  echo "\nReview failures above. Common reasons: table DDL mismatch, MySQL version mismatch, or tablespace metadata differences."
fi

# If at least one success, create a dump
if [[ ${#SUCCEEDED[@]} -gt 0 ]]; then
  dumpfile="${DB_NAME}_from_ibd_$(date +%Y%m%d_%H%M%S).sql"
  echo "Creating mysqldump -> $dumpfile"
  mysqldump -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$dumpfile"
  echo "Dump complete: $dumpfile"
fi

echo "Done."
