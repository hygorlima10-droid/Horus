/* ============================================================
   FICHA DE ATENDIMENTO: resumo do caso narrado pelo cliente, feito a partir da transcrição.
   - Principal: modelo aberto do Workers AI (cota gratuita diária; sem retenção de dados). Reserva: Claude (a mesma chave ANTHROPIC_API_KEY que já lê documentos).
   - Regras de fidelidade (no pedido ao modelo e na checagem depois):
       1. só o que está na transcrição; nada de conclusão jurídica, nada de preencher lacuna;
       2. cada item cita o momento da fala (segundos desde o início), que a tela transforma em "▶ 03:12";
       3. o que não foi dito vai para "naoMencionado" (lista fixa de itens esperados), nunca é inventado;
       4. número (valor, data, CPF, quantidade) que NÃO aparece na transcrição marca o item como "conferir".
   Formato guardado: { secoes: { quem, fatos, pedidos, valoresDatas, documentos, pendencias, prazos: [{ texto, t, conferir? }] }, naoMencionado: [texto], provedor, modelo }
   ============================================================ */
export const SECOES = [['quem', 'Quem'], ['fatos', 'Fatos, em ordem'], ['pedidos', 'O que o cliente quer'], ['valoresDatas', 'Valores e datas citados'], ['documentos', 'Documentos'], ['pendencias', 'Pendências e dúvidas'], ['prazos', 'Prazos a verificar']];
export const ESPERADOS = ['nome completo do cliente', 'data dos fatos', 'valores envolvidos', 'documentos que o cliente possui', 'o que o cliente pretende obter', 'honorários combinados'];
export const MODELOS_CF = ['@cf/google/gemma-4-26b-a4b-it', '@cf/zai-org/glm-4.7-flash'];
export const ORDEM_RESUMO = ['cloudflare', 'claude'];

export const PROMPT_SISTEMA = `Você organiza anotações de um atendimento jurídico a partir da TRANSCRIÇÃO automática de uma conversa entre advogado e cliente. Escreva em português do Brasil.
REGRAS OBRIGATÓRIAS:
1. Use SOMENTE o que está na transcrição. Não invente, não complete lacunas, não conclua nada juridicamente, não dê opinião nem cite leis.
2. Mantenha números, valores, datas, nomes e siglas exatamente como foram ditos. Se um trecho estiver confuso, escreva o que foi entendido e termine com " (conferir)".
3. Cada item tem "texto" (curto e direto) e "t": o tempo em segundos do início da fala de onde veio (use o número entre colchetes da linha, no formato [mm:ss] ou [h:mm:ss], convertido para segundos).
4. "naoMencionado": liste, entre os itens esperados abaixo, SOMENTE os que não aparecem em lugar nenhum da conversa.
5. Responda APENAS com um objeto JSON válido, sem texto antes nem depois, neste formato:
{"quem":[{"texto":"","t":0}],"fatos":[],"pedidos":[],"valoresDatas":[],"documentos":[],"pendencias":[],"prazos":[],"naoMencionado":[""]}
Significado: quem = partes e qualificação ditas (nome, profissão, estado civil, endereço); fatos = o que aconteceu, em ordem cronológica; pedidos = o que o cliente quer; valoresDatas = valores e datas citados; documentos = documentos que o cliente tem, que faltam ou que ficou de trazer; pendencias = dúvidas e coisas a esclarecer na próxima conversa; prazos = datas que podem importar para prazos (ex.: data da demissão, do acidente, do contrato) — apenas como lembrete a verificar, sem calcular nada.
Itens esperados para "naoMencionado": ${ESPERADOS.join('; ')}.`;

const mmss = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
export const formatarTempo = mmss;

/* a transcrição em linhas "[mm:ss] texto" (com o falante, se o provedor o informou) */
export function montarEntrada(itens, falantes = {}) {
  return (itens || []).map((i) => `[${mmss(i.ini || 0)}] ${i.falante != null ? (falantes[i.falante] || 'Voz ' + i.falante) + ': ' : ''}${i.texto}`).join('\n');
}

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
/* números que aparecem na transcrição (sem contar os horários [mm:ss]): o número inteiro e cada pedaço (15/03/2024 → 15032024, 15, 03, 2024) */
function numerosDaTranscricao(transcricao) {
  const set = new Set(), limpa = String(transcricao || '').replace(/^\[[\d:]+\]/gm, '');
  for (const tok of limpa.match(/\d[\d.,/-]*\d|\d/g) || []) { set.add(soDigitos(tok)); for (const p of tok.split(/\D+/)) if (p) set.add(p); }
  return set;
}
/* número do item que não existe na transcrição (valor, data, CPF, quantidade…): conferir */
export function numerosForaDaTranscricao(texto, transcricao) {
  const set = numerosDaTranscricao(transcricao);
  for (const n of String(texto || '').match(/\d[\d.,/-]*\d|\d/g) || []) {
    const d = soDigitos(n); if (d.length < 2) continue;
    if (set.has(d)) continue;
    const partes = n.split(/\D+/).filter((p) => p.length >= 2);
    if (partes.length > 1 && partes.every((p) => set.has(p))) continue;
    return true;
  }
  return false;
}

/* extrai o objeto JSON da resposta do modelo (que pode vir cercado de ```json, de texto ou de raciocínio) */
export function extrairJson(txt) {
  let s = String(txt || '').trim();
  s = s.replace(/<think>[\s\S]*?<\/think>/g, '');
  const cerca = /```(?:json)?\s*([\s\S]*?)```/i.exec(s); if (cerca) s = cerca[1];
  const a = s.indexOf('{'); if (a < 0) return null;
  for (let b = s.lastIndexOf('}'); b > a; b = s.lastIndexOf('}', b - 1)) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { /* tenta um fecho anterior */ } }
  return null;
}

