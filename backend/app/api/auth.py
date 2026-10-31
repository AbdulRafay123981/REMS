import re

from flask import jsonify, request
from flask_login import (
    current_user,
    login_required,
    login_user,
    logout_user,
)
from werkzeug.security import check_password_hash

import backend.database as db
from .. import User, PROTOTYPE_URL
from . import bp


@bp.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    user_data = db.get_user_by_email(email)
    if user_data and check_password_hash(user_data["password_hash"], password):
        user_obj = User(user_data)
        login_user(user_obj)
        return jsonify({
    "message": "Logged in successfully",
    "user_id": user_obj.id,           
    "role": user_obj.role,
    "name": user_obj.full_name,
    })
    
    return jsonify({"error": "Invalid email or password"}), 401

@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    email     = (data.get("email") or "").strip().lower()
    password  = data.get("password") or ""
    role      = (data.get("role") or "buyer").strip().lower()

    if not full_name or not email or not password:
        return jsonify({"error": "Full name, email, and password are required."}), 400
    if len(full_name) < 2:
        return jsonify({"error": "Please enter your full name."}), 400
    if not re.match(r"^\S+@\S+\.\S+$", email):
        return jsonify({"error": "Enter a valid email address."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password needs at least 6 characters."}), 400
    if role not in db.SELF_REGISTER_ROLES:
        return jsonify({"error": "You can only register as a buyer or owner."}), 400

    try:
        ok = db.create_user(full_name, email, password, role)
    except ValueError:
        return jsonify({"error": "Invalid role."}), 400

    if not ok:
        return jsonify({"error": "An account with this email already exists."}), 409

    return jsonify({"message": "Account created. Please sign in."}), 201

@bp.route("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"})

@bp.route("/me")
def me():
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({
        "user_id": current_user.id,
        "email":   current_user.email,
        "name":    current_user.full_name,
        "role":    current_user.role,
    })
    
@bp.route("/change-password", methods=["POST"])
def change_password():
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    new     = data.get("new_password") or ""

    if not current or not new:
        return jsonify({"error": "Both current and new passwords are required."}), 400
    if len(new) < 6:
        return jsonify({"error": "New password needs at least 6 characters."}), 400
    if current == new:
        return jsonify({"error": "New password must be different from the current one."}), 400

    # current_user doesn't carry the hash — re-fetch to verify
    user_data = db.get_user_by_email(current_user.email)
    if not user_data or not check_password_hash(user_data["password_hash"], current):
        return jsonify({"error": "Current password is incorrect."}), 401

    db.update_password(current_user.id, new)
    return jsonify({"message": "Password updated successfully."})

@bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Enter your email address."}), 400

    user_data = db.get_user_by_email(email)

    # Always return the same response — prevents user enumeration.
    generic = jsonify({
        "message": "If that email exists, a reset token has been sent."
    })

    if not user_data:
        app.logger.info("Forgot-password requested for unknown email: %s", email)
        return generic, 200

    token = db.create_reset_token(user_data["user_id"])
    app.logger.info("Password reset token issued for %s", email)

    # Stubbed "email": print to Flask console.
    print("\n" + "=" * 60)
    print(f"PASSWORD RESET for {email}")
    print(f"  Token: {token}")
    print(f"  Link:  {PROTOTYPE_URL}?reset={token}")
    print("  Expires in 15 minutes. Single use.")
    print("=" * 60 + "\n")

    return generic, 200

@bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    new   = data.get("new_password") or ""

    if not token or not new:
        return jsonify({"error": "Token and new password are required."}), 400
    if len(new) < 6:
        return jsonify({"error": "New password needs at least 6 characters."}), 400

    user_id = db.consume_reset_token(token)
    if user_id is None:
        return jsonify({"error": "Invalid or expired reset token."}), 400

    db.update_password(user_id, new)
    app.logger.info("Password reset completed for user_id=%s", user_id)
    return jsonify({"message": "Password reset successfully. Please sign in."})
