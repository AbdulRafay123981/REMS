import backend.database as db
from flask import jsonify

from . import bp


@bp.route("/properties")
def get_properties():
    properties = db.fetch_table("properties")
    return jsonify(properties)


@bp.route("/properties/<int:property_id>")
def get_property(property_id):
    property = db.fetch_property(property_id)

    if property is None:
        return jsonify({"error": "Property not found"}), 404

    return jsonify(property)
