// Hono
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { resolver } from "hono-openapi/valibot";
import * as v from "valibot";

/**
 * OpenAPI Docs
 */
import { swaggerUI } from "@hono/swagger-ui";
import { describeRoute, openAPISpecs } from "hono-openapi";
import { defineCalendarRoutes } from "./routes/calendar";

export type HonoApp = Hono<{ Variables: {} }>;

/**
 * Init the main Hono app
 */
export const defineServer = () => {
  const app = new Hono<{ Variables: {} }>();
  app.use(logger());

  /**
   * Adds CORS Middleware
   */
  app.use(
    "/*",
    cors({
      origin: "*",
    })
  );

  /**
   * Ping endpoint
   */
  app.get(
    "/api/v1/ping",
    describeRoute({
      method: "get",
      path: "/ping",
      tags: ["admin"],
      summary: "Health check endpoint",
      responses: {
        200: {
          description: "Successful response",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  online: v.boolean(),
                  canConnectToInternet: v.boolean(),
                })
              ),
            },
          },
        },
      },
    }),

    (c) => c.json({ online: true })
  );

  // Calendar Routes
  defineCalendarRoutes(app);

  /**
   * OpenAPI docs
   */
  app.get(
    "/api/v1/openapi",
    openAPISpecs(app, {
      documentation: {
        info: {
          title: "Symbiosika Backend API",
          version: "1.0.0",
          description: "API for the Symbiosika AI Backend",
        },
      },
    })
  );
  app.get("/api/v1/ui", swaggerUI({ url: "/api/v1/openapi" }));

  return {
    idleTimeout: 255,
    port: 3000,
    fetch: app.fetch,
  };
};

const server = defineServer();

export default server;
