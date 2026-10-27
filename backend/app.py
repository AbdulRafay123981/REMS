from flask import Flask, jsonify, request
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import check_password_hash
from functools import wraps
import backend.database as db
import sqlite3

from flask_cors import CORS

app = Flask(__name__)
CORS(app, supports_credentials=True) # Enables cookies and cross-origin requests
app.secret_key = "your-secret-key-here"  # Needed for session management

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
    # Helper to load user by ID for sessions
    connection = sqlite3.connect(db.DB_PATH)
    connection.row_factory = sqlite3.Row
    cursor = connection.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
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
    return "Welcome to REMS API"

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    user_data = db.get_user_by_email(email)
    if user_data and check_password_hash(user_data["password_hash"], password):
        user_obj = User(user_data)
        login_user(user_obj)
        return jsonify({"message": "Logged in successfully", "role": user_obj.role, "name": user_obj.full_name})
    
    return jsonify({"error": "Invalid email or password"}), 401

@app.route("/api/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"})

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
