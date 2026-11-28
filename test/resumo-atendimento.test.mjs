// Ficha de atendimento (sem navegador): pedido ao modelo, leitura do JSON, regras de fidelidade (número fora da transcrição = "conferir"; tempo inválido some),
// ordem Cloudflare → Claude e a limpeza dos áudios antigos.   node test/resumo-atendimento.test.mjs
import { montarEntrada, extrairJson, limparResumo, numerosForaDaTranscricao, resumir, PROMPT_SISTEMA, MODELOS_CF, ESPERADOS } from '../src/resumo-atendimento.js';
import { limparAudiosAntigos } from '../src/atendimentos.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const itens = [{ ini: 0, fim: 5, texto: 'Bom dia, conte o que aconteceu.' }, { ini: 192, fim: 200, texto: 'Fui demitido em março de 2024, sem justa causa. Trabalhei 6 anos lá.' }, { ini: 3700, fim: 3710, texto: 'O salário era de R$ 3.500,00.' }];
const entrada = montarEntrada(itens);
check(entrada.split('\n')[0] === '[00:00] Bom dia, conte o que aconteceu.' && entrada.includes('[03:12] Fui demitido') && entrada.includes('[1:01:40] O salário'), 'a entrada é "[mm:ss] texto" (com horas quando passa de 1 h)');
check(montarEntrada([{ ini: 5, texto: 'oi', falante: '1' }], { 1: 'Cliente' }) === '[00:05] Cliente: oi', 'se houver falante, vai com o nome dado');
check(/SOMENTE o que está na transcrição/.test(PROMPT_SISTEMA) && /não invente/i.test(PROMPT_SISTEMA) && ESPERADOS.every((x) => PROMPT_SISTEMA.includes(x)) && /JSON/.test(PROMPT_SISTEMA), 'o pedido proíbe inventar, exige JSON e lista os itens esperados');

// leitura do JSON
check(extrairJson('```json\n{"fatos":[{"texto":"a","t":1}]}\n```').fatos.length === 1, 'JSON dentro de cerca ```json');
check(extrairJson('Claro! Aqui está:\n{"fatos":[{"texto":"a","t":1}]}\nEspero ter ajudado.').fatos[0].texto === 'a', 'JSON com texto antes e depois');
check(extrairJson('<think>pensando {x}</think>{"fatos":[]}').fatos.length === 0, 'ignora o raciocínio do modelo');
check(extrairJson('sem json') === null, 'sem JSON devolve nulo');

// fidelidade
check(numerosForaDaTranscricao('Demitido em março de 2024', entrada) === false && numerosForaDaTranscricao('Recebia R$ 3.500,00', entrada) === false, 'números que existem na transcrição não geram alerta');
check(numerosForaDaTranscricao('Recebia R$ 9.999,00', entrada) === true && numerosForaDaTranscricao('Trabalhou 12 anos', entrada) === true, 'número que NÃO está na transcrição marca "conferir"');
const limpo = limparResumo({ fatos: [{ texto: 'Demitido em março de 2024', t: 192 }, { texto: 'Ganhava R$ 9.999,00', t: 3700 }, { texto: 'Tempo absurdo', t: 99999 }, { texto: '', t: 1 }, 'texto solto'], quem: [], naoMencionado: ['data dos fatos'] }, entrada, 3710);
check(limpo.secoes.fatos.length === 4 && limpo.secoes.fatos[0].conferir === undefined && limpo.secoes.fatos[1].conferir === true && limpo.secoes.fatos[2].t === null && limpo.secoes.fatos[3].texto === 'texto solto', 'limpeza: marca o número estranho, anula o tempo fora da conversa, descarta item vazio e aceita texto solto');
check(limpo.naoMencionado[0] === 'data dos fatos' && limparResumo({ fatos: [] }, entrada, 10) === null && limparResumo(null, entrada, 10) === null, 'mantém "não mencionado"; resposta sem nenhum item é recusada');

