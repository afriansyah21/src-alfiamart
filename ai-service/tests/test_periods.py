"""Tes perhitungan periode WIB (sesi 3). Waktu 'sekarang' dibuat tetap supaya hasilnya pasti."""
from datetime import datetime, timedelta, timezone

from app.periods import WIB, resolve_period

# Selasa, 24 November 2026 pukul 06.30 WIB (= 23 November pukul 23.30 UTC)
NOW = datetime(2026, 11, 24, 6, 30, tzinfo=WIB)


def test_kemarin_dihitung_dalam_wib_bukan_utc():
    start, end = resolve_period("kemarin", NOW)
    assert start.isoformat() == "2026-11-23T00:00:00+07:00"
    assert end.isoformat(timespec="milliseconds") == "2026-11-23T23:59:59.999+07:00"


def test_waktu_utc_tetap_dibaca_sebagai_wib():
    now_utc = NOW.astimezone(timezone.utc)  # 23 Nov 23.30 UTC, tapi di WIB sudah 24 Nov
    start, _ = resolve_period("kemarin", now_utc)
    assert start.date().isoformat() == "2026-11-23"


def test_hari_ini_sampai_sekarang():
    start, end = resolve_period("hari_ini", NOW)
    assert start.isoformat() == "2026-11-24T00:00:00+07:00"
    assert end == NOW


def test_7_hari_terakhir_termasuk_hari_ini():
    start, _ = resolve_period("7_hari_terakhir", NOW)
    assert start.date().isoformat() == "2026-11-18"


def test_minggu_dimulai_hari_senin():
    start, _ = resolve_period("minggu_ini", NOW)
    assert start.date().isoformat() == "2026-11-23"  # Senin
    start, end = resolve_period("minggu_lalu", NOW)
    assert start.date().isoformat() == "2026-11-16"
    assert (end + timedelta(milliseconds=1)).date().isoformat() == "2026-11-23"


def test_bulan_lalu_melewati_pergantian_tahun():
    start, end = resolve_period("bulan_lalu", datetime(2027, 1, 10, 12, 0, tzinfo=WIB))
    assert start.isoformat() == "2026-12-01T00:00:00+07:00"
    assert end.date().isoformat() == "2026-12-31"
