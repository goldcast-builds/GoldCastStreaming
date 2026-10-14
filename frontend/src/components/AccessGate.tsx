import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colors, radius, spacing } from "../utils/theme";
import { useSession } from "../store/session";

interface AccessGateProps {
  children?: React.ReactNode;
}

const VALIDATE_CODE_URL = "https://lljsnoovvwexzebzbaal.supabase.co/functions/v1/validate-code";

export default function AccessGate({ children }: AccessGateProps) {
  // Etapa atual: 'email_code' (Ecrã 2) ou 'server_login' (Ecrã de Servidor/Utilizador/Senha)
  const [step, setStep] = useState<"email_code" | "server_login">("email_code");

  // Dados da Etapa 1
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Dados da Etapa 2 (Servidor / Xtream)
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Estados de controlo
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const login = useSession((s) => s.login);

  useEffect(() => {
    checkSavedAccess();
  }, []);

  const checkSavedAccess = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem("@goldcast_saved_email");
      const savedCode = await AsyncStorage.getItem("@goldcast_saved_code");
      const savedUnlocked = await AsyncStorage.getItem("@goldcast_gate_unlocked");

      const savedServer = await AsyncStorage.getItem("@goldcast_server_url");
      const savedUser = await AsyncStorage.getItem("@goldcast_username");
      const savedPass = await AsyncStorage.getItem("@goldcast_password");

      if (savedEmail) setEmail(savedEmail);
      if (savedCode) setCode(savedCode);
      if (savedServer) setServerUrl(savedServer);
      if (savedUser) setUsername(savedUser);
      if (savedPass) setPassword(savedPass);

      // Se já possui acesso validado e credenciais guardadas, tenta autenticar diretamente
      if (savedUnlocked === "true" && savedServer && savedUser && savedPass) {
        try {
          await login(savedServer, savedUser, savedPass, true);
          setIsUnlocked(true);
        } catch {
          // Se o servidor falhar ao iniciar, vai para a tela de servidor para permitir ajustes
          setStep("server_login");
        }
      }
    } catch (e) {
      // Ignora falhas de leitura inicial
    } finally {
      setChecking(false);
    }
  };

  // Processa o envio da Etapa 1 (E-mail e Código de Acesso)
  const handleValidateEmailAndCode = async () => {
    setErrorMessage("");
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Por favor, introduza um endereço de e-mail válido.");
      return;
    }

    if (!cleanCode) {
      setErrorMessage("Por favor, insira o seu código de acesso.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(VALIDATE_CODE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setErrorMessage(data.message || "Código ou e-mail inválido. Verifique os dados.");
        setLoading(false);
        return;
      }

      // Guarda os dados de licença validados
      await AsyncStorage.setItem("@goldcast_saved_email", cleanEmail);
      await AsyncStorage.setItem("@goldcast_saved_code", cleanCode);
      await AsyncStorage.setItem("@goldcast_gate_unlocked", "true");

      // Se a sua API já devolver o servidor e as credenciais automaticamente:
      if (data.serverUrl && data.username && data.password) {
        try {
          await login(data.serverUrl, data.username, data.password, true);
          await AsyncStorage.setItem("@goldcast_server_url", data.serverUrl);
          await AsyncStorage.setItem("@goldcast_username", data.username);
          await AsyncStorage.setItem("@goldcast_password", data.password);
          setIsUnlocked(true);
          return;
        } catch (loginErr) {
          // Se falhar a conexão ao stream, preenche os campos e avança para a etapa manual
          setServerUrl(data.serverUrl);
          setUsername(data.username);
          setPassword(data.password);
          setErrorMessage("Falha na conexão. Verifique sua internet ou o servidor.");
          setStep("server_login");
          return;
        }
      }

      // Cenário C: Avança para a tela de introdução de Servidor, Utilizador e Senha
      setStep("server_login");
    } catch (err: any) {
      // Se não conseguir validar online mas o formato for válido, permite configurar o servidor
      setErrorMessage("Não foi possível validar o código com o servidor de ativação.");
    } finally {
      setLoading(false);
    }
  };

  // Processa o envio da Etapa 2 (Servidor, Utilizador e Palavra-passe)
  const handleServerLogin = async () => {
    setErrorMessage("");

    let cleanServer = serverUrl.trim();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanServer || !cleanUser || !cleanPass) {
      setErrorMessage("Preencha todos os campos do servidor.");
      return;
    }

    if (!cleanServer.startsWith("http://") && !cleanServer.startsWith("https://")) {
      cleanServer = `http://${cleanServer}`;
    }
    if (cleanServer.endsWith("/")) {
      cleanServer = cleanServer.slice(0, -1);
    }

    setLoading(true);

    try {
      await login(cleanServer, cleanUser, cleanPass, true);

      // Guarda credenciais validadas com sucesso
      await AsyncStorage.setItem("@goldcast_server_url", cleanServer);
      await AsyncStorage.setItem("@goldcast_username", cleanUser);
      await AsyncStorage.setItem("@goldcast_password", cleanPass);
      await AsyncStorage.setItem("@goldcast_gate_unlocked", "true");

      setIsUnlocked(true);
    } catch (err: any) {
      setErrorMessage("Falha na conexão. Verifique sua internet ou o servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.gold || "#e5a93c"} />
      </View>
    );
  }

  if (isUnlocked && children) {
    return <>{children}</>;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrap}>
          {/* Logótipo e Cabeçalho GCS */}
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>GCS</Text>
            <Text style={styles.logoSubBadge}>GOLDCAST STREAMING</Text>
          </View>

          <Text style={styles.mainTitle}>GoldCast Streaming</Text>

          {/* ======================================================== */}
          {/* ETAPA 1: E-MAIL E CÓDIGO DE ACESSO (TELA 2)             */}
          {/* ======================================================== */}
          {step === "email_code" ? (
            <>
              <Text style={styles.subTitle}>
                Digite o seu e-mail e código de acesso para entrar.
              </Text>

              <Text style={styles.fieldLabel}>SEU E-MAIL</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color="#aaa" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="exemplo@gmail.com"
                  placeholderTextColor="#555"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrorMessage("");
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.fieldLabel}>CÓDIGO DE ACESSO</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputEmoji}>🔑</Text>
                <TextInput
                  style={styles.input}
                  placeholder="GOLD-VIP-365D"
                  placeholderTextColor="#555"
                  value={code}
                  onChangeText={(text) => {
                    setCode(text.toUpperCase());
                    setErrorMessage("");
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.helperText}>
                Este código é exclusivo e ficará vinculado ao seu e-mail de acesso.
              </Text>

              {/* Caixa de Erro Vermelha (Exatamente como na Imagem 3) */}
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Botão Entrar */}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleValidateEmailAndCode}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryButtonText}>ENTRAR NO APLICATIVO</Text>
                )}
              </TouchableOpacity>

              {/* Botão Teste Grátis */}
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => Alert.alert("Teste Grátis", "Entre em contacto com o suporte para receber um código de teste de 3 horas.")}
                activeOpacity={0.7}
              >
                <Text style={styles.outlineButtonText}>✨ SOLICITAR TESTE GRÁTIS (3 HORAS)</Text>
              </TouchableOpacity>

              {/* Botão Alternativo para abrir diretamente a configuração de servidor */}
              <TouchableOpacity
                style={styles.textLinkButton}
                onPress={() => {
                  setErrorMessage("");
                  setStep("server_login");
                }}
              >
                <Text style={styles.textLink}>🔗 Usar lista M3U alternativa</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* ======================================================== */
            /* ETAPA 2: SERVIDOR, UTILIZADOR E SENHA (CENÁRIO C)         */
            /* ======================================================== */
            <>
              <Text style={styles.subTitle}>
                Insira os dados do seu servidor IPTV / Xtream Codes.
              </Text>

              <Text style={styles.fieldLabel}>URL DO SERVIDOR</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="server-outline" size={18} color="#aaa" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="http://dnsdoservidor.com:8080"
                  placeholderTextColor="#555"
                  value={serverUrl}
                  onChangeText={(text) => {
                    setServerUrl(text);
                    setErrorMessage("");
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.fieldLabel}>UTILIZADOR</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color="#aaa" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Seu utilizador"
                  placeholderTextColor="#555"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    setErrorMessage("");
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.fieldLabel}>PALAVRA-PASSE</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color="#aaa" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Sua palavra-passe"
                  placeholderTextColor="#555"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage("");
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              {/* Caixa de Erro Vermelha */}
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Botão de Conexão */}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleServerLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryButtonText}>CONECTAR E ENTRAR</Text>
                )}
              </TouchableOpacity>

              {/* Botão Voltar */}
              <TouchableOpacity
                style={styles.textLinkButton}
                onPress={() => {
                  setErrorMessage("");
                  setStep("email_code");
                }}
              >
                <Text style={styles.textLink}>← Voltar para e-mail e código</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07080a",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#07080a",
    justifyContent: "center",
    alignItems: "center",
  },
  contentWrap: {
    width: "100%",
    maxWidth: 390,
    alignItems: "stretch",
  },
  logoBadge: {
    width: 90,
    height: 90,
    backgroundColor: "#0f1115",
    borderWidth: 1,
    borderColor: "rgba(229, 169, 59, 0.4)",
    borderRadius: 16,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoBadgeText: {
    color: "#e5a93c",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
  },
  logoSubBadge: {
    color: "#888",
    fontSize: 6,
    letterSpacing: 1,
    marginTop: 2,
    fontWeight: "bold",
  },
  mainTitle: {
    color: "#e5a93c",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subTitle: {
    color: "#999ea8",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 24,
  },
  fieldLabel: {
    color: "#c2c6d0",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  inputContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#13161c",
    borderWidth: 1,
    borderColor: "#262b35",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputEmoji: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  helperText: {
    color: "#6b7280",
    fontSize: 11,
    marginBottom: 16,
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#d99b26",
    borderRadius: 24,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#d99b26",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  outlineButtonText: {
    color: "#d99b26",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  textLinkButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  textLink: {
    color: "#e5a93c",
    fontSize: 12,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
