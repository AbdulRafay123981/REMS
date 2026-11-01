import sqlite3

import backend.database as db
from flask import jsonify, request

from . import bp


@bp.route("/properties")
def get_properties():
    filters = {}

    city = request.args.get("city")
    property_type = request.args.get("property_type")
    listing_type = request.args.get("listing_type")
    min_price = request.args.get("min_price")
    max_price = request.args.get("max_price")

    if property_type and property_type not in (
        "residential",
        "commercial",
        "industrial",
        "land",
        "other",
    ):
        return jsonify({"error": "Unknown property type"}), 400

    if listing_type and listing_type not in ("sale", "rent"):
        return jsonify({"error": "Unknown listing type"}), 400

    try:
        if min_price is not None:
            filters["min_price"] = float(min_price)

        if max_price is not None:
            filters["max_price"] = float(max_price)
    except ValueError:
        return jsonify({"error": "Invalid price filter"}), 400

    if filters.get("min_price", 0) < 0 or filters.get("max_price", 0) < 0:
        return jsonify({"error": "Prices cannot be negative"}), 400

    if (
        "min_price" in filters
        and "max_price" in filters
        and filters["min_price"] > filters["max_price"]
    ):
        return jsonify({"error": "Minimum price exceeds maximum price"}), 400

    filters["city"] = city
    filters["property_type"] = property_type
    filters["listing_type"] = listing_type

    properties = db.search_properties(filters)

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
    try:
        property_id = db.insert_property(data)

    except sqlite3.IntegrityError:
        return jsonify({"error": "Invalid owner ID or property data"}), 400

    except sqlite3.Error:
        return jsonify({"error": "Database operation failed"}), 500

    new_property = db.fetch_property(property_id)

    return jsonify(new_property), 201


@bp.route("/properties/<int:property_id>", methods=["PATCH"])
def update_property(property_id):
    allowed_fields = {
        "title",
        "description",
        "property_type",
        "listing_type",
        "price",
        "price_period",
        "area_marla",
        "area_sqft",
        "bedrooms",
        "bathrooms",
        "address",
        "area",
        "city",
        "province",
        "postal_code",
        "latitude",
        "longitude",
    }

    property = db.fetch_property(property_id)

    if property is None:
        return jsonify({"error": "Property not found"}), 404

    data = request.get_json()

    if data is None:
        return jsonify({"error": "Missing JSON"}), 400

    if not isinstance(data, dict):
        return jsonify({"error": "JSON body must be an object"}), 400

    if not data:
        return jsonify({"error": "No fields provided"}), 400

    unknown_fields = set(data) - allowed_fields

    if unknown_fields:
        return jsonify(
            {
                "error": "Unknown fields",
                "fields": list(unknown_fields),
            }
        ), 400

    updated_data = {**property, **data}

    if updated_data["property_type"] not in (
        "residential",
        "commercial",
        "industrial",
        "land",
        "other",
    ):
        return jsonify({"error": "Unknown property type"}), 400

    if updated_data["listing_type"] not in ("sale", "rent"):
        return jsonify({"error": "Unknown listing type"}), 400

    if updated_data["listing_type"] == "rent":
        if updated_data.get("price_period") not in (
            "daily",
            "weekly",
            "monthly",
            "yearly",
        ):
            return jsonify({"error": "Invalid or missing price period"}), 400
    elif updated_data.get("price_period") is not None:
        return jsonify({"error": "Sale properties cannot have a price period"}), 400

    for field in ("title", "address", "city"):
        if field in data:
            if not isinstance(data[field], str) or not data[field].strip():
                return jsonify({"error": f"Invalid {field}"}), 400

    if "price" in data:
        if (
            isinstance(data["price"], bool)
            or not isinstance(data["price"], (int, float))
            or data["price"] < 0
        ):
            return jsonify({"error": "Price must be a non-negative number"}), 400

    for field in ("area_marla", "area_sqft"):
        if field in data and data[field] is not None:
            if (
                isinstance(data[field], bool)
                or not isinstance(data[field], (int, float))
                or data[field] <= 0
            ):
                return jsonify({"error": f"Invalid {field}"}), 400

    for field in ("bedrooms", "bathrooms"):
        if field in data and data[field] is not None:
            if (
                isinstance(data[field], bool)
                or not isinstance(data[field], int)
                or data[field] < 0
            ):
                return jsonify({"error": f"Invalid {field}"}), 400

    try:
        success = db.update_property(property_id, data)

    except sqlite3.IntegrityError:
        return jsonify({"error": "Invalid property data"}), 400

    except sqlite3.Error:
        return jsonify({"error": "Database operation failed"}), 500

    if not success:
        return jsonify({"error": "Property not found"}), 404

    updated_property = db.fetch_property(property_id)

    return jsonify(updated_property), 200
