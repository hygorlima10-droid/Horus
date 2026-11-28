// Atendimentos na tela: bloco na ficha do cliente, gravação de verdade (microfone falso do Chromium), pausa e retomada, transcrição e ficha (simuladas), player, destaque de números,
// envio de arquivo, "Atendimento de origem" na Inicial, linha do tempo, Configurações, apagar e a geometria dos botões em 390 px.   Grupo 'atendimentos':  node test/rodar.mjs atendimentos-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8823', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (m, p, b) => fetch(B + '/api/' + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined });
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), agora = new Date().toISOString();
const br = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }), ctx = await br.newContext({ viewport: { width: 390, height: 900 }, permissions: ['microphone'] }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) {} });
await api('PUT', 'db/clientes/at-c1', { nome: 'MARIA DA SILVA', telefone: '(62) 99999-0000', pagador: 'cliente', criadoEm: agora, atualizadoEm: agora, notas: [], cobrancas: [], promessas: [] });
await api('PUT', 'db/casos/at-k1', { tipo: 'inicial', cliente: 'Maria da Silva', nomeAcao: 'Reclamação trabalhista', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', clienteIds: ['at-c1'], criadoEm: agora, atualizadoEm: agora });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(3000);
const foto = async (nome) => { if (process.env.FOTOS) await p.screenshot({ path: process.env.FOTOS + '/at-' + nome + '.png' }); };
const geometria = async (rot) => {
  await foto(rot.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
  const g = await p.evaluate(() => {
    const vw = innerWidth, bt = [...document.querySelectorAll('#atBody button, #atBody input[type=range], #atBody select')].filter((b) => b.getClientRects().length), r = bt.map((b) => ({ r: b.getBoundingClientRect(), t: (b.innerText || b.id || '').slice(0, 24) }));
    const fora = r.filter((x) => x.r.right > vw + 1 || x.r.left < -1).map((x) => x.t), sob = [];
    const bs = r.filter((x, i) => bt[i].tagName === 'BUTTON');
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].r, b = bs[j].r, w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 2 && h > 2) sob.push(bs[i].t + ' × ' + bs[j].t); }
    const modal = document.querySelector('#overlayAt .modal'); return { fora, sob, rolaLado: modal ? modal.scrollWidth > modal.clientWidth + 1 : false };
  });
  check(g.fora.length === 0 && g.sob.length === 0 && !g.rolaLado, rot + ': botões dentro da tela, sem sobreposição e sem rolagem lateral' + (g.fora.length || g.sob.length ? ' → ' + JSON.stringify(g) : ''));
};
// ---- 1) ficha do cliente
await p.evaluate(() => { const d = document.querySelector('#drawer [data-tab="clientes"]'); if (d) d.click(); }); await p.waitForTimeout(800);
await p.evaluate(() => document.querySelector('[data-cli-abrir="at-c1"]').click()); await p.waitForTimeout(1500);
let t = await p.locator('#perfilBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Atendimentos \(0\)/.test(t) && await p.locator('#perfilBody [data-at="novo"]').count() === 1, 'a ficha do cliente tem o bloco "Atendimentos (0)" com o botão "Novo atendimento"');
// ---- 2) gravar de verdade
await p.evaluate(() => { const d = document.querySelector('#perfilBody details[data-sec="atendimentos"]'); if (d) d.open = true; });
await foto('perfil');
await p.click('#perfilBody [data-at="novo"]'); await p.waitForTimeout(500);
check(await p.locator('#overlayAt.show').count() === 1 && await p.inputValue('#atCli') === 'at-c1' && /Deixe a tela ligada/.test(await p.locator('#atBody').innerText()), 'abre "Novo atendimento" com o cliente já escolhido e o aviso da tela ligada');
await geometria('Novo atendimento');
await p.fill('#atTit', 'Demissão sem justa causa');
await p.click('#atBody [data-at="gravar"]'); await p.waitForTimeout(2500);
t = await p.locator('#atBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Gravando/.test(t) && /\d\d:\d\d/.test(t) && await p.locator('#atBody [data-at="pausar"]').count() === 1, 'a gravação começa: cronômetro, "Gravando" e botão Pausar');
await geometria('Gravando');
await p.click('#atBody [data-at="pausar"]'); await p.waitForTimeout(500);
check(/Pausado/.test(await p.locator('#atBody').innerText()) && await p.locator('#atBody [data-at="retomar"]').count() === 1, 'Pausar troca para Retomar');
await p.click('#atBody [data-at="retomar"]'); await p.waitForTimeout(2200);
check(/Gravando/.test(await p.locator('#atBody').innerText()), 'Retomar volta a gravar');
await p.click('#atBody [data-at="parar"]');
await p.waitForSelector('#atBody .at-cab', { timeout: 40000 }); await p.waitForTimeout(500);
t = await p.locator('#atBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Demissão sem justa causa/.test(t) && /pronto/.test(t) && /Bom dia, conte o que aconteceu/.test(t), 'ao finalizar, o áudio sobe, é transcrito e o atendimento abre pronto com a transcrição');
const lista = (await (await api('GET', 'atendimentos?cliente=at-c1')).json()).itens;
check(lista.length === 1 && lista[0].nComAudio === 2 && lista[0].nTranscritos === 2 && lista[0].dur > 2, 'foram guardados 2 trechos (antes e depois da pausa), os dois transcritos');
const idAt = lista[0].id;
await geometria('Atendimento pronto');
// ---- 3) transcrição: destaque, busca, tocar
check(await p.locator('#atBody mark.at-hl').count() >= 2, 'números e datas ("2024", "6") saem marcados em amarelo');
await p.fill('#atBusca', 'demitido'); await p.waitForTimeout(300);
check(await p.locator('#atBody .at-fala').count() >= 1 && await p.locator('#atBody mark.at-busca').count() >= 1, 'a busca filtra as falas e marca o que achou');
await p.fill('#atBusca', '');
await p.locator('#atBody [data-at="tocar"]').nth(1).click(); await p.waitForTimeout(1500);
const aud = await p.evaluate(() => { const a = document.getElementById('atAudio'); return a ? { src: a.getAttribute('src'), erro: a.error ? a.error.code : 0 } : null; });
check(aud && /\/api\/atendimentos\/[0-9a-f]+\/trecho\/\d/.test(aud.src) && !aud.erro, 'tocar uma fala carrega o trecho certo do áudio (com Range) sem erro de mídia');
// ---- 4) ficha de atendimento
await p.click('#atBody [data-at="aba"][data-v="ficha"]'); await p.waitForTimeout(300);
t = await p.locator('#atBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Gerada por inteligência artificial/.test(t) && /Fatos, em ordem/i.test(t) && /Não mencionado na conversa/i.test(t) && /data dos fatos/.test(t), 'a ficha mostra o aviso de IA, os fatos e o que não foi mencionado');
check(await p.locator('#atBody .at-it [data-at="tocar"]').count() >= 1 && /conferir/.test(t), 'cada item tem o horário que toca o áudio, e o número que não está na conversa vem como "conferir"');
await geometria('Ficha de atendimento');
// ---- 5) dados e apagar
await p.click('#atBody [data-at="aba"][data-v="dados"]'); await p.waitForTimeout(300);
await geometria('Dados');
await p.click('#atBody [data-at="apagar-audio"]'); await p.waitForTimeout(200);
check(/Apagar só o áudio\?/.test(await p.locator('#atBody').innerText()), 'apagar o áudio pede confirmação');
await p.click('#atBody [data-at="apagar-audio-sim"]'); await p.waitForTimeout(1500);
const d2 = await (await api('GET', 'atendimentos/' + idAt)).json();
check(d2.nComAudio === 0 && d2.itens.length >= 2 && d2.resumo, 'o áudio foi apagado e a transcrição e a ficha continuam');
await p.click('#atBody [data-at="aba"][data-v="texto"]'); await p.waitForTimeout(300);
check(await p.locator('#atPlay').count() === 0 && /áudio deste atendimento foi apagado/.test(await p.locator('#atBody').innerText()), 'sem áudio, o player some e a tela explica');
await p.click('#atFecha'); await p.waitForTimeout(400);
// ---- 6) enviar arquivo
await p.evaluate(() => window.__horusTeste.atAbrirNovo({ clienteId: 'at-c1' })); await p.waitForTimeout(300);
await p.setInputFiles('#atArq', { name: 'gravacao.m4a', mimeType: 'audio/mp4', buffer: Buffer.from('0: Boa tarde.\n1: Fui demitido em 12/03/2024.') });
await p.waitForSelector('#atBody .at-cab', { timeout: 30000 }); await p.waitForTimeout(400);
t = await p.locator('#atBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Fui demitido em 12\/03\/2024/.test(t) && /pronto/.test(t), 'enviar um arquivo de áudio: guarda, transcreve e abre o atendimento');
await p.click('#atFecha'); await p.waitForTimeout(300);
await p.evaluate(() => window.__horusTeste.atAbrirNovo({ clienteId: 'at-c1' })); await p.waitForTimeout(300);
await p.setInputFiles('#atArq', { name: 'grande.m4a', mimeType: 'audio/mp4', buffer: Buffer.alloc(25 * 1024 * 1024) }); await p.waitForTimeout(800);
check(/limite é de 24 MB/.test(await p.locator('#atBody').innerText()) && (await (await api('GET', 'atendimentos?cliente=at-c1')).json()).itens.length === 2, 'arquivo acima de 24 MB é recusado com a explicação e não cria atendimento');
await geometria('Novo atendimento com erro');
await p.click('#atFecha'); await p.waitForTimeout(300);
// ---- 7) Inicial e linha do tempo
await api('POST', 'atendimentos', { titulo: 'Da Inicial', clienteId: 'at-c1', casoId: 'at-k1' });
await p.evaluate(() => { document.getElementById('overlay').classList.add('show'); window.__horusTeste.atInicialAtualizar('at-k1'); }); await p.waitForTimeout(1200);
t = await p.locator('#atInicialBox').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Atendimento de origem/i.test(t) && /Da Inicial/.test(t) && await p.locator('#atInicialBox [data-at="novo"]').count() === 1, 'a ficha da Inicial mostra o "Atendimento de origem" e o botão para gravar outro');
await p.evaluate(() => document.getElementById('overlay').classList.remove('show'));
await p.evaluate(() => window.__horusTeste.lcAbrir('at-c1')); await p.waitForTimeout(1500);
t = await p.locator('#lcBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Atendimento: Demissão sem justa causa/.test(t) && /Atendimento: Da Inicial/.test(t), 'a linha do tempo do cliente mostra os atendimentos');
await p.evaluate(() => document.getElementById('lcFecha').click());
// ---- 8) Configurações › Transcrição
await p.evaluate(() => window.__horusTeste.atAbrirConfig()); await p.waitForTimeout(1200);
t = await p.locator('#atBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Whisper \(Cloudflare\)/.test(t) && /Claude/.test(t) && /atendimentos? ·/.test(t) && /não separa quem fala/.test(t) && !/Grok/.test(t), 'Configurações › Transcrição: serviços, uso do armazenamento, aviso de que não separa quem fala (sem Grok)');
await geometria('Configurações › Transcrição');
await p.selectOption('#atDias', '60'); await p.waitForTimeout(800);
check((await (await api('GET', 'atendimentos/config')).json()).apagarAudioDias === 60, 'o prazo para apagar o áudio é gravado');
await p.click('#atFecha');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
