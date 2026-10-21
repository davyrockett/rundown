"""Collect what Rundown shows and write data.json for the private rundown-data repo.

Run every hour by .github/workflows/update.yml in davyrockett/rundown-data (it checks out this public repo for
the script, then commits data.json there if anything changed). Secrets (set in rundown-data's Settings →
Secrets and variables → Actions; a missing one just leaves that part out):

    CAL_PERSONAL, CAL_RJ, CAL_US   private iCal links ("Secret address in iCal format" in Google Calendar)
    PCO_APP_ID, PCO_SECRET         a Planning Center personal access token (api.planningcenteronline.com)

rundown-data is PUBLIC (David's choice), so data.json holds only what Rundown shows: event titles, times and
locations (no descriptions), and Resounding Joy entries with client details stripped (clean_rj_title). The links
and token stay secrets: they'd open the full calendars and The Crossing's Planning Center to anyone.

Locally:  pip install icalendar recurring-ical-events
          python tools/build_data.py path/to/data.json
"""

import base64
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events

TZ = ZoneInfo("America/Los_Angeles")
GIGS_ID = "qlfaf5pt3ubfrqb158kub26g98@group.calendar.google.com"

# key, name shown in the app, where the feed comes from (a secret's name, or a public link)
CALENDARS = [
    ("personal", "Personal", "secret:CAL_PERSONAL"),
    ("rj", "Resounding Joy", "secret:CAL_RJ"),
    ("gigs", "Davy Rockett gigs", f"https://calendar.google.com/calendar/ical/{GIGS_ID.replace('@', '%40')}/public/basic.ics"),
    ("us", "David & RaeLynn", "secret:CAL_US"),
]
DAYS_AHEAD = 15        # calendar events kept: yesterday to two weeks out
RJ_DAYS_BACK = 40      # RJ sessions kept for ticking: this pay period and last, with room to spare

# Autocross near San Diego (MotorsportReg's public calendar), checked once a day.
AX_URL = ("https://www.motorsportreg.com/api/calendar/events/?radius=300&types=autocross&page=1&pageSize=100"
          "&lat=32.7157&lng=-117.1611")

UA = {"User-Agent": "davyrockett-rundown/1.0 (personal dashboard; hourly)"}


def fetch(url, headers=None, timeout=60):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def local(value):
    """Calendar date/datetime -> Pacific wall-clock string, and whether it's an all-day event."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=TZ)
        return value.astimezone(TZ).strftime("%Y-%m-%dT%H:%M"), False
    return value.isoformat(), True


def read_calendar(source, start, end):
    if source.startswith("secret:"):
        url = os.environ.get(source[7:], "").strip()
        if not url:
            return None
    else:
        url = source
    cal = icalendar.Calendar.from_ical(fetch(url))
    events = []
    for event in recurring_ical_events.of(cal).between(start, end):
        if str(event.get("STATUS", "")).upper() == "CANCELLED":
            continue
        begin, all_day = local(event.decoded("DTSTART"))
        finish = local(event.decoded("DTEND"))[0] if event.get("DTEND") else None
        if all_day and finish:
            # An all-day event's end date is the day after it finishes.
            finish = (date.fromisoformat(finish) - timedelta(days=1)).isoformat()
        events.append({
            "uid": str(event.get("UID", "")),
            "title": str(event.get("SUMMARY", "")).strip() or "(no title)",
            "start": begin,
            "end": finish,
            "allDay": all_day,
            "location": str(event.get("LOCATION", "")).strip().split("\n")[0],
        })
    return events


# The data repo is public (David, 2026-10-21), so Resounding Joy entries go in without client details:
# no locations (some are clients' homes), no client codes like "AbcDef" / "(AbcDef - G)", no initials.
RJ_KEEP_SHORT = {"VA", "MK", "RJ", "SOS", "ARC", "MWC"}


def clean_rj_title(title):
    t = re.sub(r"\s*\([^)]*\)", "", title)                       # anything in brackets, e.g. "(AbcDef)"
    t = re.sub(r"\b[A-Z][a-z]+[A-Z][a-z]+\b", "", t)                # client codes made of two name parts: AbcDef
    t = re.sub(r"\b[A-Z]{2}\b", lambda m: m.group(0) if m.group(0) in RJ_KEEP_SHORT else "", t)  # initials like "AB CD"
    t = re.sub(r"\s+", " ", t).strip(" :,-")
    return t or "Session"


# ---------- Planning Center (The Crossing) ----------

def pco(path, params=None):
    auth = base64.b64encode(f"{os.environ['PCO_APP_ID'].strip()}:{os.environ['PCO_SECRET'].strip()}".encode()).decode()
    url = f"https://api.planningcenteronline.com{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    return json.loads(fetch(url, {"Authorization": f"Basic {auth}"}))


def pco_local(stamp):
    """Planning Center's UTC time -> Pacific wall-clock string."""
    return datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone(TZ).strftime("%Y-%m-%dT%H:%M")


