import os

class Config:
    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'change-this-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = 86400

    # Database
    DATABASE_URL = os.environ.get('DATABASE_URL')
    DATABASE     = os.environ.get('DATABASE', 'crm.db')

    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

    # WhatsApp
    WHATSAPP_TOKEN    = os.environ.get('META_WHATSAPP_TOKEN')
    WHATSAPP_PHONE_ID = os.environ.get('META_PHONE_NUMBER_ID')
    WHATSAPP_API_VER  = os.environ.get('META_API_VERSION', 'v25.0')
    ADMIN_WHATSAPP    = os.environ.get('ADMIN_WHATSAPP')