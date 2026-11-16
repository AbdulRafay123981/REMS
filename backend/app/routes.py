from flask import send_from_directory

from . import FRONTEND_DIR, app


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/properties")
def properties():
    return send_from_directory(FRONTEND_DIR / "pages", "properties.html")

@app.route("/property/<int:property_id>")
def property_detail(property_id):
    return send_from_directory(
        FRONTEND_DIR,
        "pages/property-detail.html"
    )
