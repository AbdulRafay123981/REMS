from . import app, PROTOTYPE_URL


@app.route("/")
def home():
    return f"Welcome to REMS API — prototype is expected at {PROTOTYPE_URL}"