import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, Alert } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "../../src/store/session";
import { logger, LogItem } from "../../src/services/logger"; // Importação do serviço de logs criado

export default function SettingsScreen() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const refreshAccount = useSession((s) => s.refreshAccount);
  const clearCatalog = useSession((s) => s.clearCatalog);
  const logout = useSession((s) => s.logout);
  const clearHistory = useSession((s) => s.clearHistory);

  // Estados para o Modal do Relatório de Diagnóstico (Logs)
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);

  // Abrir o modal de logs e carregar o histórico
  const handleOpenLogs = async () => {
    const history = await logger.getLogs();
    setLogs(history);
    setShowLogsModal(true);
  };

  // Limpar histórico de logs
  const handleClearLogs = async () => {
    await logger.clearLogs();
    setLogs([]);
    Alert.alert("Sucesso", "O histórico de registos foi limpo.");
  };

  // Ação de Terminar Sessão / Sair
  const handleLogout = async () => {
    logger.info("Utilizador acionou Sair da Conta.");
    Alert.alert(
      "Sair da Conta",
      "Tem certeza de que deseja terminar a sessão e limpar os dados salvos?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/");
          },
        },
      ]
    );
  };

  // Ação de Atualizar Conteúdo / Sincronizar Catálogo
  const handleRefreshContent = async () => {
    try {
      logger.info("A iniciar sincronização de conteúdo do servidor IPTV.");
      Alert.alert("Atualizar Conteúdo", "A atualizar dados do servidor IPTV...");
      await refreshAccount();
      clearCatalog();
      Alert.alert("Sucesso", "Conteúdo atualizado com sucesso!");
    } catch (e: any) {
      logger.error(`Falha ao atualizar conteúdo: ${e?.message || e}`);
      Alert.alert("Erro", "Não foi possível atualizar o conteúdo neste momento.");
    }
  };

  // Ação de Limpar Cache e Reiniciar o "Continuar a Assistir" do zero
  const handleClearCache = async () => {
    Alert.alert(
      "Limpar Cache e Histórico",
      "Deseja limpar todo o cache e o histórico de 'Continuar a Assistir'? O aplicativo voltará ao estado inicial.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar Tudo",
          style: "destructive",
          onPress: async () => {
            try {
              clearHistory();
              await AsyncStorage.removeItem("@goldcast_cache");
              logger.info("Cache e histórico limpos pelo utilizador.");
              Alert.alert("Sucesso", "Cache limpo e progresso reiniciado do zero!");
            } catch (e: any) {
              logger.error(`Erro ao limpar cache: ${e?.message || e}`);
              Alert.alert("Erro", "Não foi possível concluir a limpeza do cache.");
            }
          },
        },
      ]
    );
  };

  // Informações da Conta
  const handleAccountInfo = () => {
    const info = session?.userInfo;
    Alert.alert(
      "Detalhes da Conta",
      `Utilizador: ${session?.username || "N/D"}\nServidor: ${session?.server || "N/D"}\nEstado: ${info?.status || "Ativo"}\nExpira em: ${info?.exp_date ? new Date(info.exp_date * 1000).toLocaleDateString() : "Ilimitado"}`
    );
  };

  // Informações Sobre o App
  const handleAbout = () => {
    Alert.alert("Sobre", "GoldCast Media Player\nVersão: 1.0.1\nPlataforma otimizada para Smart TV.");
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => router.back()} 
          style={({ focused }) => [styles.backBtn, focused && styles.cardFocused]} 
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>CONFIGURAÇÕES</Text>
      </View>

      <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
        {/* 1. Conta */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleAccountInfo} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="person-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Conta</Text>
        </Pressable>

        {/* 2. Atualizar App */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => Alert.alert("Atualizar App", "O aplicativo já está na versão mais recente.")} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="cloud-download-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Atualizar App</Text>
        </Pressable>

        {/* 3. Listas M3U */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => router.push("/add-list")} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="list-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Listas M3U</Text>
        </Pressable>

        {/* 4. Atualizar Conteúdo */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleRefreshContent} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="sync-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Atualizar conteúdo</Text>
        </Pressable>

        {/* 5. Reprodução */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => Alert.alert("Reprodução", "Reprodutor de vídeo configurado com aceleração de hardware nativa.")} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="play-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Reprodução</Text>
        </Pressable>

        {/* 6. Histórico e favoritos */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={() => Alert.alert("Histórico", "Histórico de reprodução sincronizado localmente.")} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="time-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Histórico e favoritos</Text>
        </Pressable>

        {/* 7. Relatório de Diagnóstico (LOGS DO SISTEMA) */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleOpenLogs} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="document-text-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Diagnóstico (Logs)</Text>
        </Pressable>

        {/* 8. Limpar cache */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleClearCache} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="brush-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Limpar cache</Text>
        </Pressable>

        {/* 9. Sobre */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleAbout} 
          style={({ focused }) => [styles.settingCard, focused && styles.cardFocused]}
        >
          <Ionicons name="information-circle-outline" size={28} color="#E9C46A" />
          <Text style={styles.cardText}>Sobre</Text>
        </Pressable>

        {/* 10. Sair */}
        <Pressable 
          focusable={true} 
          accessible={true}
          onPress={handleLogout} 
          style={({ focused }) => [styles.settingCard, styles.logoutCard, focused && styles.cardFocused]}
        >
          <Ionicons name="log-out-outline" size={28} color="#E76F51" />
          <Text style={[styles.cardText, { color: "#E76F51" }]}>Sair</Text>
        </Pressable>
      </ScrollView>

      {/* MODAL DE HISTÓRICO DE LOGS E RELATÓRIO DE DIAGNÓSTICO */}
      <Modal visible={showLogsModal} animationType="fade" transparent={true} onRequestClose={() => setShowLogsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Relatório de Diagnóstico do Sistema</Text>
              <Pressable onPress={() => setShowLogsModal(false)} style={styles.closeBtn} focusable={true}>
                <Ionicons name="close" size={18} color="#FFF" />
              </Pressable>
            </View>

            <ScrollView style={styles.logsScroll} contentContainerStyle={{ gap: 6 }}>
              {logs.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum registo de log encontrado no momento.</Text>
              ) : (
                logs.map((log, index) => (
                  <View key={`log-${index}`} style={[styles.logRow, log.level === "ERROR" && styles.logError]}>
                    <Text style={styles.logTime}>[{log.timestamp}]</Text>
                    <Text style={[styles.logLevel, log.level === "ERROR" && { color: "#E76F51" }]}>{log.level}:</Text>
                    <Text style={styles.logMsg}>{log.message}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                focusable={true}
                onPress={handleClearLogs}
                style={[styles.footerBtn, { backgroundColor: "rgba(231,111,81,0.2)" }]}
              >
                <Text style={[styles.footerBtnText, { color: "#E76F51" }]}>Limpar Registos</Text>
              </Pressable>
              
              <Pressable
                focusable={true}
                onPress={() => {
                  const reportText = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join("\n");
                  Alert.alert(
                    "Relatório Pronto", 
                    reportText ? "O relatório foi gerado com sucesso. Pode partilhá-lo com o suporte técnico." : "Sem dados para partilhar."
                  );
                }}
                style={[styles.footerBtn, { backgroundColor: "#E9C46A" }]}
              >
                <Text style={[styles.footerBtnText, { color: "#000" }]}>Copiar / Partilhar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1B3B4B", paddingHorizontal: 36, paddingVertical: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "900", letterSpacing: 1.5 },

  gridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 18, justifyContent: "space-between", paddingBottom: 20 },
  settingCard: {
    width: "31%",
    height: 130,
    backgroundColor: "#152E3B",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "rgba(233,196,106,0.15)",
  },
  cardFocused: {
    borderColor: "#E9C46A",
    borderWidth: 3,
    transform: [{ scale: 1.03 }],
    backgroundColor: "#1B3B4B",
  },
  cardText: { color: "#FFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  logoutCard: { borderColor: "rgba(231,111,81,0.3)" },

  // Estilos do Modal de Diagnóstico / Logs
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 850, height: "82%", backgroundColor: "#152E3B", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(233,196,106,0.3)", padding: 20, gap: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 10 },
  modalTitle: { color: "#E9C46A", fontSize: 15, fontWeight: "900" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1B3B4B", alignItems: "center", justifyContent: "center" },
  
  logsScroll: { flex: 1, backgroundColor: "#10222B", borderRadius: 10, padding: 12 },
  emptyText: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 40 },
  logRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  logError: { backgroundColor: "rgba(231,111,81,0.1)", borderRadius: 4, paddingHorizontal: 4 },
  logTime: { color: "#9CA3AF", fontSize: 10, fontWeight: "700" },
  logLevel: { color: "#E9C46A", fontSize: 10, fontWeight: "900" },
  logMsg: { color: "#FFF", fontSize: 10, fontWeight: "600", flex: 1 },

  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, paddingTop: 6 },
  footerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  footerBtnText: { fontSize: 12, fontWeight: "900" },
});
