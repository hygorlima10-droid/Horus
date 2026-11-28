// O Início não pode mostrar número "no meio do caminho": as coleções chegam do servidor uma a uma (casos, acordos, alvarás, receitas…) e o total mudava 3 ou 4 vezes até o valor certo.
// Aqui as respostas chegam em ritmos diferentes (como na rede lenta do celular) e o número do "Recebido no mês", "A receber" e "Vencido" só pode aparecer UMA vez, já certo.
// Grupo 'telas-isoladas':  node test/rodar.mjs inicio-numeros
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined });
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), agora = new Date().toISOString();
// dados que movem os totais do Início em cada coleção
await api('PUT', 'casos/in1', { cliente: 'IN Cliente A', numeroProcesso: '0000011-11.2024.8.09.0011', descricao: 'IN ação', status: 'protocolado', modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 3000, parcelas: [{ numero: 1, valor: 1500, data: dia(-2), pago: true, dataRecebimento: dia(-1) }, { numero: 2, valor: 1500, data: dia(20), pago: false }], origem: 'proprio', criadoEm: agora });
await api('PUT', 'termosAcordo/in2', { cliente: 'IN Cliente B', numeroProcesso: '0000012-11.2024.8.09.0012', valorTotal: 2000, formaPagamento: 'parcelado', parcelas: [{ numero: 1, valor: 1000, data: dia(-1), pago: true, dataRecebimento: dia(0) }, { numero: 2, valor: 1000, data: dia(-30), pago: false }], origem: 'murilo', criadoEm: agora });
await api('PUT', 'alvaras/in3', { cliente: 'IN Cliente C', numeroProcesso: '0000013-11.2024.8.09.0013', valor: 4000, status: 'pendente', origem: 'murilo', criadoEm: agora });
await api('PUT', 'receitasManuais/in4', { coluna: 'pj', nome: 'IN Receita avulsa', valor: 800, data: dia(-1), mesReferencia: dia(0).slice(0, 7), recorrente: false, criadoEm: agora });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
// cada coleção demora um tempo diferente
const ATRASOS = { casos: 500, termosAcordo: 900, alvaras: 1300, receitasManuais: 1700, clientes: 300, despesas: 2100, metas: 2400, saldos: 2600, extratos: 2800, obraMov: 3000 };
await p.route(/\/api\/db\/([A-Za-z]+)\?limit=/, async (r) => { const n = /\/api\/db\/([A-Za-z]+)/.exec(r.request().url())[1]; await new Promise((ok) => setTimeout(ok, ATRASOS[n] || 200)); r.continue(); });
await p.addInitScript(() => { window.__vistos = []; const ids = ['resumoRecebido', 'resumoPendente', 'resumoVencido']; setInterval(() => { if (document.body && document.body.classList.contains('sk-ld-inicio')) return; const v = ids.map((i) => (document.getElementById(i) || {}).textContent || '').join('|'); const ult = window.__vistos[window.__vistos.length - 1]; if (v && v !== '||' && v !== ult) window.__vistos.push(v); }, 25); });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(8000);
const vistos = await p.evaluate(() => window.__vistos), final = vistos[vistos.length - 1];
console.log('  números que apareceram, em ordem:', JSON.stringify(vistos));
check(vistos.length === 1, 'os três números do Início aparecem uma vez só, já certos (apareceram ' + vistos.length + ' valores diferentes)');
// o valor final é o certo: recebido do mês = 1500 + 1000 + 800; a receber = 1500 + 1000 + 4000; vencido = 1000 (parcela do acordo de há 30 dias)
check(/R\$\s?3\.300,00/.test(final || '') && /R\$\s?1\.000,00/.test(final || ''), 'o valor mostrado é o final: ' + final);
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
