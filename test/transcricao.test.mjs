// Transcrição (sem navegador): formato das respostas do Whisper (Workers AI) e do Grok STT, ordem dos provedores (Cloudflare primeiro, Grok de reserva) e erros.
//   node test/transcricao.test.mjs
import { itensDoWhisper, itensDoGrok, transcrever, provedoresDisponiveis, MODELO_CF } from '../src/transcricao.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const bytes = new TextEncoder().encode('audio-falso');

// Whisper do Workers AI
let it = itensDoWhisper({ text: 'Olá. Tudo bem?', segments: [{ start: 0, end: 1.5, text: ' Olá. ' }, { start: 1.5, end: 3, text: ' Tudo bem? ' }, { start: 3, end: 4, text: '  ' }] });
check(it.length === 2 && it[0].texto === 'Olá.' && it[1].ini === 1.5 && it[1].fim === 3, 'Whisper: usa os segmentos com tempo e descarta os vazios');
it = itensDoWhisper({ text: '  Só texto  ' });
check(it.length === 1 && it[0].texto === 'Só texto' && it[0].ini === 0, 'Whisper: sem segmentos, vira um item só');
check(itensDoWhisper({}).length === 0 && itensDoWhisper(null).length === 0, 'Whisper: resposta vazia não gera item');

// Grok STT: falas, palavras com falante, só texto
it = itensDoGrok({ utterances: [{ start: 0, end: 2, text: 'Bom dia', speaker: 0 }, { start: 2, end: 5, text: 'Bom dia, doutor', speaker: 1 }] });
check(it.length === 2 && it[0].falante === '0' && it[1].falante === '1' && it[1].texto === 'Bom dia, doutor', 'Grok: falas com o falante de cada uma');
it = itensDoGrok({ words: [{ text: 'Fui', start: 0, end: .3, speaker: 0 }, { text: 'demitido', start: .3, end: .9, speaker: 0 }, { text: 'Quando?', start: 1.2, end: 1.8, speaker: 1 }] });
check(it.length === 2 && it[0].texto === 'Fui demitido' && it[0].falante === '0' && it[1].falante === '1', 'Grok: junta as palavras seguidas do mesmo falante em uma fala');
it = itensDoGrok({ text: 'sem tempo' });
check(it.length === 1 && it[0].texto === 'sem tempo', 'Grok: só texto também funciona');

// ordem e reserva
const chamadas = [];
const cf = (ok) => ({ AI: { run: async (modelo, entrada) => { chamadas.push(['cf', modelo, entrada.language, entrada.task, typeof entrada.audio]); if (!ok) { const e = new Error('limite'); e.status = 429; throw e; } return { segments: [{ start: 0, end: 2, text: 'texto do whisper' }] }; } } });
let r = await transcrever(cf(true), bytes, 'audio/mp4');
check(r.provedor === 'cloudflare' && r.itens[0].texto === 'texto do whisper' && chamadas[0][1] === MODELO_CF && chamadas[0][2] === 'pt' && chamadas[0][3] === 'transcribe' && chamadas[0][4] === 'string', 'Cloudflare é o primeiro: modelo Whisper turbo, português, áudio em base64');
// principal falha, Grok responde
const envReserva = { ...cf(false), XAI_API_KEY: 'chave-falsa' };
const f0 = globalThis.fetch; let pedido = null;
globalThis.fetch = async (url, op) => { pedido = { url: String(url), auth: op.headers.authorization, campos: [...op.body.keys()] }; return new Response(JSON.stringify({ utterances: [{ start: 0, end: 1, text: 'texto do grok', speaker: 1 }] }), { status: 200 }); };
r = await transcrever(envReserva, bytes, 'audio/mp4');
check(r.provedor === 'grok' && r.itens[0].falante === '1', 'se o Cloudflare falha (limite), o Grok responde no lugar');
check(pedido.url === 'https://api.x.ai/v1/stt' && pedido.auth === 'Bearer chave-falsa' && pedido.campos.includes('file') && pedido.campos.includes('diarize'), 'o Grok é chamado com a chave, o arquivo e a separação de falantes');
// os dois falham: o erro sobe; sem chave do Grok, ele nem é tentado
globalThis.fetch = async () => new Response('erro', { status: 500 });
let erro = null; try { await transcrever(envReserva, bytes, 'audio/mp4'); } catch (e) { erro = e; }
check(erro && !erro.semProvedor, 'se os dois falham, o erro sobe para a rota explicar');
erro = null; try { await transcrever({}, bytes, 'audio/mp4'); } catch (e) { erro = e; }
check(erro && erro.semProvedor === true, 'sem nenhum serviço ligado, o erro diz que nenhum está ligado');
check(JSON.stringify(provedoresDisponiveis({ AI: {} })) === '["cloudflare"]' && JSON.stringify(provedoresDisponiveis({ AI: {}, XAI_API_KEY: 'x' })) === '["cloudflare","grok"]', 'a lista de serviços ligados depende do que está configurado');
// escolher o Grok primeiro
chamadas.length = 0; globalThis.fetch = async () => new Response(JSON.stringify({ text: 'grok primeiro' }), { status: 200 });
r = await transcrever({ ...cf(true), XAI_API_KEY: 'k' }, bytes, 'audio/webm', { ordem: ['grok', 'cloudflare'] });
check(r.provedor === 'grok' && chamadas.length === 0, 'quando o Grok é escolhido primeiro, o Cloudflare nem é chamado');
globalThis.fetch = f0;
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
