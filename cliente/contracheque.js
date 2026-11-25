/* ============================================================
   CONTRACHEQUE (prefixo ccq) — perfil familiar com Finanças: salário de servidor com descontos em folha, serviços extras e consignados.
   - "Salário e fixos" ganha o cartão "Contracheque do mês": proventos, descontos em folha, líquido (o que cai na conta), serviços extras
     (SERV EXTRAORDINARIO, AC4… vêm no próprio contracheque) e a tabela de consignados (parcela x de y, quanto falta, quando termina, margem);
   - o contracheque é lido do PDF ou da foto (cliente/leitor-geral.js: proventos e descontos separados pela conta dos totais) e só vale depois
     que ele confirma; ao confirmar, o líquido vira a receita "Salário (contracheque)" daquele mês (previsto até ele marcar como recebido);
   - 13º, férias e abono entram como linhas do contracheque, reconhecidas pelo nome;
   - "Copiar do mês passado" faz uma estimativa (sem os extras) enquanto o contracheque novo não sai.
   Guardado na coleção `extratos` (cofre dele): id cc_AAAA-MM, só o que foi lido (nunca CPF, PIS nem identidade).
   ============================================================ */
/* REGRA: o contracheque de um mês (referência) é recebido NO ÚLTIMO DIA desse mesmo mês: o de novembro cai em 30/11 (correção do proprietário em 25/11; a regra do mês seguinte foi desfeita) */
function ccqPagoEm(ref){ return ref; }
function ccqRefDe(mesRecebimento){ return mesRecebimento; }
function ccqUltimoDia(ref){ var a = +ref.slice(0, 4), m = +ref.slice(5, 7); return ref + '-' + String(new Date(a, m, 0).getDate()).padStart(2, '0'); }
function ccqAtivo(){ return typeof ffnAtivo === 'function' && ffnAtivo(); }
function ccqDoc(mes){ var d = extDocPorId('cc_' + mes); return d && d.tipo === 'contracheque' ? d : null; }
function ccqPendentes(){ return dcmPendentes().filter(function(d){ return d.kind === 'contracheque'; }); }
function ccqSoma(itens, f){ return itens.filter(f).reduce(function(t, x){ return t + x.valor; }, 0); }
function ccqLinha(x){ return '<div class="plan-linha"><span>' + escapeHtml(x.desc) + (x.cat === 'extra' ? ' <em>serviço extra</em>' : '') + (x.parcela ? ' <em>parcela ' + x.parcela.n + ' de ' + x.parcela.m + '</em>' : '') + '</span><strong>' + dcmDinheiro(x.valor) + '</strong></div>'; }
function ccqCompacto(cc){
  return { ref: cc.referencia, itens: cc.itens.map(function(x){ return { codigo: x.codigo, desc: x.desc, parcela: x.parcela, valor: x.valor, tipo: x.tipo, cat: x.cat }; }), totais: cc.totais, margem: cc.margem, cargo: cc.cargo, orgao: cc.orgao, selo: cc.selo, provas: cc.provas };
}
/* o líquido vira a receita recorrente "Salário (contracheque)": o valor daquele mês fica como previsto (ele marca quando cair) */
function ccqReceita(ref, liquidoCent){
  var valor = r2(liquidoCent / 100), pm = ccqPagoEm(ref), r = receitasManuais.filter(function(x){ return x.ccqSalario; })[0];
  if (!r){ var rb0 = {}; rb0[pm] = { valor: valor, recebido: false }; return Promise.resolve(persistNovaReceita({ coluna: 'pf', descricao: 'Salário (contracheque)', recorrente: true, valorPadrao: valor, data: pm + '-01', mesReferencia: pm, recebimentos: rb0, pausadaAPartirDeMes: null, ccqSalario: true, ccqUltimoRef: ref })); }
  var rb = Object.assign({}, r.recebimentos || {}), ja = rb[pm] || {};
  rb[pm] = ja.recebido ? Object.assign({}, ja, { valor: valor }) : { recebido: false, valor: valor };
  var patch = { recebimentos: rb };
  if (!r.ccqUltimoRef || ref >= r.ccqUltimoRef){ patch.valorPadrao = valor; patch.ccqUltimoRef = ref; }
  if (String(r.data || '').slice(0, 7) > pm){ patch.data = pm + '-01'; patch.mesReferencia = pm; }
  return Promise.resolve(persistPatchReceita(r, patch));
}
function ccqConfirmar(d){
  var x = d.dados, refEl = qs('ccq_' + d.id + '_ref'), ref = (refEl && refEl.value) || x.ref || '';
  if (!/^\d{4}-\d{2}$/.test(ref)){ toast('Informe o mês de referência do contracheque.'); return Promise.resolve(); }
  var doc = { tipo: 'contracheque', ref: ref, itens: x.itens, totais: x.totais, margem: x.margem, cargo: x.cargo || '', orgao: x.orgao || '', selo: x.selo, provas: x.provas || [], lidoEm: new Date().toISOString(), fonte: d.titulo || '', origem: d.id };
  return extGravar('cc_' + ref, doc).then(function(){ return ccqReceita(ref, x.totais.liquido); }).then(function(){ return dcmConcluir(d); })
    .then(function(){ toast('Contracheque de ' + mesLabel(ref) + ' guardado. O líquido de ' + dcmDinheiro(x.totais.liquido) + ' entrou como salário previsto de ' + mesLabel(ccqPagoEm(ref)) + ' (cai no último dia do mês, ' + fmtData(ccqUltimoDia(ref)) + ').'); if (ccqPagoEm(ref) !== mesSelecionado) toast('Para ver, escolha ' + mesLabel(ccqPagoEm(ref)) + ' no topo.'); try{ renderFinanceiro(); }catch(e){} });
}
/* estimativa a partir do mês passado: sem os serviços extras (que variam) */
function ccqCopiar(){
  var refNovo = ccqRefDe(mesSelecionado), ant = deslocarMes(refNovo, -1), o = ccqDoc(ant); if (!o){ toast('Não há contracheque de ' + mesLabel(ant) + ' para copiar.'); return Promise.resolve(); }
  var extras = ccqSoma(o.itens, function(x){ return x.cat === 'extra'; }), itens = o.itens.filter(function(x){ return x.cat !== 'extra'; });
  var T = Object.assign({}, o.totais, { rendimentos: o.totais.rendimentos - extras, liquido: o.totais.liquido - extras });
  var doc = { tipo: 'contracheque', ref: refNovo, itens: itens, totais: T, margem: o.margem, cargo: o.cargo, orgao: o.orgao, selo: 'amarelo', provas: ['estimativa copiada de ' + mesLabel(ant) + ' (sem os serviços extras)'], copiado: true, lidoEm: new Date().toISOString(), fonte: 'copiado' };
  return extGravar('cc_' + refNovo, doc).then(function(){ return ccqReceita(refNovo, T.liquido); }).then(function(){ toast('Estimativa criada. Leia o contracheque de verdade quando sair.'); try{ renderFinanceiro(); }catch(e){} });
}
/* o líquido apareceu como crédito no extrato? */
function ccqConfere(doc){
  var liq = doc.totais.liquido, ini = ccqPagoEm(doc.ref) + '-01', fim = deslocarMes(doc.ref, 1) + '-05', ach = null;   /* cai no último dia do mês da referência (aceita até o começo do seguinte) */
  extratos.forEach(function(e){ if (e.tipo === 'arquivo') (e.lanc || []).forEach(function(l){ if (!ach && Math.abs(l.v - liq) <= 1 && l.d >= ini && l.d <= fim) ach = { data: l.d, titulo: e.titulo || '' }; }); });
  return ach;
}
function ccqConsignados(doc){
  return doc.itens.filter(function(x){ return x.cat === 'consignado' && x.parcela; }).map(function(x){ var rest = Math.max(0, x.parcela.m - x.parcela.n); return { desc: x.desc, n: x.parcela.n, m: x.parcela.m, valor: x.valor, restam: rest, ate: rest ? deslocarMes(doc.ref, rest) : doc.ref, falta: rest * x.valor }; }).sort(function(a, b){ return a.ate.localeCompare(b.ate); });
}
function ccqCardDoc(doc){
  var prov = doc.itens.filter(function(x){ return x.tipo === 'provento'; }), desc = doc.itens.filter(function(x){ return x.tipo === 'desconto' && x.cat !== 'consignado'; }), cons = ccqConsignados(doc), T = doc.totais;
  var extras = ccqSoma(doc.itens, function(x){ return x.cat === 'extra'; }), especiais = doc.itens.filter(function(x){ return x.cat === 'decimo' || x.cat === 'ferias' || x.cat === 'abono'; });
  var r = receitasManuais.filter(function(x){ return x.ccqSalario; })[0], reg = r && r.recebimentos ? r.recebimentos[ccqPagoEm(doc.ref)] : null, recebido = !!(reg && reg.recebido);
  var conf = !doc.copiado ? ccqConfere(doc) : null, totCons = cons.reduce(function(t, c){ return t + c.valor; }, 0), faltaTot = cons.reduce(function(t, c){ return t + c.falta; }, 0);
  var h = '<div class="financeiro-secao-head"><h4>Contracheque · ' + escapeHtml(mesLabel(doc.ref)) + '</h4><button type="button" class="btn-text" data-ccq="ler">Ler outro</button></div><div class="saldo-data">Cai no último dia do mês (' + escapeHtml(fmtData(ccqUltimoDia(doc.ref))) + ').</div>' +
    '<div class="ext-chips"><span class="ext-chip ' + (doc.selo === 'verde' ? 'ok' : 'bad') + '" title="' + escapeHtml((doc.provas || []).join('; ')) + '">' + (doc.copiado ? 'estimativa do mês passado' : (doc.selo === 'verde' ? 'lido · fecha com os totais' : 'lido · confira')) + '</span>' + (conf ? '<span class="ext-chip ok" title="' + escapeHtml(conf.titulo) + '">confere com o extrato (' + escapeHtml(fmtData(conf.data)) + ')</span>' : '') + '</div>' +
    '<div class="fv-k" style="margin-top:8px">Proventos · bruto ' + dcmDinheiro(T.rendimentos) + '</div>' + prov.map(ccqLinha).join('') +
    '<div class="fv-k" style="margin-top:8px">Descontos em folha · ' + dcmDinheiro(T.descontos) + (cons.length ? ' (inclui ' + dcmDinheiro(totCons) + ' de consignados)' : '') + '</div>' + desc.map(ccqLinha).join('') +
    '<div class="fp-eq tot" style="margin-top:8px"><span>Líquido (cai na conta)</span><b class="ok">' + dcmDinheiro(T.liquido) + '</b></div>' +
    '<div class="saldo-data">Salário de ' + escapeHtml(mesLabel(doc.ref)) + ': <b>' + (recebido ? 'recebido' : 'previsto') + '</b> ' + (r && !recebido ? '<button type="button" class="btn-text" data-ccq="recebido">Marcar como recebido</button>' : '') + '</div>' +
    (extras > 0 ? '<div class="note" style="margin-top:8px"><b>Serviços extras neste contracheque:</b> ' + dcmDinheiro(extras) + ' (bruto). Já estão dentro do líquido acima.</div>' : '') +
    (especiais.length ? '<div class="saldo-data" style="margin-top:6px">Também no contracheque: ' + especiais.map(function(x){ return escapeHtml(x.desc) + ' ' + dcmDinheiro(x.valor); }).join(' · ') + '</div>' : '');
  if (cons.length) h += '<div class="fv-k" style="margin-top:10px">Consignados · ' + cons.length + ' contratos · ' + dcmDinheiro(totCons) + '/mês' + (T.liquido > 0 ? ' (' + Math.round(totCons / (T.rendimentos || 1) * 100) + '% do bruto)' : '') + '</div>' +
    cons.map(function(c){ return '<div class="plan-linha"><span>' + escapeHtml(c.desc) + ' <em>parcela ' + c.n + ' de ' + c.m + ' · ' + (c.restam ? 'restam ' + c.restam + ', termina em ' + escapeHtml(mesLabel(c.ate)) : 'última parcela') + '</em></span><strong>' + dcmDinheiro(c.valor) + '</strong></div>'; }).join('') +
    '<div class="saldo-data">Falta pagar no total (se nada mudar): ' + dcmDinheiro(faltaTot) + (doc.margem && doc.margem.consignavel != null ? ' · margem consignável: ' + dcmDinheiro(doc.margem.consignavel) : '') + '</div>';
  return h + '<div class="ext-acoes"><button type="button" class="btn btn-ghost" data-ccq="apagar" data-id="' + escapeHtml('cc_' + doc.ref) + '">Apagar este contracheque</button></div>';
}
function ccqCardPendente(d){
  var x = d.dados, T = x.totais, cons = x.itens.filter(function(i){ return i.cat === 'consignado'; }).length, extras = ccqSoma(x.itens, function(i){ return i.cat === 'extra'; });
  return '<div class="ini-card ext-card" data-ccq-card="' + escapeHtml(d.id) + '"><div class="ext-card-top"><b>Contracheque lido' + (x.ref ? ' · ' + escapeHtml(mesLabel(x.ref)) : '') + '</b><span class="saldo-data">' + escapeHtml(x.cargo || '') + '</span></div>' +
    '<div class="plan-linha"><span>Bruto</span><strong>' + dcmDinheiro(T.rendimentos) + '</strong></div><div class="plan-linha"><span>Descontos em folha</span><strong>' + dcmDinheiro(T.descontos) + '</strong></div><div class="plan-linha"><span>Líquido</span><strong>' + dcmDinheiro(T.liquido) + '</strong></div>' +
    '<div class="saldo-data">' + x.itens.length + ' linhas' + (cons ? ' · ' + cons + ' consignados' : '') + (extras ? ' · serviços extras ' + dcmDinheiro(extras) : '') + '</div>' +
    '<div class="field" style="margin:6px 0"><label class="field-label">Mês de referência (o salário cai no último dia desse mês)</label><input type="month" id="ccq_' + escapeHtml(d.id) + '_ref" value="' + escapeHtml(x.ref || '') + '"></div>' + dcmSeloChip(d) +
    '<div class="ext-acoes"><button type="button" class="btn btn-primary" data-ccq="confirmar" data-id="' + escapeHtml(d.id) + '">Confirmar contracheque</button><button type="button" class="btn-text" data-ccq="ignorar" data-id="' + escapeHtml(d.id) + '">Ignorar</button></div></div>';
}
/* cartão em "Salário e fixos" (só o familiar com Finanças) */
function ccqHtml(){
  var refMes = ccqRefDe(mesSelecionado), doc = ccqDoc(refMes), pend = ccqPendentes(), ant = ccqDoc(deslocarMes(refMes, -1));
  var h = '<div class="financeiro-bloco" id="ccqCard">' + '<input type="file" id="ccqArq" accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf,text/plain" style="display:none">';
  h += pend.map(ccqCardPendente).join('');
  if (doc) h += ccqCardDoc(doc);
  else if (!pend.length) h += '<div class="financeiro-secao-head"><h4>Contracheque · ' + escapeHtml(mesLabel(refMes)) + '</h4></div><div class="financeiro-vazio">Ainda não há contracheque de ' + escapeHtml(mesLabel(refMes)) + '. Envie o PDF ou a foto: o app separa proventos, descontos, serviços extras e consignados e confere pelos totais.</div>' +
    '<div class="ext-acoes"><button type="button" class="btn btn-primary" data-ccq="ler">Ler contracheque (PDF ou foto)</button>' + (ant ? '<button type="button" class="btn btn-ghost" data-ccq="copiar">Copiar de ' + escapeHtml(mesLabel(deslocarMes(refMes, -1))) + ' (estimativa)</button>' : '') + '</div>';
  else h += '<div class="ext-acoes"><button type="button" class="btn btn-ghost" data-ccq="ler">Ler outro contracheque</button></div>';
  return h + '</div>';
}
/* resumo no alto de "Divisão do salário" */
function ccqResumoDivisao(){
  var doc = ccqDoc(ccqRefDe(mesSelecionado)); if (!doc) return '';
  var T = doc.totais, cons = ccqConsignados(doc), totCons = cons.reduce(function(t, c){ return t + c.valor; }, 0), extras = ccqSoma(doc.itens, function(x){ return x.cat === 'extra'; });
  return '<div class="financeiro-bloco"><div class="financeiro-secao-head"><h4>Contracheque de ' + escapeHtml(mesLabel(doc.ref)) + (doc.copiado ? ' (estimativa)' : '') + ' · recebido em ' + escapeHtml(mesLabel(mesSelecionado)) + '</h4></div>' +
    '<div class="plan-linha"><span>Bruto</span><strong>' + dcmDinheiro(T.rendimentos) + '</strong></div><div class="plan-linha"><span>Descontos em folha' + (totCons ? ' <em>(consignados ' + dcmDinheiro(totCons) + ')</em>' : '') + '</span><strong class="neg">− ' + dcmDinheiro(T.descontos) + '</strong></div>' +
    '<div class="plan-linha"><span>Líquido (base da divisão)</span><strong>' + dcmDinheiro(T.liquido) + '</strong></div>' +
    (extras > 0 ? '<div class="saldo-data">Dentro do bruto há ' + dcmDinheiro(extras) + ' de serviços extras, que variam de mês para mês: não conte com eles como certos.</div>' : '') + '</div>';
}
function ccqLerArquivos(files){
  var f = files[0]; if (!f) return Promise.resolve();
  toast('Lendo ' + f.name + '…');
  return f.arrayBuffer().then(function(buf){ return impProcessar(f.name, buf); }).then(function(r){
    if (r && r.jaLido) toast('Esse contracheque já tinha sido lido.');
    else toast('Li o arquivo. Confira e confirme abaixo.');
    try{ renderFinanceiro(); }catch(e){}
  }).catch(function(e){ toast((e && e.message) || 'Não consegui ler esse arquivo.'); });
}
document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('[data-ccq]') : null; if (!b) return;
  var a = b.getAttribute('data-ccq'), id = b.getAttribute('data-id');
  if (a === 'ler'){ var i = qs('ccqArq'); if (i) i.click(); return; }
  if (a === 'copiar') return ccqCopiar();
  if (a === 'recebido'){ var doc = ccqDoc(ccqRefDe(mesSelecionado)), r = receitasManuais.filter(function(x){ return x.ccqSalario; })[0]; if (doc && r) marcarReceitaRecebida(r.id, r2(doc.totais.liquido / 100)); return; }
  if (a === 'apagar'){ if (!confirm('Apagar este contracheque? O salário previsto do mês volta ao valor padrão.')) return; var ccd = extDocPorId(id); return extApagar(id).then(function(){ return ccd && ccd.origem && extDocPorId(ccd.origem) ? extApagar(ccd.origem) : null; }).then(function(){ try{ renderFinanceiro(); }catch(e){} }); }   /* apaga também o registro da leitura: o mesmo arquivo pode ser lido de novo */
  var d = extDocPorId(id); if (!d) return;
  if (a === 'confirmar') return ccqConfirmar(d);
  if (a === 'ignorar') return dcmConcluir(d, { status: 'ignorado' }).then(function(){ try{ renderFinanceiro(); }catch(e){} });
});
document.addEventListener('change', function(ev){ var t = ev.target; if (t && t.id === 'ccqArq'){ var fs = Array.prototype.slice.call(t.files || []); t.value = ''; ccqLerArquivos(fs); } });
(function(){
  if (typeof renderColunaFinanceiro === 'function'){
    var oCol = renderColunaFinanceiro;
    renderColunaFinanceiro = function(coluna){
      var r = oCol.apply(this, arguments);
      try{ if (coluna === 'pf' && ccqAtivo()){ var c = qs('colunaFinanceiroPf'); if (c) c.insertAdjacentHTML('afterbegin', ccqHtml()); } }catch(e){ console.error('contracheque', e); }
      return r;
    };
  }
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { ccqDoc: ccqDoc, ccqConsignados: ccqConsignados });
})();
