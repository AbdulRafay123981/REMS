from pathlib import Path

from flask import Flask

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "prototype"

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path="",
)

from . import routes as routes
from .api import bp as api_bp

app.register_blueprint(api_bp, url_prefix="/api")
