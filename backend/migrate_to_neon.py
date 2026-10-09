"""Copy local SQLite records into Neon without overwriting existing records."""
import sqlite3
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, select, text, inspect
from config import Config
from models import db


def migrate():
    source = Path(__file__).parent / 'instance' / 'absoluturf.db'
    if not source.is_file():
        raise RuntimeError('SQLite source database is missing')
    target = create_engine(Config.SQLALCHEMY_DATABASE_URI, pool_pre_ping=True)
    if target.dialect.name != 'postgresql':
        raise RuntimeError('Destination must be PostgreSQL')
    snapshot = source.with_name('absoluturf.before-neon-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.db')
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as original:
        with sqlite3.connect(snapshot) as backup:
            original.backup(backup)
    local = create_engine('sqlite:///' + snapshot.as_posix())
    tables = db.metadata.sorted_tables
    source_names = set(inspect(local).get_table_names())
    unknown = source_names - set(db.metadata.tables) - {'sqlite_sequence'}
    if unknown:
        raise RuntimeError('Source has unmapped tables: ' + ', '.join(sorted(unknown)))
    rows = {}
    with local.connect() as conn:
        for table in tables:
            rows[table.name] = [dict(row) for row in conn.execute(select(table)).mappings()] if table.name in source_names else []
    db.metadata.create_all(target)
    with target.begin() as conn:
        # Serialize app writes while IDs and their sequences are preserved.
        quoted = ', '.join(target.dialect.identifier_preparer.quote(t.name) for t in tables)
        conn.execute(text('LOCK TABLE ' + quoted + ' IN ACCESS EXCLUSIVE MODE'))
        for table in tables:
            existing = {row['id']: dict(row) for row in conn.execute(select(table)).mappings()}
            for row in rows[table.name]:
                if row['id'] in existing and existing[row['id']] != row:
                    raise RuntimeError('Conflicting existing ID in ' + table.name + '; nothing overwritten')
        for table in tables:
            existing_ids = set(conn.execute(select(table.c.id)).scalars())
            missing = [row for row in rows[table.name] if row['id'] not in existing_ids]
            if missing:
                conn.execute(table.insert(), missing)
            actual = {row['id']: dict(row) for row in conn.execute(select(table)).mappings()}
            assert all(actual[row['id']] == row for row in rows[table.name]), 'Record verification failed: ' + table.name
            sequence = conn.execute(text('SELECT pg_get_serial_sequence(:table, :column)'), {'table': table.name, 'column': 'id'}).scalar()
            if sequence:
                max_id = max(actual, default=0)
                conn.execute(text('SELECT setval(CAST(:sequence AS regclass), :value, :called)'),
                             {'sequence': sequence, 'value': max(1, max_id), 'called': max_id > 0})
            print(table.name + ': ' + str(len(rows[table.name])) + ' source records verified; ' + str(len(missing)) + ' inserted')
    with target.connect() as conn:
        for table in tables:
            actual = {row['id']: dict(row) for row in conn.execute(select(table)).mappings()}
            assert all(actual[row['id']] == row for row in rows[table.name])
    print('Migration committed and verified. Total source records:', sum(map(len, rows.values())))
    print('SQLite backup:', snapshot.name)
    local.dispose()
    target.dispose()


if __name__ == '__main__':
    try:
        migrate()
    except Exception as error:
        # Avoid printing connection URLs or record contents from driver exceptions.
        print('Migration failed:', type(error).__name__)
        if isinstance(error, RuntimeError):
            print(str(error))
        raise SystemExit(1)
