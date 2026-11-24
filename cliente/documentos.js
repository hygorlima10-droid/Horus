/* ============================================================
   DOCUMENTOS (prefixo dcm) — "Enviar documentos": além do extrato, o app lê boleto, Pix "copia e cola" e comprovante de pagamento/Pix
   (PDF, foto ou texto colado), SEM modelo por banco (cliente/leitor-geral.js). O que é lido fica em "Para conferir", como o extrato:
     - boleto / Pix cobrança  → vira uma despesa A PAGAR (você confere nome, valor e data antes);
     - comprovante de saída   → dá baixa na despesa que combina (valor, data e nome) ou lança uma despesa já paga;
     - comprovante de entrada → lança como receita.
   Nada é lançado sem o seu toque. Cada documento guarda só os campos lidos (nunca o texto inteiro). Vale para todos os perfis com Finanças;
   o familiar só tem a conta pessoal (PF).
   ============================================================ */
var dcmS = { col: {}, cand: {}, texto: '' };
function dcmDinheiro(c){ return fmtMoeda((c || 0) / 100); }
function dcmCatId(label){ var l = (typeof CATEGORIAS_LISTA !== 'undefined' ? CATEGORIAS_LISTA : []).filter(function(c){ return c.label === label; })[0]; return l ? l.id : 'outros'; }
function dcmCatDe(nome){ try{ return extCategoria({ s: nome || '', n: '' }, extCfg().regras); }catch(e){ return 'Outros'; } }
function dcmPode(){ return ppDono() || ppPapel() === 'advogado' || (typeof ffnAtivo === 'function' && ffnAtivo()); }
function dcmPendentes(){ return extratos.filter(function(d){ return d.tipo === 'documento' && d.status === 'pendente'; }).sort(function(a, b){ return String(b.lidoEm || '').localeCompare(String(a.lidoEm || '')); }); }

