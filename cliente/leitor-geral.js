/* ============================================================
   LEITOR GERAL DE DOCUMENTOS (objeto LeitorGeral) — lê extrato, boleto e comprovante SEM modelo por banco, para todos os perfis.
   Funções puras (sem tela): recebem texto/linhas e devolvem dados + prova. O que é padrão oficial lê-se por regra e se confere:
     - boleto: linha digitável (47 cobrança / 48 arrecadação) com os dígitos verificadores (módulo 10 e 11) e o fator de vencimento;
     - Pix "copia e cola" / QR (BR Code, padrão EMV do Banco Central) com o CRC16;
     - ID da transação do Pix (E2E): E + ISPB + data e hora + sequência;
     - CPF e CNPJ (dígitos verificadores).
   O que não é padrão (extrato em PDF, comprovante) lê-se pela estrutura comum e se prova pelas contas: ver as seções B e C abaixo.
   Nada daqui grava ou envia: a leitura é no aparelho. Este arquivo também roda no Node (testes): module.exports no fim.
   ============================================================ */
var LeitorGeral = (function(){
  var onlyDig = function(s){ return String(s == null ? '' : s).replace(/\D/g, ''); };
  var pad = function(n, t){ return String(n).padStart(t, '0'); };

  /* ---------- bancos (códigos de compensação do Banco Central) ---------- */
  var BANCOS = { '001': 'Banco do Brasil', '003': 'Banco da Amazônia', '004': 'Banco do Nordeste', '033': 'Santander', '041': 'Banrisul', '070': 'BRB', '077': 'Banco Inter', '085': 'Ailos', '099': 'Uniprime', '104': 'Caixa', '121': 'Agibank', '136': 'Unicred', '197': 'Stone', '208': 'BTG Pactual', '212': 'Banco Original', '218': 'BS2', '237': 'Bradesco', '260': 'Nubank', '290': 'PagBank', '318': 'BMG', '323': 'Mercado Pago', '336': 'C6 Bank', '341': 'Itaú', '380': 'PicPay', '389': 'Mercantil do Brasil', '403': 'Cora', '422': 'Safra', '623': 'Banco Pan', '633': 'Rendimento', '637': 'Sofisa', '655': 'Votorantim', '735': 'Neon', '745': 'Citibank', '748': 'Sicredi', '756': 'Sicoob' };
  function bancoPorCodigo(cod){ var c = pad(onlyDig(cod).replace(/^0+(?=\d{3})/, '').slice(-3), 3); return BANCOS[c] || ''; }
  /* nome que aparece no texto do documento -> código (para extrato e comprovante) */
  var BANCOS_TXT = [[/nu\s*pagamentos|nubank|\bnu\b\s*(?:cpf|ag)|\bnu\s*bank/i, '260'], [/caixa\s+econ[ôo]mica|caixa\.gov\.br|internet\s*banking[^\n]{0,30}caixa|\bCAIXA\b/i, '104'], [/ita[úu]/i, '341'], [/sicoob|sisbr/i, '756'], [/c6\s*bank/i, '336'], [/banco\s+do\s+brasil|\bBB\b\s+(?:conta|ag)/i, '001'], [/bradesco/i, '237'], [/santander/i, '033'], [/banco\s+inter\b|\binter\s+(?:conta|extrato)/i, '077'], [/sicredi/i, '748'], [/mercado\s*pago/i, '323'], [/pagbank|pagseguro/i, '290'], [/picpay/i, '380'], [/neon/i, '735'], [/original/i, '212'], [/safra/i, '422'], [/banrisul/i, '041'], [/\bbrb\b/i, '070'], [/stone/i, '197'], [/btg\s*pactual/i, '208']];
  function bancoPorTexto(t){ for (var i = 0; i < BANCOS_TXT.length; i++) if (BANCOS_TXT[i][0].test(t)) return BANCOS_TXT[i][1]; return ''; }

  /* ---------- dígitos verificadores ---------- */
  function mod10(s){ var soma = 0, peso = 2; for (var i = s.length - 1; i >= 0; i--){ var p = (+s[i]) * peso; soma += p > 9 ? p - 9 : p; peso = peso === 2 ? 1 : 2; } return (10 - soma % 10) % 10; }
  function mod11(s){ var soma = 0, peso = 2; for (var i = s.length - 1; i >= 0; i--){ soma += (+s[i]) * peso; peso = peso === 9 ? 2 : peso + 1; } var r = soma % 11, dv = 11 - r; return dv >= 10 ? 0 : dv; }
  /* o dígito geral do boleto de cobrança: resto 0, 10 ou 11 vira 1 */
  function mod11Cobranca(s){ var soma = 0, peso = 2; for (var i = s.length - 1; i >= 0; i--){ soma += (+s[i]) * peso; peso = peso === 9 ? 2 : peso + 1; } var dv = 11 - soma % 11; return (dv === 0 || dv === 10 || dv === 11) ? 1 : dv; }

  /* ---------- fator de vencimento ---------- */
  function addDias(iso, n){ var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function difDias(a, b){ return Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000); }
  /* Duas contagens possíveis: a antiga (dias desde 07/10/1997) e a nova, que recomeçou em 1000 no dia 22/02/2025 (ciclo de 9000 dias).
     Escolhe a data que cai numa janela razoável em torno de hoje (de 3 anos atrás a 2 anos à frente); se as duas cabem ou nenhuma, a mais próxima de hoje. */
  function vencimentoDoFator(fator, hoje){
    fator = +fator; if (!fator) return { data: null, semVencimento: true, alternativa: null };
    hoje = hoje || new Date().toISOString().slice(0, 10);
    var velha = fator >= 1000 ? addDias('1997-10-07', fator) : null, nova = fator >= 1000 ? addDias('2025-02-22', fator - 1000) : null;
    if (!velha) return { data: null, semVencimento: false, alternativa: null };
    var dentro = function(d){ var x = difDias(d, hoje); return x >= -3 * 366 && x <= 2 * 366; };
    var escolhida;
    if (dentro(velha) && !dentro(nova)) escolhida = velha; else if (dentro(nova) && !dentro(velha)) escolhida = nova;
    else escolhida = Math.abs(difDias(velha, hoje)) <= Math.abs(difDias(nova, hoje)) ? velha : nova;
    return { data: escolhida, semVencimento: false, alternativa: escolhida === velha ? nova : velha };
  }

  /* ---------- boleto: linha digitável / código de barras ---------- */
  function limparLinha(txt){ return onlyDig(txt); }
  /* devolve { tipo, linha, barras, banco, bancoNome, moeda, valor (centavos), vencimento, validos, ok, erros } ou null se não parece boleto */
  function lerLinhaDigitavel(txt, hoje){
    var d = limparLinha(txt), erros = [];
    if (d.length === 44){ return lerBarras(d, hoje, 'barras'); }
    if (d.length === 47){
      var campos = [d.slice(0, 9), d.slice(10, 20), d.slice(21, 31)], dvs = [d[9], d[20], d[31]], camposOk = campos.map(function(c, i){ return mod10(c) === +dvs[i]; });
      var barras = d.slice(0, 4) + d[32] + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
      var r = lerBarras(barras, hoje, 'cobranca');
      r.linha = d; r.validos.campos = camposOk; r.ok = r.ok && camposOk.every(Boolean);
      if (!camposOk.every(Boolean)) r.erros.push('dígito verificador de campo da linha digitável não confere');
      return r;
    }
    if (d.length === 48 && d[0] === '8'){
      var blocos = [d.slice(0, 12), d.slice(12, 24), d.slice(24, 36), d.slice(36, 48)], ident = d[2], usaMod11 = ident === '8' || ident === '9';
      var blocosOk = blocos.map(function(b){ var corpo = b.slice(0, 11), dv = +b[11]; return (usaMod11 ? mod11(corpo) : mod10(corpo)) === dv; });
      var bar = blocos.map(function(b){ return b.slice(0, 11); }).join('');
      var dvGeral = usaMod11 ? mod11(bar.slice(0, 3) + bar.slice(4)) : mod10(bar.slice(0, 3) + bar.slice(4));
      var geralOk = dvGeral === +bar[3], valorEfetivo = ident === '6' || ident === '8';
      return { tipo: 'arrecadacao', linha: d, barras: bar, banco: '', bancoNome: '', moeda: '9', valor: valorEfetivo ? parseInt(bar.slice(4, 15), 10) : null, valorReferencia: !valorEfetivo, vencimento: null, vencimentoAlternativo: null, semVencimento: false, segmento: d[1], validos: { campos: blocosOk, geral: geralOk }, ok: blocosOk.every(Boolean) && geralOk, erros: blocosOk.every(Boolean) && geralOk ? [] : ['dígito verificador não confere'] };
    }
    return null;
  }
  function lerBarras(b, hoje, tipo){
    var geralOk = mod11Cobranca(b.slice(0, 4) + b.slice(5)) === +b[4], v = vencimentoDoFator(b.slice(5, 9), hoje), cod = b.slice(0, 3);
    return { tipo: tipo === 'barras' ? 'cobranca' : tipo, linha: tipo === 'barras' ? '' : '', barras: b, banco: cod, bancoNome: bancoPorCodigo(cod), moeda: b[3], valor: parseInt(b.slice(9, 19), 10), vencimento: v.data, vencimentoAlternativo: v.alternativa, semVencimento: v.semVencimento, validos: { campos: [], geral: geralOk }, ok: geralOk, erros: geralOk ? [] : ['dígito verificador geral não confere'] };
  }
  /* procura, num texto qualquer, sequências que parecem linha digitável (com pontos e espaços) ou código de barras, e devolve as que passam nos dígitos */
  function acharBoletos(texto, hoje){
    var out = [], vistos = {}, re = /(?:\d[\d.\s-]{40,60}\d)/g, m;
    while ((m = re.exec(String(texto || '')))){
      var cands = [m[0]]; var linhas = m[0].split(/\n/); if (linhas.length > 1) cands = cands.concat(linhas);
      cands.forEach(function(c){
        var d = onlyDig(c); if ([44, 47, 48].indexOf(d.length) < 0 || vistos[d]) return;
        var r = lerLinhaDigitavel(d, hoje); if (r && r.ok){ vistos[d] = 1; r.linhaOriginal = c.trim(); out.push(r); }
      });
    }
    return out;
  }
  function fmtLinha(r){ var d = r.linha || ''; if (d.length === 47) return d.slice(0, 5) + '.' + d.slice(5, 10) + ' ' + d.slice(10, 15) + '.' + d.slice(15, 21) + ' ' + d.slice(21, 26) + '.' + d.slice(26, 32) + ' ' + d[32] + ' ' + d.slice(33); if (d.length === 48) return d.replace(/(\d{12})(?=\d)/g, '$1 '); return d; }

  /* ---------- Pix copia e cola / QR (BR Code, EMV) ---------- */
  function crc16(s){ var crc = 0xFFFF; for (var i = 0; i < s.length; i++){ crc ^= s.charCodeAt(i) << 8; for (var k = 0; k < 8; k++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF; } return pad(crc.toString(16).toUpperCase(), 4); }
  function tlv(s){ var out = {}, i = 0; while (i + 4 <= s.length){ var id = s.slice(i, i + 2), n = parseInt(s.slice(i + 2, i + 4), 10); if (!(n >= 0) || i + 4 + n > s.length) return null; out[id] = s.slice(i + 4, i + 4 + n); i += 4 + n; } return i === s.length ? out : null; }
  function lerBRCode(txt){
    var s = String(txt || '').replace(/[\r\n]+/g, '').trim(); var ini = s.indexOf('000201'); if (ini < 0) return null; s = s.slice(ini);   /* espaços dentro do nome contam no tamanho: só tira quebras de linha */
    var f = tlv(s); if (!f || !f['63'] || f['63'].length !== 4) return null;
    var pos = s.lastIndexOf('6304'), crcCalc = crc16(s.slice(0, pos + 4)), crcOk = crcCalc === f['63'].toUpperCase();
    var conta = null; for (var k = 26; k <= 51; k++){ var id = pad(k, 2); if (f[id]){ var t = tlv(f[id]); if (t && /br\.gov\.bcb\.pix/i.test(t['00'] || '')){ conta = t; break; } } }
    var adic = f['62'] ? tlv(f['62']) : null;
    return { ok: crcOk && !!conta, crcOk: crcOk, pix: !!conta, dinamico: !!(conta && conta['25']), chave: conta ? (conta['01'] || '') : '', url: conta ? (conta['25'] || '') : '', descricao: conta ? (conta['02'] || '') : '', valor: f['54'] ? Math.round(parseFloat(f['54']) * 100) : null, nome: f['59'] || '', cidade: f['60'] || '', txid: adic ? (adic['05'] || '') : '', moeda: f['53'] || '', bruto: s };
  }
  function acharBRCode(texto){ var m = /000201[\s\S]{20,}?6304[0-9A-Fa-f]{4}/.exec(String(texto || '').replace(/\r?\n/g, '')); return m ? lerBRCode(m[0]) : null; }

  /* ---------- ID da transação do Pix (E2E): E + ISPB (8) + data e hora (12) + sequência (11) ---------- */
  function lerE2E(s){
    var t = String(s || '').trim(), m = /^([ED])(\d{8})(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})([A-Za-z0-9]{11})$/.exec(t); if (!m) return null;
    var mes = +m[4], dia = +m[5], h = +m[6], mi = +m[7], ok = mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 && h < 24 && mi < 60 && +m[3] >= 2020;
    return { id: t, tipo: m[1] === 'E' ? 'pagamento' : 'devolução', ispb: m[2], data: ok ? m[3] + '-' + m[4] + '-' + m[5] : null, hora: ok ? m[6] + ':' + m[7] : null, sequencia: m[8], dataOk: ok };
  }
  function acharE2E(texto){ var m = /\b[ED]\d{8}\d{12}[A-Za-z0-9]{11}\b/.exec(String(texto || '').replace(/[\s]+(?=[A-Za-z0-9]{3,})/g, function(x){ return x; })); if (m) return lerE2E(m[0]); var j = String(texto || '').replace(/\s+/g, ''), m2 = /[ED]\d{8}\d{12}[A-Za-z0-9]{11}/.exec(j); return m2 ? lerE2E(m2[0]) : null; }

  /* ---------- CPF e CNPJ ---------- */
  function cpfOk(s){ var d = onlyDig(s); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false; for (var t = 9; t < 11; t++){ var soma = 0; for (var i = 0; i < t; i++) soma += (+d[i]) * (t + 1 - i); var dv = (soma * 10) % 11 % 10; if (dv !== +d[t]) return false; } return true; }
  function cnpjOk(s){ var d = onlyDig(s); if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false; var pesos = [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]; for (var t = 0; t < 2; t++){ var soma = 0; for (var i = 0; i < 12 + t; i++) soma += (+d[i]) * pesos[t][i]; var r = soma % 11, dv = r < 2 ? 0 : 11 - r; if (dv !== +d[12 + t]) return false; } return true; }


  /* ============================================================
     B. EXTRATO EM PDF DE QUALQUER BANCO — sem modelo por banco
     Entrada: rows = linhas da página, cada uma com os pedaços de texto e a posição de cada um: [ [ {s, x, w}, ... ], ... ].
     Todo extrato tem data, histórico, valor (com sinal, com C/D, em colunas Crédito/Débito, ou por seção "Entradas/Saídas") e quase sempre o saldo.
     As colunas se acham pelo alinhamento dos números e o que não é padrão é PROVADO pelas contas: saldo anterior + lançamentos = saldo;
     saldo inicial + entradas − saídas = saldo final; total do dia = soma do dia. Não fechou → selo amarelo (o app avisa, não lança calado).
     ============================================================ */
  function norm(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  var MES3 = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
  var MESL = { JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12 };
  var NUMRE = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2}';
  var RE_VAL = new RegExp('^\\(?\\s*([+-])?\\s*(?:R\\$)?\\s*([+-])?\\s*(' + NUMRE + ')\\s*\\)?\\s*([+-])?\\s*([CD])?$', 'i');
  /* "1.234,56", "-1.234,56", "R$ -1.234,56", "(1.234,56)", "1.234,56-", "1.234,56 D", "1.234,56 C" -> { c: centavos (positivo), s: +1 | -1 | 0 (sem sinal) } */
  function lerValor(t){
    t = String(t || '').trim(); var m = RE_VAL.exec(t); if (!m) return null;
    var c = Math.round(parseFloat(m[3].replace(/\./g, '').replace(',', '.')) * 100), sin = 0, cd = m[5] ? m[5].toUpperCase() : '';
    if (m[1] === '-' || m[2] === '-' || m[4] === '-' || /^\(/.test(t) || cd === 'D') sin = -1; else if (m[1] === '+' || m[2] === '+' || m[4] === '+' || cd === 'C') sin = 1;
    return { c: c, s: sin };
  }
  function dataIso(a, m, d){ return (m >= 1 && m <= 12 && d >= 1 && d <= 31) ? a + '-' + pad(m, 2) + '-' + pad(d, 2) : null; }
  /* { iso } (completa), { dm: [dia, mês] } (sem ano) ou null */
  function lerData(t){
    t = String(t || '').trim(); var m, i;
    if ((m = /^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/.exec(t))) { i = dataIso(+m[3], +m[2], +m[1]); return i ? { iso: i } : null; }
    if ((m = /^(\d{2})[\/.-](\d{2})[\/.-](\d{2})$/.exec(t))) { i = dataIso(2000 + (+m[3]), +m[2], +m[1]); return i ? { iso: i } : null; }
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) { i = dataIso(+m[1], +m[2], +m[3]); return i ? { iso: i } : null; }
    if ((m = /^(\d{2})\/(\d{2})$/.exec(t))) return (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) ? { dm: [+m[1], +m[2]] } : null;
    if ((m = /^(\d{1,2})\s+(?:DE\s+)?([A-Za-z]{3,9})\.?(?:\s+(?:DE\s+)?(\d{4}))?$/i.exec(norm(t)))) {
      var nm = m[2], mes = MESL[nm] || (nm.length === 3 ? MES3[nm] : 0);
      if (mes) { if (m[3]) { i = dataIso(+m[3], mes, +m[1]); return i ? { iso: i } : null; } return { dm: [+m[1], mes] }; }
    }
    return null;
  }
  /* uma linha do PDF em células: pedaços vizinhos viram uma célula; depois separa a data no começo e os valores no fim da célula */
  function celulasDaLinha(row){
    var its = row.slice().sort(function(a, b){ return a.x - b.x; }), cs = [], cur = null;
    its.forEach(function(it){
      var t = String(it.s == null ? '' : it.s).replace(/\s+/g, ' ').trim(); if (!t) return;
      var w = it.w || 0, cw = (w && String(it.s).length) ? w / String(it.s).length : 5;
      if (cur && it.x - cur.x1 <= Math.max(7, cw * 1.6)) { cur.t += (it.x - cur.x1 > cw * 0.4 ? ' ' : '') + t; cur.x1 = it.x + w; }
      else { cur = { t: t, x0: it.x, x1: it.x + w }; cs.push(cur); }
    });
    var out = [], fimRe = new RegExp('\\s((?:[+-]\\s*)?(?:R\\$\\s*)?(?:[+-]\\s*)?' + NUMRE + '(?:\\s*[CD+-])?)\\s*$');
    cs.forEach(function(c){
      var rest = c.t, x0 = c.x0, m;
      if ((m = /^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(\S.*)$/.exec(rest)) && lerData(m[1])) { out.push({ t: m[1], x0: x0, x1: x0 + 40 }); rest = m[2]; x0 += 40; }
      var fim = [];
      while ((m = fimRe.exec(rest))) { fim.unshift(m[1]); rest = rest.slice(0, m.index); }
      if (rest.trim()) out.push({ t: rest.trim(), x0: x0, x1: fim.length ? x0 + rest.length * 5 : c.x1 });
      fim.forEach(function(v, i){ out.push({ t: v.trim(), x0: c.x1 - (fim.length - i) * 55, x1: c.x1 - (fim.length - 1 - i) * 55 }); });
    });
    out.forEach(function(c){ var v = lerValor(c.t), d = v ? null : lerData(c.t); if (v) { c.tipo = 'valor'; c.v = v; } else if (d) { c.tipo = 'data'; c.d = d; } else if (/^\d{4,}$/.test(c.t)) c.tipo = 'doc'; else c.tipo = 'texto'; });
    return out;
  }
  function agrupar(xs, tol){ var cl = []; xs.slice().sort(function(a, b){ return a - b; }).forEach(function(x){ var u = cl[cl.length - 1]; if (u && x - u.max <= tol) { u.n++; u.max = x; u.soma += x; } else cl.push({ n: 1, max: x, soma: x }); }); cl.forEach(function(c){ c.x = c.soma / c.n; }); return cl; }

  /* quem é: banco, agência, conta, titular; período, ano e data de emissão */
  function lerCabecalho(R){
    var cab = R.slice(0, 30).map(function(r){ return r.t; }).join('\n') + '\n' + R.slice(-4).map(function(r){ return r.t; }).join('\n'), m;
    var info = { banco: bancoPorTexto(cab), ag: '', cc: '', titular: { nome: '', doc: '' }, de: null, ate: null, anoRef: null, emitido: null };
    if ((m = /Conta:?\s*(\d{4})\s*\/\s*\d{3}\s*\/\s*([\d.-]+)/i.exec(cab))) { info.ag = m[1]; info.cc = m[2]; }
    else { if ((m = /Ag[êe]ncia:?\s*([\d.-]+)/i.exec(cab))) info.ag = m[1]; if ((m = /Conta(?:\s+corrente)?:?\s*(\d[\d.]*-?\d?)/i.exec(cab))) info.cc = m[1]; }
    if ((m = /(?:Cliente|Titular|Nome):\s*([A-Za-zÀ-ÿ' .]{4,60}?)(?:\s{2,}|\n|$)/.exec(cab))) info.titular.nome = m[1].trim();
    if ((m = /(?:CPF|CNPJ)[:\s]*(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i.exec(cab))) {
      info.titular.doc = m[1];
      if (!info.titular.nome) for (var i = 0; i < Math.min(R.length, 30); i++) if (R[i].t.indexOf(m[1]) >= 0) { for (var k = i - 1; k >= Math.max(0, i - 2); k--) if (/^[A-Za-zÀ-ÿ' .]{6,60}$/.test(R[k].t) && R[k].t.trim().split(/\s+/).length >= 2 && !/EXTRATO|SALDO|PERIODO|MOVIMENT/.test(R[k].n)) { info.titular.nome = R[k].t.trim(); break; } break; }
    }
    var N = norm(cab);
    if ((m = /(\d{2})\/(\d{2})\/(\d{4})\s*(?:A|ATE|-)\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(N))) { info.de = m[3] + '-' + m[2] + '-' + m[1]; info.ate = m[6] + '-' + m[5] + '-' + m[4]; }
    else if ((m = /(\d{1,2}) DE ([A-Z]+) DE (\d{4}) A (\d{1,2}) DE ([A-Z]+) DE (\d{4})/.exec(N)) && MESL[m[2]] && MESL[m[5]]) { info.de = dataIso(+m[3], MESL[m[2]], +m[1]); info.ate = dataIso(+m[6], MESL[m[5]], +m[4]); }
    else if ((m = /(\d{1,2}) ([A-Z]{3}) (\d{4}) A (\d{1,2}) ([A-Z]{3}) (\d{4})/.exec(N)) && MES3[m[2]] && MES3[m[5]]) { info.de = dataIso(+m[3], MES3[m[2]], +m[1]); info.ate = dataIso(+m[6], MES3[m[5]], +m[4]); }
    if (!info.de && (m = /(?:MES|PERIODO)[^\n]*?([A-Z]+)\/(\d{4})/.exec(N)) && MESL[m[1]]) info.anoRef = +m[2];
    if ((m = /(\d{2})\/(\d{2})\/(\d{4})\s*-?\s*(\d{2}:\d{2})/.exec(cab))) info.emitido = m[3] + '-' + m[2] + '-' + m[1] + 'T' + m[4] + ':00';
    else if ((m = /GERADO\s+(?:DIA\s+)?(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})(?:\s+AS\s+(\d{2}:\d{2}))?/.exec(N)) && MESL[m[2]]) info.emitido = dataIso(+m[3], MESL[m[2]], +m[1]) + 'T' + (m[4] || '00:00') + ':00';
    if (!info.anoRef) info.anoRef = info.ate ? +info.ate.slice(0, 4) : (info.de ? +info.de.slice(0, 4) : (info.emitido ? +info.emitido.slice(0, 4) : null));
    return info;
  }
  /* colunas de valor: borda direita dos números; o rótulo vem do cabeçalho (Crédito, Débito, Valor, Saldo) */
  function acharColunas(R){
    var comVal = R.filter(function(r){ return r.cs.some(function(c){ return c.tipo === 'valor'; }); });
    if (!comVal.length) return [];
    var cl = agrupar([].concat.apply([], comVal.map(function(r){ return r.cs.filter(function(c){ return c.tipo === 'valor'; }).map(function(c){ return c.x1; }); })), 14).filter(function(c){ return c.n >= Math.min(3, Math.max(2, Math.floor(comVal.length / 3))); });
    cl.sort(function(a, b){ return a.x - b.x; });
    var primeira = R.indexOf(comVal[0]), cab = R.slice(Math.max(0, primeira - 8), primeira + 1);
    cl.forEach(function(c){
      var melhor = null, dist = 9999;
      cab.forEach(function(r){ r.cs.forEach(function(h){ if (h.tipo !== 'texto') return; var cx = (h.x0 + h.x1) / 2, d = Math.min(Math.abs(cx - c.x), Math.abs(h.x1 - c.x)); if (d < dist && d < 70) { var n = norm(h.t), k = /CREDITO|ENTRADA/.test(n) ? 'credito' : (/DEBITO|SAIDA/.test(n) ? 'debito' : (/SALDO/.test(n) ? 'saldo' : (/VALOR/.test(n) ? 'valor' : null))); if (k) { dist = d; melhor = k; } } }); });
      c.k = melhor;
    });
    if (cl.length && cl.every(function(c){ return !c.k; })) { var ks = cl.length === 1 ? ['valor'] : (cl.length === 2 ? ['valor', 'saldo'] : (cl.length === 3 ? ['credito', 'debito', 'saldo'] : [])); cl.forEach(function(c, i){ c.k = ks[i] || 'valor'; }); }
    return cl;
  }
  function varrer(R, info, cols){
    var T = { lanc: [], ant: null, saldosDia: {}, resumo: {}, totDia: {}, avisos: [] }, dataAtual = null, ctx = 0, ult = null, viuData = false;
    var colDe = function(c){ var b = null, d = 9999; cols.forEach(function(k){ var x = Math.abs(k.x - c.x1); if (x < d && x < 30) { d = x; b = k; } }); return b; };
    var resolver = function(d){
      if (d.iso) return d.iso; if (!info.anoRef) return null; var a = info.anoRef;
      if (info.de && info.ate && info.de.slice(0, 4) !== info.ate.slice(0, 4)) a = d.dm[1] >= +info.de.slice(5, 7) ? +info.de.slice(0, 4) : +info.ate.slice(0, 4);
      return dataIso(a, d.dm[1], d.dm[0]);
    };
    R.forEach(function(r){
      var dc = r.cs.filter(function(c){ return c.tipo === 'data'; })[0], vals = r.cs.filter(function(c){ return c.tipo === 'valor'; }), tx = r.cs.filter(function(c){ return c.tipo === 'texto'; });
      var N = norm(tx.map(function(c){ return c.t; }).join(' ')), ultimoVal = vals.length ? vals[vals.length - 1].v : null;
      if (dc) { var di = resolver(dc.d); if (di) { dataAtual = di; viuData = true; } }
      var ent = /TOTAL (DE )?(ENTRADAS|CREDITOS)|ENTRADAS NO (DIA|MES)/.test(N), sai = /TOTAL (DE )?(SAIDAS|DEBITOS)|SAIDAS NO (DIA|MES)/.test(N);
      if (ent || sai) {   /* subtotal: no resumo do topo ou no começo de cada dia (e passa a valer o sinal da seção) */
        if (viuData) { ctx = ent ? 1 : -1; if (ultimoVal && dataAtual) { T.totDia[dataAtual] = T.totDia[dataAtual] || {}; T.totDia[dataAtual][ent ? 'e' : 's'] = ultimoVal.c; } }
        else if (ultimoVal) T.resumo[ent ? 'entradas' : 'saidas'] = ultimoVal.c;
        return;
      }
      if (/^SALDO\b|^\(=\) SALDO|\bSALDO (ANTERIOR|INICIAL|DO DIA|FINAL|EM|DISPONIVEL|ATUAL|TOTAL)\b/.test(N) && ultimoVal) {
        var sv = (ultimoVal.s || 1) * ultimoVal.c;
        if (/ANTERIOR|INICIAL/.test(N)) { if (!T.ant) T.ant = { data: dataAtual, valor: sv }; T.resumo.saldoInicial = T.resumo.saldoInicial == null ? sv : T.resumo.saldoInicial; }
        else if (/FINAL/.test(N)) T.resumo.saldoFinal = sv;
        else if (/DO DIA|\bEM\b/.test(N) && dataAtual) T.saldosDia[dataAtual] = sv;
        else if (T.resumo.saldoFinal == null) T.resumo.saldoFinal = sv;
        return;
      }
      if (/RENDIMENTO/.test(N) && ultimoVal && !viuData) { T.resumo.rendimento = (ultimoVal.s || 1) * ultimoVal.c; return; }
      if (!vals.length) {   /* sem valor: segunda linha da descrição do lançamento de cima */
        if (ult && tx.length && !dc && r.cs[0].x0 >= ult.xTexto - 8 && !/^(PAGINA|DATA|HISTORICO|VALOR|SALDO|EXTRATO|CREDITO|DEBITO)\b/.test(N)) ult.det.push(tx.map(function(c){ return c.t; }).join(' '));
        return;
      }
      if (!dataAtual || !viuData) return;   /* números do resumo do topo */
      var valor = null, saldo = null, sin = 0;
      vals.forEach(function(c){
        var col = colDe(c), k = col ? col.k : null;
        if (k === 'saldo') saldo = (c.v.s || 1) * c.v.c;
        else if (valor === null) { valor = c.v.c; sin = k === 'credito' ? 1 : (k === 'debito' ? -1 : c.v.s); }
      });
      if (valor === null) { valor = vals[0].v.c; sin = vals[0].v.s; }
      if (!sin && ctx) sin = ctx;
      var l = { data: dataAtual, desc: tx.length ? tx[0].t : '', valor: valor, sinal: sin, saldo: saldo, det: tx.slice(1).map(function(c){ return c.t; }), xTexto: tx.length ? tx[0].x0 : 0 };
      T.lanc.push(l); ult = l;
    });
    return T;
  }
  /* o sinal que faltou vem da mudança do saldo; depois da descrição. Valor zero não é lançamento. */
  function ajustarSinais(T){
    var prev = T.ant ? T.ant.valor : null;
    T.lanc.forEach(function(l){
      if (l.saldo != null && prev != null && l.valor > 0) {
        var dlt = l.saldo - prev;
        if (Math.abs(Math.abs(dlt) - l.valor) <= 1) { var s2 = dlt >= 0 ? 1 : -1; if (l.sinal && l.sinal !== s2) l.corrigido = true; l.sinal = s2; }
      }
      if (!l.sinal) { var n = norm(l.desc + ' ' + l.det.join(' ')); l.sinal = /RECEBID|CREDIT|CRED |DEPOSITO|ESTORNO|RENDIMENTO|RESGATE|SALARIO|PROVENTO|REEMBOLSO|DEVOLU/.test(n) ? 1 : -1; l.chute = true; }
      l.v = l.sinal * l.valor;
      if (l.saldo != null) prev = l.saldo; else if (prev != null) prev += l.v;
    });
    T.lanc = T.lanc.filter(function(l){ return l.valor !== 0; });
  }
  var DOCRE = /(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\*{3}\.\d{3}\.\d{3}-\*{2})/, DOCPARC = /\b(\d{3}\.\d{3}\.\d{3}|\d{2}\.\d{3}\.\d{3}\/\d{4})\b/;
  function limparContraparte(l){
    var txt = l.det.filter(Boolean).join(' '), m = DOCRE.exec(txt);
    if (m) { l.doc = m[1]; txt = txt.replace(m[0], ' '); } else if ((m = DOCPARC.exec(txt))) txt = txt.replace(m[0], ' ');
    var partes = txt.split(/\s+-\s+|\s+-$|^-\s+/).map(function(x){ return x.replace(/\s+/g, ' ').trim(); }).filter(function(x){ return x && !/^-$/.test(x); });
    l.nome = partes[0] || '';
  }
  /* prova pelas contas */
  function provar(T, saldoAnt){
    var ok = 0, div = [], provas = [], prev = T.ant ? T.ant.valor : null, comSaldo = T.lanc.filter(function(l){ return l.saldo != null; }).length;
    if (comSaldo) {
      var okS = 0;
      T.lanc.forEach(function(l, i){
        if (l.saldo != null && prev != null) { var esperado = prev + l.v; if (Math.abs(esperado - l.saldo) <= 1) okS++; else div.push({ de: i ? T.lanc[i - 1].data : l.data, ate: l.data, esperado: l.saldo, obtido: esperado }); }
        prev = l.saldo != null ? l.saldo : (prev != null ? prev + l.v : null);
      });
      ok += okS; if (okS) provas.push('saldo linha a linha: ' + okS + ' de ' + comSaldo + ' conferem');
    }
    var soma = T.lanc.reduce(function(t, l){ return t + l.v; }, 0), R = T.resumo;
    if (R.saldoInicial != null && R.saldoFinal != null && !comSaldo) {
      var esp = R.saldoInicial + soma, esp2 = esp + (R.rendimento || 0);
      if (Math.abs(esp - R.saldoFinal) <= 1 || Math.abs(esp2 - R.saldoFinal) <= 1) { ok++; provas.push('saldo inicial + movimentos = saldo final'); } else div.push({ de: null, ate: null, esperado: R.saldoFinal, obtido: esp2 });
    }
    var ent = T.lanc.filter(function(l){ return l.v > 0; }).reduce(function(t, l){ return t + l.v; }, 0), sai = -T.lanc.filter(function(l){ return l.v < 0; }).reduce(function(t, l){ return t + l.v; }, 0);
    if (R.entradas != null) { if (Math.abs(ent - R.entradas) <= 1 || Math.abs(ent + (R.rendimento || 0) - R.entradas) <= 1 || Math.abs(ent - (R.rendimento || 0) - R.entradas) <= 1) { ok++; provas.push('total de entradas confere'); } else div.push({ de: null, ate: null, esperado: R.entradas, obtido: ent }); }
    if (R.saidas != null) { if (Math.abs(sai - R.saidas) <= 1) { ok++; provas.push('total de saídas confere'); } else div.push({ de: null, ate: null, esperado: R.saidas, obtido: sai }); }
    var dias = Object.keys(T.totDia), okD = 0;
    dias.forEach(function(d){
      var e = T.lanc.filter(function(l){ return l.data === d && l.v > 0; }).reduce(function(t, l){ return t + l.v; }, 0), s = -T.lanc.filter(function(l){ return l.data === d && l.v < 0; }).reduce(function(t, l){ return t + l.v; }, 0), tt = T.totDia[d];
      if ((tt.e == null || Math.abs(e - tt.e) <= 1) && (tt.s == null || Math.abs(s - tt.s) <= 1)) okD++; else div.push({ de: d, ate: d, esperado: (tt.e || 0) - (tt.s || 0), obtido: e - s });
    });
    if (dias.length) { ok += okD; if (okD) provas.push('total de cada dia: ' + okD + ' de ' + dias.length + ' conferem'); }
    var chutes = T.lanc.filter(function(l){ return l.chute; }).length, corrigidos = T.lanc.filter(function(l){ return l.corrigido; }).length;
    var selo = div.length ? 'amarelo' : (ok > 0 && !chutes ? 'verde' : 'amarelo');
    if (!ok && !div.length) provas.push('não há saldo nem total para conferir: confira os valores');
    if (chutes) provas.push(chutes + (chutes === 1 ? ' sinal' : ' sinais') + ' deduzido(s) pela descrição: confira');
    if (corrigidos) provas.push(corrigidos + (corrigidos === 1 ? ' sinal corrigido' : ' sinais corrigidos') + ' pelo saldo');
    return { conf: { conferidos: ok, divergencias: div }, selo: selo, provas: provas };
  }
  /* o que o resto do Horus espera de um extrato lido (mesmo formato dos leitores por banco) */
  function lerExtratoGeral(rows){
    var R = (rows || []).map(function(r){ var cs = celulasDaLinha(r); return { cs: cs, t: cs.map(function(c){ return c.t; }).join('  '), n: norm(cs.map(function(c){ return c.t; }).join(' ')) }; }).filter(function(r){ return r.cs.length; });
    if (R.length < 4) return null;
    var info = lerCabecalho(R), cols = acharColunas(R), T = varrer(R, info, cols);
    if (!T.lanc.length) return null;
    ajustarSinais(T); T.lanc.forEach(limparContraparte);
    if (!T.lanc.length) return null;
    var prova = provar(T), datas = T.lanc.map(function(l){ return l.data; }).sort();
    var saldos = {}; T.lanc.forEach(function(l){ if (l.saldo != null) saldos[l.data] = l.saldo; }); Object.keys(T.saldosDia).forEach(function(d){ saldos[d] = T.saldosDia[d]; });
    var ultSaldo = null; T.lanc.forEach(function(l){ if (l.saldo != null) ultSaldo = l.saldo; });
    var cod = info.banco, slug = cod ? (BANCOS[cod] || 'banco').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') : 'banco';
    var r = { banco: cod ? BANCOS[cod] : 'Banco (não identificado)', bancoCodigo: cod, tipoConta: onlyDig(info.titular.doc).length === 14 ? 'pj' : 'pf', ag: info.ag, cc: info.cc, titular: info.titular, formato: 'geral',
      lanc: T.lanc.map(function(l){ return { data: l.data, desc: l.desc, nome: l.nome, doc: l.doc || '', valor: l.v }; }), saldos: saldos,
      saldoAtual: T.resumo.saldoFinal != null ? T.resumo.saldoFinal : ultSaldo, emitido: info.emitido || ((info.ate || datas[datas.length - 1]) + 'T23:59:00'),
      de: info.de || datas[0], ate: info.ate || datas[datas.length - 1], conf: prova.conf, selo: prova.selo, provas: prova.provas, geral: true };
    r.chave = slug + '-' + (info.ag || '?') + '-' + String(info.cc || '?').replace(/[^0-9A-Za-z-]/g, '');
    return r;
  }

  return { BANCOS: BANCOS, bancoPorCodigo: bancoPorCodigo, bancoPorTexto: bancoPorTexto, mod10: mod10, mod11: mod11, vencimentoDoFator: vencimentoDoFator, lerLinhaDigitavel: lerLinhaDigitavel, acharBoletos: acharBoletos, fmtLinha: fmtLinha, crc16: crc16, lerBRCode: lerBRCode, acharBRCode: acharBRCode, lerE2E: lerE2E, acharE2E: acharE2E, cpfOk: cpfOk, cnpjOk: cnpjOk, lerExtratoGeral: lerExtratoGeral, lerValor: lerValor, lerData: lerData, celulasDaLinha: celulasDaLinha, norm: norm, addDias: addDias, difDias: difDias, onlyDig: onlyDig };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LeitorGeral;
