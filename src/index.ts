// Hono
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { resolver } from "hono-openapi/valibot";
import * as v from "valibot";
import { rateLimiter } from "hono-rate-limiter";
import { nanoid } from "nanoid";

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

  // app.use(
  //   "/*",
  //   rateLimiter({
  //     windowMs: 15 * 60 * 1000, // 15 minutes
  //     limit: 1000, // limit each IP to 100 requests per windowMs
  //     standardHeaders: "draft-6", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  //     keyGenerator: (c) => nanoid(),
  //   })
  // );

  // app.use("/*", async (c, next) => {
  //   c.header("X-Content-Type-Options", "nosniff");
  //   c.header("X-Frame-Options", "DENY");
  //   c.header("X-XSS-Protection", "1; mode=block");
  //   c.header(
  //     "Strict-Transport-Security",
  //     "max-age=31536000; includeSubDomains"
  //   );
  //   await next();
  // });

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

  /**
   * Health check endpoint for Docker
   */
  app.get("/health", (c) => {
    return c.json({ status: "ok" }, 200);
  });

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
    port: 3001,
    fetch: app.fetch,
  };
};

const server = defineServer();

export default server;
