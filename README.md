# Rundown

David's dashboard: **https://www.davyrockett.com/rundown/**

Every app at the top, then the day at a glance: time, weather where you are, your calendars (Personal, Resounding Joy,
Davy Rockett gigs, David & RaeLynn), this Sunday at The Crossing (songs, keys, band), RJ sessions to document and
bill, next gigs, practice, Z4 to-dos and autocross events near San Diego.

## How it gets your calendars and Planning Center

Every hour, a job in `davyrockett/rundown-data` (public, but the link isn't shared) reads your calendars, Planning
Center and the autocross calendar and saves `data.json` there, which Rundown reads. Resounding Joy entries are saved
without client codes or addresses. Event notes are never copied.

The calendar links and the Planning Center token stay as GitHub secrets (they'd open your full calendars and The
Crossing's Planning Center to anyone). The job needs these secrets (rundown-data on GitHub → Settings → Secrets and variables → Actions):

| Secret | What to paste |
| --- | --- |
| `CAL_PERSONAL` | Google Calendar → Personal → Settings → Integrate calendar → **Secret address in iCal format** |
| `CAL_US` | Same, for the David and RaeLynn calendar |
| `CAL_RJ` | The link you used to add the Resounding Joy calendar ("Calendar") to Google |
| `PCO_APP_ID`, `PCO_SECRET` | api.planningcenteronline.com/oauth/applications → Personal Access Tokens → new token |

To save RJ ticks across devices, your access key also needs **rundown-data** added
(github.com/settings/personal-access-tokens → your key → Repository access), with Contents read and write.

## Testing on the Mac

Double-click `Start Rundown.command`.
