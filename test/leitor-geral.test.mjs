// Leitor geral de documentos (cliente/leitor-geral.js): boleto, Pix copia e cola, ID E2E, CPF/CNPJ e extrato PDF de qualquer banco (Caixa e Nubank).
// Não precisa de servidor:  node test/rodar.mjs leitor-geral
import fs from 'node:fs';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const LeitorGeral = new Function(fs.readFileSync(new URL('../cliente/leitor-geral.js', import.meta.url), 'utf8') + '\nreturn LeitorGeral;')();

console.log('\n— Boleto (linha digitável)');
{
  const bb = LeitorGeral.lerLinhaDigitavel('00190.50095 40144.816069 06809.350314 3 37370000000100', '2008-01-01');
  check(bb && bb.ok && bb.tipo === 'cobranca' && bb.banco === '001' && bb.bancoNome === 'Banco do Brasil' && bb.valor === 100 && bb.vencimento === '2007-12-31', 'lê o boleto do Banco do Brasil: banco, valor R$ 1,00 e vencimento 31/12/2007 (fator 3737)');
  check(bb.validos.campos.every(Boolean) && bb.validos.geral, 'os três dígitos de campo e o dígito geral conferem');
  check(!LeitorGeral.lerLinhaDigitavel('00190.50095 40144.816069 06809.350314 4 37370000000100', '2008-01-01').ok, 'um dígito geral errado é recusado');
  check(!LeitorGeral.lerLinhaDigitavel('00190.50095 40144.816060 06809.350314 3 37370000000100', '2008-01-01').ok, 'um dígito de campo errado é recusado');
  const barras = LeitorGeral.lerLinhaDigitavel('00193373700000001000500940144816060680935031', '2008-01-01');
  check(barras && barras.ok && barras.valor === 100, 'o código de barras de 44 dígitos também lê');
  const a = LeitorGeral.lerLinhaDigitavel('846700000017435900240209024050002435842210138113');
  check(a && a.tipo === 'arrecadacao' && a.validos.campos.slice(0, 3).every(Boolean) && a.valor === 14359, 'conta de consumo/tributo (48 dígitos): três blocos conferem e o valor é R$ 143,59');
  const ach = LeitorGeral.acharBoletos('Pague até 31/12 — linha digitável:\n00190.50095 40144.816069 06809.350314 3 37370000000100\nobrigado', '2008-01-01');
  check(ach.length === 1 && ach[0].valor === 100, 'acha a linha digitável no meio de um texto qualquer');
}
console.log('\n— Fator de vencimento (reinício em 22/02/2025)');
{
  check(LeitorGeral.vencimentoDoFator('1000', '2025-02-20').data === '2025-02-22' && LeitorGeral.vencimentoDoFator('1001', '2025-02-20').data === '2025-02-23', 'fator 1000 = 22/02/2025 e 1001 = 23/02/2025 (calendário novo)');
  check(LeitorGeral.vencimentoDoFator('3737', '2008-01-01').data === '2007-12-31', 'fator 3737 em 2008 = calendário antigo (31/12/2007)');
  check(LeitorGeral.vencimentoDoFator('9999', '2025-01-10').data === '2025-02-21', 'fator 9999 = 21/02/2025 (último do calendário antigo)');
  check(LeitorGeral.vencimentoDoFator('0000').semVencimento, 'fator 0000 = sem vencimento');
  const v = LeitorGeral.vencimentoDoFator('1500', '2026-06-01'); check(v.data === '2026-07-07' && !!v.alternativa, 'em 2026 o fator 1500 cai no calendário novo (07/07/2026), com a alternativa guardada');
}
console.log('\n— Pix copia e cola (BR Code)');
{
  const br = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';
  const r = LeitorGeral.lerBRCode(br);
  check(r && r.ok && r.crcOk && r.chave === '123e4567-e12b-12d1-a456-426655440000' && r.nome === 'Fulano de Tal' && r.cidade === 'BRASILIA', 'exemplo do manual do Banco Central: CRC confere, chave, nome e cidade');
  check(!LeitorGeral.lerBRCode(br.replace('1D3D', '1D3E')).ok, 'CRC errado é recusado');
  const comValor = '00020126360014br.gov.bcb.pix0114+55619999999995204000053039865406123.455802BR5907LOJINHA6009SAO PAULO62070503***6304';
  const rv = LeitorGeral.lerBRCode(comValor + LeitorGeral.crc16(comValor)); check(rv && rv.ok && rv.valor === 12345 && rv.chave === '+5561999999999', 'Pix com valor (R$ 123,45) e chave de telefone');
  check(LeitorGeral.acharBRCode('copie: ' + br + ' fim').ok, 'acha o Pix copia e cola dentro de um texto');
}
console.log('\n— ID da transação (E2E), CPF e CNPJ');
{
  const e = LeitorGeral.lerE2E('E18236120202412051030s0a1b2c3d4e'); check(e && e.ispb === '18236120' && e.data === '2024-12-05' && e.hora === '10:30', 'ID E2E: ISPB 18236120, data 05/12/2024 10:30');
  check(!LeitorGeral.lerE2E('E1823612020241305103000000000000') || !LeitorGeral.lerE2E('E1823612020241305103000000000000').dataOk, 'ID com data impossível não passa na conferência');
  check(LeitorGeral.cpfOk('529.982.247-25') && !LeitorGeral.cpfOk('111.111.111-11') && !LeitorGeral.cpfOk('529.982.247-26'), 'CPF: confere dígitos');
  check(LeitorGeral.cnpjOk('11.222.333/0001-81') && !LeitorGeral.cnpjOk('11.222.333/0001-80'), 'CNPJ: confere dígitos');
}

