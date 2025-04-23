import { getAvailableSlotsForDay } from "../../calendar";
import log from "../../log";
import { createCalendarEvent } from "../../calendar/create-event";
import type { EventParams } from "../../calendar/create-event";

export interface MeetingParams {
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  participantEmails?: string[];
}

export interface CreateRoomResponse {
  result: {
    id: string;
    name: string;
    url: string;
    start_at: string;
    end_at: string;
    room_id: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

export class KSuiteClient {
  private config: {
    apiToken: string;
    apiEndpoint: string;
    calendarId: string;
    hostname?: string;
  };

  constructor() {
    this.config = {
      apiToken: process.env.KSUITE_API_TOKEN || "",
      apiEndpoint: "https://api.infomaniak.com",
      calendarId: process.env.KSUITE_CALENDAR_ID || "",
    };
  }

  /**
   * Make an API request to kSuite API
   */
  private async apiRequest<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.config.apiEndpoint}${path}`;

    const headers: HeadersInit = {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      log.info(`Making ${method} request to ${path}`);
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        log.error(`API error: ${response.status} ${errorText}`);
        throw new Error(`API error: ${response.status} ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      log.error("Error making API request:", error + "");
      throw new Error(
        `API request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Creates a new meeting room using kMeet API
   */
  async createMeetingRoom(
    name: string,
    startAt: string,
    endAt: string,
    options: {
      description?: string;
      passwordProtected?: boolean;
      password?: string;
    } = {}
  ): Promise<CreateRoomResponse> {
    // Convert ISO dates to Y-m-d H:i:s format
    const formatDate = (isoDate: string) => {
      const date = new Date(isoDate);
      return date.toISOString().replace("T", " ").replace(".000Z", "");
    };

    const payload = {
      starting_at: formatDate(startAt),
      ending_at: formatDate(endAt),
      timezone: "Europe/Berlin",
      hostname: "meet.infomaniak.com",
      options: {
        subject: name,
        start_audio_muted: false,
        enable_recording: false,
        enable_moderator_video: true,
        start_audio_only: false,
        lobby_enabled: false,
        password_enabled: options.passwordProtected || false,
        e2ee_enabled: false,
      },
      description: options.description || "",
      password_protected: options.passwordProtected || false,
      password: options.password || "",
      calendar_id: this.config.calendarId,
    };

    log.info(
      "Creating meeting room with payload:",
      JSON.stringify(payload, null, 2)
    );

    return await this.apiRequest<CreateRoomResponse>(
      "POST",
      "/1/kmeet/rooms",
      payload
    );
  }

  /**
   * Create calendar event for a meeting
   */
  async createCalendarEvent(meetingData: MeetingParams): Promise<string> {
    const eventParams: EventParams = {
      title: meetingData.title,
      startTime: meetingData.startTime,
      endTime: meetingData.endTime,
      description: meetingData.description || "",
      participantEmails: meetingData.participantEmails,
    };

    return await createCalendarEvent(eventParams);
  }

  /**
   * Book a meeting - creates a kMeet room and adds event to calendar
   */
  async bookMeeting(params: {
    title: string;
    start: string; // date and time in ISO format
    duration: number; // in hours
    description?: string;
    participants?: string[];
  }): Promise<{
    success: boolean;
    meetingUrl?: string;
    meetingId?: string;
    error?: string;
  }> {
    try {
      const startTime = new Date(params.start);
      if (isNaN(startTime.getTime())) {
        return {
          success: false,
          error: "Invalid start time",
        };
      }

      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + params.duration);

      const availableSlots = await getAvailableSlotsForDay(
        startTime,
        params.duration
      );

      // Check if the requested time slot is available
      const isSlotAvailable = availableSlots.some((slot) => {
        const slotDuration =
          new Date(slot.end).getTime() - new Date(slot.start).getTime();
        const requestedDuration = Math.round(params.duration * 60 * 60 * 1000);

        return (
          slot.start === startTime.toISOString() &&
          slotDuration === requestedDuration
        );
      });

      if (!isSlotAvailable) {
        return {
          success: false,
          error: "The requested time slot is no longer available",
        };
      }

      // check if the start day is the same as the end day
      if (
        startTime.toISOString().split("T")[0] !==
        endTime.toISOString().split("T")[0]
      ) {
        return {
          success: false,
          error: "The start date and end date are not the same",
        };
      }

      // Create meeting room
      log.info("Creating meeting room with params:", {
        title: params.title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        description: params.description,
      });

      const meetingResponse = await this.createMeetingRoom(
        params.title,
        startTime.toISOString(),
        endTime.toISOString(),
        {
          description: params.description,
        }
      );

      if (meetingResponse.error) {
        return {
          success: false,
          error: `Failed to create meeting room: ${meetingResponse.error.message}`,
        };
      }

      // Create calendar event
      const meetingParams: MeetingParams = {
        title: params.title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        description: params.description || "",
        participantEmails: params.participants,
      };

      await this.createCalendarEvent(meetingParams);

      return {
        success: true,
        meetingUrl: meetingResponse.result.url,
        meetingId: meetingResponse.result.id,
      };
    } catch (error) {
      log.error("Error booking meeting:", error + "");
      return {
        success: false,
        error: `Failed to book meeting: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export default KSuiteClient;
