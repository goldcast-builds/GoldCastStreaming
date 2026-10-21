import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';

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
          canal: { nome: 'ESPN', icone: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/ESPN_wordmark.svg' },
        },
        {
          id: '2',
          horario: '21:30',
          status: 'AO VIVO',
          timeCasa: { nome: 'Palmeiras', escudo: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Palmeiras_logo.svg' },
          placar: '0 x 0',
          timeVisitante: { nome: 'Boca Juniors', escudo: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Boca_Juniors_logo_1970.svg' },
          canal: { nome: 'Paramount+', icone: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Paramount%2B_Logo.svg' },
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
          canal: { nome: 'Premiere', icone: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Premiere_2020.svg' },
        }
      ]
    }
  ],
  '22/10': [
    {
      campeonato: 'UEFA Champions League',
      logoCamp: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/UEFA_Champions_League_Logo.svg',
      partidas: [
        {
          id: '4',
          horario: '16:00',
          status: 'AMANHÃ',
          timeCasa: { nome: 'Real Madrid', escudo: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Real_Madrid_CF.svg' },
          placar: 'VS',
          timeVisitante: { nome: 'Manchester City', escudo: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Manchester_City_FC_badge.svg' },
          canal: { nome: 'TNT', icone: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/TNT_logo_2016.svg' },
        }
      ]
    }
  ]
};

export default function IndexScreen({ navigation }) {
  const [dataSelecionada, setDataSelecionada] = useState('21/10');
  const [dias, setDias] = useState(DIAS_SEMANA);

  const selecionarDia = (data) => {
    setDataSelecionada(data);
    setDias(dias.map(d => ({ ...d, ativo: d.data === data })));
  };

  const jogosAtuais = JOGOS_POR_DATA[dataSelecionada] || [];

  return (
    <View style={styles.container}>
      {/* HEADER SUPERIOR PREMIUM */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Bem-vindo,</Text>
          <Text style={styles.userName}>GoldCast VIP</Text>
        </View>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>EXP: 08/11/2026</Text>
        </View>
      </View>

      {/* BARRA DE NAVEGAÇÃO ENTRE AS TELAS */}
      <View style={styles.navBar}>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={[styles.navText, styles.navTextActive]}>Início & Futebol</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Live')}>
          <Text style={styles.navText}>Canais</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Movies')}>
          <Text style={styles.navText}>Filmes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Series')}>
          <Text style={styles.navText}>Séries</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* CANAIS EM DESTAQUE */}
        <Text style={styles.sectionTitle}>Canais em Destaque</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.destaquesScroll}>
          {['Premiere 1', 'ESPN Brasil', 'SporTV', 'TNT Sports'].map((canal, index) => (
            <TouchableOpacity key={index} style={styles.destaqueCard}>
              <View style={styles.liveTag}><Text style={styles.liveTagText}>AO VIVO</Text></View>
              <Text style={styles.destaqueText}>{canal}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* CENTRAL DE JOGOS: DATAS */}
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
                <TouchableOpacity key={jogo.id} style={styles.matchCard} activeOpacity={0.8}>
                  {/* Horário e Status */}
                  <View style={styles.matchTimeCol}>
                    <Text style={styles.matchTime}>{jogo.horario}</Text>
                    <Text style={[styles.matchStatus, jogo.status === 'AO VIVO' && { color: '#ef4444' }]}>
                      {jogo.status}
                    </Text>
                  </View>

                  {/* Time Casa (Escudo Maior) */}
                  <View style={styles.teamHome}>
                    <Image source={{ uri: jogo.timeCasa.escudo }} style={styles.teamShield} />
                    <Text style={styles.teamName} numberOfLines={1}>{jogo.timeCasa.nome}</Text>
                  </View>

                  {/* Placar / VS */}
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>{jogo.placar}</Text>
                  </View>

                  {/* Time Visitante (Escudo Maior) */}
                  <View style={styles.teamAway}>
                    <Image source={{ uri: jogo.timeVisitante.escudo }} style={styles.teamShield} />
                    <Text style={styles.teamName} numberOfLines={1}>{jogo.timeVisitante.nome}</Text>
                  </View>

                  {/* Canal de Transmissão */}
                  <View style={styles.channelCol}>
                    <Text style={styles.channelText} numberOfLines={1}>{jogo.canal.nome}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        ) : (
          <View style={styles.noGamesContainer}>
            <Text style={styles.noGamesText}>Nenhum jogo programado para esta data.</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f23',
  },
  welcomeText: {
    color: '#a1a1aa',
    fontSize: 11,
  },
  userName: {
    color: '#d4af37',
    fontSize: 15,
    fontWeight: 'bold',
  },
  badgeContainer: {
    backgroundColor: '#121215',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  badgeText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '600',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#121215',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f23',
  },
  navItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  navItemActive: {
    backgroundColor: '#1f1f23',
    borderBottomWidth: 2,
    borderBottomColor: '#d4af37',
  },
  navText: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '500',
  },
  navTextActive: {
    color: '#d4af37',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionHeaderContainer: {
    marginTop: 14,
    marginBottom: 8,
  },
  sectionSub: {
    color: '#71717a',
    fontSize: 11,
  },
  destaquesScroll: {
    marginBottom: 10,
  },
  destaqueCard: {
    width: 110,
    height: 65,
    backgroundColor: '#121215',
    borderRadius: 8,
    marginRight: 8,
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
  destaqueText: {
    color: '#f4f4f5',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  datesScroll: {
    marginBottom: 12,
  },
  dateCard: {
    width: 55,
    height: 55,
    backgroundColor: '#121215',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  dateCardActive: {
    backgroundColor: '#d4af37',
    borderColor: '#fbbf24',
  },
  dateDay: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: 'bold',
  },
  dateNumber: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateTextActive: {
    color: '#000000',
  },
  leagueContainer: {
    marginBottom: 14,
    backgroundColor: '#121215',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1f1f23',
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f23',
  },
  leagueLogo: {
    width: 18,
    height: 18,
    marginRight: 6,
    resizeMode: 'contain',
  },
  leagueTitle: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: 'bold',
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  matchTimeCol: {
    width: 42,
    alignItems: 'center',
  },
  matchTime: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  matchStatus: {
    color: '#71717a',
    fontSize: 8,
    fontWeight: '600',
  },
  teamHome: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 4,
  },
  teamAway: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 4,
  },
  teamShield: {
    width: 24,
    height: 24,
    marginHorizontal: 4,
    resizeMode: 'contain',
  },
  teamName: {
    color: '#e4e4e7',
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 60,
  },
  scoreContainer: {
    width: 38,
    alignItems: 'center',
  },
  scoreText: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 'bold',
  },
  channelCol: {
    width: 48,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#27272a',
    paddingLeft: 4,
  },
  channelText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 'bold',
  },
  noGamesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noGamesText: {
    color: '#71717a',
    fontSize: 12,
  },
});
