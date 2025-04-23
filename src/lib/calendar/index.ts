import type { DAVCalendarObject } from "tsdav";
import { parseICS } from "./parser";
import { getEnvConfig } from "./config";
import { createDAVClient, fetchCalendarObjects } from "tsdav";
import log from "../log";

// Type for day keys
type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

// Get calendar configuration from environment variables
export async function getCalendarConfig() {
  const config = getEnvConfig();
  return {
    url: config.CALENDAR_CALDAV_URL,
    username: config.CALENDAR_CALDAV_USER,
    password: config.CALENDAR_CALDAV_PASSWORD,
    calendarName: config.CALENDAR_CALDAV_CALENDARNAME,
    availableSlots: {
      MON: parseTimeRanges(config.CALENDAR_AVAILABLE_MON),
      TUE: parseTimeRanges(config.CALENDAR_AVAILABLE_TUE),
      WED: parseTimeRanges(config.CALENDAR_AVAILABLE_WED),
      THU: parseTimeRanges(config.CALENDAR_AVAILABLE_THU),
      FRI: parseTimeRanges(config.CALENDAR_AVAILABLE_FRI),
      SAT: parseTimeRanges(config.CALENDAR_AVAILABLE_SAT),
      SUN: parseTimeRanges(config.CALENDAR_AVAILABLE_SUN),
    },
    slotLengths: parseSlotLengths(config.CALENDAR_SLOTS_LENGTH),
  };
}

// Print calendar configuration to console
export async function printCalendarConfig() {
  const config = await getCalendarConfig();

  log.info("\n=== CALENDAR CONFIGURATION ===");
  log.info(`CalDAV URL: ${config.url}`);
  log.info(`CalDAV Username: ${config.username}`);
  log.info(`CalDAV Password: ${"*".repeat(config.password.length)}`);
  log.info(`Calendar Name: ${config.calendarName}`);
  log.info("\nAvailable Time Slots:");
  log.info(`Monday: ${formatTimeRanges(config.availableSlots.MON)}`);
  log.info(`Tuesday: ${formatTimeRanges(config.availableSlots.TUE)}`);
  log.info(`Wednesday: ${formatTimeRanges(config.availableSlots.WED)}`);
  log.info(`Thursday: ${formatTimeRanges(config.availableSlots.THU)}`);
  log.info(`Friday: ${formatTimeRanges(config.availableSlots.FRI)}`);
  log.info(`Saturday: ${formatTimeRanges(config.availableSlots.SAT)}`);
  log.info(`Sunday: ${formatTimeRanges(config.availableSlots.SUN)}`);
  log.info(`\nSlot Lengths (hours): ${config.slotLengths.join(", ")}`);
  log.info("===============================\n");

  // Test connection to CalDAV server
  try {
    await testCalDAVConnection();
    log.info("✅ CalDAV connection test passed");
  } catch (error) {
    console.error("❌ CalDAV connection test failed:", error);
  }
}

