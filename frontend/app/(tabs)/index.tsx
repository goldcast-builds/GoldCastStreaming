import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Modal, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router'; // <--- Importante para Expo Router

export default function IndexScreen() {
  const router = useRouter(); // <--- Instancia o roteador
  const [modalAdultPinVisible, setModalAdultPinVisible] = useState(false);
  const [pinAdulto, setPinAdulto] = useState('');
  const [erroPinAdulto, setErroPinAdulto] = useState(false);
  const [modalConfigVisible, setModalConfigVisible] = useState(false);
  const [bloqueioAdulto, setBloqueioAdulto] = useState(true);

  const dadosUsuario = {
    nome: 'Anderson da Silva',
    usuario: 'mavi24',
    codigoAtivacao: 'GOLDCAST-ASN-0310',
    expiracao: '08/11/2026',
  };

  const verificarPinAdulto = () => {
    if (pinAdulto === '6969') {
      setModalAdultPinVisible(false);
      setPinAdulto('');
      setErroPinAdulto(false);
      router.push('/adult'); // <--- Navega para o arquivo adult.tsx usando Expo Router
    } else {
      setErroPinAdulto(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER E NAVEGAÇÃO DE ABAS */}
      <View style={styles.navBar}>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={[styles.navText, styles.navTextActive]}>Início & Futebol</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/live')}>
          <Text style={styles.navText}>Canais</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/movies')}>
          <Text style={styles.navText}>Filmes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/series')}>
          <Text style={styles.navText}>Séries</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* BOTÕES KIDS E ADULTO */}
        <View style={styles.specialModesRow}>
          <TouchableOpacity 
            style={styles.kidsModeBtn} 
            onPress={() => router.push('/kids')} // <--- Navega para o arquivo kids.tsx
          >
            <Text style={styles.specialEmoji}>🎈</Text>
            <View>
              <Text style={styles.specialTitleKids}>Espaço Kids</Text>
              <Text style={styles.specialSub}>Desenhos e Canais</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.adultModeBtn} 
            onPress={() => setModalAdultPinVisible(true)}
          >
            <Text style={styles.specialEmoji}>🔒</Text>
            <View>
              <Text style={styles.specialTitleAdult}>Conteúdo +18</Text>
              <Text style={styles.specialSub}>Protegido por Senha</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Resto do seu código da tela inicial... */}
      </ScrollView>

      {/* MODAL DE SENHA ADULTA */}
      <Modal animationType="fade" transparent={true} visible={modalAdultPinVisible} onRequestClose={() => setModalAdultPinVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔒 Área Restrita (+18)</Text>
            <TextInput
              style={styles.pinInput}
              placeholder="PIN"
              placeholderTextColor="#71717a"
              secureTextEntry={true}
              keyboardType="numeric"
              maxLength={4}
              value={pinAdulto}
              onChangeText={setPinAdulto}
            />
            {erroPinAdulto && <Text style={styles.errorText}>PIN incorreto.</Text>}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalAdultPinVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmAdultBtn]} onPress={verificarPinAdulto}>
                <Text style={styles.confirmBtnText}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Mantenha os seus estilos anteriores aqui...
  container: { flex: 1, backgroundColor: '#09090b' },
  navBar: { flexDirection: 'row', backgroundColor: '#121215', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#1f1f23' },
  navItem: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  navItemActive: { backgroundColor: '#1f1f23', borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  navText: { color: '#a1a1aa', fontSize: 11, fontWeight: '500' },
  navTextActive: { color: '#d4af37', fontWeight: 'bold' },
  scrollContent: { padding: 12, paddingBottom: 40 },
  specialModesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  kidsModeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginRight: 6, borderWidth: 1, borderColor: '#3b82f6' },
  adultModeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#181215', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginLeft: 6, borderWidth: 1, borderColor: '#ef4444' },
  specialEmoji: { fontSize: 20, marginRight: 8 },
  specialTitleKids: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
  specialTitleAdult: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },
  specialSub: { color: '#a1a1aa', fontSize: 9 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#121215', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#27272a' },
  modalTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  pinInput: { width: '100%', backgroundColor: '#18181b', borderRadius: 8, padding: 10, color: '#ffffff', fontSize: 16, textAlign: 'center', borderWidth: 1, borderColor: '#3f3f46', marginBottom: 10, letterSpacing: 4 },
  errorText: { color: '#ef4444', fontSize: 11, textAlign: 'center', marginBottom: 10 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 6 },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  cancelBtn: { backgroundColor: '#27272a' },
  cancelBtnText: { color: '#a1a1aa', fontWeight: 'bold', fontSize: 12 },
  confirmAdultBtn: { backgroundColor: '#ef4444' },
  confirmBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
});
