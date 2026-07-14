import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv(Path(__file__).parent / ".env")

app = Flask(__name__, static_folder=".", static_url_path="")
app.secret_key = os.environ["SECRET_KEY"]
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")

DATABASE_URL = os.environ["DATABASE_URL"]


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS judgments (
                id SERIAL PRIMARY KEY,
                stage TEXT NOT NULL,
                confidence INTEGER NOT NULL,
                storage_type TEXT NOT NULL,
                remaining_label TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT
            );
            """
        )
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();")
        conn.commit()


@app.get("/")
def index():
    return send_from_directory(".", "index.html")


@app.get("/login")
def login_page():
    return send_from_directory(".", "login.html")


@app.get("/signup")
def signup_page():
    return send_from_directory(".", "signup.html")


@app.post("/api/signup")
def signup():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "이메일과 비밀번호를 입력하세요."}), 400
    if len(password) < 8:
        return jsonify({"error": "비밀번호는 8자 이상이어야 해요."}), 400

    password_hash = generate_password_hash(password)
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, name, password_hash) VALUES (%s, %s, %s) RETURNING id;",
                (email, name, password_hash),
            )
            user_id = cur.fetchone()[0]
            conn.commit()
    except psycopg2.IntegrityError:
        return jsonify({"error": "이미 가입된 이메일이에요."}), 409

    session["user_id"] = user_id
    session["email"] = email
    return jsonify({"id": user_id, "email": email}), 201


@app.post("/api/login")
def login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, password_hash FROM users WHERE email = %s;", (email,))
        row = cur.fetchone()

    if not row or not row[1] or not check_password_hash(row[1], password):
        return jsonify({"error": "이메일 또는 비밀번호가 올바르지 않아요."}), 401

    session["user_id"] = row[0]
    session["email"] = email
    return jsonify({"id": row[0], "email": email})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
def me():
    if "user_id" not in session:
        return jsonify({"user": None})
    return jsonify({"user": {"id": session["user_id"], "email": session["email"]}})


@app.get("/api/health")
def health():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1;")
        cur.fetchone()
    return jsonify({"status": "ok"})


@app.post("/api/judgments")
def create_judgment():
    data = request.get_json(force=True)
    stage = data.get("stage")
    confidence = data.get("confidence")
    storage_type = data.get("storageType")
    remaining_label = data.get("remainingLabel")

    if not all([stage, confidence is not None, storage_type, remaining_label]):
        return jsonify({"error": "missing fields"}), 400

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO judgments (stage, confidence, storage_type, remaining_label, created_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (stage, confidence, storage_type, remaining_label, datetime.now(timezone.utc)),
        )
        new_id = cur.fetchone()[0]
        conn.commit()

    return jsonify({"id": new_id}), 201


@app.get("/api/judgments")
def list_judgments():
    with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM judgments ORDER BY created_at DESC LIMIT 20;")
        rows = cur.fetchall()
    return jsonify(rows)


init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5173))
    app.run(host="0.0.0.0", port=port, debug=True)
