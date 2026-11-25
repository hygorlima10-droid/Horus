/* ============================================================
   CONTRACHEQUE (prefixo ccq) — perfil familiar com Finanças: salário de servidor com descontos em folha, serviços extras e consignados.
   - "Salário e fixos" ganha o cartão "Contracheque do mês": proventos, descontos em folha, líquido (o que cai na conta), serviços extras
     (SERV EXTRAORDINARIO, AC4… vêm no próprio contracheque) e a tabela de consignados (parcela x de y, quanto falta, quando termina, margem);
   - o contracheque é lido do PDF ou da foto (cliente/leitor-geral.js: proventos e descontos separados pela conta dos totais) e só vale depois
     que ele confirma; ao confirmar, o líquido vira a receita "Salário (contracheque)" daquele mês (previsto até ele marcar como recebido);
   - 13º, férias e abono entram como linhas do contracheque, reconhecidas pelo nome;
   - "Copiar do mês passado" faz uma estimativa (sem os extras) enquanto o contracheque novo não sai.
   - EM LOTE: vários arquivos ou um PDF com vários contracheques (uma página cada, até 24 por arquivo) viram uma tabela de conferência; só os marcados são guardados,
     e só no HISTÓRICO (não lançam salário recebido); o mês já guardado vem desmarcado. O histórico confere os consignados mês a mês (parcela n anda de 1 em 1).
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
    (doc.soHistorico ? '<div class="saldo-data">Guardado só no histórico: este contracheque <b>não</b> foi lançado como salário recebido.</div>' : '<div class="saldo-data">Salário de ' + escapeHtml(mesLabel(doc.ref)) + ': <b>' + (recebido ? 'recebido' : 'previsto') + '</b> ' + (r && !recebido ? '<button type="button" class="btn-text" data-ccq="recebido">Marcar como recebido</button>' : '') + '</div>') +
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
  var h = '<div class="financeiro-bloco" id="ccqCard">' + '<input type="file" id="ccqArq" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf,text/plain" style="display:none">';
  h += ccqLoteHtml();
  h += pend.map(ccqCardPendente).join('');
  if (doc) h += ccqCardDoc(doc);
  else if (!pend.length) h += '<div class="financeiro-secao-head"><h4>Contracheque · ' + escapeHtml(mesLabel(refMes)) + '</h4></div><div class="financeiro-vazio">Ainda não há contracheque de ' + escapeHtml(mesLabel(refMes)) + '. Envie o PDF ou a foto (ou vários de uma vez): o app separa proventos, descontos, serviços extras e consignados e confere pelos totais.</div>' +
    '<div class="ext-acoes"><button type="button" class="btn btn-primary" data-ccq="ler">Ler contracheque (PDF ou foto)</button>' + (ant ? '<button type="button" class="btn btn-ghost" data-ccq="copiar">Copiar de ' + escapeHtml(mesLabel(deslocarMes(refMes, -1))) + ' (estimativa)</button>' : '') + '</div>';
  else h += '<div class="ext-acoes"><button type="button" class="btn btn-ghost" data-ccq="ler">Ler outro contracheque</button></div>';
  h += '<div class="saldo-data">Dá para escolher vários arquivos de uma vez, ou um PDF com vários contracheques (uma página cada, até ' + CCQ_MAX_PAG + ' por arquivo): vira uma tabela para você conferir e guardar no histórico.</div>';
  return h + ccqHistoricoHtml() + '</div>';
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

/* ---------- LOTE: vários contracheques de uma vez (só histórico) ---------- */
var CCQ_MAX_PAG = 24, ccqL = { itens: [], msg: '', ocupado: false, aviso: '' };
function ccqMesesEntre(a, b){ return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
function ccqNormDesc(d){ return String(d || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(); }
function ccqMsg(t){ ccqL.msg = t; var e = qs('ccqLoteMsg'); if (e) e.textContent = t; }
function ccqGrupoPagina(L, p){ var g = [], it = []; L.forEach(function(l, i){ if (L.pag[i] === p){ g.push(l); if (L.itens) it.push(L.itens[i]); } }); g.itens = it; return g; }
function ccqEntrada(nome, pag, cc, total){
  var ref = cc.referencia || '', ja = ref ? ccqDoc(ref) : null, rotulo = nome + (total > 1 ? ' · pág. ' + pag : '');
  return { nome: rotulo, ref: ref, cc: ccqCompacto(cc), ja: !!ja, marcar: !!ref && !ja };
}
/* lê um arquivo (PDF de uma ou várias páginas, ou foto) e devolve as linhas da tabela de conferência */
function ccqLerUm(f, buf){
  var u = new Uint8Array(buf), ehPdf = u.length > 4 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
  if (!ehPdf){
    if (typeof dcmEhImagem === 'function' && dcmEhImagem(u)){ ccqMsg('Lendo a foto ' + f.name + '…'); return dcmLerImagem(f.name, buf).then(function(r){ var d = r.doc; return d && d.kind === 'contracheque' ? [ccqEntradaDoc(f.name, 1, d.dados, 1)] : []; }); }
    var t = new TextDecoder().decode(u), d = typeof dcmDeTexto === 'function' ? dcmDeTexto(t, f.name) : null; return Promise.resolve(d && d.kind === 'contracheque' ? [ccqEntradaDoc(f.name, 1, d.dados, 1)] : []);
  }
  var senha, abrir = function(sn){ return extCarregarPdfJs().then(function(pdfjs){ return EX.pdfLinhas(pdfjs, new Uint8Array(buf.slice(0)), sn, false); }); };
  return abrir().catch(function(e){
    if (!(e && e.name === 'PasswordException')) throw e;
    return impComSenha('Este PDF tem senha.', function(sn){ senha = sn; return abrir(sn).catch(function(e2){ if (e2 && e2.name === 'PasswordException') throw impErroSenha(); throw e2; }); });
  }).then(function(L){
    var paginas = {}, npag = 0; (L.pag || []).forEach(function(p){ if (!paginas[p]){ paginas[p] = 1; npag++; } });
    var achados = [], nums = Object.keys(paginas).map(Number).sort(function(a, b){ return a - b; });
    if (nums.length > CCQ_MAX_PAG) ccqL.aviso += (ccqL.aviso ? ' ' : '') + f.name + ': li só as primeiras ' + CCQ_MAX_PAG + ' páginas de ' + nums.length + '.';
    nums.slice(0, CCQ_MAX_PAG).forEach(function(p){
      var g = ccqGrupoPagina(L, p); if (!LeitorGeral.pareceContracheque(g)) return;
      var cc = LeitorGeral.lerContracheque(g); if (cc) achados.push(ccqEntrada(f.name, p, cc, nums.length));
    });
    if (achados.length) { achados.forEach(function(a){ a.nome = nums.length > 1 ? a.nome : f.name; }); return achados; }
    /* PDF só de imagem: lê cada página como foto (OCR no aparelho; demora, uns 20 segundos por página) */
    return dcmPdfPaginasPng(buf, senha, CCQ_MAX_PAG).then(function(pgs){
      var out = [], i = 0;
      function prox(){
        if (i >= pgs.length) return Promise.resolve(out);
        var k = ++i; ccqMsg('Lendo ' + f.name + ': página ' + k + ' de ' + pgs.length + ' (leitura de imagem, pode levar um pouco)…');
        return dcmLerImagem(f.name + ' (pág. ' + k + ')', pgs[k - 1]).then(function(r){ if (r && r.doc && r.doc.kind === 'contracheque') out.push(ccqEntradaDoc(f.name, k, r.doc.dados, pgs.length)); }, function(){ }).then(prox);
      }
      return prox();
    });
  });
}
function ccqEntradaDoc(nome, pag, dados, total){
  var ref = dados.ref || '', ja = ref ? ccqDoc(ref) : null, v = dados.selo === 'verde' && !dados.viaFoto;
  return { nome: nome + (total > 1 ? ' · pág. ' + pag : ''), ref: ref, cc: dados, ja: !!ja, marcar: !!ref && !ja };
}
function ccqLote(files){
  if (ccqL.ocupado) return Promise.resolve();
  ccqL = { itens: [], msg: '', ocupado: true, aviso: '' };
  try{ renderFinanceiro(); }catch(e){}
  var i = 0, sem = [];
  function prox(){
    if (i >= files.length) return Promise.resolve();
    var f = files[i++]; ccqMsg('Lendo ' + f.name + ' (' + i + ' de ' + files.length + ')…');
    return f.arrayBuffer().then(function(buf){ return ccqLerUm(f, buf); }).then(function(es){ if (!es.length) sem.push(f.name); es.forEach(function(e){ ccqL.itens.push(e); }); }, function(e){ sem.push(f.name + (e && e.message ? ' (' + e.message + ')' : '')); }).then(prox);
  }
  return prox().then(function(){
    /* dois contracheques do mesmo mês no lote: só o primeiro vem marcado */
    var vistos = {}; ccqL.itens.forEach(function(e){ if (!e.ref) return; if (vistos[e.ref]){ e.marcar = false; e.rep = true; } else vistos[e.ref] = 1; });
    ccqL.itens.sort(function(a, b){ return String(a.ref || '9').localeCompare(String(b.ref || '9')); });
    ccqL.ocupado = false; ccqL.msg = ''; if (sem.length) ccqL.aviso += (ccqL.aviso ? ' ' : '') + 'Não reconheci como contracheque: ' + sem.join('; ') + '.';
    if (!ccqL.itens.length) toast('Não achei contracheque nesses arquivos.'); else toast('Li ' + ccqL.itens.length + ' contracheque' + (ccqL.itens.length > 1 ? 's' : '') + '. Confira a tabela e guarde.');
    try{ renderFinanceiro(); }catch(e){}
  }).catch(function(e){ ccqL.ocupado = false; ccqL.msg = ''; toast((e && e.message) || 'Não consegui ler esses arquivos.'); try{ renderFinanceiro(); }catch(e2){} });
}
function ccqLoteHtml(){
  if (!ccqL.ocupado && !ccqL.itens.length && !ccqL.aviso) return '';
  var h = '<div class="ini-card ext-card" id="ccqLote"><div class="ext-card-top"><b>Contracheques lidos em lote</b><span class="saldo-data">só entram no histórico</span></div>';
  if (ccqL.ocupado) return h + '<div class="saldo-data" id="ccqLoteMsg">' + escapeHtml(ccqL.msg || 'Lendo…') + '</div></div>';
  if (ccqL.aviso) h += '<div class="note">' + escapeHtml(ccqL.aviso) + '</div>';
  if (ccqL.itens.length){
    h += '<div class="saldo-data">Marque os que quer guardar. Quem já está guardado vem desmarcado (não substituo sem você pedir). Guardar não lança salário recebido: é só o histórico.</div><div class="ccq-tabela"><table class="ccq-t"><thead><tr><th></th><th>Mês</th><th>Bruto</th><th>Descontos</th><th>Líquido</th><th>Extras</th><th>Consig.</th><th></th></tr></thead><tbody>';
    ccqL.itens.forEach(function(e, k){
      var T = e.cc.totais, ex = ccqSoma(e.cc.itens, function(x){ return x.cat === 'extra'; }), nc = e.cc.itens.filter(function(x){ return x.cat === 'consignado'; }).length;
      var selo = e.cc.selo === 'verde' && !e.cc.viaFoto ? '<span class="ext-chip ok" title="' + escapeHtml((e.cc.provas || []).join('; ')) + '">confere</span>' : '<span class="ext-chip bad" title="' + escapeHtml((e.cc.provas || []).join('; ')) + '">confira</span>';
      var marca = e.ja ? '<span class="saldo-data">já guardado</span>' : (e.rep ? '<span class="saldo-data">mês repetido</span>' : '');
      h += '<tr data-ccq-lin="' + k + '"><td><input type="checkbox" data-ccq-marca="' + k + '"' + (e.marcar ? ' checked' : '') + (/^\d{4}-\d{2}$/.test(e.ref) ? '' : ' disabled') + ' aria-label="Guardar"></td>' +
        '<td><input type="month" data-ccq-mes="' + k + '" value="' + escapeHtml(e.ref) + '" aria-label="Mês de referência"></td><td>' + dcmDinheiro(T.rendimentos) + '</td><td>' + dcmDinheiro(T.descontos) + '</td><td><b>' + dcmDinheiro(T.liquido) + '</b></td><td>' + (ex ? dcmDinheiro(ex) : '—') + '</td><td>' + nc + '</td><td>' + selo + ' ' + marca + '<div class="saldo-data">' + escapeHtml(e.nome) + '</div></td></tr>';
    });
    var n = ccqL.itens.filter(function(e){ return e.marcar; }).length;
    h += '</tbody></table></div><div class="ext-acoes"><button type="button" class="btn btn-primary" data-ccq="lote-guardar"' + (n ? '' : ' disabled') + '>Guardar ' + n + ' no histórico</button><button type="button" class="btn-text" data-ccq="lote-descartar">Descartar</button></div>';
  } else h += '<div class="ext-acoes"><button type="button" class="btn-text" data-ccq="lote-descartar">Fechar</button></div>';
  return h + '</div>';
}
function ccqLoteGuardar(){
  var alvo = ccqL.itens.filter(function(e){ return e.marcar && /^\d{4}-\d{2}$/.test(e.ref); }), i = 0, feitos = 0;
  if (!alvo.length){ toast('Marque ao menos um contracheque.'); return Promise.resolve(); }
  function prox(){
    if (i >= alvo.length) return Promise.resolve();
    var e = alvo[i++], x = e.cc;
    var doc = { tipo: 'contracheque', ref: e.ref, itens: x.itens, totais: x.totais, margem: x.margem, cargo: x.cargo || '', orgao: x.orgao || '', selo: x.selo, provas: x.provas || [], lidoEm: new Date().toISOString(), fonte: e.nome, origem: '', soHistorico: true };
    return extGravar('cc_' + e.ref, doc).then(function(){ feitos++; }).then(prox);
  }
  return prox().then(function(){ ccqL = { itens: [], msg: '', ocupado: false, aviso: '' }; toast(feitos + ' contracheque' + (feitos > 1 ? 's guardados' : ' guardado') + ' no histórico (sem lançar salário).'); try{ renderFinanceiro(); }catch(e){} });
}
/* histórico: todos os contracheques guardados + conferência dos consignados mês a mês */
function ccqHistorico(){
  var docs = extratos.filter(function(d){ return d.tipo === 'contracheque' && !d.copiado && /^\d{4}-\d{2}$/.test(d.ref || ''); }).sort(function(a, b){ return a.ref.localeCompare(b.ref); }), contratos = {}, alertas = [];
  docs.forEach(function(d){ d.itens.forEach(function(x){ if (x.cat !== 'consignado' || !x.parcela) return; var k = ccqNormDesc(x.desc) + '|' + x.parcela.m; (contratos[k] = contratos[k] || { desc: x.desc, pts: [] }).pts.push({ ref: d.ref, n: x.parcela.n, valor: x.valor }); }); });
  Object.keys(contratos).forEach(function(k){
    var c = contratos[k], pts = c.pts;
    for (var i = 1; i < pts.length; i++){
      var dm = ccqMesesEntre(pts[i - 1].ref, pts[i].ref), esperado = pts[i - 1].n + dm;
      if (pts[i].n !== esperado) alertas.push({ tipo: 'parcela', txt: c.desc + ': parcela ' + pts[i - 1].n + ' em ' + mesLabel(pts[i - 1].ref) + ' e parcela ' + pts[i].n + ' em ' + mesLabel(pts[i].ref) + ' (era para ser a ' + esperado + ').' });
      else if (Math.abs(pts[i].valor - pts[i - 1].valor) > 1) alertas.push({ tipo: 'valor', txt: c.desc + ': o valor da parcela mudou de ' + dcmDinheiro(pts[i - 1].valor) + ' (' + mesLabel(pts[i - 1].ref) + ') para ' + dcmDinheiro(pts[i].valor) + ' (' + mesLabel(pts[i].ref) + ').' });
    }
  });
  /* contrato que sumiu antes da última parcela, ou apareceu no meio */
  var refs = docs.map(function(d){ return d.ref; });
  Object.keys(contratos).forEach(function(k){
    var c = contratos[k], ult = c.pts[c.pts.length - 1], prim = c.pts[0];
    if (ult.n < +k.split('|')[1]){ var prox = refs.filter(function(r){ return r > ult.ref; })[0]; if (prox) alertas.push({ tipo: 'sumiu', txt: c.desc + ': estava na parcela ' + ult.n + ' de ' + k.split('|')[1] + ' em ' + mesLabel(ult.ref) + ' e não aparece em ' + mesLabel(prox) + ' (quitado ou renegociado?).' }); }
    var ant = refs.filter(function(r){ return r < prim.ref; }).pop(); if (ant && prim.n > 1) alertas.push({ tipo: 'novo', txt: c.desc + ': aparece em ' + mesLabel(prim.ref) + ' já na parcela ' + prim.n + ', e não estava em ' + mesLabel(ant) + '.' });
  });
  return { docs: docs, alertas: alertas };
}
function ccqHistoricoHtml(){
  var H = ccqHistorico(); if (H.docs.length < 2) return '';
  var linhas = H.docs.slice().reverse().map(function(d){ var T = d.totais, ex = ccqSoma(d.itens, function(x){ return x.cat === 'extra'; }), cons = d.itens.filter(function(x){ return x.cat === 'consignado'; }).reduce(function(t, x){ return t + x.valor; }, 0);
    return '<tr><td>' + escapeHtml(mesLabel(d.ref)) + (d.soHistorico ? ' <span class="saldo-data">histórico</span>' : '') + '</td><td>' + dcmDinheiro(T.rendimentos) + '</td><td>' + dcmDinheiro(T.descontos) + '</td><td><b>' + dcmDinheiro(T.liquido) + '</b></td><td>' + (ex ? dcmDinheiro(ex) : '—') + '</td><td>' + (cons ? dcmDinheiro(cons) : '—') + '</td></tr>'; }).join('');
  return '<details class="ini-card ext-card" id="ccqHist"><summary><b>Histórico de contracheques</b> · ' + H.docs.length + ' meses' + (H.alertas.length ? ' · <span class="ext-chip bad">' + H.alertas.length + ' ponto' + (H.alertas.length > 1 ? 's' : '') + ' para conferir</span>' : ' · <span class="ext-chip ok">consignados em ordem</span>') + '</summary>' +
    '<div class="ccq-tabela"><table class="ccq-t"><thead><tr><th>Mês</th><th>Bruto</th><th>Descontos</th><th>Líquido</th><th>Extras</th><th>Consignados</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
    (H.alertas.length ? '<div class="fv-k" style="margin-top:8px">Conferência dos consignados</div>' + H.alertas.map(function(a){ return '<div class="plan-linha"><span>' + escapeHtml(a.txt) + '</span></div>'; }).join('') : '<div class="saldo-data">A parcela de cada consignado andou de 1 em 1 a cada mês, sem sumir nem aparecer no meio.</div>') + '</details>';
}
function ccqLerArquivos(files){
  var f = files[0]; if (!f) return Promise.resolve();
  if (files.length > 1) return ccqLote(files);
  toast('Lendo ' + f.name + '…');
  return f.arrayBuffer().then(function(buf){
    var u = new Uint8Array(buf);
    if (!(u.length > 4 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46)) return impProcessar(f.name, buf);
    /* PDF com mais de uma página de contracheque: vai para o lote (tabela de conferência) */
    return extCarregarPdfJs().then(function(pdfjs){ return pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise.then(function(d){ return d.numPages; }); }).catch(function(){ return 1; }).then(function(np){ return np > 1 ? ccqLote([f]).then(function(){ return { lote: true }; }) : impProcessar(f.name, buf); });
  }).then(function(r){
    if (r && r.lote) return;
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
  if (a === 'lote-guardar') return ccqLoteGuardar();
  if (a === 'lote-descartar'){ ccqL = { itens: [], msg: '', ocupado: false, aviso: '' }; try{ renderFinanceiro(); }catch(e){} return; }
  if (a === 'recebido'){ var doc = ccqDoc(ccqRefDe(mesSelecionado)), r = receitasManuais.filter(function(x){ return x.ccqSalario; })[0]; if (doc && r) marcarReceitaRecebida(r.id, r2(doc.totais.liquido / 100)); return; }
  if (a === 'apagar'){ if (!confirm('Apagar este contracheque? O salário previsto do mês volta ao valor padrão.')) return; var ccd = extDocPorId(id); return extApagar(id).then(function(){ return ccd && ccd.origem && extDocPorId(ccd.origem) ? extApagar(ccd.origem) : null; }).then(function(){ try{ renderFinanceiro(); }catch(e){} }); }   /* apaga também o registro da leitura: o mesmo arquivo pode ser lido de novo */
  var d = extDocPorId(id); if (!d) return;
  if (a === 'confirmar') return ccqConfirmar(d);
  if (a === 'ignorar') return dcmConcluir(d, { status: 'ignorado' }).then(function(){ try{ renderFinanceiro(); }catch(e){} });
});
document.addEventListener('change', function(ev){
  var t = ev.target; if (!t || !t.getAttribute) return;
  var m = t.getAttribute('data-ccq-marca'); if (m != null && ccqL.itens[+m]){ ccqL.itens[+m].marcar = t.checked; try{ renderFinanceiro(); }catch(e){} return; }
  var me = t.getAttribute('data-ccq-mes'); if (me != null && ccqL.itens[+me]){ var e = ccqL.itens[+me]; e.ref = t.value || ''; e.ja = !!(e.ref && ccqDoc(e.ref)); e.marcar = !!e.ref && !e.ja; try{ renderFinanceiro(); }catch(e2){} return; }
});
document.addEventListener('change', function(ev){ var t = ev.target; if (t && t.id === 'ccqArq'){ var fs = Array.prototype.slice.call(t.files || []); t.value = ''; ccqLerArquivos(fs); } });
(function(){
  var st = document.createElement('style'); st.textContent = '.ccq-tabela{overflow-x:auto;margin:6px 0}.ccq-t{border-collapse:collapse;width:100%;font-size:var(--t2)}.ccq-t th{font-size:var(--t1);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);text-align:left;padding:4px 8px}.ccq-t td{padding:6px 8px;border-top:1px solid var(--line);white-space:nowrap;vertical-align:top}.ccq-t input[type=month]{width:140px}'; document.head.appendChild(st);
  if (typeof renderColunaFinanceiro === 'function'){
    var oCol = renderColunaFinanceiro;
    renderColunaFinanceiro = function(coluna){
      var r = oCol.apply(this, arguments);
      try{ if (coluna === 'pf' && ccqAtivo()){ var c = qs('colunaFinanceiroPf'); if (c) c.insertAdjacentHTML('afterbegin', ccqHtml()); } }catch(e){ console.error('contracheque', e); }
      return r;
    };
  }
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { ccqDoc: ccqDoc, ccqConsignados: ccqConsignados, ccqHistorico: ccqHistorico });
})();
