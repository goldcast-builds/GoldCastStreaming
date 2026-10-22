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
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const DIAS_SEMANA = [
  { id: '1', dia: 'QUA', data: '21/10', ativo: true },
  { id: '2', dia: 'QUI', data: '22/10', ativo: false },
  { id: '3', dia: 'SEX', data: '23/10', ativo: false },
  { id: '4', dia: 'SÁB', data: '24/10', ativo: false },
  { id: '5', dia: 'DOM', data: '25/10', ativo: false },
];

const JOGOS_POR_DATA = {
  '21/10': [
    {
      campeonato: 'CONMEBOL Libertadores',
      logoCamp: 'https://images.vexels.com/media/users/3/142995/isolated/preview/2ef1c19b679469607bf9a419266e92f2-icone-de-futebol-futebol.png',
      partidas: [
        {
          id: '1',
          horario: '21:30',
          status: 'AO VIVO',
          timeCasa: { nome: 'Flamengo', escudo: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Flamengo_braz_logo.svg' },
          placar: '2 x 1',
          timeVisitante: { nome: 'River Plate', escudo: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/CA_River_Plate_logo_%282022%29.svg' },
          canal: { nome: 'ESPN' },
        },
        {
          id: '2',
          horario: '21:30',
          status: 'AO VIVO',
          timeCasa: { nome: 'Palmeiras', escudo: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Palmeiras_logo.svg' },
          placar: '0 x 0',
          timeVisitante: { nome: 'Boca Juniors', escudo: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Boca_Juniors_logo_1970.svg' },
          canal: { nome: 'Paramount+' },
        }
      ]
    },
    {
      campeonato: 'Brasileirão Série A',
      logoCamp: 'https://upload.wikimedia.org/wikipedia/commons/9/94/Campeonato_Brasileiro_S%C3%A9rie_A_logo.png',
      partidas: [
        {
          id: '3',
          horario: '19:00',
          status: 'ENC',
          timeCasa: { nome: 'São Paulo', escudo: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Sao_Paulo_FC_%282020%29.svg' },
          placar: '1 x 3',
          timeVisitante: { nome: 'Corinthians', escudo: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Corinthians_simbolo.svg' },
          canal: { nome: 'Premiere' },
        }
      ]
    }
  ]
};

export default function IndexScreen() {
  const router = useRouter();
  const [dataSelecionada, setDataSelecionada] = useState('21/10');
  const [dias, setDias] = useState(DIAS_SEMANA);
  const [modalConfigVisible, setModalConfigVisible] = useState(false);
  const [bloqueioAdulto, setBloqueioAdulto] = useState(true);

  const [modalAdultPinVisible, setModalAdultPinVisible] = useState(false);
  const [pinAdulto, setPinAdulto] = useState('');
  const [erroPinAdulto, setErroPinAdulto] = useState(false);

  const dadosUsuario = {
    nome: 'Anderson da Silva',
    usuario: 'mavi24',
    codigoAtivacao: 'GOLDCAST-ASN-0310',
    expiracao: '08/11/2026',
  };

  const selecionarDia = (data) => {
    setDataSelecionada(data);
    setDias(dias.map(d => ({ ...d, ativo: d.data === data })));
  };

  const verificarPinAdulto = () => {
    if (pinAdulto === '6969') {
      setModalAdultPinVisible(false);
      setPinAdulto('');
      setErroPinAdulto(false);
      router.push('/adult');
    } else {
      setErroPinAdulto(true);
    }
  };

  const jogosAtuais = JOGOS_POR_DATA[dataSelecionada] || [];

  return (
    <View style={styles.container}>
      {/* HEADER SUPERIOR (USUÁRIO, ATIVAÇÃO E CONFIGURAÇÕES) */}
      <View style={styles.header}>
        <View style={styles.userBox}>
          <Text style={styles.welcomeText}>Usuário: <Text style={styles.highlightText}>{dadosUsuario.usuario}</Text></Text>
          <Text style={styles.codeText}>Ativação: <Text style={styles.highlightCode}>{dadosUsuario.codigoAtivacao}</Text></Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>EXP: {dadosUsuario.expiracao}</Text>
          </View>
          <TouchableOpacity style={styles.gearButton} onPress={() => setModalConfigVisible(true)}>
            <Text style={styles.gearIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BARRA DE NAVEGAÇÃO DE ABAS */}
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* BOTÕES DE ACESSO RÁPIDO: KIDS E ADULTO */}
        <View style={styles.specialModesRow}>
          <TouchableOpacity 
            style={styles.kidsModeBtn} 
            onPress={() => router.push('/kids')}
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

        {/* ATALHOS: FAVORITOS E CONTINUAR ASSISTINDO */}
        <View style={styles.shortcutsRow}>
          <TouchableOpacity style={styles.shortcutCard}>
            <Text style={styles.shortcutIcon}>⭐</Text>
            <Text style={styles.shortcutText}>Favoritos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutCard}>
            <Text style={styles.shortcutIcon}>▶️</Text>
            <Text style={styles.shortcutText}>Continuar Assistindo</Text>
          </TouchableOpacity>
        </View>

        {/* CANAIS EM DESTAQUE */}
        <Text style={styles.sectionTitle}>Canais em Destaque</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.destaquesScroll}>
          {['Premiere 1', 'ESPN Brasil', 'SporTV', 'TNT Sports'].map((canal, index) => (
            <TouchableOpacity key={index} style={styles.destaqueCard} onPress={() => router.push('/live')}>
              <View style={styles.liveTag}><Text style={styles.liveTagText}>AO VIVO</Text></View>
              <Text style={styles.destaqueText}>{canal}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* CENTRAL DE JOGOS: CARROSSEL DE DATAS */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionTitle}>⚽ Central de Jogos</Text>
          <Text style={styles.sectionSub}>Partidas do dia e da semana</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesScroll}>
          {dias.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.dateCard, item.ativo && styles.dateCardActive]}
              onPress={() => selecionarDia(item.data)}
            >
              <Text style={[styles.dateDay, item.ativo && styles.dateTextActive]}>{item.dia}</Text>
              <Text style={[styles.dateNumber, item.ativo && styles.dateTextActive]}>{item.data}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* LISTA DE JOGOS */}
        {jogosAtuais.length > 0 ? (
          jogosAtuais.map((liga, index) => (
            <View key={index} style={styles.leagueContainer}>
              <View style={styles.leagueHeader}>
                <Image source={{ uri: liga.logoCamp }} style={styles.leagueLogo} />
                <Text style={styles.leagueTitle}>{liga.campeonato}</Text>
              </View>

              {liga.partidas.map((jogo) => (
                <View key={jogo.id} style={styles.matchCard}>
                  <View style={styles.matchTimeCol}>
                    <Text style={styles.matchTime}>{jogo.horario}</Text>
                    <Text style={[styles.matchStatus, jogo.status === 'AO VIVO' && { color: '#ef4444' }]}>
                      {jogo.status}
                    </Text>
                  </View>

                  <View style={styles.teamHome}>
                    <Image source={{ uri: jogo.timeCasa.escudo }} style={styles.teamShield} />
                    <Text style={styles.teamName} numberOfLines={1}>{jogo.timeCasa.nome}</Text>
                  </View>

                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>{jogo.placar}</Text>
                  </View>

                  <View style={styles.teamAway}>
                    <Image source={{ uri: jogo.timeVisitante.escudo }} style={styles.teamShield} />
                    <Text style={styles.teamName} numberOfLines={1}>{jogo.timeVisitante.nome}</Text>
                  </View>

                  <View style={styles.channelCol}>
                    <Text style={styles.channelText} numberOfLines={1}>{jogo.canal.nome}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        ) : (
          <View style={styles.noGamesContainer}>
            <Text style={styles.noGamesText}>Nenhum jogo programado para esta data.</Text>
          </View>
        )}

      </ScrollView>

      {/* MODAL DE SENHA PARA CONTEÚDO ADULTO */}
      <Modal animationType="fade" transparent={true} visible={modalAdultPinVisible} onRequestClose={() => setModalAdultPinVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔒 Área Restrita (+18)</Text>
            <Text style={styles.modalSub}>Digite o PIN de segurança para acessar:</Text>
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
            {erroPinAdulto && <Text style={styles.errorText}>PIN incorreto. Acesso negado.</Text>}
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

      {/* MODAL DE CONFIGURAÇÕES */}
      <Modal animationType="slide" transparent={true} visible={modalConfigVisible} onRequestClose={() => setModalConfigVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurações</Text>
            
            <View style={styles.configItem}>
              <View>
                <Text style={styles.configText}>Bloqueio de Conteúdo Adulto</Text>
                <Text style={styles.configSubText}>Exigir PIN na tela inicial</Text>
              </View>
              <Switch
                trackColor={{ false: '#27272a', true: '#d4af37' }}
                thumbColor={bloqueioAdulto ? '#ffffff' : '#a1a1aa'}
                onValueChange={() => setBloqueioAdulto(!bloqueioAdulto)}
                value={bloqueioAdulto}
              />
            </View>

            <View style={styles.accountInfoBox}>
              <Text style={styles.accountTitle}>Informações da Conta</Text>
              <Text style={styles.accountDetail}>Nome: {dadosUsuario.nome}</Text>
              <Text style={styles.accountDetail}>Usuário: {dadosUsuario.usuario}</Text>
              <Text style={styles.accountDetail}>Código: {dadosUsuario.codigoAtivacao}</Text>
              <Text style={styles.accountDetail}>Expiração: {dadosUsuario.expiracao}</Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={() => setModalConfigVisible(false)}>
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 40, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f23', backgroundColor: '#0d0d0f' },
  userBox: { flex: 1 },
  welcomeText: { color: '#a1a1aa', fontSize: 11 },
  highlightText: { color: '#d4af37', fontWeight: 'bold' },
  codeText: { color: '#71717a', fontSize: 10, marginTop: 2 },
  highlightCode: { color: '#fbbf24', fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  badgeContainer: { backgroundColor: '#18181b', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#27272a', marginRight: 8 },
  badgeText: { color: '#fbbf24', fontSize: 9, fontWeight: '600' },
  gearButton: { padding: 6, backgroundColor: '#18181b', borderRadius: 6, borderWidth: 1, borderColor: '#27272a' },
  gearIcon: { fontSize: 14 },
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
  shortcutsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  shortcutCard: { flex: 1, backgroundColor: '#121215', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginHorizontal: 4, borderWidth: 1, borderColor: '#1f1f23' },
  shortcutIcon: { fontSize: 16, marginBottom: 4 },
  shortcutText: { color: '#d4af37', fontSize: 11, fontWeight: '600' },
  sectionTitle: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', marginBottom: 8 },
  sectionHeaderContainer: { marginTop: 14, marginBottom: 8 },
  sectionSub: { color: '#71717a', fontSize: 11 },
  destaquesScroll: { marginBottom: 10 },
  destaqueCard: { width: 110, height: 65, backgroundColor: '#121215', borderRadius: 8, marginRight: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27272a', position: 'relative' },
  liveTag: { position: 'absolute', top: 4, left: 4, backgroundColor: '#ef4444', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 },
  liveTagText: { color: '#fff', fontSize: 7, fontWeight: 'bold' },
  destaqueText: { color: '#f4f4f5', fontSize: 11, fontWeight: '600', marginTop: 8 },
  datesScroll: { marginBottom: 12 },
  dateCard: { width: 55, height: 55, backgroundColor: '#121215', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 6, borderWidth: 1, borderColor: '#27272a' },
  dateCardActive: { backgroundColor: '#d4af37', borderColor: '#fbbf24' },
  dateDay: { color: '#a1a1aa', fontSize: 10, fontWeight: 'bold' },
  dateNumber: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  dateTextActive: { color: '#000000' },
  leagueContainer: { marginBottom: 14, backgroundColor: '#121215', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#1f1f23' },
  leagueHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#1f1f23' },
  leagueLogo: { width: 18, height: 18, marginRight: 6, resizeMode: 'contain' },
  leagueTitle: { color: '#d4af37', fontSize: 12, fontWeight: 'bold' },
  matchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 6, marginBottom: 6, borderWidth: 1, borderColor: '#27272a' },
  matchTimeCol: { width: 42, alignItems: 'center' },
  matchTime: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  matchStatus: { color: '#71717a', fontSize: 8, fontWeight: '600' },
  teamHome: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 },
  teamAway: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 4 },
  teamShield: { width: 24, height: 24, marginHorizontal: 4, resizeMode: 'contain' },
  teamName: { color: '#e4e4e7', fontSize: 11, fontWeight: '500', maxWidth: 60 },
  scoreContainer: { width: 38, alignItems: 'center' },
  scoreText: { color: '#d4af37', fontSize: 11, fontWeight: 'bold' },
  channelCol: { width: 48, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#27272a', paddingLeft: 4 },
  channelText: { color: '#94a3b8', fontSize: 9, fontWeight: 'bold' },
  noGamesContainer: { padding: 20, alignItems: 'center' },
  noGamesText: { color: '#71717a', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#121215', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#27272a' },
  modalTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  modalSub: { color: '#a1a1aa', fontSize: 11, textAlign: 'center', marginBottom: 14 },
  pinInput: { width: '100%', backgroundColor: '#18181b', borderRadius: 8, padding: 10, color: '#ffffff', fontSize: 16, textAlign: 'center', borderWidth: 1, borderColor: '#3f3f46', marginBottom: 10, letterSpacing: 4 },
  errorText: { color: '#ef4444', fontSize: 11, textAlign: 'center', marginBottom: 10 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 6 },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  cancelBtn: { backgroundColor: '#27272a' },
  cancelBtnText: { color: '#a1a1aa', fontWeight: 'bold', fontSize: 12 },
  confirmAdultBtn: { backgroundColor: '#ef4444' },
  confirmBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  configItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f23', marginBottom: 14 },
  configText: { color: '#e4e4e7', fontSize: 13, fontWeight: '600' },
  configSubText: { color: '#71717a', fontSize: 10 },
  accountInfoBox: { backgroundColor: '#18181b', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#27272a' },
  accountTitle: { color: '#d4af37', fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  accountDetail: { color: '#a1a1aa', fontSize: 11, marginBottom: 3 },
  closeButton: { backgroundColor: '#d4af37', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  closeButtonText: { color: '#000000', fontWeight: 'bold', fontSize: 13 },
});
