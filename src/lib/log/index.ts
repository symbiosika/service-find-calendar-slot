import fs from "fs/promises";
import path from "path";

class Logger {
  private logFilePath: string;
  private maxFileSize: number = 1 * 1024 * 1024; // 1MB
  private maxFiles: number = 10;
  private writeDebugFiles: boolean;

  constructor() {
    this.logFilePath = path.join(process.cwd(), "logs", "app.log");
    this.writeDebugFiles = process.env.WRITE_DEBUG_FILES === "true";
    this.ensureLogDirectory();
  }

  /**
   * Ensure the log directory exists
   */
  private async ensureLogDirectory() {
    try {
      await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
    } catch (error: any) {
      if (error.code !== "EEXIST") {
        console.error("Error creating log directory:", error);
      }
    }
  }

  /**
   * Rotate the log files
   */
  private async rotateFiles() {
    for (let i = this.maxFiles - 1; i > 0; i--) {
      const oldPath = `${this.logFilePath}.${i}`;
      const newPath = `${this.logFilePath}.${i + 1}`;
      try {
        await fs.rename(oldPath, newPath);
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.error("Error rotating log files:", error);
        }
      }
    }
    try {
      await fs.rename(this.logFilePath, `${this.logFilePath}.1`);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.error("Error renaming log file:", error);
      }
    }
  }

  /**
   * Write to the log file
   */
  private async writeToFile(message: string) {
    if (this.writeDebugFiles) {
      try {
        const stats = await fs.stat(this.logFilePath);
        if (stats.size > this.maxFileSize) {
          await this.rotateFiles();
        }
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.error("Error checking log file size:", error);
        }
      }
      try {
        await fs.appendFile(this.logFilePath, message + "\n");
      } catch (error: any) {
        console.error("Error writing to log file:", error);
      }
    }
  }

  /**
   * Write to the custom log file
   */
  private async writeToCustomFile(fileName: string, message: string) {
    const filePath = path.join(process.cwd(), "logs", fileName);
    await fs.appendFile(filePath, message + "\n");
  }

  /**
   * Log a message
   */
  private async log(level: string, message: string) {
    const logMessage = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage);
    await this.writeToFile(logMessage);
  }

  /**
   * Log an info message
   */
  async info(...messages: (string | object | undefined | number)[]) {
    for (const message of messages) {
      if (typeof message === "object") {
        await this.log("info", JSON.stringify(message));
      } else {
        await this.log("info", message + "");
      }
    }
  }

  /**
   * Log an error message
   */
  async error(...messages: (string | object | undefined | number)[]) {
    for (const message of messages) {
      if (typeof message === "object") {
        await this.log("error", JSON.stringify(message));
      } else {
        await this.log("error", message + "");
      }
    }
  }

  /**
   * Log a debug message
   */
  async debug(...messages: (string | object | undefined | number)[]) {
    for (const message of messages) {
      if (typeof message === "object") {
        await this.log("debug", JSON.stringify(message));
      } else {
        await this.log("debug", message + "");
      }
    }
  }

  /**
   * Log a custom message
   */
  async logCustom(
    options: { name: string },
    ...messages: (string | object | undefined | number)[]
  ) {
    for (const message of messages) {
      let toLog = `[${new Date().toISOString()}] [${options.name}] `;
      if (typeof message === "object") {
        toLog += JSON.stringify(message);
      } else {
        toLog += message + "";
      }
      toLog += "\n";
      console.log(toLog);
      await this.writeToCustomFile("custom-" + options.name + ".log", toLog);
    }
  }

  /**
   * Get the content of a custom log file
   */
  async getCustomLogFileContent(name: string) {
    return fs.readFile(
      path.join(process.cwd(), "logs", "custom-" + name + ".log"),
      "utf8"
    );
  }

  /**
   * Get the paths of all log files
   */
  async getLogFilePaths(): Promise<string[]> {
    const logFiles: string[] = [];

    try {
      // Add main log file if it exists
      try {
        await fs.access(this.logFilePath);
        logFiles.push(this.logFilePath);
      } catch {}

      // Add rotated log files if they exist
      for (let i = 1; i <= this.maxFiles; i++) {
        const rotatedPath = `${this.logFilePath}.${i}`;
        try {
          await fs.access(rotatedPath);
          logFiles.push(rotatedPath);
        } catch {}
      }
    } catch (error) {
      console.error("Error getting log file paths:", error);
    }

    return logFiles;
  }
}

export default new Logger();
