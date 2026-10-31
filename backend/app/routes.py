import backend.database as db
from flask import jsonify

from . import app


@app.route("/")
def home():
    return "Welcome to REMS"