/* linhas de PDF montadas à mão: [texto, x] ou [texto, xDireita, 'd'] (alinhado pela borda direita), com 6,2 de largura por letra */
const W = 6.2, L = (...cs) => cs.map(([t, x, d]) => ({ s: t, x: d ? x - t.length * W : x, w: t.length * W }));
console.log('\n— Extrato Caixa (Extrato por período; valor e saldo com C/D)');
{
  const lin = (d, nd, h, v, s) => L([d, 169], [nd, 273], [h, 386], [v, 803, 'd'], [s, 1012, 'd']);
  const rows = [L(['18/11/2022', 145], ['Internet Banking____CAIXA', 574]), L(['Extrato por período', 159]), L(['Cliente: LEONARDO ALVES ALMEIDA', 169]), L(['Conta: 3596 / 013 / 00018498-7', 169]), L(['Data:', 169], ['18/11/2022- 14:27', 233]), L(['Mês:', 169], ['Novembro/2022', 233]), L(['Período: 18 - 29', 169]), L(['Extrato', 169]),
    L(['Data Mov.', 169], ['Nr. Doc.', 273], ['Histórico', 386], ['Valor', 803, 'd'], ['Saldo', 1015, 'd']),
    L(['000000', 273], ['SALDO ANTERIOR', 386], ['0,00', 803, 'd'], ['2.839,34 C', 1012, 'd']),
    lin('18/11/2022', '000000', 'REM BASICA', '0,00 C', '2.839,34 C'), lin('19/11/2022', '000000', 'CRED JUROS', '10,02 C', '2.849,35 C'), lin('20/11/2022', '022703', 'PAG BOLETO', '252,39 D', '2.590,96 C'), lin('20/11/2022', '495598', 'PAG BOLETO', '82,94 D', '2.508,02 C'),
    lin('21/11/2022', '041431', 'ENVIO TEV', '159,00 D', '2.349,02 C'), lin('22/11/2022', '050746', 'ENVIO TEV', '70,00 D', '2.279,02 C'), lin('23/11/2022', '127135', 'PAG BOLETO', '56,15 D', '2.222,87 C'), lin('23/11/2022', '061304', 'ENVIO TEV', '18,00 D', '2.204,87 C'),
    lin('24/11/2022', '081553', 'ENVIO TEV', '7,50 D', '2.197,37 C'), lin('25/11/2022', '009386', 'PAG BOLETO', '82,94 D', '2.114,43 C'), L(['https://internetbanking.caixa.gov.br/SIIBC/imprime_ext_periodo', 144], ['1/2', 1040])];
  const r = LeitorGeral.lerExtratoGeral(rows);
  check(r && r.formato === 'geral' && r.banco === 'Caixa' && r.ag === '3596' && r.cc === '00018498-7' && r.titular.nome === 'LEONARDO ALVES ALMEIDA', 'reconhece a Caixa sem modelo: banco, agência 3596, conta 00018498-7 e titular');
  check(r.chave === 'caixa-3596-00018498-7', 'chave da conta: ' + (r && r.chave));
  check(r.lanc.length === 9 && r.lanc[0].data === '2022-11-19' && r.lanc[0].valor === 1002 && r.lanc[1].valor === -25239 && r.lanc[1].desc === 'PAG BOLETO', '9 lançamentos (o de R$ 0,00 não conta): crédito de juros +10,02; boleto −252,39');
  check(r.saldoAtual === 211443, 'saldo atual: R$ 2.114,43');
  // o extrato de exemplo tem um erro de R$ 6,00 entre duas linhas (2.849,35 − 252,39 ≠ 2.590,96): o leitor percebe e avisa
  check(r.selo === 'amarelo' && r.conf.divergencias.length === 1 && r.conf.divergencias[0].ate === '2022-11-20', 'o exemplo tem uma linha que não fecha (diferença de R$ 6,00): selo AMARELO apontando 20/11');
  // versão coerente (saldos recalculados): tudo confere
  let saldo = 283934; const rowsOk = rows.map((x, i) => { if (i < 10 || i > 19) return x; const t = x.map((c) => c.s); const val = t[3], sinal = /D$/.test(val) ? -1 : 1, c = Math.round(parseFloat(val.replace(/[^\d,]/g, '').replace(',', '.')) * 100); saldo += sinal * c; const f = (saldo / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' C'; return lin(t[0], t[1], t[2], t[3], f); });
  const r2 = LeitorGeral.lerExtratoGeral(rowsOk);
  check(r2.selo === 'verde' && r2.conf.divergencias.length === 0 && r2.conf.conferidos >= 9, 'com os saldos coerentes: selo VERDE (' + (r2 && r2.provas.join('; ')) + ')');
  check(r2.lanc.reduce((t, l) => t + l.valor, 0) === r2.saldoAtual - 283934, 'a soma dos lançamentos leva o saldo de 2.839,34 ao saldo final');
  // sem o C/D (só o saldo mostra o sentido): o leitor deduz o sinal pela mudança do saldo
  const semCD = rowsOk.map((x, i) => (i < 10 || i > 19) ? x : lin(x[0].s, x[1].s, x[2].s, x[3].s.replace(/ [CD]$/, ''), x[4].s));
  const r3 = LeitorGeral.lerExtratoGeral(semCD); check(r3.lanc.length === 9 && r3.lanc[1].valor === -25239 && r3.lanc[0].valor === 1002 && r3.selo === 'verde', 'sem o C/D no valor: o sinal vem da mudança do saldo e continua verde');
}
console.log('\n— Extrato Nubank (seções por dia: Total de entradas / Total de saídas; só uma coluna de valor)');
{
  const v = (t) => [t, 1005, 'd'], T = (a, b, c) => L([a, 303], [b, 543], v(c));
  const rows = [L(['Vinicius Bernardes Basile Stopa', 770]), L(['CPF  218.718.568-09 Agência  0001 Conta  5992345-8', 612]), L(['01 DE OUTUBRO DE 2021 a 31 DE OUTUBRO DE 2021', 196], ['VALORES EM R$', 892]),
    L(['Saldo inicial', 597], v('1.000,00')), L(['Saldo final do período', 196]), L(['Rendimento líquido', 597], v('+0,00')), L(['R$ 1.200,00', 192]), L(['Total de entradas', 597], v('+3.000,00')), L(['Total de saídas', 597], v('-2.800,00')), L(['Saldo final do período', 597], v('1.200,00')), L(['Movimentações', 196]),
    L(['01 OUT 2021', 198], ['Total de entradas', 303], v('+ 2.000,00')),
    L(['Transferência recebida pelo Pix', 303], ['Gisele Vitinilla 366.571.852-00 -', 543], v('1180,00')), L(['Transferência recebida pelo Pix', 303], ['Rodrigo Viana - 230.087.568', 543], v('820,00')),
    L(['Total de saídas', 303], v('- 1.500,00')), L(['Compra no débito', 303], ['Raia', 543], v('1000,00')), L(['Compra no débito', 303], ['Jatobah Espetaria', 543], v('500,00')),
    L(['02 OUT 2021', 198], ['Total de entradas', 303], v('+ 1.000,00')), L(['Transferência recebida pelo Pix', 303], ['Laura Mendes - 526.940.798-14 - NU', 543], v('1000,00')),
    L(['Total de saídas', 303], v('- 1.300,00')), L(['Transferência enviada pelo Pix', 303], ['Vinicius Bernardes Basile Stopa - 218.718.568-09 -', 543], v('1300,00')),
    L(['Ouvidoria: Se você não ficou satisfeito, ligue para 0800 887 0463', 196]), L(['Nu Pagamentos S.A. - Instituição de Pagamento', 196]), L(['CNPJ: 18.236.120/0001-58', 196], ['Extrato gerado dia 15 de dezembro de 2021 às 09:10', 614])];
  const r = LeitorGeral.lerExtratoGeral(rows);
  check(r && r.banco === 'Nubank' && r.ag === '0001' && r.cc === '5992345-8' && r.titular.doc === '218.718.568-09' && r.titular.nome === 'Vinicius Bernardes Basile Stopa', 'reconhece o Nubank sem modelo: banco, agência 0001, conta 5992345-8, titular e CPF');
  check(r.de === '2021-10-01' && r.ate === '2021-10-31' && /^2021-12-15T09:10/.test(r.emitido), 'período (01 a 31/10/2021) e emissão (15/12/2021 09:10)');
  check(r.lanc.length === 6 && r.lanc.filter((l) => l.valor > 0).length === 3, '6 lançamentos: 3 entradas e 3 saídas (o sinal vem da seção do dia)');
  const g = r.lanc[0]; check(g.data === '2021-10-01' && g.valor === 118000 && g.desc === 'Transferência recebida pelo Pix' && g.nome === 'Gisele Vitinilla' && g.doc === '366.571.852-00', 'Pix recebido: descrição, nome e CPF da contraparte separados');
  check(r.lanc[1].nome === 'Rodrigo Viana' && r.lanc[4].nome === 'Laura Mendes' && r.lanc[5].valor === -130000 && r.lanc[5].data === '2021-10-02', 'nome sem CPF completo, sufixo "NU" e saída do dia 02/10');
  check(r.selo === 'verde' && r.conf.divergencias.length === 0, 'selo VERDE: saldo inicial + entradas − saídas = saldo final e cada dia confere (' + (r && r.provas.join('; ')) + ')');
  check(r.saldoAtual === 120000, 'saldo final do período R$ 1.200,00');
  // total do dia diferente da soma (como no extrato de exemplo, em que 1449,99+110,00+448,06 não dá 2.002,05)
  const rows3 = rows.map((x) => x); rows3[14] = L(['Total de saídas', 303], v('- 1.490,00'));
  const r3 = LeitorGeral.lerExtratoGeral(rows3); check(r3.selo === 'amarelo' && r3.conf.divergencias.some((d) => d.de === '2021-10-01'), 'total do dia que não fecha: selo AMARELO apontando o dia 01/10');
}
console.log('\n— Extrato com colunas Crédito e Débito (sem sinal), sem saldo por linha');
{
  const lin = (d, h, c, db) => L([d, 40], [h, 110], ...(c ? [[c, 520, 'd']] : []), ...(db ? [[db, 610, 'd']] : []));
  const rows = [L(['BANCO EXEMPLO S.A.', 40]), L(['Agência: 1234  Conta: 99887-6', 40]), L(['Período: 01/03/2026 a 31/03/2026', 40]), L(['Data', 40], ['Histórico', 110], ['Crédito', 520, 'd'], ['Débito', 610, 'd']),
    L(['Saldo anterior', 110], ['500,00', 700, 'd']), lin('02/03', 'SALARIO EMPRESA X', '3.000,00'), lin('03/03', 'PAGTO ENERGIA', '', '210,50'), lin('05/03', 'MERCADO CENTRAL', '', '389,50'), lin('10/03', 'PIX RECEBIDO JOAO', '100,00'), L(['Saldo final', 110], ['3.000,00', 700, 'd'])];
  const r = LeitorGeral.lerExtratoGeral(rows);
  check(r && r.lanc.length === 4 && r.lanc[0].valor === 300000 && r.lanc[1].valor === -21050 && r.lanc[3].valor === 10000 && r.lanc[0].data === '2026-03-02', 'colunas Crédito/Débito pelo cabeçalho: entradas positivas e saídas negativas; o ano vem do período');
  check(r.saldoAtual === 300000 && r.selo === 'verde', 'saldo anterior 500 + entradas 3.100 − saídas 600 = saldo final 3.000: selo VERDE (' + (r && r.provas.join('; ')) + ')');
}

console.log('\n— Comprovantes de Pix e de pagamento (rótulos e tipo do dado, estilos diferentes)');
{
  // estilo 1: rótulo numa linha e valor na de baixo (app de banco digital)
  const nu = ['Comprovante de transferência', '10 NOV 2026 - 09:42:10', 'Valor', 'R$ 1.350,00', 'Tipo de transferência', 'Pix', 'Destino', 'Nome', 'Caixa Consórcios Ltda', 'CPF/CNPJ', '00.360.305/****-**', 'Instituição', 'CAIXA ECONÔMICA FEDERAL', 'Origem', 'Nome', 'Hygor L A', 'CPF/CNPJ', '***.456.789-**', 'Instituição', 'NU PAGAMENTOS - IP', 'ID da transação', 'E18236120202611101242s0a1b2c3d4e'];
  const a = LeitorGeral.lerComprovante(nu);
  check(a.valor === 135000 && a.data === '2026-11-10' && a.hora === '09:42' && a.tipo === 'pix', 'estilo 1 (rótulo e valor em linhas separadas): valor R$ 1.350,00, 10/11/2026 09:42, Pix');
  check(a.destino.nome === 'Caixa Consórcios Ltda' && a.destino.doc === '00.360.305/****-**' && a.destino.inst === 'CAIXA ECONÔMICA FEDERAL' && a.origem.nome === 'Hygor L A' && a.origem.doc === '***.456.789-**', 'quem recebeu e quem pagou ficam separados pela seção (Destino / Origem)');
  check(a.e2e && a.e2e.ispb === '18236120' && a.e2e.data === '2026-11-10' && a.selo === 'verde', 'ID E2E confere com a data (10/11/2026): selo VERDE');
  // estilo 2: "Rótulo: valor" na mesma linha, em PDF de internet banking
  const cx = ['COMPROVANTE DE PIX ENVIADO', 'Data: 10/11/2026 09:42', 'Valor: R$ 89,90', 'Dados do recebedor', 'Nome: PADARIA PAO QUENTE LTDA', 'CPF/CNPJ: 12.345.678/0001-95', 'Instituição: BANCO DO BRASIL', 'Chave: padaria@exemplo.com.br', 'Dados do pagador', 'Nome: LEONARDO ALVES ALMEIDA', 'ID da transação: E00360305202611101242abcdef12345'];
  const b = LeitorGeral.lerComprovante(cx);
  check(b.valor === 8990 && b.sentido === 'saida' && b.destino.nome === 'PADARIA PAO QUENTE LTDA' && b.destino.chave === 'padaria@exemplo.com.br' && b.origem.nome === 'LEONARDO ALVES ALMEIDA' && b.nome === 'PADARIA PAO QUENTE LTDA', 'estilo 2 ("Rótulo: valor"): saída de R$ 89,90 para a padaria, com a chave Pix');
  // estilo 3: duas colunas (célula do rótulo e da valor separadas por espaços), pagamento de boleto
  const it = ['Comprovante de pagamento', 'Pagamento de boleto', 'Beneficiário   EQUATORIAL GOIAS DISTRIBUIDORA', 'CNPJ do beneficiário   01.543.032/0001-04', 'Vencimento   12/12/2026', 'Valor   R$ 412,87', 'Data do pagamento   10/12/2026', 'Linha digitável   00190.50095 40144.816069 06809.350314 3 37370000000100', 'Autenticação   9A8B7C6D5E4F3G2H1I0J'];
  const c = LeitorGeral.lerComprovante(it);
  check(c.tipo === 'boleto' && c.valor === 41287 && c.data === '2026-12-10' && c.venc === '2026-12-12' && c.destino.nome === 'EQUATORIAL GOIAS DISTRIBUIDORA' && c.auth === '9A8B7C6D5E4F3G2H1I0J', 'estilo 3 (duas colunas): pagamento de boleto, vencimento 12/12, pago em 10/12, autenticação lida');
  check(c.boleto && c.boleto.ok && c.selo === 'verde', 'a linha digitável do boleto pago confere');
  // sem ID nem autenticação: amarelo; sem valor: vermelho
  check(LeitorGeral.lerComprovante(['Pix enviado', 'Valor R$ 50,00', 'Data 03/12/2026', 'Para', 'Fulano']).selo === 'amarelo', 'sem ID de transação nem autenticação: selo AMARELO (confira)');
  check(LeitorGeral.lerComprovante(['Qualquer coisa', 'sem número']).selo === 'vermelho', 'sem valor nem data: selo VERMELHO');
  // a data do ID não bate com a data lida
  const d = LeitorGeral.lerComprovante(['Pix enviado', 'Valor R$ 50,00', 'Data 03/12/2026', 'Para', 'Fulano de Tal', 'ID da transação', 'E18236120202601101242s0a1b2c3d4e']);
  check(d.divergeData && d.selo === 'amarelo', 'a data dentro do ID (10/01/2026) difere da data lida (03/12/2026): selo AMARELO');
  check(LeitorGeral.lerComprovante(['Você recebeu um Pix', 'R$ 200,00', '15/11/2026', 'De', 'Maria Souza', 'ID E18236120202611151030s0a1b2c3d4e']).sentido === 'entrada', 'Pix recebido: sentido de entrada, valor achado mesmo sem rótulo');
}
console.log('\n— Boleto impresso (PDF do boleto) e classificação do documento');
{
  const bol = ['Banco do Brasil', '00190.50095 40144.816069 06809.350314 3 37370000000100', 'Beneficiário', 'ESCRITORIO EXEMPLO LTDA', 'CPF/CNPJ do beneficiário', '11.222.333/0001-81', 'Pagador', 'FULANO DE TAL', 'Vencimento', '31/12/2007', 'Valor do documento', 'R$ 1,00', 'Nosso número', '12345678'];
  const b = LeitorGeral.lerBoletoDoc(bol, '2008-01-01');
  check(b && b.banco === '001' && b.valor === 100 && b.vencimento === '2007-12-31' && b.beneficiario === 'ESCRITORIO EXEMPLO LTDA' && b.pagador === 'FULANO DE TAL' && b.selo === 'verde', 'boleto: banco 001, R$ 1,00, vencimento, beneficiário e pagador pelos rótulos; a linha confere');
  const b2 = LeitorGeral.lerBoletoDoc(bol.map((x) => x === 'R$ 1,00' ? 'R$ 25,00' : x), '2008-01-01');
  check(b2.selo === 'amarelo' && b2.valorDocumento === 2500 && /multa|juros|desconto/.test(b2.provas.join(' ')), 'valor escrito diferente da linha digitável: selo AMARELO avisando (multa, juros ou desconto)');
  check(LeitorGeral.classificar(bol).tipo === 'boleto', 'classifica: boleto');
  check(LeitorGeral.classificar(['Comprovante de transferência', 'Valor', 'R$ 10,00', 'Destino', 'Fulano', 'ID da transação', 'E18236120202611101242s0a1b2c3d4e']).tipo === 'comprovante', 'classifica: comprovante (ID de Pix)');
  check(LeitorGeral.classificar(['Pague com Pix', '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D']).tipo === 'pix_copia_cola', 'classifica: Pix copia e cola');
  check(LeitorGeral.classificar(['OFXHEADER:100', '<OFX><STMTTRN>']).tipo === 'ofx', 'classifica: OFX');
  const ext = ['Extrato', ...['01/10/2026 PIX 10,00', '02/10/2026 PIX 20,00', '03/10/2026 PIX 30,00', '04/10/2026 PIX 40,00', '05/10/2026 PIX 50,00']];
  check(LeitorGeral.classificar(ext).tipo === 'extrato', 'classifica: extrato (várias linhas com data e valor)');
  check(LeitorGeral.classificar(['Olá, tudo bem?']).tipo === null, 'texto qualquer: não classifica (null)');
}
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
