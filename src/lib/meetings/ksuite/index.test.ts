import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  type Mock,
} from "bun:test";
import KSuiteClient from "./index";

const client = new KSuiteClient();

describe("KSuiteClient", () => {
  test("should create a meeting room and add it to the calendar", async () => {
    expect(client).toBeDefined();

    const result = await client.bookMeeting({
      title: "Test Meeting",
      start: "2025-06-02T08:00:00Z",
      duration: 1,
    });

    expect(result.success).toBe(true);
  });
});
