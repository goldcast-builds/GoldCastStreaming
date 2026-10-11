import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

// Credenciais configuradas no seu Supabase
const SUPABASE_URL = "https://lljsnoovwwexzebzbaal.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NYNyvl3svSrRKskmUfDJGQ_Iq3PCOTt";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface DeviceData {
  mac: string;
  deviceKey: string;
}

export default function TrialScreen({ onLoginSuccess, onOpenManualLogin }: any) {
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);

  useEffect(() => {
    async function loadDevice() {
      let rawId = "000000000000";
      if (Platform.OS === "android") {
        rawId = Application.getAndroidId() || "000000000000";
      }

      // Formatação no modelo de endereço MAC
      const clean = (rawId.replace(/[^a-zA-Z0-9]/g, "") + "ABCDEF123456").slice(0, 12).toUpperCase();
      const mac = clean.match(/.{1,2}/g)?.join(":") || "00:11:22:33:44:55";

      // Cálculo determinístico do PIN de 6 algarismos
      let hash = 0;
      for (let i = 0; i < clean.length; i++) {
        hash = (hash << 5) - hash + clean.charCodeAt(i);
        hash |= 0;
      }
      const deviceKey = String(Math.abs(hash) % 900000 + 100000);

      setDevice({ mac, deviceKey });

      // Verificação de registo prévio no Supabase
      const { data } = await supabase
        .from("devices")
        .select("trial_used, assigned_user, assigned_pass")
        .eq("mac", mac)
        .single();

      if (data && data.trial_used) {
        setTrialUsed(true);
      }
    }

    loadDevice();
  }, []);

  async function handleRequestTrial() {
    if (!device) return;
    setLoading(true);

    try {
      // 1. Invoca a Edge Function que comunica com o painel kOfficePanel
      const { data, error } = await supabase.functions.invoke("request-trial", {
        body: { mac: device.mac, device_key: device.deviceKey },
      });

      if (error || !data?.success) {
        const errorMsg = data?.message || "Não foi possível gerar o teste.";
        Alert.alert("Aviso", errorMsg);
        setTrialUsed(true);
        setLoading(false);
        return;
      }

      // 2. Login automático com os dados recebidos do painel
      onLoginSuccess({
        username: data.username,
        password: data.password,
        serverUrl: "http://newbrtop.online:8080",
      });
    } catch (err: any) {
      Alert.alert("Erro", "Falha de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GOLDCAST STREAMING</Text>

      <View style={styles.card}>
        <Text style={styles.label}>ENDEREÇO MAC DO DISPOSITIVO</Text>
        <Text style={styles.value}>{device.mac}</Text>

        <Text style={[styles.label, { marginTop: 15 }]}>CHAVE DO DISPOSITIVO (PIN)</Text>
        <Text style={styles.value}>{device.deviceKey}</Text>
      </View>

      {trialUsed ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            O período de teste gratuito de 3 horas já foi utilizado neste equipamento.
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.trialButton}
          onPress={handleRequestTrial}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.trialButtonText}>SOLICITAR TESTE GRÁTIS DE 3 HORAS</Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.secondaryButton} onPress={onOpenManualLogin}>
        <Text style={styles.secondaryButtonText}>JÁ TENHO UMA SUBSCRIÇÃO / ENTRAR COM CÓDIGO</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0f12",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 24,
    letterSpacing: 2,
  },
  card: {
    backgroundColor: "#161b22",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#30363d",
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    color: "#8b949e",
    fontWeight: "600",
  },
  value: {
    fontSize: 22,
    color: "#f0f6fc",
    fontWeight: "bold",
    marginTop: 4,
    letterSpacing: 1.5,
  },
  trialButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
    marginBottom: 14,
  },
  trialButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "bold",
  },
  noticeBox: {
    backgroundColor: "#2d1619",
    borderWidth: 1,
    borderColor: "#f85149",
    padding: 14,
    borderRadius: 8,
    width: "100%",
    maxWidth: 480,
    marginBottom: 14,
  },
  noticeText: {
    color: "#ff7b72",
    fontSize: 13,
    textAlign: "center",
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#30363d",
  },
  secondaryButtonText: {
    color: "#c9d1d9",
    fontSize: 13,
    fontWeight: "500",
  },
});
