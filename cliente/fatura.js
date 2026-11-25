/* ============================================================
   FATURA DO CARTÃO DE CRÉDITO (prefixo fat) — Extratos › aba "Cartão de crédito"
   - CSV ou PDF de fatura (qualquer banco) lido pelo leitor geral; aqui: conferência, categorias com ícone, confirmação e as sub-abas de Extratos;
   - cada fatura confirmada vira documentos "diaadia" (um por mês de competência) com origem "cartao": as Análises e o Orçamento já somam com o dia a dia da conta,
     e o filtro Tudo / Só conta / Só cartão separa quando a pessoa quiser;
   - a compra entra pela data da compra; parcela que não é a primeira cai no mês em que a fatura fecha; mostra o que falta das parcelas;
   - o vencimento vem do campo "Vencimento" do documento; se não houver, o app pergunta (nunca pelo nome do arquivo).
   ============================================================ */
var fatS = { aba: 'conta', origem: 'tudo', sel: {}, lembrar: {}, troca: {}, rev: {}, forcar: {}, catAb: {}, difInclui: {}, info: '', erro: '' };
function fatM(c){ return fmtMoeda(c / 100); }
function fatOrigemOk(d){ var o = fatS.origem; if (o === 'tudo') return true; return o === 'cartao' ? d.origem === 'cartao' : d.origem !== 'cartao'; }
function fatIc(label, t){ var v = (typeof catVisualDe === 'function') ? catVisualDe(label) : null; return '<span class="cat-ic" style="background:' + (v ? v.cor : '#8A93AD') + '">' + (typeof catSvg === 'function' ? catSvg(v ? v.lu : 'tag', t || 16) : '') + '</span>'; }
function fatFaturas(status){ return extratos.filter(function(d){ return d.tipo === 'documento' && d.kind === 'fatura' && d.status === status; }).sort(function(a, b){ return String(b.lidoEm || '').localeCompare(String(a.lidoEm || '')); }); }
function fatChave(t){ var k = (typeof extChaveRegra === 'function') ? extChaveRegra({ s: t }) : ''; return k || String(t).toLowerCase().slice(0, 20); }
/* categorias do cartão: regras que a pessoa ensinou → catálogo; palavras que enganam (DAS em "Mundo das Utilidades", MORA em nome de pessoa, "Parcela 1/2" ≠ empréstimo) viram "decidir" */
function fatSuspeita(label, it){
  var N = (typeof EX !== 'undefined' ? EX.norm(it.t) : String(it.t).toUpperCase());
  if (/^Empr[ée]stimos/.test(label) && it.parcela) return true;
  if (/^Impostos e taxas/.test(label) && !/DARF|\bDAS\b.*(MEI|SIMPLES)|SIMPLES NACIONAL|\bISS\b|IPTU|IPVA|PREFEIT|RECEITA FED|SEFAZ|DETRAN/.test(N)) return true;
  if (/^Juros, multas e IOF/.test(label) && !/\bIOF\b|JUROS DE MORA|MULTA|ENCARGOS|JUROS/.test(N)) return true;
  return false;
}
function fatCatAuto(it){
  var cfg = (typeof extCfg === 'function') ? extCfg() : { regras: {} };
  var c = (typeof extCategoria === 'function') ? extCategoria({ s: it.t, n: '' }, cfg.regras || {}) : 'Outros';
  var regra = cfg.regras && cfg.regras[fatChave(it.t)];
  if (!regra && fatSuspeita(c, it)) return null;
  return (c && c !== 'Outros') ? c : null;
}
/* NÃO LANÇAR DUAS VEZES (como nos extratos): (1) a mesma compra já lançada por outra fatura/arquivo (fatura aberta exportada duas vezes, CSV e PDF da mesma fatura): mesmo dia, nome, valor e parcela; (2) lançamento manual de mesmo valor e data (±3 dias) já no app */
function fatHash(it){ return EX.fnv([it.dc, EX.norm(it.t), it.v, it.parcela ? it.parcela.n + '/' + it.parcela.m : ''].join('|')); }
function fatChaveFatura(x, venc){ return (venc || x.vencimento || '') + '|' + (x.total != null ? x.total : x.soma); }
function fatDuplicados(d){
  var x = d.dados, id = d.id, coluna = dcmColunaDe(d), ja = {}, hashes = [], ocorr = {}, dup = {};
  extratos.forEach(function(e){ if (e.tipo === 'diaadia' && e.origem === 'cartao' && e.fatura !== id) (e.linhas || []).forEach(function(l){ if (l.h) ja[l.h] = 1; }); });
  var movs = []; try{ movs = extMovsApp(coluna); }catch(e){}
  x.itens.forEach(function(it, i){
    var h0 = fatHash(it); ocorr[h0] = (ocorr[h0] || 0) + 1; hashes[i] = h0 + '#' + ocorr[h0];
    if (it.v <= 0) return;
    if (ja[hashes[i]]) dup[i] = 'já lançado por outra fatura ou arquivo (mesmo dia, nome e valor)';
    else if (extAcharMov(movs, it.v, 'saida', it.dc, { n: '', s: it.t }, null)) dup[i] = 'já existe um lançamento de mesmo valor e data no app (despesa paga ou aporte)';
  });
  var mesma = extratos.filter(function(e){ return e.tipo === 'documento' && e.kind === 'fatura' && e.status === 'concluido' && e.id !== id && e.dados && fatChaveFatura(e.dados) === fatChaveFatura(x); })[0] || null;
  return { dup: dup, hashes: hashes, mesma: mesma };
}
function fatCats(d){
  var x = d.dados, sel = fatS.sel[d.id] || {}, grupos = {}, pend = {}, cats = {}, dd = fatDuplicados(d).dup, fc = fatS.forcar[d.id] || {};
  x.itens.forEach(function(it, i){
    if (dd[i] && !fc[i]) return;   /* duplicado: fora das categorias, a menos que ele mande lançar mesmo assim */
    var k = fatChave(it.t), esc = sel[k], auto = esc || fatCatAuto(it);
    if (auto){ var c = cats[auto] = cats[auto] || { n: 0, v: 0, idx: [] }; c.n++; c.v += it.v; c.idx.push(i); }
    else { var p = pend[k] = pend[k] || { k: k, t: it.t, n: 0, v: 0, idx: [] }; p.n++; p.v += it.v; p.idx.push(i); }
  });
  return { cats: cats, pend: pend };
}
function fatDespesasCartao(d){
  var x = d.dados, venc = (qs('fat_' + d.id + '_venc') || {}).value || x.vencimento; if (!venc) return [];
  var mes = venc.slice(0, 7), out = [], banco = x.banco ? (typeof EX !== 'undefined' ? EX.norm(x.banco) : '') : '';
  try{ comMes(mes, function(){ getDespesasParaMes(dcmColunaDe(d)).forEach(function(it){ var n = EX.norm(it.despesa.nome); if (/CARTAO|FATURA/.test(n) || (banco && n.indexOf(banco) >= 0)) out.push({ d: it.despesa, mes: mes, v: it.previsto != null ? it.previsto : it.valor, pago: it.pago }); }); }); }catch(e){}
  return out;
}
/* conciliação: o total da fatura pode ser maior que as compras (resto da fatura anterior, juros, encargos) */
function fatDifHtml(d){
  var x = d.dados, df = x.diferenca, id = d.id; if (!df || !df.v) return '';
  var incl = fatS.difInclui[id] !== false, mais = df.v > 0, resto = df.explica === 'resto';
  var rot = resto ? 'Resto da fatura anterior' : (mais ? 'Outros valores da fatura (não são compras)' : 'Abatimentos da fatura (não são compras)');
  var nota = resto ? 'A fatura anterior foi de ' + fatM(df.anterior) + ' e o pagamento listado nesta fatura é de ' + fatM(df.pagos) + (df.totalPagamentos != null && df.totalPagamentos !== df.pagos ? ' (o resumo do banco indica ' + fatM(df.totalPagamentos) + ' de pagamentos, mas só mostra essa linha)' : '') + '. Confira no aplicativo do banco se esse resto está mesmo em aberto.'
    : 'Pode ser resto da fatura anterior, juros, multa ou encargos. Confira no aplicativo do banco o que compõe a diferença.';
  return '<div class="av fat-dif"><b>O total da fatura (' + fatM(x.total) + ') ' + (mais ? 'é maior' : 'é menor') + ' que as compras lidas (' + fatM(x.soma) + ')</b>' +
    '<div class="fat-lin"><span>Compras lidas (por categoria, abaixo)</span><b>' + fatM(x.soma) + '</b></div><div class="fat-lin"><span>' + rot + '</span><b>' + (mais ? '' : '− ') + fatM(Math.abs(df.v)) + '</b></div><div class="fat-lin"><span><b>Total a pagar (como o banco cobra)</b></span><b>' + fatM(x.total) + '</b></div>' +
    '<div class="saldo-data">' + escapeHtml(nota) + ' Essa diferença não entra no gasto por categoria (não é compra nova).</div>' +
    '<label class="fat-lembrar"><input type="checkbox" data-fat-dif="' + escapeHtml(id) + '"' + (incl ? ' checked' : '') + '> Lançar a despesa da fatura pelo total (' + fatM(x.total) + '). Desmarque se essa diferença já foi paga ou lançada: a despesa fica só com as compras (' + fatM(x.soma) + ').</label></div>';
}
/* uma categoria: linha clicável que abre os lançamentos que o app reconheceu automaticamente (para a última conferência) */
function fatCatLinhas(id, x, c, o){
  var ab = !!fatS.catAb[id + '|' + c];
  var h = '<button type="button" class="fat-cat fat-cat-b" data-fat="cat" data-id="' + escapeHtml(id) + '" data-c="' + escapeHtml(c) + '" aria-expanded="' + (ab ? 'true' : 'false') + '">' + fatIc(c) + '<span class="fat-cn">' + escapeHtml(c) + '<small>' + o.n + (o.n === 1 ? ' lançamento' : ' lançamentos') + ' · ' + (ab ? 'toque para fechar' : 'toque para ver') + '</small></span><b>' + fatM(o.v) + '</b><span class="fat-chev">' + (ab ? '▾' : '▸') + '</span></button>';
  if (!ab) return h;
  return h + '<div class="fat-linhas">' + o.idx.slice().sort(function(a, b){ return String(x.itens[b].dc || '').localeCompare(String(x.itens[a].dc || '')); }).map(function(i){
    var it = x.itens[i]; return '<div class="fat-lin"><span>' + escapeHtml(fmtData(it.dc)) + ' · ' + escapeHtml(it.t) + (it.parcela ? ' <small>(' + it.parcela.n + '/' + it.parcela.m + ')</small>' : '') + (it.v < 0 ? ' <small>crédito</small>' : '') + '</span><b>' + fatM(it.v) + '</b></div>'; }).join('') + '</div>';
}
function fatCard(d){
  var x = d.dados, id = d.id, dupInfo = fatDuplicados(d), g = fatCats(d), cats = Object.keys(g.cats).sort(function(a, b){ return g.cats[b].v - g.cats[a].v; }), pends = Object.keys(g.pend).map(function(k){ return g.pend[k]; }).sort(function(a, b){ return b.v - a.v; });
  var nCompras = x.itens.filter(function(i){ return i.v > 0; }).length, venc = x.vencimento || '', soPend = pends.reduce(function(t, p){ return t + p.v; }, 0), nPend = pends.reduce(function(t, p){ return t + p.n; }, 0);
  var h = '<div class="ini-card ext-card" data-fat-card="' + escapeHtml(id) + '"><div class="ext-card-top"><b>Fatura' + (x.banco ? ' · ' + escapeHtml(x.banco) : '') + (x.cartao ? ' · final ' + escapeHtml(x.cartao) : '') + '</b><span class="ext-chip ' + (x.selo === 'verde' ? 'ok' : 'bad') + '">' + (x.selo === 'verde' ? 'soma confere' : 'confira') + '</span></div>' +
    '<div class="fat-kv"><div><b>' + fatM(x.soma) + '</b><span>total lido' + (x.total != null ? ' · fatura ' + fatM(x.total) : '') + '</span></div><div><b>' + nCompras + ' compras</b><span>' + (x.periodo && x.periodo.de ? fmtData(x.periodo.de) + ' a ' + fmtData(x.periodo.ate) : 'período não identificado') + '</span></div></div>' +
    ((x.provas || []).length ? '<div class="saldo-data">' + escapeHtml(x.provas.join('; ')) + '</div>' : '') +
    fatDifHtml(d) +
    '<div class="fat-lin2">' + dcmCampo(id, 'venc', 'Vencimento' + (venc ? '' : ' — informe (não achei no documento)'), 'date', venc) + dcmCampo(id, 'fecha', 'Fechamento (dia 26) — a despesa entra neste mês', 'date', (qs('dcm_' + id + '_fecha') && qs('dcm_' + id + '_fecha').value) || fatFechamento(venc)) + (dcmColunaHtml(d) ? dcmColunaHtml(d) : '') + '</div>' +
    (!venc && x.dicaVencimento ? '<div class="saldo-data">O nome do arquivo tem a data ' + escapeHtml(fmtData(x.dicaVencimento)) + ': confira no aplicativo do banco se é o vencimento antes de usar.</div>' : '');
  var nd = Object.keys(dupInfo.dup).length;
  if (dupInfo.mesma) h += '<div class="av">Esta fatura parece ser <b>a mesma já lançada</b> (vence ' + escapeHtml(fmtData(dupInfo.mesma.dados.vencimento)) + ', ' + fatM(dupInfo.mesma.dados.soma) + '). Os lançamentos repetidos não serão lançados de novo e a despesa da fatura não será duplicada.</div>';
  if (nd){
    var fcx = fatS.forcar[id] || {}, totDup = Object.keys(dupInfo.dup).reduce(function(t, i){ return t + x.itens[i].v; }, 0);
    h += '<div class="fat-t fat-pt">Já lançados — não serão lançados de novo (' + nd + ' · ' + fatM(totDup) + ')</div>' + Object.keys(dupInfo.dup).map(function(i){
      var it = x.itens[i]; return '<label class="fat-lembrar"><input type="checkbox" data-fat-forcar="' + escapeHtml(id) + '" data-i="' + i + '"' + (fcx[i] ? ' checked' : '') + '><span>' + escapeHtml(it.t) + ' · ' + escapeHtml(fmtData(it.dc)) + ' · <b>' + fatM(it.v) + '</b><br><small class="saldo-data">' + escapeHtml(dupInfo.dup[i]) + ' — marque para lançar mesmo assim</small></span></label>';
    }).join('');
  }
  var todasAb = cats.length && cats.every(function(c){ return fatS.catAb[id + '|' + c]; });
  h += '<div class="fat-t">Compras por categoria <button type="button" class="btn-text" data-fat="cats-todas" data-id="' + escapeHtml(id) + '">' + (todasAb ? 'Fechar todas' : 'Ver todos os lançamentos') + '</button></div>' + cats.map(function(c){ return fatCatLinhas(id, x, c, g.cats[c]); }).join('');
  if (pends.length){
    h += '<div class="fat-t fat-pt">Sem categoria — escolha (' + nPend + ' lançamentos · ' + fatM(soPend) + ')</div>' + pends.map(function(p){
      return '<div class="fat-cat">' + '<span class="fat-cn">' + escapeHtml(p.t) + '<small>' + p.n + (p.n === 1 ? ' lançamento' : ' lançamentos') + '</small></span><b>' + fatM(p.v) + '</b>' + catSelectHtml('data-fat-cat="' + escapeHtml(id) + '" data-fat-k="' + escapeHtml(p.k) + '"', 'Outros') + '</div>';
    }).join('') + '<label class="fat-lembrar"><input type="checkbox" data-fat-lembrar="' + escapeHtml(id) + '"' + (fatS.lembrar[id] === false ? '' : ' checked') + '> Lembrar essas escolhas para as próximas faturas</label>';
  }
  /* a pessoa pode trocar também a categoria sugerida (a palavra do estabelecimento às vezes engana) */
  var gr = {}; x.itens.forEach(function(it, ii){ if (dupInfo.dup[ii] && !(fatS.forcar[id] || {})[ii]) return; var k = fatChave(it.t), c = (fatS.sel[id] || {})[k] || fatCatAuto(it); if (!c) return; var o = gr[k] = gr[k] || { k: k, t: it.t, n: 0, v: 0, c: c }; o.n++; o.v += it.v; });
  var grl = Object.keys(gr).map(function(k){ return gr[k]; }).sort(function(a, b){ return b.v - a.v; });
  if (grl.length) h += '<div class="fat-t">Categorias sugeridas <button type="button" class="btn-text" data-fat="revisar" data-id="' + escapeHtml(id) + '">' + (fatS.rev[id] ? 'Fechar a revisão' : 'Revisar e trocar') + '</button></div>' + (fatS.rev[id] ? grl.map(function(o){ return '<div class="fat-cat"><span class="fat-cn">' + escapeHtml(o.t) + '<small>' + o.n + (o.n === 1 ? ' lançamento' : ' lançamentos') + '</small></span><b>' + fatM(o.v) + '</b>' + catSelectHtml('data-fat-cat="' + escapeHtml(id) + '" data-fat-k="' + escapeHtml(o.k) + '"', o.c) + '</div>'; }).join('') : '');
  var parc = x.itens.filter(function(i){ return i.parcela && i.parcela.m > i.parcela.n; });
  if (parc.length || (x.futuras && x.futuras.lista && x.futuras.lista.length)){
    var falta = parc.reduce(function(t, i){ return t + i.v * (i.parcela.m - i.parcela.n); }, 0);
    h += '<div class="fat-t">Parcelas que ainda faltam</div>' + parc.slice(0, 8).map(function(i){ var k = i.parcela.m - i.parcela.n; return '<div class="fat-lin"><span>' + escapeHtml(i.t) + ' <small>(' + i.parcela.n + '/' + i.parcela.m + ')</small></span><b>falta' + (k > 1 ? 'm ' + k + ' × ' : ' 1 × ') + fatM(i.v) + '</b></div>'; }).join('') +
      '<div class="saldo-data">Comprometido nas próximas faturas: <b>' + fatM(x.futuras && x.futuras.total > 0 ? x.futuras.total : falta) + '</b>' + (parc.length > 8 ? ' (mostrando 8 de ' + parc.length + ' parceladas)' : '') + '</div>';
  }
  if ((x.ignorados || []).length) h += '<div class="saldo-data">Não contam como gasto: ' + x.ignorados.map(function(i){ return escapeHtml(i.t) + ' (' + escapeHtml(i.motivo) + ')'; }).join('; ') + '.</div>';
  var desp = fatDespesasCartao(d);
  if (desp.length) h += '<label class="fat-lembrar"><input type="checkbox" data-fat-troca="' + escapeHtml(id) + '"' + (fatS.troca[id] === false ? '' : ' checked') + '> Trocar a despesa “' + escapeHtml(desp[0].d.nome) + '”' + (desp[0].v != null ? ' (' + fatM(desp[0].v * 100) + ')' : '') + ' pelo detalhe desta fatura <small>(recomendado: não conta duas vezes)</small></label>';
  h += '<div class="ext-acoes"><button type="button" class="btn btn-primary" data-fat="confirmar" data-id="' + escapeHtml(id) + '">Confirmar a fatura</button><button type="button" class="btn-text" data-fat="ignorar" data-id="' + escapeHtml(id) + '">Ignorar</button></div></div>';
  return h;
}
/* o cartão fecha SEMPRE no dia 26: o fechamento é o último dia 26 antes do vencimento (vence 02/12 → fechou 26/11) */
function fatFechamento(venc){
  if (!venc) return '';
  var a = +venc.slice(0, 4), m = +venc.slice(5, 7), d = +venc.slice(8, 10);
  if (d <= 26){ m--; if (m < 1){ m = 12; a--; } }
  return a + '-' + String(m).padStart(2, '0') + '-26';
}
/* a fatura como DESPESA no mês do FECHAMENTO (dia 26), pelo total da fatura; o detalhe por categoria vai pela data da compra e não conta de novo nas análises */
function fatCriarDespesa(id, x, fecha, coluna){
  var venc = x.vencimento || '';
  var chave = fatChaveFatura(x, x.vencimento);
  if (typeof despesaPorFatura === 'function' && despesaPorFatura(id, chave)) return Promise.resolve();
  var tot = x.totalDespesa != null ? x.totalDespesa : (x.total != null ? x.total : x.soma), nome = 'Fatura ' + (x.banco || 'cartão') + (x.cartao ? ' final ' + x.cartao : '');
  return Promise.resolve(persistNovaDespesa({ nome: nome, coluna: coluna, tipo: 'unica', categoria: 'cartao', valor: r2(tot / 100), data: fecha, mesReferencia: fecha.slice(0, 7), pago: false, dataPagamento: null, pagoEm: null, parciais: [], valorPadrao: null, diaVencimento: null, ativa: true, pausadaAPartirDeMes: null, pagamentos: {}, faturaId: id, faturaChave: chave, observacoes: 'Fatura do cartão (fecha em ' + fmtData(fecha) + (venc ? ', vence em ' + fmtData(venc) : '') + '). Compras por categoria em Extratos › Cartão de crédito', origemDocumento: true }));
}
function fatConfirmar(id){
  var d = extDocPorId(id); if (!d) return Promise.resolve();
  var x = d.dados, venc = dcmLer(id, 'venc') || x.vencimento || '';
  if (!venc){ toast('Informe o vencimento da fatura.'); return Promise.resolve(); }
  var coluna = dcmColunaDe(d), sel = fatS.sel[id] || {}, cfg = extCfg(), regras = Object.assign({}, cfg.regras || {}), mudouRegra = false, porMes = {};
  var dupC = fatDuplicados(d), fcC = fatS.forcar[id] || {}, nLanc = 0;
  x.itens.forEach(function(it, i){
    if (dupC.dup[i] && !fcC[i]) return;   /* já estava lançado: não lança de novo */
    nLanc++;
    var k = fatChave(it.t), esc = sel[k], cat = esc || fatCatAuto(it) || 'Outros';
    if (esc && fatS.lembrar[id] !== false && k){ regras[k] = esc; mudouRegra = true; }
    var mes = it.d.slice(0, 7), doc = porMes[mes] = porMes[mes] || { id: 'dd_' + mes + '_cartao_' + id.replace(/^dcm_/, ''), mes: mes, cats: {}, linhas: [] };
    var v = r2(it.v / 100), c = doc.cats[cat] = doc.cats[cat] || { v: 0, n: 0 }; c.v = r2(c.v + v); c.n++;
    doc.linhas.push({ id: uid(), d: it.d, t: String(it.t).slice(0, 80) + (it.parcela ? ' (' + it.parcela.n + '/' + it.parcela.m + ')' : ''), v: v, c: cat, h: dupC.hashes[i] || '' });
  });
  var meses = Object.keys(porMes), cadeia = Promise.resolve();
  meses.forEach(function(m){ var o = porMes[m]; cadeia = cadeia.then(function(){ return extGravar(o.id, { tipo: 'diaadia', mes: o.mes, conta: 'cartao:' + id, coluna: coluna, origem: 'cartao', fatura: id, cats: o.cats, linhas: o.linhas, atualizadoEm: new Date().toISOString() }); }); });
  cadeia = cadeia.then(function(){ return mudouRegra ? persistExtCfg({ regras: regras }) : null; });
  var fecha = dcmLer(id, 'fecha') || fatFechamento(venc);
  cadeia = cadeia.then(function(){ return fatCriarDespesa(id, Object.assign({}, x, { vencimento: venc, totalDespesa: (x.diferenca && fatS.difInclui[id] === false) ? x.soma : x.total }), fecha, coluna); });   /* não duplica a despesa se a mesma fatura (mesmo vencimento e total) já tem uma */
  var tr = fatS.troca[id] !== false ? fatDespesasCartao(d).filter(function(c){ return !c.d.faturaId; })[0] : null;
  if (tr && typeof persistPatchDespesa === 'function') cadeia = cadeia.then(function(){ return persistPatchDespesa(tr.d, { faturaMeses: (tr.d.faturaMeses || []).concat([tr.mes]) }); });
  return cadeia.then(function(){ return extGravar(d.id, Object.assign({}, d, { status: 'concluido', concluidoEm: new Date().toISOString(), coluna: coluna, docsDD: meses.map(function(m){ return porMes[m].id; }), dados: Object.assign({}, x, { vencimento: venc, fechamento: fecha }) })); })
    .then(function(){ toast('Fatura lançada: ' + nLanc + ' lançamentos' + (nLanc < x.itens.length ? ' (' + (x.itens.length - nLanc) + ' já estavam lançados e foram ignorados)' : '') + ' em ' + meses.length + (meses.length === 1 ? ' mês' : ' meses') + '.'); renderExtratos(); try{ renderFinanceiro(); }catch(e){} })
    .catch(function(e){ console.error('fatura', e); toast('Não consegui lançar a fatura. Tente de novo.'); });
}
function fatDesfazer(id){
  var d = extDocPorId(id); if (!d) return Promise.resolve();
  var ids = d.docsDD || [], cadeia = Promise.resolve();
  ids.forEach(function(i){ cadeia = cadeia.then(function(){ return extApagar(i); }); });
  var dp = (typeof despesaPorFatura === 'function') ? despesaPorFatura(id) : null;
  if (dp && typeof persistExcluiDespesaSimples === 'function') cadeia = cadeia.then(function(){ return persistExcluiDespesaSimples(dp.id); });
  return cadeia.then(function(){ return extGravar(d.id, Object.assign({}, d, { status: 'pendente', concluidoEm: null, docsDD: [] })); }).then(function(){ toast('Fatura desfeita: voltou para conferir.'); renderExtratos(); try{ renderFinanceiro(); }catch(e){} });
}
/* aba "Cartão de crédito" */
function fatAbaHtml(){
  var l = fatFaturas('pendente'), ja = fatFaturas('concluido'), h = '';
  h += '<div class="ext-acoes" style="margin:0 0 8px"><button type="button" class="btn btn-primary" data-fat="enviar">Enviar fatura (CSV ou PDF)</button></div>' + (fatS.info ? '<div class="saldo-data" role="status">' + escapeHtml(fatS.info) + '</div>' : '') + (fatS.erro ? '<div class="aviso-sis critico"><span class="as-txt">' + escapeHtml(fatS.erro) + '</span></div>' : '');
  h += '<div class="financeiro-secao-head"><h4>Faturas para conferir' + (l.length ? ' (' + l.length + ')' : '') + '</h4></div>' + (l.length ? l.map(fatCard).join('') : '<div class="financeiro-vazio">Nenhuma fatura esperando. Envie o CSV ou o PDF da fatura em “Enviar documentos” (aba Conta bancária), ou compartilhe do celular.</div>');
  /* compras por categoria do mês escolhido */
  var por = {}, tot = 0, n = 0;
  extratos.forEach(function(d){ if (d.tipo !== 'diaadia' || d.origem !== 'cartao' || d.mes !== mesSelecionado) return; Object.keys(d.cats || {}).forEach(function(k0){ var k = (typeof catNomeNovo === 'function') ? catNomeNovo(k0) : k0, c = d.cats[k0]; por[k] = por[k] || { v: 0, n: 0 }; por[k].v = r2(por[k].v + (Number(c.v) || 0)); por[k].n += c.n || 0; tot += Number(c.v) || 0; n += c.n || 0; }); });
  var ks = Object.keys(por).sort(function(a, b){ return por[b].v - por[a].v; });
  h += '<div class="financeiro-secao-head"><h4>Compras por categoria · ' + escapeHtml(mesLabel(mesSelecionado)) + '</h4></div>' + (ks.length ? '<div class="ini-card">' + ks.map(function(k){ return '<div class="fat-cat">' + fatIc(k) + '<span class="fat-cn">' + escapeHtml(k) + '<small>' + por[k].n + ' lançamentos</small></span><b>' + fmtMoeda(por[k].v) + '</b></div>'; }).join('') + '<div class="fat-lin"><span><b>Total do cartão no mês</b></span><b>' + fmtMoeda(r2(tot)) + '</b></div></div>' : '<div class="financeiro-vazio">Nenhuma compra de cartão lançada neste mês.</div>');
  h += '<div class="financeiro-secao-head"><h4>Faturas lançadas' + (ja.length ? ' (' + ja.length + ')' : '') + '</h4></div>' + (ja.length ? ja.map(function(d){ var x = d.dados; return '<div class="ini-card fat-ja"><div class="fat-lin"><span><b>' + escapeHtml(x.banco || 'Cartão') + (x.cartao ? ' · final ' + escapeHtml(x.cartao) : '') + '</b> <small>vence ' + escapeHtml(fmtData(x.vencimento)) + ' · ' + x.itens.length + ' lançamentos</small></span><b>' + fatM(x.soma) + '</b></div><button type="button" class="btn-text" data-fat="desfazer" data-id="' + escapeHtml(d.id) + '">Desfazer</button>' + ((x.vencimento && typeof despesaPorFatura === 'function' && !despesaPorFatura(d.id)) ? ' <button type="button" class="btn btn-ghost" data-fat="despesa" data-id="' + escapeHtml(d.id) + '">Lançar como despesa de ' + escapeHtml(mesLabel((x.fechamento || fatFechamento(x.vencimento)).slice(0, 7))) + '</button>' : '') + '</div>'; }).join('') : '<div class="financeiro-vazio">Nenhuma fatura lançada ainda.</div>');
  return h;
}
function fatAbasHtml(){
  var n = fatFaturas('pendente').length;
  return '<div class="fat-abas" id="fatAbas" role="tablist"><button type="button" role="tab" data-fat="aba" data-v="conta" class="' + (fatS.aba === 'conta' ? 'on' : '') + '">Conta bancária</button><button type="button" role="tab" data-fat="aba" data-v="cartao" class="' + (fatS.aba === 'cartao' ? 'on' : '') + '">Cartão de crédito' + (n ? ' <i>' + n + '</i>' : '') + '</button></div>';
}
function fatTemCartao(){ return extratos.some(function(d){ return d.tipo === 'diaadia' && d.origem === 'cartao'; }); }
function fatOrigemSegHtml(){
  if (!fatTemCartao()) return '';
  return '<div class="segmented an-seg2" role="group" aria-label="Origem" style="margin-top:6px">' + [['tudo', 'Tudo'], ['conta', 'Só conta'], ['cartao', 'Só cartão']].map(function(o){ return '<button type="button" data-fat-origem="' + o[0] + '" class="seg-btn' + (fatS.origem === o[0] ? ' active' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.fat-abas{display:flex;background:var(--surface-2);border-radius:99px;padding:3px;width:fit-content;margin:0 0 10px}.fat-abas button{border:0;background:transparent;padding:8px 18px;min-height:40px;border-radius:99px;font:inherit;font-weight:700;font-size:var(--t2);color:var(--ink-soft);cursor:pointer}.fat-abas button.on{background:#12172A;color:#fff}.fat-abas i{font-style:normal;background:#C98500;color:#fff;border-radius:99px;padding:0 7px;font-size:11px;margin-left:4px}' +
    '.fat-kv{display:flex;gap:26px;flex-wrap:wrap;margin:6px 0 8px}.fat-kv b{display:block;font-size:var(--t5)}.fat-kv span{font-size:var(--t1);color:var(--ink-soft)}.fat-lin2{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0 12px}' +
    '.fat-t{font-size:var(--t1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);margin:14px 0 4px}.fat-pt{color:#8A5A0B}.fat-cat{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--border);flex-wrap:wrap}.fat-cat .cat-ic{flex:none}.fat-cn{flex:1 1 140px;min-width:0;font-weight:600;overflow-wrap:anywhere}.fat-cn small{display:block;color:var(--ink-soft);font-weight:400;font-size:var(--t1)}.fat-cat>b{font-variant-numeric:tabular-nums}.fat-cat .cat-ps{flex:1 1 100%}' +
    '.fat-lin{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--border);font-size:var(--t2)}.fat-lembrar{display:flex;gap:8px;align-items:flex-start;font-size:var(--t2);margin:10px 0 2px}.fat-ja .btn-text{margin-top:2px}' +
    '.fat-cat-b{width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;font:inherit;color:inherit;cursor:pointer}.fat-chev{color:var(--ink-soft);font-size:var(--t2)}.fat-linhas{padding:0 0 6px 38px}.fat-linhas .fat-lin{font-size:var(--t1)}.fat-dif{margin:8px 0}.fat-dif .fat-lin{border-top:1px solid var(--border)}' +
    '@media(min-width:700px){.fat-cat .cat-ps{flex:0 0 260px}}';
  document.head.appendChild(st);
  if (typeof dcmHtml === 'function') { var oHtml = dcmHtml; dcmHtml = function(){ return fatS.aba === 'cartao' ? '' : oHtml.apply(this, arguments); }; }
  if (typeof renderExtratos === 'function'){
    var oR = renderExtratos;
    renderExtratos = function(){
      var r = oR.apply(this, arguments);
      try{
        if (activeTab !== 'extratos' || !dcmPode()) return r;
        var wrap = document.querySelector('#bodyExtratos .ext-wrap'); if (!wrap) return r;
        var barra = qs('fatAbas'), nova = fatAbasHtml();
        if (!barra){ wrap.insertAdjacentHTML('afterbegin', nova); } else if (barra.outerHTML !== nova){ barra.outerHTML = nova; }
        var cart = qs('fatCartao'); if (!cart){ cart = document.createElement('div'); cart.id = 'fatCartao'; wrap.appendChild(cart); }
        var isC = fatS.aba === 'cartao';
        ['extTopo', 'extPend', 'extDia', 'extJa', 'extHist'].forEach(function(i){ var e = qs(i); if (e) e.style.display = isC ? 'none' : ''; });
        cart.style.display = isC ? '' : 'none';
        if (isC){ try{ fatS.info = (impEstado && impEstado.info) || ''; fatS.erro = (impEstado && impEstado.erro) || ''; }catch(e){} var h = fatAbaHtml(); if (cart.getAttribute('data-h') !== h){ cart.innerHTML = h; cart.setAttribute('data-h', h); } }
      }catch(e){ console.error('fatura', e); }
      return r;
    };
  }
  document.addEventListener('click', function(ev){
    var og = ev.target.closest ? ev.target.closest('[data-fat-origem]') : null;
    if (og){ fatS.origem = og.getAttribute('data-fat-origem'); try{ renderAnalises(); }catch(e){} try{ renderOrcamento && renderOrcamento(); }catch(e){} return; }
    var b = ev.target.closest ? ev.target.closest('[data-fat]') : null; if (!b) return;
    var a = b.getAttribute('data-fat'), id = b.getAttribute('data-id');
    if (a === 'enviar'){ var f = qs('impArq'); if (f) f.click(); return; }
    if (a === 'aba'){ fatS.aba = b.getAttribute('data-v'); return renderExtratos(); }
    if (a === 'revisar'){ fatS.rev[id] = !fatS.rev[id]; return renderExtratos(); }
    if (a === 'cat'){ var kc = id + '|' + b.getAttribute('data-c'); fatS.catAb[kc] = !fatS.catAb[kc]; return renderExtratos(); }
    if (a === 'cats-todas'){ var dx = extDocPorId(id); if (dx){ var gx = fatCats(dx), cs = Object.keys(gx.cats), todas = cs.length && cs.every(function(c){ return fatS.catAb[id + '|' + c]; }); cs.forEach(function(c){ fatS.catAb[id + '|' + c] = !todas; }); } return renderExtratos(); }
    if (a === 'confirmar') return fatConfirmar(id);
    if (a === 'ignorar'){ var d = extDocPorId(id); if (d) return extGravar(d.id, Object.assign({}, d, { status: 'ignorado' })).then(function(){ renderExtratos(); }); }
    if (a === 'desfazer') return fatDesfazer(id);
    if (a === 'despesa'){ var dd = extDocPorId(id); if (dd && dd.dados && dd.dados.vencimento){ var fc = dd.dados.fechamento || fatFechamento(dd.dados.vencimento); return fatCriarDespesa(id, dd.dados, fc, dd.coluna || dcmColunaDe(dd)).then(function(){ toast('Fatura lançada como despesa de ' + mesLabel(fc.slice(0, 7)) + ' (fecha em ' + fmtData(fc) + ').'); renderExtratos(); try{ renderFinanceiro(); }catch(e){} }); } }
  });
  document.addEventListener('change', function(ev){
    var t = ev.target; if (!t || !t.getAttribute) return;
    if (t.hasAttribute('data-fat-cat')){ var id = t.getAttribute('data-fat-cat'); (fatS.sel[id] = fatS.sel[id] || {})[t.getAttribute('data-fat-k')] = t.value; return renderExtratos(); }
    if (t.hasAttribute('data-fat-forcar')){ var fi = t.getAttribute('data-fat-forcar'); (fatS.forcar[fi] = fatS.forcar[fi] || {})[t.getAttribute('data-i')] = t.checked; return renderExtratos(); }
    if (t.hasAttribute('data-fat-lembrar')) fatS.lembrar[t.getAttribute('data-fat-lembrar')] = t.checked;
    if (t.hasAttribute('data-fat-troca')) fatS.troca[t.getAttribute('data-fat-troca')] = t.checked;
    if (t.hasAttribute('data-fat-dif')) fatS.difInclui[t.getAttribute('data-fat-dif')] = t.checked;
    if (t.id && /^dcm_.+_venc$/.test(t.id)) renderExtratos();   /* mudou o vencimento: refaz a procura da despesa "Cartão" do mês */
  });
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { fatFaturas: fatFaturas, fatS: fatS });
})();
