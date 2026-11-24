import os

# Diisi sebelum app diimpor, karena config.py membaca kunci saat start.
os.environ.setdefault("INTERNAL_API_KEY", "kunci-tes")
os.environ.setdefault("STUB_SCENARIOS", "true")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

KEY = {"X-Internal-Key": os.environ["INTERNAL_API_KEY"]}


@pytest.fixture
def client():
    # raise_server_exceptions=False: bug disimulasikan menjadi respons 500, bukan menghentikan tes
    return TestClient(app, raise_server_exceptions=False)
