// Transcrição (sem navegador): formato da resposta do Whisper (Workers AI), uso do serviço e erros. O Claude não transcreve áudio (é só a reserva do resumo).
//   node test/transcricao.test.mjs
import { itensDoWhisper, transcrever, provedoresDisponiveis, PROVEDORES, MODELO_CF, ORDEM_PADRAO } from '../src/transcricao.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const bytes = new TextEncoder().encode('audio-falso');

let it = itensDoWhisper({ text: 'Olá. Tudo bem?', segments: [{ start: 0, end: 1.5, text: ' Olá. ' }, { start: 1.5, end: 3, text: ' Tudo bem? ' }, { start: 3, end: 4, text: '  ' }] });
check(it.length === 2 && it[0].texto === 'Olá.' && it[1].ini === 1.5 && it[1].fim === 3, 'Whisper: usa os segmentos com tempo e descarta os vazios');
it = itensDoWhisper({ text: '  Só texto  ' });
check(it.length === 1 && it[0].texto === 'Só texto' && it[0].ini === 0, 'Whisper: sem segmentos, vira um item só');
check(itensDoWhisper({}).length === 0 && itensDoWhisper(null).length === 0, 'Whisper: resposta vazia não gera item');

const chamadas = [];
const cf = (ok) => ({ AI: { run: async (modelo, entrada) => { chamadas.push([modelo, entrada.language, entrada.task, typeof entrada.audio, entrada.vad_filter]); if (!ok) { const e = new Error('limite'); e.status = 429; throw e; } return { segments: [{ start: 0, end: 2, text: 'texto do whisper' }] }; } } });
let r = await transcrever(cf(true), bytes, 'audio/mp4');
check(r.provedor === 'cloudflare' && r.itens[0].texto === 'texto do whisper' && chamadas[0][0] === MODELO_CF && chamadas[0][1] === 'pt' && chamadas[0][2] === 'transcribe' && chamadas[0][3] === 'string' && chamadas[0][4] === true, 'usa o Whisper turbo da Cloudflare: português, áudio em base64, filtro de silêncio');
let erro = null; try { await transcrever(cf(false), bytes, 'audio/mp4'); } catch (e) { erro = e; }
check(erro && !erro.semProvedor && erro.status === 429, 'se o Whisper falha (limite), o erro sobe para a rota explicar (não há reserva de transcrição)');
erro = null; try { await transcrever({}, bytes, 'audio/mp4'); } catch (e) { erro = e; }
check(erro && erro.semProvedor === true, 'sem o recurso de IA ligado, o erro diz que nenhum serviço está ligado');
check(JSON.stringify(provedoresDisponiveis({ AI: {} })) === '["cloudflare"]' && JSON.stringify(provedoresDisponiveis({})) === '[]', 'a lista de serviços ligados depende do que está configurado');
check(JSON.stringify(ORDEM_PADRAO) === '["cloudflare"]' && !PROVEDORES.grok, 'o Grok não existe mais');
// áudio grande: o base64 não estoura a pilha
const grande = new Uint8Array(3 * 1024 * 1024).fill(65);
chamadas.length = 0; r = await transcrever(cf(true), grande.buffer, 'audio/webm');
check(r.provedor === 'cloudflare' && chamadas.length === 1, 'um trecho de 3 MB é codificado sem estourar a pilha');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
