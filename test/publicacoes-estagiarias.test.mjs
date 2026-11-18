// Publicações das estagiárias com a mesma regra dos advogados: lida, tratada ou "não é prazo" de QUALQUER pessoa tira a publicação das "Não lidas" da estagiária
// (ela pode devolver com ↩); a estagiária também marca "Não é prazo" (não esconde dos advogados); aba "Resolvidas por outros".
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs publicacoes-estagiarias
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004', dani: 'tok-est-dani-0000000000000000000000005' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, pth, b) => { const x = await fetch(B + pth, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const pub = async (n, id) => (await api(n, 'GET', '/api/djen/lista')).j.pubs.find((p) => p.id === id);
const zera = async () => { for (const n of ['dono', 'ana', 'caio', 'dani']) await api(n, 'POST', '/api/djen/marcar', { ids: ['100', '101', '102', '103'], lida: null, semPrazo: null, tratada: false }); };
await zera();

console.log('\n— a lida de qualquer pessoa limpa a lista da estagiária');
await api('ana', 'POST', '/api/djen/marcar', { ids: ['100'], lida: true });
let pc = await pub('caio', '100'), pd = await pub('dani', '100'), pdn = await pub('dono', '100'), pa = await pub('ana', '100');
check(pc.lida === true && pc.lidaAuto === true && pd.lida === true && pc.leuPor.some((x) => x.nome === 'Ana'), 'a Ana (advogada) lê a 100: some das Não lidas do Caio e da Dani, com "lida por Ana"');
check(pdn.lida === false && pdn.leuPor.some((x) => x.nome === 'Ana'), 'para o proprietário continua não lida ("Ana leu"): nada muda para advogados e proprietário');
await api('dono', 'POST', '/api/djen/marcar', { ids: ['103'], lida: true });
check((await pub('caio', '103')).lida === true, 'a leitura do proprietário também limpa a lista da estagiária');
await api('caio', 'POST', '/api/djen/marcar', { ids: ['101'], lida: true });
check((await pub('dani', '101')).lida === true && (await pub('dono', '101')).lida === false, 'o Caio lê a 101: some para a Dani; para o proprietário continua não lida');

console.log('\n— "Não é prazo" da estagiária');
await zera();
const r = await api('caio', 'POST', '/api/djen/marcar', { ids: ['102'], semPrazo: true, lida: true });
check(r.j.alteradas === 1 && (await pub('caio', '102')).semPrazo === true, 'a estagiária consegue marcar "Não é prazo" (antes o servidor ignorava)');
pd = await pub('dani', '102'); pa = await pub('ana', '102');
check(pd.lida === true && pd.leuPor.some((x) => x.nome === 'Caio' && x.semPrazo === true), 'a Dani vê a 102 como lida, com "Caio: não é prazo"');
check(pa.lida === false && pa.semPrazo === false && pa.leuPor.some((x) => x.nome === 'Caio' && x.semPrazo === true), 'a Ana (advogada) continua com a sugestão e não lida, vendo "Caio: não é prazo" — ela decide');

console.log('\n— a estagiária pode devolver; a escolha dela vale');
await api('dani', 'POST', '/api/djen/marcar', { ids: ['102'], lida: false });
check((await pub('dani', '102')).lida === false && (await pub('caio', '102')).lida === true, 'a Dani devolve a 102 para não lida (↩) e ela volta só para a Dani');
await api('ana', 'POST', '/api/djen/marcar', { ids: ['102'], lida: true });
check((await pub('dani', '102')).lida === false, 'mesmo que outra pessoa leia depois, a escolha da Dani continua valendo');

console.log('\n— tratar continua igual');
await zera();
await api('caio', 'POST', '/api/djen/marcar', { ids: ['100'], tratada: true, como: 'prazo' });
check((await pub('dani', '100')).lida === true && (await pub('ana', '100')).lida === false && (await pub('ana', '100')).tratadas[0].papel === 'estagiario', 'estagiária que trata: a outra estagiária vê como lida; a advogada continua com "preparada por Caio"');
await api('ana', 'POST', '/api/djen/marcar', { ids: ['102'], tratada: true, como: 'prazo' });
check((await pub('caio', '102')).lida === true && (await pub('dani', '102')).lida === true, 'advogada que trata: some para as duas estagiárias');

console.log('\n— contagem e aba na tela');
await zera();
const antes = (await api('dani', 'GET', '/api/djen/estado')).j.naoLidas;
await api('ana', 'POST', '/api/djen/marcar', { ids: ['100', '102'], lida: true });
const depois = (await api('dani', 'GET', '/api/djen/estado')).j.naoLidas;
check(antes - depois === 2, 'o número de não lidas da Dani cai em 2 (de ' + antes + ' para ' + depois + ')');
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK.dani, url: B }]);
const page = await ctx.newPage(); page.erros = []; page.on('pageerror', (e) => page.erros.push(e.message)); await page.route(/fonts\./, (x) => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { publicacoes: 'naolidas' }, per: 6 })); } catch (e) { } });
await page.goto(B + '/'); await page.waitForTimeout(2500); await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(1400);
const card = (id) => page.evaluate((i) => { const c = document.querySelector('.pb-card[data-cid="' + i + '"]'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, id);
check((await card('100')) === '' && (await card('102')) === '', 'em "Não lidas" a Dani não vê mais a 100 nem a 102');
const aba = await page.evaluate(() => { const b = document.querySelector('[data-pb="filtro"][data-v="tratadas"]'); return b ? b.innerText.replace(/\s+/g, ' ').trim() : ''; });
check(/Resolvidas por outros/.test(aba) && /2/.test(aba), 'aparece a aba "Resolvidas por outros" com o número 2: ' + aba);
await page.evaluate(() => document.querySelector('[data-pb="filtro"][data-v="tratadas"]').click()); await page.waitForTimeout(500);
const c100 = await card('100');
check(/lida por Ana/.test(c100), 'nela o cartão mostra "lida por Ana": ' + c100.slice(0, 110));
await page.evaluate(() => { const b = document.querySelector('.pb-card[data-cid="100"] [data-pb="lido"]'); if (b) b.click(); }); await page.waitForTimeout(1000);
check((await pub('dani', '100')).lida === false && (await pub('caio', '100')).lida === true, 'o botão ↩ do cartão devolve a 100 para "Não lidas" da Dani (e só dela)');
check(page.erros.length === 0, 'sem erros de JavaScript' + page.erros.join(' | '));
await br.close();
await zera();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