/* ---------- ler: linhas de PDF, texto colado ou foto (OCR) → { kind, dados } ---------- */
function dcmCompactoComprovante(c){
  return { tipo: c.tipo, sentido: c.sentido, sentidoPresumido: !!c.sentidoPresumido, valor: c.valor, data: c.data, hora: c.hora, nome: c.nome, origem: c.origem, destino: c.destino, e2e: c.e2e ? c.e2e.id : '', auth: c.auth || '', descricao: c.descricao || '',
    boleto: c.boleto ? { linhaFmt: LeitorGeral.fmtLinha(c.boleto), valor: c.boleto.valor, vencimento: c.boleto.vencimento, bancoNome: c.boleto.bancoNome } : null, selo: c.selo, provas: c.provas };
}
function dcmDeLinhas(linhas, itens){
  if (typeof LeitorGeral === 'undefined') return null;
  var c = LeitorGeral.classificar(linhas, itens), hoje = todayISO();
  if (c.tipo === 'boleto'){ var b = LeitorGeral.lerBoletoDoc(linhas, hoje); if (b) return { kind: 'boleto', dados: { beneficiario: b.beneficiario, beneficiarioDoc: b.beneficiarioDoc, pagador: b.pagador, banco: b.banco, bancoNome: b.bancoNome, valor: b.valorDocumento != null && b.valor == null ? b.valorDocumento : b.valor, vencimento: b.vencimento, semVencimento: b.semVencimento, linhaFmt: b.linhaFmt, tipo: b.tipo, selo: b.selo, provas: b.provas } }; }
  if (c.tipo === 'contracheque' && typeof ccqAtivo === 'function' && ccqAtivo()){ var cc = LeitorGeral.lerContracheque(linhas); if (cc) return { kind: 'contracheque', dados: ccqCompacto(cc) }; }
  if (c.tipo === 'pix_copia_cola'){ var p = LeitorGeral.acharBRCode(linhas.join('\n')); if (p) return { kind: 'pix', dados: { valor: p.valor, nome: p.nome, cidade: p.cidade, chave: p.chave, txid: p.txid, descricao: p.descricao, dinamico: p.dinamico, selo: p.crcOk ? 'verde' : 'amarelo', provas: [p.crcOk ? 'CRC do Pix confere' : 'CRC do Pix não confere'] } }; }
  if (c.tipo === 'comprovante'){ var m = LeitorGeral.lerComprovante(linhas, hoje); return { kind: 'comprovante', dados: dcmCompactoComprovante(m) }; }
  return null;
}
function dcmDeTexto(txt){
  var linhas = String(txt || '').split(/\r?\n/).map(function(x){ return x.trim(); }).filter(Boolean);
  var d = dcmDeLinhas(linhas, null); if (d) return d;
  var bs = typeof LeitorGeral !== 'undefined' ? LeitorGeral.acharBoletos(txt, todayISO()) : [];   /* só a linha digitável colada */
  if (bs.length){ var b = bs[0]; return { kind: 'boleto', dados: { beneficiario: '', beneficiarioDoc: '', pagador: '', banco: b.banco, bancoNome: b.bancoNome, valor: b.valor, vencimento: b.vencimento, semVencimento: b.semVencimento, linhaFmt: LeitorGeral.fmtLinha(b), tipo: b.tipo, selo: 'verde', provas: ['linha digitável confere nos dígitos verificadores'] } }; }
  return null;
}
function dcmRegistrar(nome, d, sig){
  var id = 'dcm_' + sig;
  if (extDocPorId(id)) return Promise.resolve({ jaLido: true, nome: nome });
  return extGravar(id, { tipo: 'documento', kind: d.kind, status: 'pendente', titulo: nome, lidoEm: new Date().toISOString(), dados: d.dados }).then(function(){ return { ok: true, nome: nome, linhas: 1, documento: true }; });
}
function dcmColar(texto){
  texto = String(texto || '').trim(); if (!texto){ toast('Cole a linha digitável do boleto ou o Pix copia e cola.'); return Promise.resolve(); }
  var d = dcmDeTexto(texto);
  if (!d){ impEstado.erro = 'Não reconheci esse texto como boleto, Pix copia e cola ou comprovante.'; impEstado.info = ''; renderExtratos(); return Promise.resolve(); }
  return dcmRegistrar('Colado em ' + fmtData(todayISO()), d, EX.fnv(texto)).then(function(r){ impEstado.erro = ''; impEstado.info = r.jaLido ? 'Esse documento já tinha sido lido.' : 'Li o documento. Confira abaixo.'; renderExtratos(); });
}

