// Configuração das ligas monitorizadas na ESPN
const LIGAS_ESPN = [
  { slug: 'bra.1', nome: 'Brasileirão Série A', canal: 'Premiere' },
  { slug: 'bra.copa_do_brasil', nome: 'Copa do Brasil', canal: 'SporTV / Premiere' },
  { slug: 'conmebol.libertadores', nome: 'Libertadores', canal: 'ESPN / Premiere' },
  { slug: 'conmebol.sudamericana', nome: 'Sul-Americana', canal: 'ESPN' },
  { slug: 'uefa.champions', nome: 'Champions League', canal: 'TNT Sports' },
  { slug: 'eng.1', nome: 'Premier League', canal: 'ESPN' },
  { slug: 'esp.1', nome: 'La Liga', canal: 'ESPN' },
  { slug: 'ita.1', nome: 'Serie A', canal: 'ESPN' },
];

// Função que obtém a data de hoje no fuso horário do Brasil (AAAAMMDD)
function obterDataBrasilia(): string {
  const agora = new Date();
  const utc = agora.getTime() + agora.getTimezoneOffset() * 60000;
  const brt = new Date(utc - 3 * 3600000);
  const ano = brt.getFullYear();
  const mes = String(brt.getMonth() + 1).padStart(2, '0');
  const dia = String(brt.getDate()).padStart(2, '0');
  return `${ano}${mes}${dia}`;
}

// Função principal de busca direta na API da ESPN
async function buscarJogosESPN(): Promise<Jogo[]> {
  const dataHoje = obterDataBrasilia();
  let idContador = 1;

  try {
    const requisicoes = LIGAS_ESPN.map(async (liga) => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${liga.slug}/scoreboard?dates=${dataHoje}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const dados = await res.json();
        const eventos = dados.events || [];

        const jogosLiga: Jogo[] = [];
        for (const ev of eventos) {
          const comp = ev.competitions?.[0];
          if (!comp || !comp.competitors || comp.competitors.length < 2) continue;

          let casa = comp.competitors[0]?.team?.shortDisplayName || comp.competitors[0]?.team?.name || 'Time 1';
          let fora = comp.competitors[1]?.team?.shortDisplayName || comp.competitors[1]?.team?.name || 'Time 2';

          if (comp.competitors[0]?.homeAway !== 'home') {
            const temp = casa;
            casa = fora;
            fora = temp;
          }

          let horario = 'A definir';
          if (ev.date) {
            try {
              const dt = new Date(ev.date);
              horario = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            } catch (e) {}
          }

          const aoVivo = comp.status?.type?.state === 'in';

          let canal = liga.canal;
          if (comp.broadcasts && comp.broadcasts.length > 0 && comp.broadcasts[0].names?.length > 0) {
            canal = comp.broadcasts[0].names.join(' / ');
          }

          const estadio = comp.venue?.fullName || '';

          jogosLiga.push({
            id: String(idContador++),
            campeonato: liga.nome,
            time_casa: casa,
            time_fora: fora,
            horario,
            ao_vivo: aoVivo,
            estadio,
            canal_nome: canal,
          });
        }
        return jogosLiga;
      } catch (e) {
        return [];
      }
    });

    const resultados = await Promise.all(requisicoes);
    const todosJogos = resultados.flat();

    if (todosJogos.length > 0) {
      return todosJogos;
    }
  } catch (erro) {
    console.error('Erro ao consultar ESPN:', erro);
  }

  // Plano de contingência caso não haja partidas oficiais no dia
  return [
    {
      id: '1',
      campeonato: 'PROGRAMAÇÃO ESPORTIVA',
      time_casa: 'Sem grandes jogos',
      time_fora: 'agendados para hoje',
      horario: '--:--',
      ao_vivo: false,
      estadio: 'Confira a grade ao vivo',
      canal_nome: 'Canais Esportivos',
    },
  ];
}
