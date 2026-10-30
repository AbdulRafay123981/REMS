import re
import os   
import sqlite3
from functools import wraps
from flask_cors import CORS
import backend.database as db
from flask import Flask, jsonify, request
from werkzeug.security import check_password_hash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user


app = Flask(__name__)
CORS(app, supports_credentials=True) # Enables cookies and cross-origin requests
app.secret_key = "your-secret-key-here"  # Needed for session management

PROTOTYPE_URL = os.environ.get(
    "PROTOTYPE_URL",
    "http://127.0.0.1:5500/prototype/index.html",   # Live Server default
)

login_manager = LoginManager()
login_manager.init_app(app)

# User class required by Flask-Login
class User(UserMixin):
    def __init__(self, user_data):
        self.id = user_data["user_id"]
        self.email = user_data["email"]
        self.full_name = user_data["full_name"]
        self.role = user_data["role"]

    def get_id(self):
        return str(self.id)

@login_manager.user_loader
def load_user(user_id):
    connection = sqlite3.connect(db.DB_PATH)
    connection.row_factory = sqlite3.Row
    cursor = connection.execute(
        "SELECT * FROM users WHERE user_id = ? AND is_active = 1",
        (user_id,)
    )
    row = cursor.fetchone()
    connection.close()
    return User(row) if row else None

