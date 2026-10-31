import os
import sqlite3
from functools import wraps

from flask import Flask, jsonify
from flask_cors import CORS
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
)

import backend.database as db

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = "your-secret-key-here"

PROTOTYPE_URL = os.environ.get(
    "PROTOTYPE_URL",
    "http://127.0.0.1:5500/prototype/index.html",
)

login_manager = LoginManager()
login_manager.init_app(app)


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
        (user_id,),
    )
    row = cursor.fetchone()
    connection.close()
    return User(row) if row else None


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


# Import AFTER everything above is defined — avoids circular imports
from . import routes                       # noqa: E402,F401    
from .api import bp as api_bp              # noqa: E402

app.register_blueprint(api_bp, url_prefix="/api")