// provedores: Cloudflare primeiro; se falhar ou vier fora do formato, o Claude
const certo = '{"quem":[],"fatos":[{"texto":"Demitido em março de 2024","t":192}],"pedidos":[],"valoresDatas":[],"documentos":[],"pendencias":[],"prazos":[],"naoMencionado":["data dos fatos"]}';
const usos = [];
const cfEnv = (resp) => ({ AI: { run: async (modelo, ent) => { usos.push(modelo); if (resp instanceof Error) throw resp; return resp && resp.choices ? resp : { response: resp }; } } });
let r = await resumir(cfEnv('```json\n' + certo + '\n```'), itens, 3710);
check(r.provedor === 'cloudflare' && r.modelo === MODELOS_CF[0] && r.secoes.fatos[0].t === 192 && usos.length === 1, 'o modelo aberto da Cloudflare responde primeiro');
usos.length = 0; r = await resumir(cfEnv({ choices: [{ message: { content: certo } }] }), itens, 3710);
check(r.provedor === 'cloudflare', 'aceita a resposta no formato de chat (choices)');
usos.length = 0;
const falhaPrimeiro = { AI: { run: async (modelo) => { usos.push(modelo); if (modelo === MODELOS_CF[0]) throw new Error('fora do ar'); return { response: certo }; } } };
r = await resumir(falhaPrimeiro, itens, 3710);
check(r.modelo === MODELOS_CF[1] && usos.length === 2, 'se o primeiro modelo da Cloudflare falha, tenta o segundo (também gratuito)');
const f0 = globalThis.fetch; let pedido = null;
globalThis.fetch = async (url, op) => { pedido = { url: String(url), chave: op.headers['x-api-key'], corpo: JSON.parse(op.body) }; return new Response(JSON.stringify({ content: [{ type: 'text', text: certo }] }), { status: 200 }); };
r = await resumir({ ...cfEnv(new Error('limite')), ANTHROPIC_API_KEY: 'k' }, itens, 3710);
check(r.provedor === 'claude' && pedido.url === 'https://api.anthropic.com/v1/messages' && pedido.chave === 'k' && pedido.corpo.system === PROMPT_SISTEMA && pedido.corpo.messages[0].content.startsWith('TRANSCRIÇÃO:\n[00:00]'), 'se a Cloudflare falha, o Claude (a chave que já existe) faz o resumo, com o mesmo pedido');
r = await resumir({ ...cfEnv('não sei responder em JSON'), ANTHROPIC_API_KEY: 'k' }, itens, 3710);
check(r.provedor === 'claude', 'resposta fora do formato também passa para o Claude');
let erro = null; try { await resumir(cfEnv(new Error('x')), itens, 3710); } catch (e) { erro = e; }
check(erro && !erro.semProvedor, 'sem reserva e com o principal falhando, o erro sobe');
erro = null; try { await resumir({}, itens, 3710); } catch (e) { erro = e; }
check(erro && erro.semProvedor === true, 'sem nenhum serviço ligado, diz que nenhum está ligado');
erro = null; try { await resumir(cfEnv(certo), [{ ini: 0, texto: 'oi' }], 10); } catch (e) { erro = e; }
check(erro && erro.curto === true, 'transcrição curta demais não vai ao modelo');
globalThis.fetch = f0;

// limpeza diária dos áudios antigos (D1 e R2 de mentira)
const linhas = new Map(); const apagados = [];
const db = { prepare: (sql) => ({ bind: (...a) => ({
  first: async () => { const k = a.join('|'); return linhas.has(k) ? { dados: linhas.get(k) } : null; },
  all: async () => ({ results: [...linhas.entries()].filter(([k]) => k.startsWith(a[0] + '|') && !k.endsWith('|_cfg')).map(([, v]) => ({ dados: v })) }),
  run: async () => { if (/^INSERT/.test(sql)) linhas.set(a[0] + '|' + a[1], a[2]); },
}) }) };
const R2 = { delete: async (k) => apagados.push(k) };
const dia = 86400000, agora = Date.parse('2026-11-29T12:00:00Z');
const at = (id, dias) => linhas.set('_atendimentos|' + id, JSON.stringify({ id, criadoEm: new Date(agora - dias * dia).toISOString(), trechos: [{ i: 0, r2: 'aten/dono/' + id + '/0', tam: 10 }], transc: { 0: { itens: [{ texto: 'x' }] } } }));
at('velho', 100); at('novo', 5);
const env = { DB: db, ARQUIVOS: R2 };
check(await limparAudiosAntigos(env, agora) === 0 && apagados.length === 0, 'sem prazo configurado (padrão "nunca"), não apaga nada');
linhas.set('_atendimentos|_cfg', JSON.stringify({ id: '_cfg', apagarAudioDias: 90 }));
const n = await limparAudiosAntigos(env, agora);
const velho = JSON.parse(linhas.get('_atendimentos|velho'));
check(n === 1 && apagados.length === 1 && apagados[0] === 'aten/dono/velho/0' && velho.trechos[0].r2 === '' && velho.transc[0].itens[0].texto === 'x' && JSON.parse(linhas.get('_atendimentos|novo')).trechos[0].r2 !== '', 'com prazo de 90 dias, apaga só o áudio do atendimento de 100 dias e mantém a transcrição; o recente fica');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