/* valida e limpa o resultado do modelo */
export function limparResumo(obj, transcricao, durTotal) {
  if (!obj || typeof obj !== 'object') return null;
  const secoes = {}; let total = 0;
  for (const [k] of SECOES) {
    const lista = Array.isArray(obj[k]) ? obj[k] : [];
    secoes[k] = lista.slice(0, 30).map((it) => {
      const texto = String(typeof it === 'string' ? it : (it && it.texto) || '').replace(/\s+/g, ' ').trim().slice(0, 500); if (!texto) return null;
      let t = typeof it === 'object' && it ? Number(it.t) : NaN; t = Number.isFinite(t) && t >= 0 && t <= (durTotal || 0) + 5 ? Math.round(t) : null;
      const conferir = /\(conferir\)\s*$/i.test(texto) || numerosForaDaTranscricao(texto, transcricao);
      return { texto, t, ...(conferir ? { conferir: true } : {}) };
    }).filter(Boolean);
    total += secoes[k].length;
  }
  if (!total) return null;
  const nm = (Array.isArray(obj.naoMencionado) ? obj.naoMencionado : []).map((x) => String(x || '').trim().slice(0, 80)).filter(Boolean).slice(0, 10);
  return { secoes, naoMencionado: nm };
}

const textoDaResposta = (r) => {
  if (r == null) return '';
  if (typeof r === 'string') return r;
  const c = r.response != null ? r.response : (r.result && r.result.response != null ? r.result.response : (r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : ''));
  if (Array.isArray(c)) return c.map((p) => (typeof p === 'string' ? p : (p && p.text) || '')).join('');
  if (c && typeof c === 'object') return JSON.stringify(c);
  return String(c || '');
};

export const PROVEDORES_RESUMO = {
  cloudflare: {
    nome: 'Modelo aberto (Cloudflare)',
    disponivel: (env) => !!env.AI,
    async rodar(env, entrada) {
      let ultimo = null;
      for (const modelo of MODELOS_CF) {
        try {
          const r = await env.AI.run(modelo, { messages: [{ role: 'system', content: PROMPT_SISTEMA }, { role: 'user', content: 'TRANSCRIÇÃO:\n' + entrada }], max_tokens: 4000, temperature: 0.1 });
          return { texto: textoDaResposta(r), modelo };
        } catch (e) { console.error('resumo (' + modelo + ')', e && e.message); ultimo = e; }
      }
      throw ultimo || new Error('Sem resposta do modelo.');
    },
  },
  claude: {
    nome: 'Claude',
    disponivel: (env) => !!env.ANTHROPIC_API_KEY,
    async rodar(env, entrada) {
      const modelo = env.MODELO_RESUMO || env.MODELO_LEITURA || 'claude-sonnet-5-5';
      const r = await fetch(env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: modelo, max_tokens: 4000, temperature: 0.1, system: PROMPT_SISTEMA, messages: [{ role: 'user', content: 'TRANSCRIÇÃO:\n' + entrada }] }), signal: AbortSignal.timeout(110000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error('Claude respondeu ' + r.status + '.'), { status: r.status });
      return { texto: (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(''), modelo };
    },
  },
  teste: {
    nome: 'Teste', disponivel: (env) => env.RESUMO_TESTE === '1',
    async rodar(env, entrada) {
      const linhas = entrada.split('\n').filter(Boolean).map((l) => { const m = /^\[(?:(\d+):)?(\d+):(\d+)\]\s*(.*)$/.exec(l); return m ? { t: (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]), texto: m[4] } : null; }).filter(Boolean);
      if (/FALHAR_RESUMO/.test(entrada)) throw Object.assign(new Error('falha de teste'), { status: 500 });
      return { texto: '```json\n' + JSON.stringify({ quem: [], fatos: linhas.slice(0, 2).map((l) => ({ texto: l.texto, t: l.t })), pedidos: [], valoresDatas: linhas.filter((l) => /R\$|\d/.test(l.texto)).slice(0, 1).map((l) => ({ texto: l.texto + ' (valor de 99999)', t: l.t })), documentos: [], pendencias: [], prazos: [], naoMencionado: ['data dos fatos'] }) + '\n```', modelo: 'teste' };
    },
  },
};
export const resumosDisponiveis = (env) => Object.keys(PROVEDORES_RESUMO).filter((k) => PROVEDORES_RESUMO[k].disponivel(env));

/* tenta cada provedor na ordem; o primeiro que devolver um resumo válido vale */
export async function resumir(env, itens, durTotal, op = {}) {
  const entrada = montarEntrada(itens, op.falantes || {});
  if (entrada.length < 40) throw Object.assign(new Error('A transcrição é curta demais para resumir.'), { curto: true });
  let ordem = (op.ordem && op.ordem.length ? op.ordem : ORDEM_RESUMO).filter((k) => PROVEDORES_RESUMO[k]);
  if (env.RESUMO_TESTE === '1') ordem = ['teste'];
  ordem = ordem.filter((k) => PROVEDORES_RESUMO[k].disponivel(env));
  if (!ordem.length) throw Object.assign(new Error('Nenhum serviço de resumo está ligado.'), { semProvedor: true });
  let ultimo = null;
  for (const k of ordem) {
    try {
      const r = await PROVEDORES_RESUMO[k].rodar(env, entrada);
      const limpo = limparResumo(extrairJson(r.texto), entrada, durTotal);
      if (limpo) return { ...limpo, provedor: k, modelo: r.modelo, em: new Date().toISOString() };
      ultimo = new Error('O modelo não devolveu um resumo no formato esperado.');
    } catch (e) { console.error('resumo (' + k + ')', e && e.message); ultimo = e; }
  }
  throw ultimo || new Error('Não consegui resumir.');
}
