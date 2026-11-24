"""Mengubah nama periode menjadi rentang waktu WIB (sesi 3).

Nilai periode sama dengan kolom `periode` di dataset intent buatan Fadhillah, jadi fungsi ini
dipakai bersama oleh ringkasan (/v1/summaries) dan chat `cek_penjualan`.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Literal

# Indonesia tidak memakai daylight saving time, jadi offset +07:00 selalu tetap.
WIB = timezone(timedelta(hours=7), "WIB")

PeriodName = Literal[
    "hari_ini", "kemarin", "7_hari_terakhir", "minggu_ini", "minggu_lalu", "bulan_ini", "bulan_lalu"
]

_ONE_MS = timedelta(milliseconds=1)


def now_wib() -> datetime:
    return datetime.now(WIB).replace(microsecond=0)


def _start_of(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=WIB)


def resolve_period(name: PeriodName, now: datetime | None = None) -> tuple[datetime, datetime]:
    """Mengembalikan (from, to) dalam WIB, keduanya inklusif.

    Asumsi yang perlu dikonfirmasi tim DS: minggu dimulai hari Senin,
    dan "7 hari terakhir" sudah termasuk hari ini.
    """
    now = (now or now_wib()).astimezone(WIB)
    today = now.date()

    if name == "hari_ini":
        return _start_of(today), now
    if name == "kemarin":
        return _start_of(today - timedelta(days=1)), _start_of(today) - _ONE_MS
    if name == "7_hari_terakhir":
        return _start_of(today - timedelta(days=6)), now

    monday = today - timedelta(days=today.weekday())
    if name == "minggu_ini":
        return _start_of(monday), now
    if name == "minggu_lalu":
        return _start_of(monday - timedelta(days=7)), _start_of(monday) - _ONE_MS

    first_of_month = today.replace(day=1)
    if name == "bulan_ini":
        return _start_of(first_of_month), now
    if name == "bulan_lalu":
        first_of_previous = (first_of_month - timedelta(days=1)).replace(day=1)
        return _start_of(first_of_previous), _start_of(first_of_month) - _ONE_MS

    raise ValueError(f"Periode tidak dikenal: {name}")
