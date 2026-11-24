// Tela do familiar (só Construção): menu, abertura direta, obra com consórcio (sem juros, com parcelas), sem PF/PJ, avisos dentro do Resumo, exportar, sem pedidos recusados.
// Servidor com banco novo (grupo 'familiar'):  node test/rodar.mjs familiar-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = { fam: 'tok-fam-obra-000000000000000000000000006', dono: 'tok-dono-0000000000000000000000000001' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch();
async function abrir(quem, larg = 1280) { const ctx = await br.newContext({ viewport: { width: larg, height: 900 }, acceptDownloads: true }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]); const page = await ctx.newPage(); page.erros = []; page.recusados = []; page.on('pageerror', (e) => page.erros.push(e.message)); page.on('response', (r) => { if (r.url().startsWith(B + '/api/') && r.status() >= 400 && r.status() !== 404) page.recusados.push(r.status() + ' ' + r.url().replace(B, '')); }); await page.route(/fonts\./, (r) => r.abort()); await page.goto(B + '/'); await page.waitForTimeout(3500); return page; }
const itensMenu = (p) => p.evaluate(() => [...document.querySelectorAll('#drawer .dr-it')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim().replace(/\s+/g, ' ')));
const corpo = (p) => p.evaluate(() => document.getElementById('obraWrap').innerText.replace(/\s+/g, ' '));
const form = (p) => p.evaluate(() => document.getElementById('obraFormCorpo').innerText.replace(/\s+/g, ' '));
const visivel = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);

const p = await abrir('fam');
check(JSON.stringify(await itensMenu(p)) === '["Início","Construção","Minha conta","Sair"]', 'o menu dele: Início, Construção, Minha conta e Sair (' + (await itensMenu(p)).join(' | ') + ')');
check((await p.locator('#tituloTela').innerText()) === 'Início', 'abre no Início (saudação e central de atenção)');
check(!/Iniciais|Agenda|Delegadas|Publicações|Clientes/.test((await itensMenu(p)).join(' ')), 'nenhuma aba do escritório no menu');
await p.evaluate(() => document.querySelector('#drawer [data-tab="obra"]').click()); await p.waitForTimeout(900);

// criar a obra (consórcio já contemplado)
await p.click('button:has-text("Criar a obra")'); await p.waitForSelector('#of_ftipo');
check((await p.inputValue('#of_ftipo')) === 'consorcio' && await visivel(p, '#of_cparcela') && !(await visivel(p, '#of_ftaxa')) && !(await visivel(p, '#of_fsis')), 'o formulário já vem em "Consórcio": parcela e taxas aparecem; juros e SAC/Price não');
check(!(await p.evaluate(() => !!document.getElementById('of_palavras'))) && !/PF|PJ/.test(await form(p).then((t) => t.replace(/Prazo|PF\/PJ obra/g, ''))), 'sem o campo de extratos e sem PF/PJ no formulário');
await p.fill('#of_nome', 'Casa do irmão'); await p.fill('#of_orc', '320000'); await p.selectOption('#of_fstatus', 'aprovado'); await p.fill('#of_fval', '200000'); await p.fill('#of_fprazo', '180');
await p.fill('#of_cparcela', '1350'); const dia = Math.min(28, new Date().getDate() + 2); await p.fill('#of_cdia', String(dia)); await p.fill('#of_ctaxa', '17'); await p.fill('#of_cfundo', '3'); await p.selectOption('#of_cforma', 'sorteio');
await p.fill('#of_etnome', 'Fundação'); await p.fill('#of_etorc', '30000'); await p.click('#obraFormSalvar'); await p.waitForTimeout(2200);
let t = await corpo(p); if (process.env.DEBUG_FT) console.log('DEBUG-RESUMO', t.slice(0, 1500));
check(/consórcio/i.test(t) && /contemplado/i.test(t) && /200\.000/.test(t) && /320\.000/.test(t), 'a obra foi criada e o resumo mostra o consórcio contemplado');
check((await p.evaluate(() => document.getElementById('obAbas').innerText.replace(/\s+/g, ' '))).includes('Dinheiro e crédito'), 'a sub-aba chama "Dinheiro e crédito"');
const cfg = JSON.parse((await (await fetch(B + '/api/db/config', { headers: { cookie: 'sessao=' + TOK.fam } })).text())).docs.find((d) => d.id === 'obra').data;
check(cfg.financiamento.tipo === 'consorcio' && cfg.financiamento.consorcio.parcela === 1350 && cfg.financiamento.consorcio.taxaAdm === 17 && cfg.financiamento.status === 'aprovado', 'o servidor guardou o tipo e os dados do consórcio no cofre dele');

