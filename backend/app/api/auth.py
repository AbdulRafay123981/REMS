import sqlite3

from flask import jsonify, request
from flask_login import current_user, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

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

@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Missing JSON body"}), 400

    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not full_name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if "@" not in email or any(char.isspace() for char in email):
        return jsonify({"error": "Please enter a valid email address"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    password_hash = generate_password_hash(password)

    try:
        user_id = db.create_user(full_name, email, password_hash)
    except sqlite3.IntegrityError:
        return jsonify({"error": "An account with this email already exists"}), 409

    user_data = db.fetch_user_by_id(user_id)
    user = User(user_data)
    login_user(user)

    return jsonify({
        "message": "Account created successfully",
        "user_id": user.id,
        "name": user.full_name,
        "email": user.email,
        "roles": list(user.roles),
    }), 201

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
