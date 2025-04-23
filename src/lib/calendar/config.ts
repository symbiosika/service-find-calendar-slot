// src/lib/calendar/config.ts

import log from "../log";

interface CalendarConfig {
  CALENDAR_AVAILABLE_MON: string;
  CALENDAR_AVAILABLE_TUE: string;
  CALENDAR_AVAILABLE_WED: string;
  CALENDAR_AVAILABLE_THU: string;
  CALENDAR_AVAILABLE_FRI: string;
  CALENDAR_AVAILABLE_SAT: string;
  CALENDAR_AVAILABLE_SUN: string;
  CALENDAR_CALDAV_USER: string;
  CALENDAR_CALDAV_PASSWORD: string;
  CALENDAR_CALDAV_URL: string;
  CALENDAR_CALDAV_CALENDARNAME: string;
  CALENDAR_SLOTS_LENGTH: string;
}

// Get calendar configuration from environment variables
export function getEnvConfig(): CalendarConfig {
  const config = {
    CALENDAR_AVAILABLE_MON: process.env.CALENDAR_AVAILABLE_MON || "",
    CALENDAR_AVAILABLE_TUE: process.env.CALENDAR_AVAILABLE_TUE || "",
    CALENDAR_AVAILABLE_WED: process.env.CALENDAR_AVAILABLE_WED || "",
    CALENDAR_AVAILABLE_THU: process.env.CALENDAR_AVAILABLE_THU || "",
    CALENDAR_AVAILABLE_FRI: process.env.CALENDAR_AVAILABLE_FRI || "",
    CALENDAR_AVAILABLE_SAT: process.env.CALENDAR_AVAILABLE_SAT || "",
    CALENDAR_AVAILABLE_SUN: process.env.CALENDAR_AVAILABLE_SUN || "",
    CALENDAR_CALDAV_USER: process.env.CALENDAR_CALDAV_USER || "",
    CALENDAR_CALDAV_PASSWORD: process.env.CALENDAR_CALDAV_PASSWORD || "",
    CALENDAR_CALDAV_URL: process.env.CALENDAR_CALDAV_URL || "",
    CALENDAR_CALDAV_CALENDARNAME:
      process.env.CALENDAR_CALDAV_CALENDARNAME || "",
    CALENDAR_SLOTS_LENGTH: process.env.CALENDAR_SLOTS_LENGTH || "1",
  };

  // Log connection details for debugging (mask password)
  const debugConfig = { ...config };
  if (debugConfig.CALENDAR_CALDAV_PASSWORD) {
    debugConfig.CALENDAR_CALDAV_PASSWORD = "***MASKED***";
  }
  log.info("Calendar configuration:", {
    url: debugConfig.CALENDAR_CALDAV_URL,
    username: debugConfig.CALENDAR_CALDAV_USER,
    calendarName: debugConfig.CALENDAR_CALDAV_CALENDARNAME,
  });

  return config;
}
