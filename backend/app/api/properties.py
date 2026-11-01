import backend.database as db
from flask import jsonify, request

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


@bp.route("/properties", methods=["POST"])
def create_property():

    required_fields = [
        "owner_id",
        "title",
        "property_type",
        "listing_type",
        "price",
        "address",
        "city",
    ]

    allowed_types = ("residential", "commercial", "industrial", "land", "other")
    listing_types = ("sale", "rent")
    allowed_periods = ("daily", "weekly", "monthly", "yearly")

    data = request.get_json()

    if data is None:
        return jsonify({"error": "Missing JSON"}), 400

    if not isinstance(data, dict):
        return jsonify({"error": "JSON Body must be an object"}), 400

    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        return jsonify(
            {"error": "Missing required fields", "missing_fields": missing_fields}
        ), 400

    if data["property_type"] not in allowed_types:
        return jsonify({"error": "Unknown property type"}), 400

    if data["listing_type"] not in listing_types:
        return jsonify({"error": "Unknown listing type"}), 400

    if data["listing_type"] == "rent":
        if data.get("price_period") not in allowed_periods:
            return jsonify({"error": "Invalid or missing price period"}), 400

    elif data.get("price_period") is not None:
        return jsonify({"error": "Sale properties cannot have a price period"}), 400

    if (
        not isinstance(data["owner_id"], int)
        or isinstance(data["owner_id"], bool)
        or data["owner_id"] <= 0
    ):
        return jsonify({"error": "Invalid owner ID"}), 400

    for field in ("title", "address", "city"):
        if not isinstance(data[field], str) or not data[field].strip():
            return jsonify({"error": f"Invalid {field}"}), 400

    if (
        isinstance(data["price"], bool)
        or not isinstance(data["price"], (int, float))
        or data["price"] < 0
    ):
        return jsonify({"error": "Price must be a non-negative number"}), 400

    return data
