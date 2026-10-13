import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_LOG_URL = "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/report-error";

export async function reportError(
  screen: string,
  error: any,
  additionalContext?: string
) {
  try {
    const mac = (await AsyncStorage.getItem("@goldcast_device_mac")) || "SEM_MAC";
    const constants = (Platform.constants || {}) as any;
    const deviceModel = `${constants.Manufacturer || ""} ${constants.Model || ""}`.trim() || Platform.OS;

    const errorMessage = typeof error === "string" ? error : error?.message || "Erro desconhecido";
    const stackTrace = error?.stack ? String(error.stack) : additionalContext || null;

    // Dispara o envio silenciosamente em segundo plano (sem travar a interface do app)
    fetch(SUPABASE_LOG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mac,
        screen,
        error_message: errorMessage,
        stack_trace: stackTrace,
        device_model: deviceModel,
        app_version: "1.1.0",
      }),
    }).catch(() => {
      // Ignora silenciosamente se o dispositivo estiver sem internet
    });
  } catch {
    // Falha silenciosa para não interferir na usabilidade
  }
}
