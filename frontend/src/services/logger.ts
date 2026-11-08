import AsyncStorage from "@react-native-async-storage/async-storage";

export interface LogItem {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
}

class AppLogger {
  private logs: LogItem[] = [];
  private maxLogs = 100;

  async log(level: "INFO" | "WARN" | "ERROR", message: string) {
    const timestamp = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const entry: LogItem = { timestamp, level, message };
    
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Opcional: persite no storage para manter histórico recente
    try {
      await AsyncStorage.setItem("@goldcast_app_logs", JSON.stringify(this.logs.slice(0, 30)));
    } catch {}

    console.log(`[${level}] ${timestamp}: ${message}`);
  }

  info(msg: string) { this.log("INFO", msg); }
  warn(msg: string) { this.log("WARN", msg); }
  error(msg: string) { this.log("ERROR", msg); }

  async getLogs(): Promise<LogItem[]> {
    try {
      const stored = await AsyncStorage.getItem("@goldcast_app_logs");
      if (stored) return JSON.parse(stored);
    } catch {}
    return this.logs;
  }

  async clearLogs() {
    this.logs = [];
    await AsyncStorage.removeItem("@goldcast_app_logs");
  }
}

export const logger = new AppLogger();
