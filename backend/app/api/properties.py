from flask import jsonify
from flask_login import current_user

import backend.database as db
from .. import role_required
from . import bp

@bp.route("/properties")
def get_properties():
    properties = db.fetch_table("properties")
    return jsonify(properties)


@bp.route("/properties/manage", methods=["POST"])
@role_required("admin", "agent")
def manage_property():
    return jsonify({"message": f"Welcome {current_user.full_name}, you have permission to manage this."})