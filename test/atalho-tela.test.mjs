// Tela "Atalho do iPhone" (Configurações): código pessoal com Mostrar/Copiar, link do atalho, pessoas (proprietário) e a caixa de entrada na aba Extratos.
// Servidor com banco novo (grupo 'atalho'):  node test/rodar.mjs atalho-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8819', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const br = await chromium.launch();
async function abrir(quem, larg = 1280) { const ctx = await br.newContext({ viewport: { width: larg, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]); const page = await ctx.newPage(); page.erros = []; page.on('pageerror', (e) => page.erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort()); await page.goto(B + '/'); await page.waitForTimeout(2500); return page; }
const irConfig = async (p) => { await p.evaluate(() => document.querySelector('[data-tab="configuracoes"]').click()); await p.waitForTimeout(900); };
const abrirAtalho = async (p) => { await irConfig(p); await p.click('[data-cf="atalho"]'); await p.waitForSelector('#overlayAtalho.show .atl-sec', { timeout: 6000 }); await p.waitForTimeout(500); };
const txt = (p) => p.evaluate(() => document.getElementById('overlayAtalhoC').innerText.replace(/\s+/g, ' '));

// advogada
const ana = await abrir('ana'); await irConfig(ana);
check(await ana.evaluate(() => !!document.querySelector('[data-cf="atalho"]')), 'a advogada vê "Atalho do iPhone" em Minha conta');
await abrirAtalho(ana);
let t = await txt(ana);
check(/Seu código pessoal/i.test(t) && /Gerar meu código/.test(t) && /ainda não foi cadastrado/.test(t), 'sem código ainda, e o link do atalho ainda não foi cadastrado');
await ana.click('[data-atla="gerar"]'); await ana.waitForTimeout(1500);
let cod = await ana.evaluate(() => document.getElementById('atlCod').innerText);
check(/^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/.test(cod), 'o código aparece depois de gerar: ' + cod);
await ana.click('[data-atla="mostrar"]'); await ana.waitForTimeout(300);
check(/•{4}/.test(await ana.evaluate(() => document.getElementById('atlCod').innerText)), 'Esconder mascara o código (só os 4 últimos)');
await ana.click('[data-atla="mostrar"]'); await ana.waitForTimeout(300);
await ana.click('[data-atla="copiar"]'); await ana.waitForTimeout(500);
check((await ana.evaluate(() => navigator.clipboard.readText())) === cod, 'Copiar põe o código na área de transferência');
ana.on('dialog', (d) => d.accept());
await ana.click('[data-atla="novo"]'); await ana.waitForTimeout(1500);
const cod2 = await ana.evaluate(() => document.getElementById('atlCod').innerText); check(cod2 !== cod, 'Gerar novo código troca o código');
const velho = await fetch(B + '/api/enviar', { method: 'POST', headers: { authorization: 'Bearer ' + cod, 'x-nome': 'a.pdf' }, body: Buffer.from('%PDF-1.4 x') });
check(velho.status === 401, 'o código antigo deixou de valer');

// chega o extrato pelo iPhone (simulado) e aparece na aba Extratos dela
const env = await fetch(B + '/api/enviar', { method: 'POST', headers: { authorization: 'Bearer ' + cod2, 'x-nome': encodeURIComponent('extrato c6.pdf'), 'content-type': 'application/pdf' }, body: Buffer.from('%PDF-1.4 teste') });
check(env.status === 200, 'o iPhone da Ana envia um extrato');
await ana.reload(); await ana.waitForTimeout(3000);
check(/1 extrato recebido do celular esperando conferência/.test(await ana.evaluate(() => document.getElementById('inicioExtratos').innerText.replace(/\s+/g, ' '))), 'o Início dela avisa: "1 extrato recebido do celular esperando conferência"');
await ana.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await ana.waitForTimeout(2500);
const ext = await ana.evaluate(() => document.getElementById('bodyExtratos').innerText.replace(/\s+/g, ' '));
check(/Recebidos pelo Compartilhar \(1\)/.test(ext) && /extrato c6\.pdf/.test(ext), 'a caixa dela aparece em Extratos: "Recebidos pelo Compartilhar (1)"');
await abrirAtalho(ana);
check(/1 arquivo/.test(await txt(ana)) && /extrato c6\.pdf/.test(await txt(ana)), 'a tela do atalho mostra o último envio e 1 arquivo esperando');

// proprietário: link, pessoas, instruções
const dono = await abrir('dono'); await abrirAtalho(dono);
t = await txt(dono);
check(/Link do atalho/i.test(t) && /Pessoas com atalho/i.test(t) && /Ana Advogada/.test(t) && /ativo/.test(t) && /Caio Estagiario/.test(t) && /não usa/.test(t), 'o proprietário vê o link e a lista de pessoas (a estagiária "não usa")');
await dono.fill('#atlLink', 'https://www.icloud.com/shortcuts/teste123'); await dono.click('[data-atla="link"]'); await dono.waitForTimeout(1500);
check(/Link salvo/.test(await txt(dono)) && await dono.evaluate(() => !!document.querySelector('a.atl-azul[href*="icloud.com/shortcuts/teste123"]')), 'o link salvo vira o botão "Adicionar o atalho ao iPhone"');
await dono.click('[data-atla="prompt"]'); await dono.waitForTimeout(500);
const pr = await dono.evaluate(() => navigator.clipboard.readText());
check(/api\/enviar/.test(pr) && /Authorization: Bearer/.test(pr) && /25 MB/.test(pr), 'as instruções para montar o atalho foram copiadas');
await dono.click('[data-atla="desligar"]'); dono.on('dialog', (d) => d.accept()); await dono.waitForTimeout(300);
await ana.click('[data-atla="atualizar"]'); await ana.waitForTimeout(1200);
check(await ana.evaluate(() => !!document.querySelector('a.atl-azul[href*="icloud.com/shortcuts/teste123"]')), 'a Ana vê o botão com o link cadastrado');

// estagiária não vê
const caio = await abrir('caio'); await irConfig(caio);
check(await caio.evaluate(() => !document.querySelector('[data-cf="atalho"]')), 'a estagiária não vê o atalho');
// celular
const cel = await abrir('ana', 390); await abrirAtalho(cel);
check(await cel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular a tela cabe na largura');
if (process.env.FOTO) await cel.screenshot({ path: process.env.FOTO + '/atalho-celular.png' });
if (process.env.FOTO) await dono.screenshot({ path: process.env.FOTO + '/atalho-dono.png' });
for (const p of [ana, dono, caio, cel]) check(p.erros.length === 0, 'sem erros de script' + (p.erros[0] ? ': ' + p.erros[0] : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