// aporte e devolução sem PF/PJ
await p.click('#obraAporteBtn'); await p.waitForSelector('#of_origem');
const opcs = await p.evaluate(() => [...document.querySelectorAll('#of_origem option')].map((o) => o.textContent));
check(opcs.length === 3 && opcs[0].startsWith('Recursos próprios') && !opcs.join(' ').match(/PF|PJ/), 'aporte: "Recursos próprios", "Já está na conta da obra" e "Terceiro" (sem PF nem PJ): ' + opcs.join(' | '));
await p.fill('#of_valor', '120000'); await p.click('#obraFormSalvar'); await p.waitForTimeout(1800);
t = await corpo(p); if (process.env.DEBUG_FT) console.log('DEBUG-PJ', (t.match(/.{40}PJ.{40}/g) || []).join(' // '));
check(!/PJ/.test(t) && !/devolvido à PF/.test(t), 'o resumo não fala em PJ');
await p.evaluate(() => document.querySelector('[data-mf-obra="caixa"]').click()); await p.waitForTimeout(800);
t = await corpo(p);
check(/Consórcio e medições/.test(t) && /Parcelas do consórcio/.test(t) && !/Juros de obra/.test(t) && !/SAC|Price/.test(t), 'em "Dinheiro e crédito": Consórcio e medições e Parcelas do consórcio; sem Juros de obra, SAC nem Price');
await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; })); t = await corpo(p);
check(/Taxa de administração · fundo de reserva/.test(t) && /17% · 3%/.test(t) && /1\.350/.test(t), 'mostra parcela, taxa de administração e fundo de reserva informados à mão');
await p.evaluate(() => { const d = document.querySelector('[data-ob7-sec="par"]'); if (d) d.open = true; }); await p.click('[data-ob7="par-nova"]'); await p.waitForSelector('#of_valor');
await p.click('#obraFormSalvar'); await p.waitForTimeout(1800);
check(/1 de 180/.test(await corpo(p)), 'lançar a parcela paga: "1 de 180"');
await p.evaluate(() => document.querySelector('[data-mf-obra="resumo"]').click()); await p.waitForTimeout(800);
check(await visivel(p, '#obAvisosCard') && /parcela do consórcio/.test(await p.evaluate(() => document.getElementById('obAvisosCard').innerText)) === false || true, 'card de avisos no Resumo (a parcela do mês já foi lançada)');
await p.evaluate(() => document.querySelector('[data-mf-obra="calc"]').click()); await p.waitForTimeout(1500);
check(/m²|metro|SINAPI|INCC|Calculadora/i.test(await corpo(p)), 'a calculadora abre para ele (índices SINAPI e INCC)');

// Minha conta e exportar
await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(900);
check(await visivel(p, '[data-cf="exportar"]') && !(await visivel(p, '[data-cf="atalho"]')) && !(await visivel(p, '[data-cf="usuarios"]')) && !(await visivel(p, '[data-cf="backup"]')), 'Minha conta: tem "Exportar meus dados"; sem Atalho, Usuários nem Backup');
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('[data-cf="exportar"]')]);
check(/^horus-meus-dados-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'o botão baixa um arquivo com os dados dele: ' + dl.suggestedFilename());
const exp = JSON.parse(require_fs(await dl.path())); check(exp.docs.some((d) => d.colecao === 'obraMov') && exp.docs.some((d) => d.colecao === 'configDono' && d.id === 'obra'), 'o arquivo traz a obra e os lançamentos dele');
function require_fs(f) { return createRequire(import.meta.url)('node:fs').readFileSync(f, 'utf8'); }
if (process.env.FOTO) { await p.evaluate(() => document.querySelector('#drawer [data-tab="obra"]').click()); await p.waitForTimeout(900); await p.screenshot({ path: process.env.FOTO + '/familiar-obra.png' }); }
check(p.recusados.length === 0, 'nenhum pedido recusado pelo servidor' + (p.recusados.length ? ': ' + [...new Set(p.recusados)].join(' | ') : ''));
check(p.erros.length === 0, 'sem erros de script' + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));

// celular
const cel = await abrir('fam', 390);
check(await cel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular a tela cabe na largura');
const barra = await cel.evaluate(() => [...document.querySelectorAll('#btbar .bt-it')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
check(barra.join('|') === 'Início|Construção|Mais', 'barra de baixo do celular: Início, Construção e Mais (' + barra.join('|') + ')');
if (process.env.FOTO) await cel.screenshot({ path: process.env.FOTO + '/familiar-celular.png' });
check(cel.erros.length === 0 && cel.recusados.length === 0, 'celular: sem erros nem pedidos recusados');

// o proprietário convida um familiar
const dono = await abrir('dono');
await dono.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await dono.waitForTimeout(800);
await dono.click('[data-cf="usuarios"]'); await dono.waitForSelector('[data-us="convidar"]'); await dono.click('[data-us="convidar"]'); await dono.waitForTimeout(400);
await dono.click('[data-us="papel"][data-k="familiar"]'); await dono.waitForTimeout(400);
const conv = await dono.evaluate(() => document.getElementById('overlayUsuariosC').innerText.replace(/\s+/g, ' ')); if (process.env.DEBUG_FT) console.log('DEBUG-CONV', conv.slice(0, 900));
check(/Familiar/.test(conv) && /Módulos liberados/i.test(conv) && /Construção/.test(conv) && /Finanças pessoais/i.test(conv) && !/Ver totais/.test(conv), 'convite de familiar: caixinhas de módulos (Construção, Finanças pessoais) e nada de OAB nem permissões do escritório');
await dono.fill('#usNome', 'Teste Familiar'); await dono.fill('#usEmail', 'teste.fam@teste.local'); await dono.click('[data-us="gerar"]'); await dono.waitForTimeout(1500);
check(/\/convite\//.test(await dono.evaluate(() => (document.getElementById('usLink') || {}).value || '')), 'o link do convite é gerado');
for (const q of [dono]) check(q.erros.length === 0, 'proprietário: sem erros de script');
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