def read_crossing(today):
    if not os.environ.get("PCO_APP_ID") or not os.environ.get("PCO_SECRET"):
        return None
    me = pco("/services/v2/me")["data"]
    schedules = pco(f"/services/v2/people/{me['id']}/schedules", {"per_page": 50})["data"]
    upcoming = sorted(
        (s for s in schedules if pco_local(s["attributes"]["sort_date"])[:10] >= today.isoformat()),
        key=lambda s: s["attributes"]["sort_date"],
    )
    requests = [{
        "date": pco_local(s["attributes"]["sort_date"])[:10],
        "service": s["attributes"].get("service_type_name") or "",
        "position": s["attributes"].get("team_position_name") or "",
    } for s in upcoming if s["attributes"].get("status") == "U"]

    mine = next((s for s in upcoming if s["attributes"].get("status") != "D"), None)
    if mine:
        plan_id = mine["relationships"]["plan"]["data"]["id"]
        type_id = mine["relationships"]["service_type"]["data"]["id"]
        me_in_plan = {
            "team": mine["attributes"].get("team_name") or "",
            "position": mine["attributes"].get("team_position_name") or "",
            "status": mine["attributes"].get("status") or "",
        }
    else:
        # Not scheduled: the next plan of any service type this login can see.
        plan_id = type_id = None
        soonest = None
        for st in pco("/services/v2/service_types")["data"]:
            plans = pco(f"/services/v2/service_types/{st['id']}/plans", {"filter": "future", "order": "sort_date", "per_page": 1})["data"]
            if plans and (soonest is None or plans[0]["attributes"]["sort_date"] < soonest):
                soonest, plan_id, type_id = plans[0]["attributes"]["sort_date"], plans[0]["id"], st["id"]
        if not plan_id:
            return {"requests": requests} if requests else None
        me_in_plan = None

    base = f"/services/v2/service_types/{type_id}/plans/{plan_id}"
    plan = pco(base, {"include": "plan_times,service_type"})
    included = plan.get("included", [])
    attrs = plan["data"]["attributes"]
    times = sorted(({
        "name": t["attributes"].get("name") or (t["attributes"].get("time_type") or "").capitalize(),
        "type": t["attributes"].get("time_type") or "",
        "start": pco_local(t["attributes"]["starts_at"]),
    } for t in included if t["type"] == "PlanTime" and t["attributes"].get("starts_at")), key=lambda t: t["start"])
    service = next((t for t in times if t["type"] == "service"), None)
    service_type = next((t["attributes"].get("name") for t in included if t["type"] == "ServiceType"), "")

    items = pco(f"{base}/items", {"include": "song", "per_page": 100})
    songs_by_id = {s["id"]: s["attributes"] for s in items.get("included", []) if s["type"] == "Song"}
    songs = []
    for item in sorted(items["data"], key=lambda i: i["attributes"].get("sequence") or 0):
        a = item["attributes"]
        if a.get("item_type") != "song":
            continue
        rel = (item.get("relationships", {}).get("song") or {}).get("data") or {}
        song = songs_by_id.get(rel.get("id"), {})
        songs.append({"title": song.get("title") or a.get("title") or "", "key": a.get("key_name") or "", "author": song.get("author") or ""})

    members = pco(f"{base}/team_members", {"include": "team", "per_page": 100})
    team_names = {t["id"]: t["attributes"].get("name") or "" for t in members.get("included", []) if t["type"] == "Team"}
    teams = {}
    for m in members["data"]:
        a = m["attributes"]
        rel = (m.get("relationships", {}).get("team") or {}).get("data") or {}
        teams.setdefault(team_names.get(rel.get("id"), "Team"), []).append({
            "name": a.get("name") or "", "position": a.get("team_position_name") or "", "status": (a.get("status") or "")[:1],
        })

    return {
        "service": service_type,
        "title": attrs.get("title") or attrs.get("series_title") or "",
        "date": (service or (times[0] if times else None) or {"start": pco_local(attrs["sort_date"])})["start"][:10],
        "url": attrs.get("planning_center_url") or f"https://services.planningcenteronline.com/plans/{plan_id}",
        "times": times,
        "me": me_in_plan,
        "songs": songs,
        "teams": [{"name": k, "people": v} for k, v in teams.items()],
        "requests": requests,
    }


