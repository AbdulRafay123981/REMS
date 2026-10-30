import sqlite3
import secrets
from pathlib import Path
from werkzeug.security import generate_password_hash, check_password_hash

BASE_PATH = Path(__file__).resolve().parent.parent
DB_PATH = BASE_PATH / "database" / "rems.db"
SCHEMA_PATH = BASE_PATH / "database" / "schema.sql"
VALID_ROLES = ("admin", "agent", "buyer", "owner")
SELF_REGISTER_ROLES = ("buyer", "owner")

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
        cursor = connection.execute(
            "SELECT * FROM users WHERE lower(email) = lower(?) AND is_active = 1",
            (email,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        connection.close()

def update_password(user_id, new_password):
    connection = sqlite3.connect(DB_PATH)
    password_hash = generate_password_hash(new_password)
    try:
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE user_id = ?",
            (password_hash, user_id),
        )
        connection.commit()
        return True
    finally:
        connection.close()

def create_reset_token(user_id):
    """Invalidate any old tokens for this user, issue a fresh one, return the token string."""
    token = secrets.token_urlsafe(32)
    connection = sqlite3.connect(DB_PATH)
    try:
        # cleanup: drop this user's stale tokens so only the latest works
        connection.execute(
            "DELETE FROM password_resets "
            "WHERE user_id = ? AND (used = 1 OR expires_at <= datetime('now'))",
            (user_id,),
        )
        connection.execute(
            "INSERT INTO password_resets (token, user_id, expires_at) "
            "VALUES (?, ?, datetime('now', '+15 minutes'))",
            (token, user_id),
        )
        connection.commit()
        return token
    finally:
        connection.close()

def consume_reset_token(token):
    """If token is valid, mark it used and return the user_id. Else return None."""
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            "SELECT user_id FROM password_resets "
            "WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
            (token,),
        ).fetchone()

        if not row:
            return None

        connection.execute(
            "UPDATE password_resets SET used = 1 WHERE token = ?", (token,)
        )
        connection.commit()
        return row["user_id"]
    finally:
        connection.close()
        
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

# User roles change + admins

def list_users():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.execute(
            "SELECT user_id, full_name, email, role, is_active, created_at "
            "FROM users ORDER BY user_id"
        )
        return [dict(r) for r in cursor.fetchall()]
    finally:
        connection.close()

def get_user_by_id(user_id):
    """Returns the row regardless of is_active — needed to reactivate."""
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        connection.close()

def update_user_role(user_id, new_role):
    if new_role not in VALID_ROLES:
        raise ValueError(f"Invalid role {new_role!r}; must be one of {VALID_ROLES}")
    connection = sqlite3.connect(DB_PATH)
    try:
        connection.execute(
            "UPDATE users SET role = ? WHERE user_id = ?", (new_role, user_id)
        )
        connection.commit()
        return True
    finally:
        connection.close()

def set_user_active(user_id, active):
    connection = sqlite3.connect(DB_PATH)
    try:
        connection.execute(
            "UPDATE users SET is_active = ? WHERE user_id = ?",
            (1 if active else 0, user_id),
        )
        connection.commit()
        return True
    finally:
        connection.close()

def count_active_admins(exclude_user_id=None):
    connection = sqlite3.connect(DB_PATH)
    try:
        sql = "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1"
        args = ()
        if exclude_user_id is not None:
            sql += " AND user_id != ?"
            args = (exclude_user_id,)
        return connection.execute(sql, args).fetchone()[0]
    finally:
        connection.close()

if __name__ == "__main__":
    db_init()
    print("Success!")