/* ---------- foto ou print: OCR no próprio aparelho (Tesseract.js, carregado só na primeira vez) ---------- */
var DCM_OCR_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', DCM_OCR_LANG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/por@1.0.0/4.0.0_best_int', dcmOcrP = null;
function dcmEhImagem(u){ return (u.length > 8 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4E && u[3] === 0x47) || (u.length > 3 && u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF) || (u.length > 12 && u[0] === 0x52 && u[1] === 0x49 && u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42); }
function dcmOcrCarregar(){
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (dcmOcrP) return dcmOcrP;
  dcmOcrP = new Promise(function(res, rej){ var s = document.createElement('script'); s.src = DCM_OCR_URL; s.onload = function(){ window.Tesseract ? res(window.Tesseract) : rej(new Error('Não consegui carregar a leitura de foto.')); }; s.onerror = function(){ dcmOcrP = null; rej(new Error('Não consegui carregar a leitura de foto (precisa de internet na primeira vez).')); }; document.head.appendChild(s); });
  return dcmOcrP;
}
/* prepara a imagem para o OCR: amplia (print pequeno vira ~2400 px de largura, no máximo 3×), tons de cinza e contraste. Sem isso, um print de 860 px perde vírgulas e dígitos. */
function dcmPreparar(buf, op){
  op = op || {}; var alvo = op.alvo || 2400, contr = op.contraste || 1.6;
  return new Promise(function(res){
    var orig = new Blob([buf]), url = URL.createObjectURL(orig), img = new Image();
    img.onload = function(){
      try{
        var e = img.width >= alvo ? 1 : Math.min(4, alvo / img.width); if (img.height * e > 6500) e = 6500 / img.height;
        var c = document.createElement('canvas'); c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
        var d = x.getImageData(0, 0, c.width, c.height), px = d.data;
        for (var i = 0; i < px.length; i += 4){ var g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2], v = Math.max(0, Math.min(255, (g - 128) * contr + 128)); px[i] = px[i + 1] = px[i + 2] = v; }
        x.putImageData(d, 0, 0); URL.revokeObjectURL(url);
        c.toBlob(function(b){ res(b || orig); }, 'image/png');
      }catch(err){ URL.revokeObjectURL(url); res(orig); }
    };
    img.onerror = function(){ URL.revokeObjectURL(url); res(orig); };
    img.src = url;
  });
}
function dcmOcrRodar(T, blob, psm){
  var cfg = Object.assign({ langPath: DCM_OCR_LANG }, window.__dcmOcrCfg || {});   /* idioma português, modelo compacto (cerca de 1,4 MB); o motor baixa uma vez e fica no cache do navegador */
  return T.createWorker('por', 1, cfg).then(function(w){
    return w.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' }).then(function(){ return w.recognize(blob); })
      .then(function(r){ return w.terminate().then(function(){ return (r && r.data && r.data.text) || ''; }); });
  });
}
/* contracheque que não fechou de primeira (um dígito lido errado, um total ilegível): lê de novo com outro tamanho e contraste e fica com a melhor leitura (a que fecha sem ajuste) */
function dcmNotaContra(r){
  var d = r && r.d; if (!d || d.kind !== 'contracheque') return 9;
  var pr = ((d.dados && d.dados.provas) || []).join(' ');
  if (d.dados.selo === 'verde') return 0;
  return /corrigi|não consegui ler|usei|difere|não achei os totais|não consegui separar/.test(pr) ? 2 : 1;
}
function dcmRefinar(T, buf, melhor){
  if (dcmNotaContra(melhor) === 0 || dcmNotaContra(melhor) === 9) return Promise.resolve(melhor);
  var variantes = [{ alvo: 3200, contraste: 1.2 }, { alvo: 1800, contraste: 2.2 }, { alvo: 2800, contraste: 1.0 }];
  function prox(i){
    if (i >= variantes.length || dcmNotaContra(melhor) === 0) return Promise.resolve(melhor);
    impEstado.info = 'Conferindo a leitura do contracheque de novo (' + (i + 1) + ' de ' + variantes.length + ')…'; renderExtratos();
    return dcmPreparar(buf, variantes[i]).then(function(b){ return dcmOcrRodar(T, b, '6'); }).then(function(t){
      var d = dcmDeTexto(t), c = { texto: t, d: d }; if (dcmNotaContra(c) < dcmNotaContra(melhor)) melhor = c; return prox(i + 1);
    }).catch(function(){ return prox(i + 1); });
  }
  return prox(0);
}
function dcmLerImagem(nome, buf){
  var teste = window.__dcmOcrTeste;   /* os testes entram aqui com um texto pronto */
  var obter = teste ? Promise.resolve(teste(nome)).then(function(t){ return { texto: t, d: dcmDeTexto(t) }; }) : dcmOcrCarregar().then(function(T){
    impEstado.info = 'Lendo a foto (na primeira vez baixa o motor de leitura, alguns MB; pode levar um pouco)…'; renderExtratos();
    return dcmPreparar(buf).then(function(blob){
      /* 1ª leitura em modo de tabela (extrato, contracheque); se não reconhecer, 2ª em modo automático (comprovantes de app) */
      return dcmOcrRodar(T, blob, '6').then(function(t1){ var d1 = dcmDeTexto(t1); if (d1) return dcmRefinar(T, buf, { texto: t1, d: d1 }); return dcmOcrRodar(T, blob, '3').then(function(t2){ return { texto: t2, d: dcmDeTexto(t2) }; }); });
    });
  });
  return obter.then(function(r){
    var d = r.d;
    if (window.__dcmDebug) console.log('DCM-OCR\n' + r.texto);
    if (!d){
      var pareceContra = typeof LeitorGeral !== 'undefined' && /PROVENTOS|RENDIMENTOS|CONTRA ?CHEQUE|SERVIDOR/.test(LeitorGeral.norm(r.texto || ''));
      throw new Error(pareceContra ? 'Parece um contracheque, mas a foto não ficou nítida o bastante para eu conferir os valores. Envie o PDF do contracheque (do portal) ou uma foto ou print maior, reta e sem reflexo.' : 'Li a foto, mas não reconheci como extrato, boleto, comprovante ou contracheque. Tente uma foto mais nítida e reta, ou envie o PDF.');
    }
    d.dados.viaFoto = true; if (d.dados.selo === 'verde') d.dados.selo = 'amarelo'; (d.dados.provas = d.dados.provas || []).push('lido de foto: confira os valores');
    return { doc: d, sig: EX.fnv('img|' + String(r.texto).replace(/\s+/g, ' ').slice(0, 2000)) };
  });
}

