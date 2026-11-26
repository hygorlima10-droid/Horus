// Janela que abre por cima de outra fica por cima (antes, "Adiar" aparecia atrás da ficha do prazo e não dava para escolher a data).
// Servidor do grupo 'principal':  node test/rodar.mjs overlay-topo
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 1000, height: 800 } })).newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2800);
// duas janelas: a "de baixo" criada DEPOIS da que vai abrir por cima (o caso do Adiar)
await page.evaluate(() => {
  const mk = (id, txt) => { const d = document.createElement('div'); d.className = 'overlay'; d.id = id; d.innerHTML = '<div class="modal"><div class="modal-head"><h2>' + txt + '</h2></div><div class="modal-body"><input id="in_' + id + '" placeholder="campo"></div></div>'; document.body.appendChild(d); return d; };
  mk('ovTopo', 'Adiar (criada antes)'); mk('ovBase', 'Ficha do prazo (criada depois)');
  document.getElementById('ovBase').classList.add('show');
});
await page.waitForTimeout(150);
await page.evaluate(() => document.getElementById('ovTopo').classList.add('show')); await page.waitForTimeout(200);
check(await page.evaluate(() => document.body.lastElementChild.id === 'ovTopo'), 'a janela que acabou de abrir vai para o fim da página (fica na frente)');
check(await page.evaluate(() => { const i = document.getElementById('in_ovTopo').getBoundingClientRect(), t = document.elementFromPoint(i.x + i.width / 2, i.y + i.height / 2); return !!t && !!t.closest('#ovTopo'); }), 'o campo da janela de cima recebe o toque (não fica coberto pela de baixo)');
await page.evaluate(() => document.getElementById('ovTopo').classList.remove('show')); await page.waitForTimeout(100);
check(await page.evaluate(() => { const i = document.getElementById('in_ovBase').getBoundingClientRect(), t = document.elementFromPoint(i.x + i.width / 2, i.y + i.height / 2); return !!t && !!t.closest('#ovBase'); }), 'fechando a de cima, a de baixo volta a ser a visível');
// foco: abrir e já focar um campo não perde o foco
await page.evaluate(() => { const o = document.getElementById('ovTopo'); o.classList.add('show'); document.getElementById('in_ovTopo').focus(); }); await page.waitForTimeout(250);
check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'in_ovTopo'), 'o campo focado ao abrir continua com o foco depois de a janela subir');
await page.evaluate(() => document.querySelectorAll('#ovTopo,#ovBase').forEach((e) => e.remove()));
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
