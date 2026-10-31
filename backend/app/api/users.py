import re

from flask import jsonify, request
from flask_login import current_user

import backend.database as db
from .. import role_required
from . import bp

@bp.route("/users", methods=["GET"])
@role_required("admin")
def list_users_route():
    return jsonify(db.list_users())

@bp.route("/users", methods=["POST"])
@role_required("admin")
def create_user_route():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    email     = (data.get("email") or "").strip().lower()
    password  = data.get("password") or ""
    role      = (data.get("role") or "").strip().lower()

    if not full_name or not email or not password or not role:
        return jsonify({"error": "All fields are required."}), 400
    if not re.match(r"^\S+@\S+\.\S+$", email):
        return jsonify({"error": "Enter a valid email address."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password needs at least 6 characters."}), 400
    if role not in db.VALID_ROLES:
        return jsonify({"error": f"Role must be one of {list(db.VALID_ROLES)}."}), 400

    try:
        ok = db.create_user(full_name, email, password, role)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if not ok:
        return jsonify({"error": "An account with this email already exists."}), 409

    return jsonify({"message": "User created."}), 201

@bp.route("/users/<int:user_id>", methods=["PATCH"])
@role_required("admin")
def update_user_route(user_id):
    data   = request.get_json(silent=True) or {}
    target = db.get_user_by_id(user_id)
    if not target:
        return jsonify({"error": "User not found."}), 404

    is_self = (user_id == int(current_user.id))
    changes = {}

    if "role" in data:
        new_role = (data["role"] or "").strip().lower()
        if new_role not in db.VALID_ROLES:
            return jsonify({"error": f"Role must be one of {list(db.VALID_ROLES)}."}), 400
        if is_self and new_role != current_user.role:
            return jsonify({"error": "You cannot change your own role."}), 400
        changes["role"] = new_role

    if "is_active" in data:
        new_active = bool(data["is_active"])
        if is_self and not new_active:
            return jsonify({"error": "You cannot deactivate your own account."}), 400
        changes["is_active"] = 1 if new_active else 0

    if not changes:
        return jsonify({"error": "No changes supplied."}), 400

    # Defense in depth: never let the system end up with zero active admins.
    would_lose_admin = (
        target["role"] == "admin"
        and target["is_active"] == 1
        and (
            ("role" in changes and changes["role"] != "admin")
            or ("is_active" in changes and changes["is_active"] == 0)
        )
    )
    if would_lose_admin and db.count_active_admins(exclude_user_id=user_id) == 0:
        return jsonify({"error": "Cannot remove the last active admin."}), 400

    if "role" in changes:
        db.update_user_role(user_id, changes["role"])
    if "is_active" in changes:
        db.set_user_active(user_id, changes["is_active"])

    return jsonify({
        "message": "User updated.",
        "user": db.get_user_by_id(user_id),
    })
