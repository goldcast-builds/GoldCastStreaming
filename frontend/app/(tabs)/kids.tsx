import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function KidsScreen() {
  const router = useRouter();
  const [modalPinVisible, setModalPinVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [erroPin, setErroPin] = useState(false);

  // Estados para dados reais do IPTV
  const [canaisKids, setCanaisKids] = useState([]);
  const [vodKids, setVodKids] = useState([]);
  const [loading, setLoading] = useState(true);

  // Simulação de busca da API de IPTV (Substitua pela sua URL real de Xtream Codes / M3U)
  useEffect(() => {
    async function carregarDadosIPTVKids() {
      try {
        // Exemplo de requisição aos dados do seu provedor IPTV filtrando categoria infantil
        // const resposta = await fetch('SUA_API_IPTV_AQUI/player_api.php?username=...&password=...');
        // const dados = await resposta.json();
        
        // Dados dinâmicos simulados conectados ao fluxo do IPTV
        setCanaisKids([
          { id: '1', name: 'Discovery Kids HD', stream_icon: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300' },
          { id: '2', name: 'Cartoon Network', stream_icon: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300' },
        ]);

        setVodKids([
          { id: '101', name: 'Divertidamente 2', stream_icon: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300', category_name: 'Filme Infantil' },
          { id: '102', name: 'Patrulha Canina O Filme', stream_icon: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300', category_name: 'Série Infantil' },
        ]);
      } catch (erro) {
        console.error("Erro ao carregar IPTV Kids:", erro);
      } finally {
        setLoading(false);
      }
    }

    carregarDadosIPTVKids();
  }, []);

  const validarPin = () => {
    if (pin === '1234') {
      setModalPinVisible(false);
      setPin('');
      setErroPin(false);
      router.back();
    } else {
      setErroPin(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.kidsTitleContainer}>
          <Text style={styles.kidsEmoji}>🎈</Text>
          <Text style={styles.headerTitle}>Espaço Kids</Text>
        </View>

        <TouchableOpacity style={styles.exitButton} onPress={() => setModalPinVisible(true)}>
          <Text style={styles.exitButtonText}>🔒 Sair (Pais)</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loaderText}>Carregando conteúdo infantil do IPTV...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>📺 Canais Infantis Ao Vivo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {canaisKids.map((canal) => (
              <TouchableOpacity key={canal.id} style={styles.canalCard} activeOpacity={0.8}>
                <View style={styles.liveTag}><Text style={styles.liveTagText}>AO VIVO</Text></View>
                <Image source={{ uri: canal.stream_icon }} style={styles.canalImage} />
                <Text style={styles.canalName} numberOfLines={1}>{canal.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🎬 Filmes e Séries Infantis</Text>
          <View style={styles.gridContainer}>
            {vodKids.map((item) => (
              <TouchableOpacity key={item.id} style={styles.mediaCard} activeOpacity={0.8}>
                <Image source={{ uri: item.stream_icon }} style={styles.mediaImage} />
                <View style={styles.mediaInfo}>
                  <Text style={styles.mediaTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.mediaType}>{item.category_name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal animationType="fade" transparent={true} visible={modalPinVisible} onRequestClose={() => setModalPinVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Área Restrita aos Pais</Text>
            <Text style={styles.modalSub}>Digite o PIN para sair (Padrão: 1234):</Text>
            
            <TextInput
              style={styles.pinInput}
              placeholder="PIN"
              placeholderTextColor="#71717a"
              secureTextEntry={true}
              keyboardType="numeric"
              maxLength={4}
              value={pin}
              onChangeText={setPin}
            />

            {erroPin && <Text style={styles.errorText}>PIN incorreto.</Text>}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalPinVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={validarPin}>
                <Text style={styles.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 45, paddingBottom: 12, backgroundColor: '#1e293b', borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
  kidsTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  kidsEmoji: { fontSize: 20, marginRight: 6 },
  headerTitle: { color: '#38bdf8', fontSize: 18, fontWeight: 'bold' },
  exitButton: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#475569' },
  exitButtonText: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: '#94a3b8', marginTop: 10, fontSize: 12 },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  horizontalScroll: { marginBottom: 10 },
  canalCard: { width: 130, height: 95, backgroundColor: '#1e293b', borderRadius: 12, marginRight: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#3b82f6', position: 'relative', padding: 6 },
  liveTag: { position: 'absolute', top: 6, left: 6, backgroundColor: '#ef4444', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, zIndex: 2 },
  liveTagText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  canalImage: { width: 40, height: 40, resizeMode: 'contain', marginBottom: 6 },
  canalName: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  mediaCard: { width: (width - 40) / 2, backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  mediaImage: { width: '100%', height: 110, resizeMode: 'cover' },
  mediaInfo: { padding: 8 },
  mediaTitle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
  mediaType: { color: '#38bdf8', fontSize: 10, marginTop: 2, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#1e293b', borderRadius: 16, padding: 20, borderWidth: 2, borderColor: '#3b82f6', alignItems: 'center' },
  modalTitle: { color: '#38bdf8', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  modalSub: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  pinInput: { width: '100%', backgroundColor: '#0f172a', borderRadius: 8, padding: 10, color: '#ffffff', fontSize: 16, textAlign: 'center', borderWidth: 1, borderColor: '#475569', marginBottom: 10 },
  errorText: { color: '#ef4444', fontSize: 11, marginBottom: 10 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  cancelBtn: { backgroundColor: '#334155' },
  cancelBtnText: { color: '#cbd5e1', fontWeight: 'bold', fontSize: 12 },
  confirmBtn: { backgroundColor: '#3b82f6' },
  confirmBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
});
