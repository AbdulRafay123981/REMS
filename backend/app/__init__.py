import os
from pathlib import Path

from flask import Flask
from flask_login import LoginManager, UserMixin

from backend import database


FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path="",
)

app.config["SECRET_KEY"] = os.environ.get(
    "SECRET_KEY",
    "dev-only-change-this-secret",
)


class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data["user_id"])
        self.full_name = user_data["full_name"]
        self.email = user_data["email"]
        self.roles = set(user_data["roles"])

    def has_role(self, role):
        return role in self.roles


login_manager = LoginManager()
login_manager.init_app(app)


@login_manager.user_loader
def load_user(user_id):
    user_data = database.fetch_user_by_id(user_id)

    if user_data is None:
        return None

    return User(user_data)


from . import routes as routes
from .api import bp as api_bp

app.register_blueprint(api_bp, url_prefix="/api")