/* PDF que é só imagem (escaneado, "imprimir em PDF" de um print) ou cujo texto de OCR veio bagunçado: desenha cada página e lê como uma foto (OCR no aparelho) */
function dcmPdfPaginasPng(buf, senha, max){
  return extCarregarPdfJs().then(function(pdfjs){
    return pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)), password: senha || undefined }).promise.then(function(doc){
      var n = Math.min(doc.numPages, max || 3), out = [];
      function pagina(i){
        if (i > n) return Promise.resolve(out);
        return doc.getPage(i).then(function(pg){
          var v1 = pg.getViewport({ scale: 1 }), sc = Math.max(1.5, Math.min(4, 2400 / v1.width)); if (v1.height * sc > 5000) sc = 5000 / v1.height;
          var v = pg.getViewport({ scale: sc }), c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
          return pg.render({ canvasContext: x, viewport: v }).promise.then(function(){
            return new Promise(function(res){ c.toBlob(function(b){ res(b); }, 'image/png'); });
          }).then(function(b){ return b ? b.arrayBuffer() : null; }).then(function(ab){ if (ab) out.push(ab); return pagina(i + 1); });
        });
      }
      return pagina(1);
    });
  });
}
function dcmLerPdfComoImagem(nome, buf, senha){
  impEstado.info = 'Este PDF não tem texto que eu consiga ler direto; lendo como imagem (pode levar um pouco)…'; renderExtratos();
  return dcmPdfPaginasPng(buf, senha, 3).then(function(pgs){
    var i = 0;
    function prox(){
      if (i >= pgs.length) return Promise.resolve(null);
      var k = ++i;
      return dcmLerImagem(nome + ' (pág. ' + k + ')', pgs[k - 1]).catch(function(){ return null; }).then(function(r){ return r || prox(); });
    }
    return prox();
  }).catch(function(){ return null; });
}
/* contracheque em PDF: tenta o texto do PDF; se não fechar com os totais, o texto com linhas agrupadas pela altura da letra; por fim a página como imagem (OCR). Fica a melhor leitura */
function dcmLerPdfContracheque(nome, buf, senha, L, abrir){
  var melhor = null, sig = EX.fnv(L.join('\n'));
  function considerar(d, s){ if (!d || d.kind !== 'contracheque') return; var c = { d: d, sig: s || sig }; if (!melhor || dcmNotaContra(c) < dcmNotaContra(melhor)) melhor = c; }
  function fim(){ return melhor && dcmNotaContra(melhor) === 0; }
  function resultado(){ if (melhor) return { doc: melhor.d, sig: melhor.sig }; throw new Error(dcmErroPdf(L)); }
  considerar(dcmDeLinhas(L, L.itens));
  if (fim()) return Promise.resolve(resultado());
  return abrir(senha, true).then(function(L2){
    considerar(dcmDeLinhas(L2, L2.itens));
    if (fim()) return resultado();
    return dcmLerPdfComoImagem(nome, buf, senha).then(function(x){ if (x) considerar(x.doc, x.sig); return resultado(); });
  });
}
function dcmErroPdf(L){
  var n = (L || []).length, parece = typeof LeitorGeral !== 'undefined' && /PROVENTOS|RENDIMENTOS|CONTRA ?CHEQUE/.test(LeitorGeral.norm((L || []).join('\n')));
  return parece ? 'Parece um contracheque, mas não consegui conferir os valores (li ' + n + ' linhas do PDF e também tentei lê-lo como imagem). Envie o PDF original do portal, ou uma foto ou print maior, reto e sem reflexo.'
    : 'Não consegui ler este PDF como extrato, boleto, comprovante ou contracheque (li ' + n + ' linhas de texto, sem as colunas esperadas, e também tentei lê-lo como imagem). Se puder, envie o OFX do banco ou uma foto ou print do documento.';
}