# ---------- Autocross ----------

def read_autocross(today):
    events = json.loads(fetch(AX_URL)).get("events", [])
    out = []
    for e in events:
        if e.get("booCancelled") or (e.get("dteEnd") or e.get("dteStart") or "") < today.isoformat():
            continue
        miles = "".join(ch for ch in (e.get("vchDistance") or "") if ch.isdigit())
        out.append({
            "name": e.get("vchEventName") or "",
            "club": e.get("vchClubName") or "",
            "start": e.get("dteStart"),
            "end": e.get("dteEnd"),
            "city": e.get("vchCity") or "",
            "region": e.get("vchRegion") or "",
            "miles": int(miles) if miles else None,
            "url": "https://www.motorsportreg.com" + (e.get("vchSlug") or "/calendar/"),
        })
    return sorted(out, key=lambda e: e["start"])


def main():
    out_path = Path(sys.argv[1] if len(sys.argv) > 1 else "data.json")
    old = json.loads(out_path.read_text()) if out_path.exists() else {}
    today = datetime.now(TZ).date()
    errors = {}

    events, rj_sessions, names = [], [], {}
    seen = set()
    for key, name, source in CALENDARS:
        start = today - timedelta(days=RJ_DAYS_BACK if key == "rj" else 1)
        try:
            found = read_calendar(source, start, today + timedelta(days=DAYS_AHEAD))
        except Exception as e:  # keep the other calendars going
            errors[key] = str(e)[:200]
            found = [e for e in old.get("events", []) if e.get("cal") == key]
            if key == "rj":
                rj_sessions = old.get("rjSessions", [])
        if found is None:
            continue
        names[key] = name
        for ev in found:
            if key == "rj" and "uid" in ev:
                ev["title"] = clean_rj_title(ev["title"])
                ev["location"] = ""
            if key == "rj" and not ev["allDay"] and "uid" in ev:
                ev_id = f"{ev['start'][:10]}-{hashlib.sha1((ev['uid'] + ev['start']).encode()).hexdigest()[:8]}"
                rj_sessions.append({"id": ev_id, "title": ev["title"], "start": ev["start"], "end": ev["end"]})
            if ev["start"][:10] < (today - timedelta(days=1)).isoformat():
                continue
            dup = (ev["title"].lower(), ev["start"])
            if dup in seen:
                continue
            seen.add(dup)
            ev.pop("uid", None)
            events.append({"cal": key, **ev})
    events.sort(key=lambda e: e["start"])
    rj_sessions.sort(key=lambda s: s["start"])

    try:
        crossing = read_crossing(today)
    except Exception as e:
        errors["crossing"] = str(e)[:200]
        crossing = old.get("crossing")

    autocross, checked = old.get("autocross", []), old.get("autocrossChecked")
    if checked != today.isoformat():
        try:
            autocross, checked = read_autocross(today), today.isoformat()
        except Exception as e:
            errors["autocross"] = str(e)[:200]

    data = {
        "calendars": names,
        "events": events,
        "rjSessions": rj_sessions,
        "crossing": crossing,
        "autocross": autocross,
        "autocrossChecked": checked,
        "errors": errors,
    }
    text = json.dumps(data, ensure_ascii=False, indent=0) + "\n"
    for key, message in errors.items():
        print(f"Problem with {key}: {message}")
    if out_path.exists() and out_path.read_text() == text:
        print("No changes.")
        return
    out_path.write_text(text)
    print(f"Wrote {len(events)} events, {len(rj_sessions)} RJ sessions, {len(autocross)} autocross events"
          f"{', The Crossing' if crossing else ''}.")


if __name__ == "__main__":
    sys.exit(main())
