import sqlite3
from pathlib import Path
from werkzeug.security import generate_password_hash, check_password_hash

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
# Login System---------------------------------------------------------------
def get_user_by_email(email):
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        # case-insensitive so "Ali@x.com" == "ali@x.com"
        cursor = connection.execute(
            "SELECT * FROM users WHERE lower(email) = lower(?)", (email,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        connection.close()


VALID_ROLES = ("admin", "agent", "buyer", "owner")

def create_user(full_name, email, password, role):
    if role not in VALID_ROLES:

        raise ValueError(f"Invalid role {role!r}; must be one of {VALID_ROLES}")

    connection = sqlite3.connect(DB_PATH)
    password_hash = generate_password_hash(password)
    try:
        connection.execute(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (full_name, email.strip().lower(), password_hash, role),
        )
        connection.commit()
        return True
    except sqlite3.IntegrityError:
        return False          # email already exists
    finally:
        connection.close()


if __name__ == "__main__":
    db_init()
    # for name, email, pw, role in [
    #     ("Ali Raza",    "customer@rems.com", "customer123", "buyer"),
    #     ("Agent Abdul", "agent@rems.com",    "agent123",    "agent"),
    #     ("Admin",       "admin@rems.com",    "admin123",    "admin"),
    # ]:
    #     print(email, "->", create_user(name, email, pw, role))
    # print([(u["email"], u["role"]) for u in fetch_table("users")])
    print("Success!")