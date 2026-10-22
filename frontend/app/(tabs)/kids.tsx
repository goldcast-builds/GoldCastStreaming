import React, { useState } from 'react';
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
} from 'react-native';

const { width } = Dimensions.get('window');

// Dados simulados exclusivos para o modo Kids
const CANAIS_KIDS = [
  { id: '1', nome: 'Discovery Kids', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Discovery_Kids_Logo_2009.png' },
  { id: '2', nome: 'Cartoon Network', logo: 'https://upload.wikimedia.org/wikipedia/commons/8/80/Cartoon_Network_2010_logo.svg' },
  { id: '3', nome: 'Disney Channel', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Disney_Channel_Logo_2019.svg' },
  { id: '4', nome: 'Nickelodeon', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Nickelodeon_2009_logo.svg' },
];

const FILMES_SERIES_KIDS = [
  { id: '1', titulo: 'Divertidamente 2', tipo: 'Filme', capa: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300' },
  { id: '2', titulo: 'Patrulha Canina', tipo: 'Série', capa: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300' },
  { id: '3', titulo: 'Moana 2', tipo: 'Filme', capa: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300' },
  { id: '4', titulo: 'Peppa Pig', tipo: 'Série', capa: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300' },
];

export default function KidsScreen({ navigation }) {
  const [modalPinVisible, setModalPinVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [erroPin, setErroPin] = useState(false);

  // Função para validar a saída do modo Kids (Senha dos pais)
  const validarPin = () => {
    if (pin === '1234') { // Senha padrão de exemplo
      setModalPinVisible(false);
      setPin('');
      setErroPin(false);
      navigation.goBack(); // Retorna para a tela normal
    } else {
      setErroPin(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER LÚDICO KIDS */}
      <View style={styles.header}>
        <View style={styles.kidsTitleContainer}>
          <Text style={styles.kidsEmoji}>🎈</Text>
          <Text style={styles.headerTitle}>Espaço Kids</Text>
        </View>

        {/* Botão de Saída Segura para os Pais */}
        <TouchableOpacity 
          style={styles.exitButton} 
          onPress={() => setModalPinVisible(true)}
        >
          <Text style={styles.exitButtonText}>🔒 Sair (Pais)</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* SEÇÃO DE CANAIS INFANTIS AO VIVO */}
        <Text style={styles.sectionTitle}>📺 Canais Infantis</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {CANAIS_KIDS.map((canal) => (
            <TouchableOpacity key={canal.id} style={styles.canalCard} activeOpacity={0.8}>
              <View style={styles.liveTag}><Text style={styles.liveTagText}>AO VIVO</Text></View>
              <Text style={styles.canalName}>{canal.nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* SEÇÃO DE FILMES E SÉRIES INFANTIS */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🎬 Desenhos, Filmes e Séries</Text>
        <View style={styles.gridContainer}>
          {FILMES_SERIES_KIDS.map((item) => (
            <TouchableOpacity key={item.id} style={styles.mediaCard} activeOpacity={0.8}>
              <Image source={{ uri: item.capa }} style={styles.mediaImage} />
              <View style={styles.mediaInfo}>
                <Text style={styles.mediaTitle} numberOfLines={1}>{item.titulo}</Text>
                <Text style={styles.mediaType}>{item.tipo}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* MODAL DE CONTROLE PARENTAL PARA SAIR DO MODO KIDS */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalPinVisible}
        onRequestClose={() => setModalPinVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Área Restrita aos Pais</Text>
            <Text style={styles.modalSub}>Digite o PIN de segurança para sair do modo infantil (Padrão: 1234):</Text>
            
            <TextInput
              style={styles.pinInput}
              placeholder="Digite o PIN"
              placeholderTextColor="#71717a"
              secureTextEntry={true}
              keyboardType="numeric"
              maxLength={4}
              value={pin}
              onChangeText={setPin}
            />

            {erroPin && <Text style={styles.errorText}>PIN incorreto. Tente novamente.</Text>}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => { setModalPinVisible(false); setPin(''); setErroPin(false); }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={validarPin}
              >
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
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Azul escuro divertido e aconchegante
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  kidsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kidsEmoji: {
    fontSize: 20,
    marginRight: 6,
  },
  headerTitle: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  exitButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  exitButtonText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  horizontalScroll: {
    marginBottom: 10,
  },
  canalCard: {
    width: 130,
    height: 80,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
    position: 'relative',
  },
  liveTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  liveTagText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  canalName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mediaCard: {
    width: (width - 40) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  mediaImage: {
    width: '100%',
    height: 110,
    resizeMode: 'cover',
  },
  mediaInfo: {
    padding: 8,
  },
  mediaTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  mediaType: {
    color: '#38bdf8',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  pinInput: {
    width: '100vw',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#475569',
    marginBottom: 10,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelBtn: {
    backgroundColor: '#334155',
  },
  cancelBtnText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 12,
  },
  confirmBtn: {
    backgroundColor: '#3b82f6',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
