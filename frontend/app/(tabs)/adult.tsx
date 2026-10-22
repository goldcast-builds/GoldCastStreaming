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

// Dados simulados exclusivos para a Área +18
const CANAIS_ADULTOS = [
  { id: '1', nome: 'Channel Red', logo: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300' },
  { id: '2', nome: 'Private TV', logo: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300' },
  { id: '3', nome: 'Venus HD', logo: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300' },
];

const FILMES_SERIES_ADULTOS = [
  { id: '1', titulo: 'Conteúdo Exclusivo Vol. 1', tipo: 'Filme', capa: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300' },
  { id: '2', titulo: 'Série Especial +18', tipo: 'Série', capa: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300' },
  { id: '3', titulo: 'Produção Premium', tipo: 'Filme', capa: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300' },
];

export default function AdultScreen({ navigation }) {
  // Controle de Senha / PIN obrigatório para entrar
  const [autenticado, setAutenticado] = useState(false);
  const [pin, setPin] = useState('');
  const [erroPin, setErroPin] = useState(false);

  // Função para validar a senha de acesso (Exemplo: 6969 ou defina a sua)
  const validarSenhaAcesso = () => {
    if (pin === '6969') { 
      setAutenticado(true);
      setPin('');
      setErroPin(false);
    } else {
      setErroPin(true);
    }
  };

  // Se não estiver autenticado, exibe a tela de bloqueio por senha
  if (!autenticado) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.authBox}>
          <Text style={styles.authLockIcon}>🔒</Text>
          <Text style={styles.authTitle}>Área Restrita (+18)</Text>
          <Text style={styles.authSub}>Digite o PIN de segurança para acessar o conteúdo adulto:</Text>
          
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

          {erroPin && <Text style={styles.errorText}>PIN incorreto. Acesso negado.</Text>}

          <View style={styles.authButtons}>
            <TouchableOpacity 
              style={[styles.authBtn, styles.backBtn]} 
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backBtnText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.authBtn, styles.enterBtn]} 
              onPress={validarSenhaAcesso}
            >
              <Text style={styles.enterBtnText}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Conteúdo liberado após a senha correta
  return (
    <View style={styles.container}>
      {/* HEADER +18 */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.badgeAdult}>+18</Text>
          <Text style={styles.headerTitle}>Conteúdo Adulto</Text>
        </View>

        <TouchableOpacity 
          style={styles.exitButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.exitButtonText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* SEÇÃO DE CANAIS AO VIVO */}
        <Text style={styles.sectionTitle}>📺 Canais Ao Vivo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {CANAIS_ADULTOS.map((canal) => (
            <TouchableOpacity key={canal.id} style={styles.canalCard} activeOpacity={0.8}>
              <View style={styles.liveTag}><Text style={styles.liveTagText}>AO VIVO</Text></View>
              <Text style={styles.canalName}>{canal.nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* SEÇÃO DE FILMES E SÉRIES */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🎬 Filmes e Séries</Text>
        <View style={styles.gridContainer}>
          {FILMES_SERIES_ADULTOS.map((item) => (
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Estilos da Tela de Bloqueio por Senha
  authContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#121215',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
  },
  authLockIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  authTitle: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  authSub: {
    color: '#a1a1aa',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  pinInput: {
    width: '100%',
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
    marginBottom: 12,
    letterSpacing: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginBottom: 12,
  },
  authButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  authBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  backBtn: {
    backgroundColor: '#27272a',
  },
  backBtnText: {
    color: '#a1a1aa',
    fontWeight: 'bold',
    fontSize: 12,
  },
  enterBtn: {
    backgroundColor: '#ef4444',
  },
  enterBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },

  // Estilos da Tela Interna (+18)
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 12,
    backgroundColor: '#121215',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeAdult: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    overflow: 'hidden',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exitButton: {
    backgroundColor: '#18181b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  exitButtonText: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  horizontalScroll: {
    marginBottom: 10,
  },
  canalCard: {
    width: 120,
    height: 75,
    backgroundColor: '#121215',
    borderRadius: 8,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
    position: 'relative',
  },
  liveTag: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  liveTagText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: 'bold',
  },
  canalName: {
    color: '#f4f4f5',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mediaCard: {
    width: (width - 40) / 2,
    backgroundColor: '#121215',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  mediaImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  mediaInfo: {
    padding: 8,
  },
  mediaTitle: {
    color: '#f4f4f5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mediaType: {
    color: '#ef4444',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
});