/* ---------- a tela: cartões "Para conferir" ---------- */
function dcmColunaDe(d){ return ppFamiliar() ? 'pf' : (dcmS.col[d.id] || 'pf'); }
function dcmSeloChip(d){
  var s = (d.dados && d.dados.selo) || 'amarelo', provas = ((d.dados && d.dados.provas) || []).join('; ');
  var txt = s === 'verde' ? 'lido sem modelo · confere' : (s === 'vermelho' ? 'lido sem modelo · confira tudo' : 'lido sem modelo · confira');
  return '<span class="ext-chip ' + (s === 'verde' ? 'ok' : 'bad') + '" title="' + escapeHtml(provas) + '">' + txt + '</span>' + (provas ? '<div class="saldo-data">' + escapeHtml(provas) + '</div>' : '');
}
function dcmCampo(id, k, rot, tipo, val, extra){ return '<div class="field" style="margin:6px 0"><label class="field-label">' + rot + '</label><input type="' + tipo + '" id="dcm_' + id + '_' + k + '" value="' + escapeHtml(val == null ? '' : String(val)) + '" ' + (extra || '') + '></div>'; }
function dcmColunaHtml(d){ return ppFamiliar() ? '' : '<div class="field" style="margin:6px 0"><label class="field-label">Conta</label>' + extSelectHtml('data-dcm-col="' + escapeHtml(d.id) + '"', [['pf', 'Pessoa física'], ['pj', ppNomePj()]], dcmColunaDe(d)) + '</div>'; }
function dcmCardBoleto(d){
  var x = d.dados, id = d.id, nomeSug = x.beneficiario || (x.bancoNome ? 'Boleto ' + x.bancoNome : 'Boleto'), cat = dcmCatDe(x.beneficiario || '');
  var valorTxt = x.valor != null ? (x.valor / 100).toFixed(2) : '';
  return '<div class="ini-card ext-card" data-dcm-card="' + escapeHtml(id) + '"><div class="ext-card-top"><b>Boleto' + (x.beneficiario ? ' · ' + escapeHtml(x.beneficiario) : '') + '</b><span class="saldo-data">' + escapeHtml(x.bancoNome || '') + '</span></div>' +
    dcmCampo(id, 'nome', 'Nome da despesa', 'text', nomeSug, 'maxlength="80"') + dcmCampo(id, 'valor', 'Valor (R$)' + (x.valor == null ? ' — informe' : ''), 'number', valorTxt, 'min="0" step="0.01" inputmode="decimal"') +
    dcmCampo(id, 'data', 'Vencimento' + (x.vencimento ? '' : ' — informe'), 'date', x.vencimento || '') + dcmColunaHtml(d) +
    '<div class="saldo-data">Categoria sugerida: <b>' + escapeHtml(cat) + '</b> · ' + escapeHtml(x.linhaFmt || '') + '</div>' + dcmSeloChip(d) +
    '<div class="ext-acoes"><button type="button" class="btn btn-primary" data-dcm="pagar" data-id="' + escapeHtml(id) + '">Lançar como a pagar</button><button type="button" class="btn btn-ghost" data-dcm="pago" data-id="' + escapeHtml(id) + '">Já está pago</button><button type="button" class="btn-text" data-dcm="ignorar" data-id="' + escapeHtml(id) + '">Ignorar</button></div></div>';
}
function dcmCardPix(d){
  var x = d.dados, id = d.id, valorTxt = x.valor != null ? (x.valor / 100).toFixed(2) : '';
  return '<div class="ini-card ext-card" data-dcm-card="' + escapeHtml(id) + '"><div class="ext-card-top"><b>Pix copia e cola' + (x.nome ? ' · ' + escapeHtml(x.nome) : '') + '</b><span class="saldo-data">' + escapeHtml(x.cidade || '') + '</span></div>' +
    dcmCampo(id, 'nome', 'Nome da despesa', 'text', x.nome || 'Pix', 'maxlength="80"') + dcmCampo(id, 'valor', 'Valor (R$)' + (x.valor == null ? ' — informe' : ''), 'number', valorTxt, 'min="0" step="0.01" inputmode="decimal"') +
    dcmCampo(id, 'data', 'Pagar até', 'date', todayISO()) + dcmColunaHtml(d) + '<div class="saldo-data">Chave: ' + escapeHtml(x.chave || (x.dinamico ? 'cobrança dinâmica' : '')) + '</div>' + dcmSeloChip(d) +
    '<div class="ext-acoes"><button type="button" class="btn btn-primary" data-dcm="pagar" data-id="' + escapeHtml(id) + '">Lançar como a pagar</button><button type="button" class="btn btn-ghost" data-dcm="pago" data-id="' + escapeHtml(id) + '">Já está pago</button><button type="button" class="btn-text" data-dcm="ignorar" data-id="' + escapeHtml(id) + '">Ignorar</button></div></div>';
}
/* despesas em aberto que combinam com o comprovante (mesmo valor e/ou nome parecido), da melhor para a pior */
function dcmCandidatas(d){
  var x = d.dados; if (x.valor == null || !x.data || x.sentido === 'entrada') return [];
  var v = { v: -x.valor, d: x.data, l: { n: x.nome || '', s: x.descricao || '' }, coluna: dcmColunaDe(d) };
  try{ return extCandidatasDespesa(v).filter(function(c){ return c.igual || c.ov >= 1; }); }catch(e){ return []; }
}
function dcmCardComprovante(d){
  var x = d.dados, id = d.id, ent = x.sentido === 'entrada', cands = dcmCandidatas(d), i = (dcmS.cand[id] || 0) % Math.max(1, cands.length), c = cands[i] || null;
  var quem = ent ? (x.origem && x.origem.nome) : (x.destino && x.destino.nome), inst = ent ? (x.origem && x.origem.inst) : (x.destino && x.destino.inst);
  var linhas = '<div class="plan-linha"><span>Valor</span><strong>' + (x.valor != null ? dcmDinheiro(x.valor) : '—') + '</strong></div>' +
    '<div class="plan-linha"><span>Data</span><strong>' + (x.data ? escapeHtml(fmtData(x.data)) + (x.hora ? ' ' + escapeHtml(x.hora) : '') : '—') + '</strong></div>' +
    '<div class="plan-linha"><span>' + (ent ? 'De' : 'Para') + '</span><strong>' + escapeHtml(quem || '—') + '</strong></div>' + (inst ? '<div class="saldo-data">' + escapeHtml(inst) + '</div>' : '') +
    (x.e2e ? '<div class="saldo-data">ID: ' + escapeHtml(x.e2e) + '</div>' : (x.auth ? '<div class="saldo-data">Autenticação: ' + escapeHtml(x.auth) + '</div>' : ''));
  var acoes;
  if (ent) acoes = '<button type="button" class="btn btn-primary" data-dcm="receita" data-id="' + escapeHtml(id) + '">Lançar como receita</button>';
  else {
    var combina = c ? '<div class="note" style="margin:8px 0"><b>Combina com:</b> ' + escapeHtml(c.d.nome) + ' · ' + (c.igual ? 'mesmo valor' : 'nome parecido') + (c.d.diaVencimento ? ' · vence dia ' + c.d.diaVencimento : (c.d.data ? ' · ' + escapeHtml(fmtData(c.d.data)) : '')) + (cands.length > 1 ? ' <button type="button" class="btn-text" data-dcm="proxima" data-id="' + escapeHtml(id) + '">Não é essa</button>' : '') + '</div>' : '<div class="saldo-data">Nenhuma despesa em aberto combina: você pode lançar como despesa já paga.</div>';
    if (x.sentidoPresumido) combina += '<div class="saldo-data">Não está escrito se foi você quem pagou: presumi que sim (saída). Se foi você quem recebeu, ignore este documento.</div>';
    linhas += combina;
    acoes = (c ? '<button type="button" class="btn btn-primary" data-dcm="baixa" data-id="' + escapeHtml(id) + '">Dar baixa nesta</button>' : '') + '<button type="button" class="btn ' + (c ? 'btn-ghost' : 'btn-primary') + '" data-dcm="novaPaga" data-id="' + escapeHtml(id) + '">Lançar como despesa paga</button>';
  }
  return '<div class="ini-card ext-card" data-dcm-card="' + escapeHtml(id) + '"><div class="ext-card-top"><b>Comprovante · ' + escapeHtml(x.tipo || 'pagamento') + (ent ? ' recebido' : (x.sentido === 'saida' ? ' enviado' : '')) + '</b><span class="saldo-data">' + escapeHtml(d.titulo || '') + '</span></div>' + linhas + dcmColunaHtml(d) + dcmSeloChip(d) +
    '<div class="ext-acoes">' + acoes + '<button type="button" class="btn-text" data-dcm="ignorar" data-id="' + escapeHtml(id) + '">Ignorar</button></div></div>';
}
function dcmHtml(){
  var l = dcmPendentes(); if (!l.length) return '';
  return '<div class="financeiro-secao-head"><h4>Documentos para conferir (' + l.length + ')</h4></div>' + l.map(function(d){ return d.kind === 'boleto' ? dcmCardBoleto(d) : (d.kind === 'pix' ? dcmCardPix(d) : (d.kind === 'contracheque' ? ccqCardPendente(d) : dcmCardComprovante(d))); }).join('');
}
function dcmColarHtml(){
  return '<div class="field" style="margin-top:12px"><label class="field-label" for="dcmColar">Colar a linha digitável do boleto ou o Pix copia e cola</label><textarea id="dcmColar" rows="2" placeholder="00190.50095 40144.816069 …   ou   00020126…6304ABCD" style="width:100%">' + escapeHtml(dcmS.texto || '') + '</textarea></div><div class="ext-acoes"><button type="button" class="btn btn-ghost" data-dcm="colar">Ler o texto colado</button></div>';
}

