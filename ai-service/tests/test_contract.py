"""Tes kontrak: memastikan layanan AI berperilaku sesuai yang disepakati dengan Express."""
from tests.conftest import KEY

SESSION = "3f6c2a10-8b1e-4c7a-9e52-0d4f1a7b9c11"


def chat_body(message, **extra):
    return {"message": message, "session_id": SESSION, **extra}


def assert_error(res, status, code):
    assert res.status_code == status
    body = res.json()
    assert body["success"] is False
    assert body["error"]["code"] == code


# ---------- Aturan global ----------

def test_health_terbuka_tanpa_kunci(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"success": True, "data": {"status": "ok", "model_intent": "stub"}}


def test_tanpa_kunci_ditolak(client):
    assert_error(client.post("/v1/chat", json=chat_body("harga beras?")), 401, "UNAUTHORIZED")


def test_kunci_salah_ditolak(client):
    res = client.post("/v1/chat", json=chat_body("harga beras?"), headers={"X-Internal-Key": "salah"})
    assert_error(res, 401, "UNAUTHORIZED")


def test_endpoint_tidak_ada_tetap_memakai_amplop(client):
    assert_error(client.get("/v1/tidak-ada", headers=KEY), 404, "NOT_FOUND")


def test_swagger_tidak_menjanjikan_422(client):
    spec = client.get("/openapi.json").json()
    assert "422" not in spec["paths"]["/v1/chat"]["post"]["responses"]
    assert "400" in spec["paths"]["/v1/chat"]["post"]["responses"]


# ---------- Request /v1/chat (sesi 2a) ----------

def test_pesan_hanya_spasi_ditolak(client):
    res = client.post("/v1/chat", json=chat_body("   "), headers=KEY)
    assert_error(res, 400, "VALIDATION_ERROR")
    assert res.json()["error"]["details"][0]["field"] == "message"


def test_pesan_lebih_dari_500_karakter_ditolak(client):
    assert_error(client.post("/v1/chat", json=chat_body("a" * 501), headers=KEY), 400, "VALIDATION_ERROR")


def test_channel_tidak_dikenal_ditolak(client):
    res = client.post("/v1/chat", json=chat_body("harga beras?", channel="tele"), headers=KEY)
    assert_error(res, 400, "VALIDATION_ERROR")


def test_history_lebih_dari_6_ditolak(client):
    history = [{"role": "user", "content": "halo"}] * 7
    res = client.post("/v1/chat", json=chat_body("harga beras?", history=history), headers=KEY)
    assert_error(res, 400, "VALIDATION_ERROR")


def test_session_id_bukan_uuid_ditolak(client):
    res = client.post("/v1/chat", json={"message": "harga beras?", "session_id": "123"}, headers=KEY)
    assert_error(res, 400, "VALIDATION_ERROR")


# ---------- Response /v1/chat (sesi 2b) ----------

def test_bentuk_response_lengkap(client):
    res = client.post("/v1/chat", json=chat_body("harga beras berapa?"), headers=KEY)
    assert res.status_code == 200
    data = res.json()["data"]
    assert set(data) == {"intent", "confidence", "reply", "action", "sources", "fallback"}
    assert data["intent"] == "tanya_produk"
    assert data["action"] is None
    assert data["sources"] == [{"type": "product", "id": "BRS-5KG", "title": "Beras 5 kg"}]
    assert data["fallback"] is False


def test_ubah_harga_menghasilkan_usulan(client):
    data = client.post("/v1/chat", json=chat_body("naikin harga gula jadi 18rb"), headers=KEY).json()["data"]
    assert data["intent"] == "ubah_harga"
    assert data["action"]["type"] == "price_proposal"
    assert data["action"]["old_price"] == 17500
    assert data["action"]["new_price"] == 18000


def test_batal_harga_menghasilkan_usulan_pembatalan(client):
    data = client.post("/v1/chat", json=chat_body("batalin perubahan harga telur"), headers=KEY).json()["data"]
    assert data["action"]["type"] == "price_revert"
    assert data["action"]["history_id"] == 42


def test_telegram_diarahkan_ke_dasbor(client):
    data = client.post("/v1/chat", json=chat_body("naikin harga gula jadi 18rb", channel="telegram"),
                       headers=KEY).json()["data"]
    assert "dasbor" in data["reply"]


def test_cara_memakai_aplikasi_masuk_tanya_panduan(client):
    data = client.post("/v1/chat", json=chat_body("cara ubah harga gimana?"), headers=KEY).json()["data"]
    assert data["intent"] == "tanya_panduan"
    assert data["sources"][0]["type"] == "guide"


# ---------- Gangguan (sesi 2c) ----------

def test_llm_gagal_tetap_menjawab_dengan_fallback(client):
    res = client.post("/v1/chat", json=chat_body("omzet kemarin berapa?"),
                      headers={**KEY, "X-Stub-Scenario": "fallback"})
    assert res.status_code == 200
    assert res.json()["data"]["fallback"] is True


def test_data_gagal_tetap_menjawab_tanpa_angka(client):
    res = client.post("/v1/chat", json=chat_body("omzet kemarin berapa?"),
                      headers={**KEY, "X-Stub-Scenario": "no_data"})
    data = res.json()["data"]
    assert res.status_code == 200
    assert data["fallback"] is True
    assert "Rp" not in data["reply"]


def test_model_belum_siap_503(client):
    res = client.post("/v1/chat", json=chat_body("harga beras?"), headers={**KEY, "X-Stub-Scenario": "unavailable"})
    assert_error(res, 503, "MODEL_UNAVAILABLE")


def test_bug_menjadi_500_tanpa_bocor_detail(client):
    res = client.post("/v1/chat", json=chat_body("harga beras?"), headers={**KEY, "X-Stub-Scenario": "crash"})
    assert_error(res, 500, "INTERNAL_ERROR")
    assert "Simulasi" not in res.text  # pesan error mentah tidak boleh ikut terkirim


# ---------- /v1/summaries (sesi 3) ----------

def test_ringkasan_penjualan(client):
    res = client.get("/v1/summaries", params={"type": "sales", "period": "kemarin"}, headers=KEY)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["type"] == "sales"
    assert data["period"]["name"] == "kemarin"
    assert data["period"]["from"].endswith("+07:00")
    assert set(data["facts"]["by_branch"]) == {"alfiamart1", "alfiamart2"}
    assert data["fallback"] is False


def test_ringkasan_perubahan_harga_tanpa_rincian_cabang(client):
    data = client.get("/v1/summaries", params={"type": "price_changes"}, headers=KEY).json()["data"]
    assert data["period"]["name"] == "kemarin"  # nilai default
    assert data["facts"]["changes_count"] == 2
    assert "by_branch" not in data["facts"]


def test_ringkasan_data_gagal_facts_null(client):
    res = client.get("/v1/summaries", params={"type": "sales"}, headers={**KEY, "X-Stub-Scenario": "no_data"})
    data = res.json()["data"]
    assert res.status_code == 200
    assert data["facts"] is None
    assert data["fallback"] is True


def test_ringkasan_type_salah_ditolak(client):
    assert_error(client.get("/v1/summaries", params={"type": "stok"}, headers=KEY), 400, "VALIDATION_ERROR")


def test_ringkasan_periode_ke_depan_ditolak(client):
    res = client.get("/v1/summaries", params={"type": "sales", "period": "besok"}, headers=KEY)
    assert_error(res, 400, "VALIDATION_ERROR")
