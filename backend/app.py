import backend.database as db
from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/")
def home():
    return "Welcome to REMS"


@app.route("/api/properties")
def get_properties():
    properties = db.fetch_table("properties")
    return jsonify(properties)


if __name__ == "__main__":
    app.run(debug=True)
