# Virtual Tech CRM

A full-stack Customer Relationship Management (CRM) system built with **Flask**, **PostgreSQL (Supabase)**, and **React (Vite)**. It supports role-based access control, subscription-based billing via Razorpay, and automated email notifications.

## Features

- 🔐 **Role-Aware Access Control** — Separate permissions and views for Admin and Staff roles
- 💳 **Subscription & Payments** — Razorpay integration for subscription management and payment gating
- 📧 **Email Notifications** — Automated emails via Gmail SMTP (e.g., alerts, confirmations)
- 🗄️ **PostgreSQL Database** — Hosted on Supabase for scalable, managed data storage
- ⚡ **Modern Frontend** — Fast, responsive UI built with React and Vite
- 🌐 **REST API** — Flask-based backend exposing CRM operations via API endpoints

## Tech Stack

**Backend**
- Flask (Python)
- PostgreSQL (via Supabase)
- Flask-CORS

**Frontend**
- React
- Vite
 
## Project Structure

```
virtual-tech-crm/
├── backend/
│   ├── app.py
│   ├── models/
│   ├── routes/
│   ├── config.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
└── README.md
```
 

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 16+
- A Supabase project (PostgreSQL connection string)
- A Razorpay account (API keys)
- A Gmail account with an App Password for SMTP

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=your_supabase_postgres_connection_string
SECRET_KEY=your_flask_secret_key
GMAIL_USER=your_gmail_address
GMAIL_APP_PASSWORD=your_gmail_app_password
```

Run the backend:

```bash
flask run
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:5000
```

## Roles & Access

| Role  | Permissions |
|-------|-------------|
| Admin | Full access — manage users, subscriptions, and all CRM data |
| Staff | Limited access — manage assigned leads/customers only |

 
