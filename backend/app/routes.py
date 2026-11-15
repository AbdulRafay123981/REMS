from flask import send_from_directory

from . import FRONTEND_DIR, app


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")
