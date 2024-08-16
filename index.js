const fs = require('fs')
const readline = require('readline')
const { google } = require('googleapis')
const dateFns = require('date-fns')
const { exec } = require('child_process')
const path = require('path')

/*
  Note: This file was first created by ChatGPT and then modified by tbc
*/

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
const TOKEN_PATH = path.join(__dirname, 'token.json')
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json')
const APPLESCRIPT_TEMPLATE_PATH = path.join(__dirname, 'apple-script.template')
const OPTIONAL_CALENDAR_ID_PATH = path.join(__dirname, 'calendar.id')
const APPLESCRIPT_TEMPLATE = fs.readFileSync(APPLESCRIPT_TEMPLATE_PATH, 'utf-8')
const OPTIONAL_CALENDAR_ID = fs.existsSync(OPTIONAL_CALENDAR_ID_PATH) && fs.readFileSync(OPTIONAL_CALENDAR_ID_PATH, 'utf-8').trim()
const NEXT_MEETING_PATH = path.join(__dirname, 'next-meeting.scpt')

fs.readFile(CREDENTIALS_PATH, async (err, content) => {
  if (err) return console.log('Error loading client secret file:', err)
  authorize(JSON.parse(content), runForever)
})

function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback)
    oAuth2Client.setCredentials(JSON.parse(token))
    callback(oAuth2Client)
  })
}

function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  })
  console.log('Authorize this app by visiting this url:', authUrl)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close()
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err)
      oAuth2Client.setCredentials(token)

      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err)
        console.log('Token stored to', TOKEN_PATH)
      })
      callback(oAuth2Client)
    })
  })
}

let joinedMeetings = []

async function runForever (auth) {
  while (true) {
    try {
      lookForNextEventAndJoin(auth)
    } catch (err) {
      console.log(err)
    }
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}

async function lookForNextEventAndJoin (auth) {
  const calendar = google.calendar({ version: 'v3', auth })
  const { data: { items: [nextEvent] } } = await calendar.events.list({
    calendarId: OPTIONAL_CALENDAR_ID || 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 1,
    singleEvents: true,
    orderBy: 'startTime',
  })
  if (!nextEvent) return
  const startAsDate = dateFns.parseISO(nextEvent.start.dateTime || nextEvent.start.date)
  const endAsDate = dateFns.parseISO(nextEvent.end.dateTime || nextEvent.end.date)
  const secondsUntil = dateFns.differenceInSeconds(startAsDate, new Date())
  const meetingDurationInSeconds = dateFns.differenceInSeconds(endAsDate, startAsDate)
  const meetingUrl = nextEvent.conferenceData?.entryPoints[0]?.uri
  const meetingUniqueId = `${nextEvent.id}-${nextEvent.start.dateTime}`
  const meetingSummary = nextEvent.summary.replace(/[^\x00-\x7F]/g, '')
  const hasAlreadyJoinedMeeting = joinedMeetings.includes(meetingUniqueId)
  const shouldJoinMeeting = meetingUrl && !hasAlreadyJoinedMeeting && secondsUntil < 10
  if (shouldJoinMeeting) {
    joinedMeetings.push(meetingUniqueId)
    const script = APPLESCRIPT_TEMPLATE
      .replace('MEETING_URL', meetingUrl)
      .replace('MEETING_TIME_IN_SECONDS', meetingDurationInSeconds + secondsUntil)
      .replace('MEETING_SUMMARY', meetingSummary)
    fs.writeFileSync(NEXT_MEETING_PATH, script)
    exec(`osascript ${NEXT_MEETING_PATH}`, () => { /* noop */ })
    console.log(`[${new Date().toISOString()}] Joining ${nextEvent.summary} ${meetingUrl}`)
  }
}
