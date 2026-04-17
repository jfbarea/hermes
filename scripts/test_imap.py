"""Test de conexión IMAP con M365.

Uso:
    python scripts/test_imap.py
"""
import imaplib
import os

user = os.environ.get("MS_USER_EMAIL", "e.arbesu.s01@faculty.amireducacion.com")
password = os.environ.get("MS_PASSWORD", "")

if not password:
    password = input(f"Contraseña para {user}: ")

try:
    m = imaplib.IMAP4_SSL("outlook.office365.com", 993)
    m.login(user, password)
    print("IMAP OK")
    print("Capacidades:", m.capability())
    m.logout()
except imaplib.IMAP4.error as e:
    print(f"ERROR IMAP: {e}")
