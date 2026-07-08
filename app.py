from dotenv import load_dotenv
import os
import sys

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(env_path)
import os
import webbrowser
from threading import Timer

from flask import Flask, request, send_from_directory, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from database import init_db

from routes.auth import auth_bp
from routes.enquiries import enquiries_bp
from routes.team import team_bp
from routes.team_enquiries import team_enquiries_bp
from routes.sessions import sessions_bp
from routes.billing import billing_bp
from routes.customers import customers_bp
from routes.reports import reports_bp
from routes.inventory import inventory_bp
from routes.expenses import expenses_bp

# ─────────────────────────────────────────────────────────────
# Flask App
# ─────────────────────────────────────────────────────────────

app = Flask(
    __name__,
    static_folder="frontend/dist",
    static_url_path=""
)

app.config.from_object(Config)

# JWT
jwt = JWTManager(app)

# ─────────────────────────────────────────────────────────────
# Initialize Database
# ─────────────────────────────────────────────────────────────

try:
    init_db()
except Exception as _db_err:
    print(f"⚠️ DB init warning: {_db_err}")

# ─────────────────────────────────────────────────────────────
# CORS Configuration
# ─────────────────────────────────────────────────────────────

CORS(
    app,
    origins=[
        Config.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5000"
    ],
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
)

_ALLOWED_ORIGINS = {
    Config.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5000"
}

# ─────────────────────────────────────────────────────────────
# Add CORS headers to all responses
# ─────────────────────────────────────────────────────────────

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin', '')

    if origin in _ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'

    return response

# ─────────────────────────────────────────────────────────────
# Handle OPTIONS preflight
# ─────────────────────────────────────────────────────────────

@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':

        response = app.make_default_options_response()
        origin = request.headers.get('Origin', '')

        if origin in _ALLOWED_ORIGINS:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response.headers['Access-Control-Max-Age'] = '3600'

        return response

# ─────────────────────────────────────────────────────────────
# Global Exception Handler
# ─────────────────────────────────────────────────────────────

@app.errorhandler(Exception)
def handle_exception(e):
    import traceback
    traceback.print_exc()

    origin = request.headers.get('Origin', '')

    response = jsonify({
        'error': 'Internal server error',
        'detail': str(e)
    })

    response.status_code = 500

    if origin in _ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'

    return response

# ─────────────────────────────────────────────────────────────
# API Routes
# ─────────────────────────────────────────────────────────────

app.register_blueprint(auth_bp,            url_prefix='/api/auth')
app.register_blueprint(enquiries_bp,       url_prefix='/api/enquiries')
app.register_blueprint(team_bp,            url_prefix='/api/team')
app.register_blueprint(team_enquiries_bp,  url_prefix='/api/team-enquiries')
app.register_blueprint(sessions_bp,        url_prefix='/api/sessions')
app.register_blueprint(billing_bp,   url_prefix='/api/billing')
app.register_blueprint(customers_bp, url_prefix='/api/customers')
app.register_blueprint(reports_bp,   url_prefix='/api/reports')
app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
app.register_blueprint(expenses_bp,  url_prefix='/api/expenses')

# ─────────────────────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────────────────────

@app.route('/api/health')
def health():
    return {
        'status': 'ok',
        'app': 'Virtual Tech CRM'
    }

# ─────────────────────────────────────────────────────────────
# Serve React Frontend
# ─────────────────────────────────────────────────────────────

FRONTEND_DIST = os.path.join(
    os.path.dirname(__file__),
    'frontend',
    'dist'
)

@app.route('/')
def serve_frontend():
    return send_from_directory(FRONTEND_DIST, 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):

    file_path = os.path.join(FRONTEND_DIST, path)

    if os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIST, path)

    return send_from_directory(FRONTEND_DIST, 'index.html')

# ─────────────────────────────────────────────────────────────
# Auto Open Browser
# ─────────────────────────────────────────────────────────────

def open_browser():
    webbrowser.open("http://127.0.0.1:5000")

# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

if __name__ == '__main__':

    print("🚀 Virtual Tech CRM running on http://127.0.0.1:5000")

    Timer(1, open_browser).start()

    app.run(
        debug=False,
        host='127.0.0.1',
        port=5000
    )