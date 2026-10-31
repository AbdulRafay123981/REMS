from flask import Flask

app = Flask(__name__)

from . import routes
from .api import bp as api_bp

app.register_blueprint(api_bp, url_prefix="/api")
