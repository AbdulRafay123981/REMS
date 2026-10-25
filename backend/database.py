import sqlite3
from pathlib import Path

BASE_PATH = Path(__file__).resolve().parent.parent
DB_PATH = BASE_PATH / "database" / "rems.db"
SCHEMA_PATH = BASE_PATH / "database" / "schema.sql"

schema = SCHEMA_PATH.read_text()


def db_init():
    connection = sqlite3.connect(DB_PATH)
    try:
        connection.executescript(schema)
    finally:
        connection.close()


def fetch_table(table_name):
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        cursor = connection.execute(f"select * from {table_name}")
        rows = cursor.fetchall()
        properties = []

        for row in rows:
            properties.append(dict(row))
        return properties

    finally:
        connection.close()


if __name__ == "__main__":
    db_init()
    print(fetch_table("properties"))