/* ---------- ações ---------- */
function dcmLer(id, k){ var e = qs('dcm_' + id + '_' + k); return e ? e.value : ''; }
function dcmConcluir(d, extra){ return extGravar(d.id, Object.assign({}, d, { status: 'concluido', concluidoEm: new Date().toISOString() }, extra || {})); }
function dcmNovaDespesa(d, pago){
  var id = d.id, nome = dcmLer(id, 'nome').trim(), valor = parseFloat(dcmLer(id, 'valor')) || 0, data = dcmLer(id, 'data') || todayISO(), x = d.dados;
  if (!nome){ toast('Informe o nome da despesa.'); return Promise.resolve(); }
  if (!(valor > 0)){ toast('Informe o valor.'); return Promise.resolve(); }
  var hoje = todayISO();
  return Promise.resolve(persistNovaDespesa({ nome: nome, coluna: dcmColunaDe(d), tipo: 'unica', categoria: dcmCatId(dcmCatDe(x.beneficiario || x.nome || nome)), valor: valor, data: data, mesReferencia: data.slice(0, 7), pago: !!pago, dataPagamento: pago ? hoje : null, pagoEm: pago ? new Date().toISOString() : null, parciais: [], valorPadrao: null, diaVencimento: null, ativa: true, pausadaAPartirDeMes: null, pagamentos: {}, observacoes: x.linhaFmt ? 'Boleto ' + x.linhaFmt : (x.chave ? 'Pix ' + x.chave : ''), origemDocumento: true }))
    .then(function(){ return dcmConcluir(d); }).then(function(){ toast(pago ? 'Despesa lançada como paga.' : 'Despesa lançada para pagar em ' + fmtData(data) + '.'); renderExtratos(); try{ renderFinanceiro(); }catch(e){} });
}
function dcmAcao(a, id){
  var d = extDocPorId(id); if (!d) return;
  if (a === 'ignorar') return dcmConcluir(d, { status: 'ignorado' }).then(function(){ renderExtratos(); });
  if (a === 'proxima'){ dcmS.cand[id] = (dcmS.cand[id] || 0) + 1; return renderExtratos(); }
  if (a === 'pagar') return dcmNovaDespesa(d, false);
  if (a === 'pago') return dcmNovaDespesa(d, true);
  var x = d.dados, cands = dcmCandidatas(d), c = cands.length ? cands[(dcmS.cand[id] || 0) % cands.length] : null;
  if (a === 'baixa'){
    if (!c){ toast('Não há despesa para dar baixa.'); return; }
    var mes = String(x.data).slice(0, 7);
    return extPagarDespesa(c.d, mes, r2(x.valor / 100), x.data).then(function(){ return dcmConcluir(d, { baixaEm: c.d.id }); }).then(function(){ toast('Baixa dada em "' + c.d.nome + '".'); renderExtratos(); try{ renderFinanceiro(); }catch(e){} });
  }
  if (a === 'novaPaga'){
    var nome = x.nome || (x.destino && x.destino.nome) || 'Pagamento';
    return Promise.resolve(persistNovaDespesa({ nome: nome, coluna: dcmColunaDe(d), tipo: 'unica', categoria: dcmCatId(dcmCatDe(nome)), valor: r2(x.valor / 100), data: x.data, mesReferencia: x.data.slice(0, 7), pago: true, dataPagamento: x.data, pagoEm: new Date().toISOString(), parciais: [], valorPadrao: null, diaVencimento: null, ativa: true, pausadaAPartirDeMes: null, pagamentos: {}, observacoes: x.e2e ? 'Pix ' + x.e2e : (x.auth ? 'Autenticação ' + x.auth : ''), origemDocumento: true }))
      .then(function(){ return dcmConcluir(d); }).then(function(){ toast('Despesa lançada como paga.'); renderExtratos(); try{ renderFinanceiro(); }catch(e){} });
  }
  if (a === 'receita'){
    return Promise.resolve(persistNovaReceita({ coluna: dcmColunaDe(d), descricao: x.nome || (x.origem && x.origem.nome) || 'Pix recebido', recorrente: false, valor: r2(x.valor / 100), data: x.data, mesReferencia: x.data.slice(0, 7), origemDocumento: true }))
      .then(function(){ return dcmConcluir(d); }).then(function(){ toast('Receita lançada.'); renderExtratos(); try{ renderFinanceiro(); }catch(e){} });
  }
}
document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('[data-dcm]') : null; if (!b) return;
  var a = b.getAttribute('data-dcm'), id = b.getAttribute('data-id');
  if (a === 'colar'){ var t = qs('dcmColar'); dcmS.texto = ''; return dcmColar(t ? t.value : ''); }
  dcmAcao(a, id);
});
document.addEventListener('input', function(ev){ if (ev.target && ev.target.id === 'dcmColar') dcmS.texto = ev.target.value; });
document.addEventListener('change', function(ev){ var t = ev.target; if (t && t.getAttribute && t.getAttribute('data-dcm-col')){ dcmS.col[t.getAttribute('data-dcm-col')] = t.value; renderExtratos(); } });
(function(){
  if (typeof renderExtratos === 'function'){
    var oRender = renderExtratos;
    renderExtratos = function(){
      var r = oRender.apply(this, arguments);
      try{
        if (activeTab !== 'extratos' || !dcmPode()) return r;
        var el = qs('extPend'); if (!el) return r;
        var h = dcmHtml();
        if (h){ el.innerHTML = (/Nada para conferir agora/.test(el.innerHTML) ? '' : el.innerHTML) + h; }
      }catch(e){ console.error('documentos', e); }
      return r;
    };
  }
  if (typeof impTopoHtml === 'function'){
    var oTopo = impTopoHtml;
    impTopoHtml = function(){ var h = oTopo.apply(this, arguments); return dcmPode() ? h + dcmColarHtml() : h; };
  }
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { dcmDeTexto: dcmDeTexto, dcmPendentes: dcmPendentes });
})();
