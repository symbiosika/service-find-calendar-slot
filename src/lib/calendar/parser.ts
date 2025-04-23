import { parseICS as parseICalString } from "ical";

interface CalendarEvent {
  start?: Date;
  end?: Date;
  summary?: string;
}

// Parse ICS data to extract event details
export function parseICS(icsData: string): CalendarEvent {
  try {
    // Handle cases where the ICS data might be truncated or incomplete
    if (
      !icsData ||
      !icsData.includes("BEGIN:VEVENT") ||
      !icsData.includes("END:VEVENT")
    ) {
      console.warn(
        "Invalid or incomplete ICS data:",
        icsData.substring(0, 100) + "..."
      );
      return {};
    }

    console.log("Parsing ICS data...");
    let parsedData;

    try {
      parsedData = parseICalString(icsData);
      console.log("Successfully parsed ICS data:", Object.keys(parsedData));
    } catch (parseError) {
      console.error("Error in ical.parseICS:", parseError);

      // Attempt manual extraction if parsing fails
      console.log("Attempting manual extraction of event data...");
      return manualExtractEventData(icsData);
    }

    // Find the first VEVENT in the calendar data
    const firstEventKey = Object.keys(parsedData).find(
      (key) => parsedData[key].type === "VEVENT"
    );

    if (!firstEventKey) {
      console.warn("No VEVENT found in ICS data, trying manual extraction");
      return manualExtractEventData(icsData);
    }

    const event = parsedData[firstEventKey];

    // Validate that we have actual start and end dates
    if (!event.start || !event.end) {
      console.warn("Missing start or end time in event:", event);
      return manualExtractEventData(icsData);
    }

    console.log("Successfully extracted event data:", {
      start: event.start,
      end: event.end,
      summary: event.summary,
    });

    return {
      start: event.start,
      end: event.end,
      summary: event.summary,
    };
  } catch (error) {
    console.error("Error parsing ICS data:", error);
    console.debug("ICS data excerpt:", icsData.substring(0, 150) + "...");
    return manualExtractEventData(icsData);
  }
}

// Manual extraction of event data from ICS string when the parser fails
function manualExtractEventData(icsData: string): CalendarEvent {
  console.log("Starting manual extraction of ICS data");

  try {
    // Extract DTSTART
    let startDate: Date | undefined;
    const dtStartMatch = icsData.match(
      /DTSTART(?:;TZID=[^:]+)?:(.*?)(?:\r?\n)/
    );
    if (dtStartMatch && dtStartMatch[1]) {
      console.log("Found DTSTART:", dtStartMatch[1]);
      startDate = parseICalDate(dtStartMatch[1]);
    }

    // Extract DTEND
    let endDate: Date | undefined;
    const dtEndMatch = icsData.match(/DTEND(?:;TZID=[^:]+)?:(.*?)(?:\r?\n)/);
    if (dtEndMatch && dtEndMatch[1]) {
      console.log("Found DTEND:", dtEndMatch[1]);
      endDate = parseICalDate(dtEndMatch[1]);
    }

    // Extract SUMMARY
    let summary: string | undefined;
    const summaryMatch = icsData.match(/SUMMARY:(.*?)(?:\r?\n)/);
    if (summaryMatch && summaryMatch[1]) {
      summary = summaryMatch[1];
    }

    console.log("Manual extraction results:", { startDate, endDate, summary });

    return {
      start: startDate,
      end: endDate,
      summary,
    };
  } catch (error) {
    console.error("Error in manual ICS extraction:", error);
    return {};
  }
}

// Parse iCal date format
function parseICalDate(dateStr: string): Date | undefined {
  try {
    // Handle basic format: 20230915T143000Z
    if (/^\d{8}T\d{6}Z$/.test(dateStr)) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Months are 0-based in JS
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(dateStr.substring(9, 11));
      const minute = parseInt(dateStr.substring(11, 13));
      const second = parseInt(dateStr.substring(13, 15));

      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }

    // Handle format without Z (local time): 20230915T143000
    if (/^\d{8}T\d{6}$/.test(dateStr)) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(dateStr.substring(9, 11));
      const minute = parseInt(dateStr.substring(11, 13));
      const second = parseInt(dateStr.substring(13, 15));

      return new Date(year, month, day, hour, minute, second);
    }

    // Handle ISO format: 2023-09-15T14:30:00Z
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(dateStr)) {
      return new Date(dateStr);
    }

    console.warn("Unrecognized date format:", dateStr);
    return undefined;
  } catch (error) {
    console.error("Error parsing iCal date:", error, dateStr);
    return undefined;
  }
}
