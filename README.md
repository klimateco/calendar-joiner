# calendar-joiner

App that will look through a calendar and automatically join those video conference meetings.

Used to automatically join certain events from a screeen in kiosk mode.

## How to set up

To get it up and running it requires a project/app set up in Google Cloud, and then the app needs to get access to your account.

Optionally you can give it access to another calendar your account also have access to (like a room/project/etc).

### 1. Create app in Google Cloud

1. First create a Project in Google Cloud
2. When asked for scope, set `https://www.googleapis.com/auth/calendar.readonly`
3. Have that project use Google Calendar API
4. Generate `oauth` credentials
5. Download and save as `credentials.json` in this folder

### 2. Get access token

1. Run this `node index.js`
2. Open the logged url
3. Give access to your account
4. In the url opened there's a `...&code=foobarbaz&blehle`, copy the `foobarbaz` part and paste in

### (optional) 3. Set specific calendar

If you want to use a specific, e.g. a room/projector/etc, then find the email of it in your Google Admin. It will look like `c_a92834798hdfjkdf3849@resource.calendar.google.com`. Store this in a file called `calendar.id` in this folder.