// Test the connection to the CalDAV server
export async function testCalDAVConnection(): Promise<boolean> {
  const config = await getCalendarConfig();

  try {
    log.info("Testing CalDAV connection...");
    const { createDAVClient } = await import("tsdav");

    const client = await createDAVClient({
      serverUrl: config.url,
      credentials: {
        username: config.username,
        password: config.password,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    log.info("Client created, attempting to fetch calendars...");
    const calendars = await client.fetchCalendars();

    log.info(`Found ${calendars.length} calendars:`);
    calendars.forEach((cal, i) => {
      log.info(`  ${i + 1}. ${cal.displayName || "Unnamed"} (${cal.url})`);
    });

    return true;
  } catch (error) {
    console.error("CalDAV connection error:", error);
    throw new Error(
      `CalDAV connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Format time ranges for display
function formatTimeRanges(ranges: { start: number; end: number }[]): string {
  if (!ranges || ranges.length === 0) return "Not available";

  return ranges.map((range) => `${range.start}:00-${range.end}:00`).join(", ");
}

// Parse time ranges like "8-10,14-17" into structured objects
function parseTimeRanges(
  rangeString: string
): { start: number; end: number }[] {
  if (!rangeString) return [];

  return rangeString.split(",").map((range) => {
    const [start, end] = range.split("-").map(Number);
    return { start, end };
  });
}

// Parse slot lengths like "0.5,1" into array of hours
function parseSlotLengths(lengthString: string): number[] {
  if (!lengthString) return [1]; // Default to 1-hour slots

  return lengthString.split(",").map(Number);
}

// Fetch calendar events for a specific day
export async function fetchCalendarEventsForDay(
  date: Date
): Promise<DAVCalendarObject[]> {
  const config = await getCalendarConfig();

  // Create start and end date for the requested day (full day)
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  try {
    log.info(
      `Fetching calendar events for ${date.toISOString().split("T")[0]}`
    );

    // Create a DAV client
    const client = await createDAVClient({
      serverUrl: config.url,
      credentials: {
        username: config.username,
        password: config.password,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    // Fetch calendars
    const calendars = await client.fetchCalendars();
    log.info(`Found ${calendars.length} calendars`);

    // Find the calendar with matching name or use the first one
    const calendar =
      calendars.find((cal) => cal.displayName === config.calendarName) ||
      calendars[0];

    if (!calendar) {
      throw new Error("No calendar found");
    }

    log.info(
      `Using calendar: ${calendar.displayName || "Unnamed"} (${calendar.url})`
    );

    // Prepare auth headers
    const baseAuth = `${config.username}:${config.password}`;
    const base64Auth = Buffer.from(baseAuth).toString("base64");

    // First try fetching with time range
    try {
      const calendarObjects = await fetchCalendarObjects({
        calendar,
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        headers: {
          authorization: `Basic ${base64Auth}`,
        },
      });

      log.info(`Found ${calendarObjects.length} events with timeRange query`);

      if (calendarObjects.length > 0) {
        return calendarObjects;
      }
    } catch (timeRangeError) {
      console.warn(
        "Time range query failed, falling back to regular query:",
        timeRangeError
      );
    }

    // Fallback: fetch all objects if time range query fails or returns no results
    const allCalendarObjects = await fetchCalendarObjects({
      calendar,
      headers: {
        authorization: `Basic ${base64Auth}`,
      },
    });

    log.info(
      `Found ${allCalendarObjects.length} events with full calendar query`
    );
    return allCalendarObjects;
  } catch (error: unknown) {
    console.error("Error fetching calendar events:", error);
    // Throw more specific error with original error message for better UI feedback
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch calendar events: ${errorMessage}`);
  }
}

// Get available time slots for a specific day based on calendar events and configuration
export async function getAvailableSlotsForDay(
  date: Date,
  slotLength: number
): Promise<{ start: string; end: string }[]> {
  try {
    const config = await getCalendarConfig();

    // Check if requested slot length is valid
    if (!config.slotLengths.includes(slotLength)) {
      throw new Error(
        `Invalid slot length. Allowed values: ${config.slotLengths.join(", ")}`
      );
    }

    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = date.getDay();
    const dayMap = [
      "SUN",
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
    ] as DayKey[];
    const dayKey = dayMap[dayOfWeek];

    // Get available time ranges for the day
    const availableRanges = config.availableSlots[dayKey];

    // If no availability configured for this day, return empty array
    if (!availableRanges || availableRanges.length === 0) {
      return [];
    }

    // Fetch calendar events for the day
    try {
      const events = await fetchCalendarEventsForDay(date);

      // Parse events to get busy slots
      const busySlots = parseEventsToTimeRanges(events, date);

      // Generate available slots based on configuration and busy times
      return generateAvailableSlots(
        date,
        availableRanges,
        busySlots,
        slotLength
      );
    } catch (error: unknown) {
      console.error("Error in calendar event fetching:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Calendar error: ${errorMessage}`);
    }
  } catch (error: unknown) {
    console.error("Error getting available slots:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get available slots: ${errorMessage}`);
  }
}

// Parse calendar events into time ranges
function parseEventsToTimeRanges(
  events: DAVCalendarObject[],
  date: Date
): { start: Date; end: Date }[] {
  const busySlots = [];
  log.info(
    `Processing ${events.length} events for date: ${date.toISOString()}`
  );

  for (const event of events) {
    try {
      if (event.data) {
        log.info(`Event data available, length: ${event.data.length}`);
        log.info(`Event data excerpt: ${event.data.substring(0, 100)}...`);

        const eventData = parseICS(event.data);
        log.info(`Parsed event data:`, eventData);

        // Add event start/end times to busy slots if valid
        if (eventData.start && eventData.end) {
          log.info(
            `Event has valid start/end times: ${eventData.start} to ${eventData.end}`
          );

          // Only include events that overlap with the target date
          const eventStart = new Date(eventData.start);
          const eventEnd = new Date(eventData.end);
          log.info(
            `Event start: ${eventStart.toISOString()}, end: ${eventEnd.toISOString()}`
          );

          // Create date boundaries for the given date (00:00 to 23:59:59)
          const dateStart = new Date(date);
          dateStart.setHours(0, 0, 0, 0);

          const dateEnd = new Date(date);
          dateEnd.setHours(23, 59, 59, 999);
          log.info(
            `Date boundaries: ${dateStart.toISOString()} to ${dateEnd.toISOString()}`
          );

          // Check if event overlaps with the target date
          const startOnDate = eventStart >= dateStart && eventStart <= dateEnd;
          const endOnDate = eventEnd >= dateStart && eventEnd <= dateEnd;
          const spansDate = eventStart <= dateStart && eventEnd >= dateEnd;

          log.info(
            `Overlap checks: startOnDate=${startOnDate}, endOnDate=${endOnDate}, spansDate=${spansDate}`
          );

          if (startOnDate || endOnDate || spansDate) {
            log.info(`Event overlaps with target date, adding to busy slots`);
            busySlots.push({
              start: eventStart,
              end: eventEnd,
            });
          } else {
            log.info(`Event does not overlap with target date, skipping`);
          }
        } else {
          log.info(`Event missing start or end time:`, eventData);
        }
      } else {
        log.info(`Event has no data property`);
      }
    } catch (error) {
      console.error("Error processing calendar event:", error);
      // Continue processing other events even if one fails
    }
  }

  log.info(`Returning ${busySlots.length} busy slots`);
  return busySlots;
}

// Generate available time slots based on available ranges and busy times
function generateAvailableSlots(
  date: Date,
  availableRanges: { start: number; end: number }[],
  busySlots: { start: Date; end: Date }[],
  slotLengthHours: number
): { start: string; end: string }[] {
  const availableSlots = [];
  const slotLengthMs = slotLengthHours * 60 * 60 * 1000;

  // Process each available range for the day
  for (const range of availableRanges) {
    // Create start and end times for this range
    const rangeStart = new Date(date);
    rangeStart.setHours(range.start, 0, 0, 0);

    const rangeEnd = new Date(date);
    rangeEnd.setHours(range.end, 0, 0, 0);

    // Generate potential slots within this range
    let currentSlotStart = new Date(rangeStart);

    while (currentSlotStart.getTime() + slotLengthMs <= rangeEnd.getTime()) {
      const currentSlotEnd = new Date(
        currentSlotStart.getTime() + slotLengthMs
      );

      // Check if slot overlaps with any busy time
      const isOverlapping = busySlots.some((busySlot) => {
        return (
          (currentSlotStart >= busySlot.start &&
            currentSlotStart < busySlot.end) ||
          (currentSlotEnd > busySlot.start && currentSlotEnd <= busySlot.end) ||
          (currentSlotStart <= busySlot.start && currentSlotEnd >= busySlot.end)
        );
      });

      // If not overlapping, add to available slots
      if (!isOverlapping) {
        availableSlots.push({
          start: currentSlotStart.toISOString(),
          end: currentSlotEnd.toISOString(),
        });
      }

      // Move to next potential slot (30-minute increments)
      currentSlotStart = new Date(currentSlotStart.getTime() + 30 * 60 * 1000);
    }
  }

  return availableSlots;
}
