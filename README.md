# Rundown

David's dashboard: **https://www.davyrockett.com/rundown/**

Every app at the top, then the day at a glance: time, weather where you are, your calendars (Personal, Resounding Joy,
Davy Rockett gigs, David & RaeLynn), this Sunday at The Crossing (songs, keys, band), RJ sessions to document and
bill, next gigs, practice, Z4 to-dos and autocross events near San Diego.

## How it gets your calendars and Planning Center

Your calendars and Planning Center are private, so they never go in this public repo. Every hour, a job in the
**private** repo `davyrockett/rundown-data` reads them and saves `data.json` there. Rundown reads that file with your
access key (the same key as your other apps).

The job needs these secrets (rundown-data on GitHub → Settings → Secrets and variables → Actions):

| Secret | What to paste |
| --- | --- |
| `CAL_PERSONAL` | Google Calendar → Personal → Settings → Integrate calendar → **Secret address in iCal format** |
| `CAL_US` | Same, for the David and RaeLynn calendar |
| `CAL_RJ` | The link you used to add the Resounding Joy calendar ("Calendar") to Google |
| `PCO_APP_ID`, `PCO_SECRET` | api.planningcenteronline.com/oauth/applications → Personal Access Tokens → new token |

Your access key also needs **rundown-data** added (github.com/settings/personal-access-tokens → your key →
Repository access), with Contents read and write so RJ ticks can be saved.

## Testing on the Mac

Double-click `Start Rundown.command`.
