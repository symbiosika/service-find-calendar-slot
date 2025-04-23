import { createDAVClient } from "tsdav";
import log from "../log";
import { getEnvConfig } from "./config";

export interface EventParams {
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  participantEmails?: string[];
}

/**
 * Generate ICS content for a calendar event
 */
export function generateICSContent(event: EventParams): string {
  const now =
    new Date().toISOString().replace(/[-:.]/g, "").split("T")[0] +
    "T" +
    new Date().toISOString().split("T")[1].replace(/[-:.]/g, "").split(".")[0] +
    "Z";

  const startDate =
    new Date(event.startTime)
      .toISOString()
      .replace(/[-:.]/g, "")
      .split("T")[0] +
    "T" +
    new Date(event.startTime)
      .toISOString()
      .split("T")[1]
      .replace(/[-:.]/g, "")
      .split(".")[0] +
    "Z";

  const endDate =
    new Date(event.endTime).toISOString().replace(/[-:.]/g, "").split("T")[0] +
    "T" +
    new Date(event.endTime)
      .toISOString()
      .split("T")[1]
      .replace(/[-:.]/g, "")
      .split(".")[0] +
    "Z";

  const uid = `event-${Date.now()}@calendar.service`;
  const attendees =
    event.participantEmails
      ?.map(
        (email) =>
          `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:${email}`
      )
      .join("\r\n") || "";

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Calendar Service//Meeting//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
DTSTART:${startDate}
DTEND:${endDate}
DTSTAMP:${now}
ORGANIZER:mailto:no-reply@calendar.service
UID:${uid}
CREATED:${now}
DESCRIPTION:${event.description || ""}
LAST-MODIFIED:${now}
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:${event.title}
TRANSP:OPAQUE
${attendees}
END:VEVENT
END:VCALENDAR`;
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(
  eventData: EventParams,
  calendarName?: string
): Promise<string> {
  // Generate ICS content for the event
  const icsContent = generateICSContent(eventData);

  // Use CalDAV to create the event
  try {
    // Get calendar configuration from existing module
    const config = getEnvConfig();

    // Create DAV client
    const client = await createDAVClient({
      serverUrl: config.CALENDAR_CALDAV_URL,
      credentials: {
        username: config.CALENDAR_CALDAV_USER,
        password: config.CALENDAR_CALDAV_PASSWORD,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    // Fetch calendars
    const calendars = await client.fetchCalendars();

    // Find the calendar with matching name or use the first one
    const targetCalendarName =
      calendarName || config.CALENDAR_CALDAV_CALENDARNAME;
    const calendar =
      calendars.find((cal) => cal.displayName === targetCalendarName) ||
      calendars[0];

    if (!calendar) {
      throw new Error("No calendar found");
    }

    // Create the event
    const eventUid = `calendar-event-${Date.now()}`;

    await client.createCalendarObject({
      calendar,
      iCalString: icsContent,
      filename: `${eventUid}.ics`,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
      },
    });

    return eventUid;
  } catch (error) {
    log.error("Error creating calendar event:", error + "");
    throw new Error(
      `Failed to create calendar event: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
