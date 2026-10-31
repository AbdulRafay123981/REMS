from flask import Blueprint

bp = Blueprint("api", __name__)

from . import auth          # noqa: F401
from . import users         # noqa: F401
from . import properties    # noqa: F401