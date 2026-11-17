from flask import jsonify, request
from flask_login import current_user, login_user, logout_user
from werkzeug.security import check_password_hash

import backend.database as db
from .. import User
from . import bp


@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Missing JSON body"}), 400

    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user_data = db.fetch_user_by_email(email)

    if not user_data or not check_password_hash(
        user_data["password_hash"], password
    ):
        return jsonify({"error": "Invalid email or password"}), 401

    user = User(user_data)
    login_user(user)

    return jsonify({
        "message": "Logged in successfully",
        "user_id": user.id,
        "name": user.full_name,
        "email": user.email,
        "roles": list(user.roles),
    }), 200

@bp.route("/me", methods=["GET"])
def me():
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401

    return jsonify({
        "user_id": current_user.id,
        "name": current_user.full_name,
        "email": current_user.email,
        "roles": list(current_user.roles),
    }), 200


@bp.route("/logout", methods=["GET"])
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200
