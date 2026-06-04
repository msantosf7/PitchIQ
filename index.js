import { createClient } from '@supabase/supabase-js';

// 1. Inicializa o Supabase testando as variações de chaves do GitHub Secrets
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERRO CRÍTICO: As credenciais do Supabase não foram encontradas no GitHub Secrets!");
  process.exit(1);
}

// Exibe os primeiros caracteres no log para conferirmos se o GitHub enviou a chave certa
console.log(`📡 Conectando ao projeto: ${supabaseUrl}`);
console.log(`🔑 Token utilizado começa com: ${supabaseKey.substring(0, 15)}...`);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false // Evita problemas de sessão em ambientes automatizados como GitHub
  }
});

// 2. Função pura da Distribuição de Poisson
function calcularPoisson(lambda, gols) {
  const euler = Math.exp(-lambda);
  const potencia = Math.pow(lambda, gols);
  let fatorial = 1;
  for (let i = 2; i <= gols; i++) fatorial *= i;
  return (potencia * euler) / fatorial;
}

// 3. Processa a partida e calcula as probabilidades exatas
function analisarPartida(jogo) {
  const lambdaCasa = jogo.forcaCasa * 1.40; 
  const lambdaFora = jogo.forcaFora * 1.10;

  let probCasa = 0, probEmpate = 0, probFora = 0, probOver25 = 0, probBtts = 0;

  for (let c = 0; c <= 5; c++) {
    for (let f = 0; f <= 5; f++) {
      const pC = calcularPoisson(lambdaCasa, c);
      const pF = calcularPoisson(lambdaFora, f);
      const pPlacar = pC * pF;

      if (c > f) probCasa += pPlacar;
      else if (c === f) probEmpate += pPlacar;
      else probFora += pPlacar;

      if (c > 0 && f > 0) probBtts += pPlacar;
      if (c + f > 2) probOver25 += pPlacar;
    }
  }

  let recomendacao = "⚠️ Sem Valor / Fora de Critério";
  if (probOver25 > 0.60) recomendacao = "🔥 Over 2.5 Gols";
  else if (probCasa > 0.58) recomendacao = "🟢 Vitória Casa";
  else if (probFora > 0.58) recomendacao = "🔴 Vitória Fora";
  else if (probBtts > 0.60) recomendacao = "⚽ Ambas Marcam";

  return {
    id: jogo.id,
    liga: jogo.liga,
    time: jogo.time,
    time_casa: jogo.time_casa,
    time_fora: jogo.time_fora,
    url_escudo_casa: `https://media.api-sports.io/football/teams/${jogo.id_casa}.png`,
    url_escudo_fora: `https://media.api-sports.io/football/teams/${jogo.id_fora}.png`,
    prob_casa: Math.round(probCasa * 100),
    prob_empate: Math.round(probEmpate * 100),
    prob_fora: Math.round(probFora * 100),
    prob_btts: Math.round(probBtts * 100),
    prob_over25: Math.round(probOver25 * 100),
    entrada_sugerida: recomendacao
  };
}

async function iniciarRobo() {
  console.log("⚽ Buscando os jogos reais do dia...");

  const jogosReaisDoDia = [
    { id: 1, liga: "Champions League", time: "17:00", time_casa: "Real Madrid", id_casa: 541, forcaCasa: 1.5, time_fora: "Dortmund", id_fora: 165, forcaFora: 1.1 },
    { id: 2, liga: "Série A", time: "16:00", time_casa: "Flamengo", id_casa: 127, forcaCasa: 1.4, time_fora: "Palmeiras", id_fora: 121, forcaFora: 1.3 },
    { id: 3, liga: "Série A", time: "18:30", time_casa: "Corinthians", id_casa: 131, forcaCasa: 0.9, time_fora: "São Paulo", id_fora: 126, forcaFora: 1.1 }
  ];

  const jogosAnalisados = jogosReaisDoDia.map(jogo => analisarPartida(jogo));

  console.log("💾 Convertendo resultados para o formato JSON...");
  const dadosJson = JSON.stringify(jogosAnalisados, null, 2);
  const blob = Buffer.from(dadosJson, 'utf-8');

  console.log("🚀 Fazendo upload para o Supabase Storage...");
  const { data, error } = await supabase
    .storage
    .from('dados-futebol')
    .upload('jogos_do_dia.json', blob, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) {
    console.error("❌ Erro ao atualizar o painel no Storage:", error.message);
    process.exit(1);
  } else {
    console.log("✅ Painel atualizado com sucesso! O Lovable já pode ler os dados.");
  }
}

iniciarRobo();