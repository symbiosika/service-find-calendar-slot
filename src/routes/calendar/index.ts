import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/valibot";
import * as v from "valibot";
import {
  getAvailableSlotsForDay,
  testCalDAVConnection,
} from "../../lib/calendar";
import type { HonoApp } from "../../index";

export function defineCalendarRoutes(app: HonoApp) {
  // Test CalDAV connection
  app.get(
    "/calendar/test-connection",
    describeRoute({
      method: "get",
      path: "/calendar/test-connection",
      tags: ["calendar"],
      summary: "Test CalDAV connection",
      responses: {
        200: {
          description: "Connection successful",
          content: {
            "application/json": {
              schema: v.object({
                status: v.string(),
                message: v.string(),
              }),
            },
          },
        },
        400: {
          description: "Connection failed",
          content: {
            "application/json": {
              schema: v.object({
                status: v.string(),
                error: v.string(),
              }),
            },
          },
        },
      },
    }),
    async (c) => {
      try {
        await testCalDAVConnection();
        return c.json({
          status: "success",
          message: "CalDAV connection successful",
        });
      } catch (error) {
        console.error("CalDAV connection test failed:", error);
        return c.json(
          {
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          },
          400
        );
      }
    }
  );

  // Get available slots for a specific day
  app.get(
    "/calendar/slots/:date",
    describeRoute({
      method: "get",
      path: "/calendar/slots/:date",
      tags: ["calendar"],
      summary: "Get available slots for a specific day",
      responses: {
        200: {
          description: "Successful response",
          content: {
            "application/json": {
              schema: v.array(
                v.object({
                  start: v.string(),
                  end: v.string(),
                })
              ),
            },
          },
        },
        400: {
          description: "Error response",
          content: {
            "application/json": {
              schema: v.object({
                error: v.string(),
              }),
            },
          },
        },
      },
    }),
    validator(
      "param",
      v.object({
        date: v.string("Date parameter is required"),
      })
    ),
    validator(
      "query",
      v.object({
        slotLength: v.optional(v.string()),
      })
    ),
    async (c) => {
      try {
        const { date } = c.req.valid("param");
        let { slotLength } = c.req.valid("query");

        // Convert slotLength to number if provided as string
        if (slotLength == undefined) {
          slotLength = "1";
        }
        const slotLengthNum = Number(slotLength);

        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return c.json({ error: "Invalid date format. Use YYYY-MM-DD." }, 400);
        }

        // Parse the date string to a Date object
        const dateObj = new Date(date);

        // Check if the date is valid
        if (isNaN(dateObj.getTime())) {
          return c.json(
            { error: "Invalid date. Please provide a valid date." },
            400
          );
        }

        // Get available slots for the specified day
        try {
          const availableSlots = await getAvailableSlotsForDay(
            dateObj,
            slotLengthNum
          );
          return c.json(availableSlots);
        } catch (error) {
          console.error("Error getting available slots:", error);
          return c.json(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            400
          );
        }
      } catch (e) {
        console.error("Calendar slots route error:", e);
        return c.json(
          {
            error: e instanceof Error ? e.message : String(e),
          },
          400
        );
      }
    }
  );
}
