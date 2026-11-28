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
check(/Seu código pessoal/i.test(t) && /Gerar meu código/.test(t) && /Gere o seu código no passo 1/.test(t) && await ana.evaluate(() => document.querySelector('[data-atla="prompt"]').disabled), 'sem código ainda: as instruções ficam desligadas até gerar o código');
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

await ana.click('[data-atla="prompt"]'); await ana.waitForTimeout(500);
const prAna = await ana.evaluate(() => navigator.clipboard.readText());
check(prAna.includes('Bearer ' + cod2) && /^Crie um atalho chamado "Enviar extrato ao Horus"/.test(prAna) && /api\/enviar/.test(prAna) && /apenas uma notificação/.test(prAna) && /Não abra nenhum app nem site/.test(prAna) && prAna.length < 1600, 'descrição da Ana: pronta para o "Descrever um atalho", com o código dela, curta (' + prAna.length + ' caracteres) e terminando só com a notificação');
check(await ana.evaluate(() => !!document.querySelector('a[href="shortcuts://create-shortcut"]')) && /Descrever um atalho/.test(await txt(ana)) && /Conferir antes de salvar/.test(await txt(ana)), 'há "Abrir o app Atalhos", a instrução de colar em "Descrever um atalho" e a lista para conferir');
// proprietário: link, pessoas, instruções
const dono = await abrir('dono'); await abrirAtalho(dono);
t = await txt(dono);
check(/Pessoas com atalho/i.test(t) && /Ana Advogada/.test(t) && /ativo/.test(t) && /Caio Estagiario/.test(t) && /não usa/.test(t), 'o proprietário vê a lista de pessoas (a estagiária "não usa")');
check(!(await dono.evaluate(() => !!document.getElementById('atlLink'))) && !/compartilhável/.test(await txt(dono)), 'todos usam a descrição com o próprio código (sem link nem atalho compartilhável)');
await dono.click('[data-atla="gerar"]'); await dono.waitForTimeout(1500);
const codDono = await dono.evaluate(() => document.getElementById('atlCod').innerText);
await dono.click('[data-atla="prompt"]'); await dono.waitForTimeout(500);
const prDono = await dono.evaluate(() => navigator.clipboard.readText());
check(prDono.includes('Bearer ' + codDono) && !/\{CÓDIGO/.test(prDono) && /25 MB/.test(prDono), 'o proprietário também recebe a descrição completa, com o código dele: ' + codDono);
check(prDono !== prAna && !prDono.includes(cod2) && !prAna.includes(codDono), 'cada pessoa recebe só o próprio código');
await dono.click('[data-atla="desligar"]'); dono.on('dialog', (d) => d.accept()); await dono.waitForTimeout(300);

// estagiária não vê
const caio = await abrir('caio'); await irConfig(caio);
check(await caio.evaluate(() => !document.querySelector('[data-cf="atalho"]')), 'a estagiária não vê o atalho');
// aba Android: compartilhar do Chrome (recomendado) e atalho com código (alternativa)
const ana2 = await abrir('ana'); await abrirAtalho(ana2);
await ana2.click('[data-atla="aba-android"]'); await ana2.waitForTimeout(400);
const tAnd = await ana2.evaluate(() => document.getElementById('overlayAtalhoC').innerText.replace(/\s+/g, ' '));
check(/Instalar o Horus no celular/i.test(tAnd) && /recomendado/i.test(tAnd) && /Compartilhar/i.test(tAnd) && /HTTP Shortcuts/i.test(tAnd) && /Copiar as instruções do atalho/i.test(tAnd), 'aba Android: instalar o Horus (recomendado) e a alternativa HTTP Shortcuts com o código');
check(/Neste aparelho/i.test(tAnd) && /Último envio/i.test(tAnd), 'aba Android: mostra se o aparelho está instalado e o último envio');
await ana2.click('[data-atla="aba-iphone"]'); await ana2.waitForTimeout(300);
check(/Seu código pessoal/i.test(await ana2.evaluate(() => document.getElementById('overlayAtalhoC').innerText)), 'voltar para a aba iPhone mostra o código pessoal');
// celular
const cel = await abrir('ana', 390); await abrirAtalho(cel);
check(await cel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular a tela cabe na largura');
if (process.env.FOTO) await cel.screenshot({ path: process.env.FOTO + '/atalho-celular.png' });
if (process.env.FOTO) await dono.screenshot({ path: process.env.FOTO + '/atalho-dono.png' });
for (const p of [ana, ana2, dono, caio, cel]) check(p.erros.length === 0, 'sem erros de script' + (p.erros[0] ? ': ' + p.erros[0] : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