# Custom Decorator for Role-Based Access Control
def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated_function(*args, **kwargs):
            if current_user.role not in allowed_roles:
                return jsonify({"error": "Unauthorized access"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# --- API ROUTES ---

@app.route("/")
def home():
    return f"Welcome to REMS API — prototype is expected at {PROTOTYPE_URL}"

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    user_data = db.get_user_by_email(email)
    if user_data and check_password_hash(user_data["password_hash"], password):
        user_obj = User(user_data)
        login_user(user_obj)
        return jsonify({
    "message": "Logged in successfully",
    "user_id": user_obj.id,           
    "role": user_obj.role,
    "name": user_obj.full_name,
    })
    
    return jsonify({"error": "Invalid email or password"}), 401

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    email     = (data.get("email") or "").strip().lower()
    password  = data.get("password") or ""
    role      = (data.get("role") or "buyer").strip().lower()

    if not full_name or not email or not password:
        return jsonify({"error": "Full name, email, and password are required."}), 400
    if len(full_name) < 2:
        return jsonify({"error": "Please enter your full name."}), 400
    if not re.match(r"^\S+@\S+\.\S+$", email):
        return jsonify({"error": "Enter a valid email address."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password needs at least 6 characters."}), 400
    if role not in db.SELF_REGISTER_ROLES:
        return jsonify({"error": "You can only register as a buyer or owner."}), 400

    try:
        ok = db.create_user(full_name, email, password, role)
    except ValueError:
        return jsonify({"error": "Invalid role."}), 400

    if not ok:
        return jsonify({"error": "An account with this email already exists."}), 409

    return jsonify({"message": "Account created. Please sign in."}), 201

@app.route("/api/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"})

@app.route("/api/me")
def me():
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({
        "user_id": current_user.id,
        "email":   current_user.email,
        "name":    current_user.full_name,
        "role":    current_user.role,
    })
    
@app.route("/api/change-password", methods=["POST"])
def change_password():
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    new     = data.get("new_password") or ""

    if not current or not new:
        return jsonify({"error": "Both current and new passwords are required."}), 400
    if len(new) < 6:
        return jsonify({"error": "New password needs at least 6 characters."}), 400
    if current == new:
        return jsonify({"error": "New password must be different from the current one."}), 400

    # current_user doesn't carry the hash — re-fetch to verify
    user_data = db.get_user_by_email(current_user.email)
    if not user_data or not check_password_hash(user_data["password_hash"], current):
        return jsonify({"error": "Current password is incorrect."}), 401

    db.update_password(current_user.id, new)
    return jsonify({"message": "Password updated successfully."})

@app.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Enter your email address."}), 400

    user_data = db.get_user_by_email(email)

    # Always return the same response — prevents user enumeration.
    generic = jsonify({
        "message": "If that email exists, a reset token has been sent."
    })

    if not user_data:
        app.logger.info("Forgot-password requested for unknown email: %s", email)
        return generic, 200

    token = db.create_reset_token(user_data["user_id"])
    app.logger.info("Password reset token issued for %s", email)

    # Stubbed "email": print to Flask console.
    print("\n" + "=" * 60)
    print(f"PASSWORD RESET for {email}")
    print(f"  Token: {token}")
    print(f"  Link:  {PROTOTYPE_URL}?reset={token}")
    print("  Expires in 15 minutes. Single use.")
    print("=" * 60 + "\n")

    return generic, 200

@app.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    new   = data.get("new_password") or ""

    if not token or not new:
        return jsonify({"error": "Token and new password are required."}), 400
    if len(new) < 6:
        return jsonify({"error": "New password needs at least 6 characters."}), 400

    user_id = db.consume_reset_token(token)
    if user_id is None:
        return jsonify({"error": "Invalid or expired reset token."}), 400

    db.update_password(user_id, new)
    app.logger.info("Password reset completed for user_id=%s", user_id)
    return jsonify({"message": "Password reset successfully. Please sign in."})

@app.route("/api/users", methods=["GET"])
@role_required("admin")
def list_users_route():
    return jsonify(db.list_users())

@app.route("/api/users", methods=["POST"])
@role_required("admin")
def create_user_route():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    email     = (data.get("email") or "").strip().lower()
    password  = data.get("password") or ""
    role      = (data.get("role") or "").strip().lower()

    if not full_name or not email or not password or not role:
        return jsonify({"error": "All fields are required."}), 400
    if not re.match(r"^\S+@\S+\.\S+$", email):
        return jsonify({"error": "Enter a valid email address."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password needs at least 6 characters."}), 400
    if role not in db.VALID_ROLES:
        return jsonify({"error": f"Role must be one of {list(db.VALID_ROLES)}."}), 400

    try:
        ok = db.create_user(full_name, email, password, role)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if not ok:
        return jsonify({"error": "An account with this email already exists."}), 409

    return jsonify({"message": "User created."}), 201


@app.route("/api/users/<int:user_id>", methods=["PATCH"])
@role_required("admin")
def update_user_route(user_id):
    data   = request.get_json(silent=True) or {}
    target = db.get_user_by_id(user_id)
    if not target:
        return jsonify({"error": "User not found."}), 404

    is_self = (user_id == int(current_user.id))
    changes = {}

    if "role" in data:
        new_role = (data["role"] or "").strip().lower()
        if new_role not in db.VALID_ROLES:
            return jsonify({"error": f"Role must be one of {list(db.VALID_ROLES)}."}), 400
        if is_self and new_role != current_user.role:
            return jsonify({"error": "You cannot change your own role."}), 400
        changes["role"] = new_role

    if "is_active" in data:
        new_active = bool(data["is_active"])
        if is_self and not new_active:
            return jsonify({"error": "You cannot deactivate your own account."}), 400
        changes["is_active"] = 1 if new_active else 0

    if not changes:
        return jsonify({"error": "No changes supplied."}), 400

    # Defense in depth: never let the system end up with zero active admins.
    would_lose_admin = (
        target["role"] == "admin"
        and target["is_active"] == 1
        and (
            ("role" in changes and changes["role"] != "admin")
            or ("is_active" in changes and changes["is_active"] == 0)
        )
    )
    if would_lose_admin and db.count_active_admins(exclude_user_id=user_id) == 0:
        return jsonify({"error": "Cannot remove the last active admin."}), 400

    if "role" in changes:
        db.update_user_role(user_id, changes["role"])
    if "is_active" in changes:
        db.set_user_active(user_id, changes["is_active"])

    return jsonify({
        "message": "User updated.",
        "user": db.get_user_by_id(user_id),
    })

# Example of a Public Endpoint
@app.route("/api/properties")
def get_properties():
    properties = db.fetch_table("properties")
    return jsonify(properties)

# Example of a Restricted Endpoint (Only 'admin' or 'agent' can add/manage)
@app.route("/api/properties/manage", methods=["POST"])
@role_required("admin", "agent")
def manage_property():
    # Code to add/modify property goes here
    return jsonify({"message": f"Welcome {current_user.full_name}, you have permission to manage this."})

if __name__ == "__main__":
    app.run(debug=True)
