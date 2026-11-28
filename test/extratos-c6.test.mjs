// Testa a leitura de extratos do C6 (PDF "Extrato personalizado", OFX e zip com senha) e do novo layout do Itaú (extrato do site/app).
// Não precisa de servidor: carrega o leitor (EX) e as funções de zip/OFX direto do public/index.html. Só dados inventados (nada de extrato real no repositório).
//   node test/extratos-c6.test.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execSync } from 'node:child_process';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const H = fs.readFileSync(new URL('../cliente/index.fonte.html', import.meta.url), 'utf8');
const fatia = (a, b) => { const i = H.indexOf(a), j = H.indexOf(b, i); if (i < 0 || j < 0) throw new Error('trecho não achado: ' + a.slice(0, 40)); return H.slice(i, j); };
const EX = new Function(fatia('var EX = (function(){', "if (typeof module !== 'undefined' && module.exports) module.exports = EX;") + '; return EX;')();
const estado = { senha: '', auto: true, rodando: false };
const LeitorGeral = new Function(fs.readFileSync(new URL('../cliente/leitor-geral.js', import.meta.url), 'utf8') + '\nreturn LeitorGeral;')();
const lib = new Function('EX', 'impEstado', 'escapeHtml', 'document', 'LeitorGeral', fatia('function ofxTag(', 'function impLerBytes(nome, buf){') + '; return { ofxLer: ofxLer, impAbrirZip: impAbrirZip, impEhZip: impEhZip };')(EX, estado, (s) => s, null, LeitorGeral);
const com = (linhas, xs) => { const L = linhas.slice(); L.x = xs; return L; };

console.log('\n— C6 PJ: "Extrato personalizado"');
{
  // [texto, posição do início da linha na página]
  const LINHAS = [['Extrato personalizado', 442], ['EMPRESA EXEMPLO LTDA • CNPJ: 11.222.333/0001-81', 313], ['Agência: 1 • Conta: 123456789', 469], ['Exportado em 10/12/26 às 09:15', 463], ['Período da Exportação', 43], ['01/12/2026 a 10/12/2026', 43], ['Categorias exportadas', 43], ['Entradas   Saídas', 52],
    ['Dezembro 2026 ( 01/12/2026 - 10/12/2026 )   Entradas: R$ 1.500,00 •   Saídas: R$ 350,75', 36], ['Data   Data', 36], ['lançamento   contábil   Tipo   Descrição   Valor', 36],
    ['03/12   03/12   Entrada PIX   Pix recebido de FULANO DE TAL   R$ 1.500,00', 36],
    ['05/12   05/12   Saída PIX   Pix enviado para BELTRANO COMERCIO DE ALIMENTOS   R$ -300,50', 36],
    ['06/12   06/12   Saída Boleto   Pagamento de boleto   - R$ 50,25', 36],
    ['Informações sujeitas a alteração até o final do dia', 37], ['C6 Bank • Av. Nove de Julho, 3186 - São Paulo/SP', 30]];
  const L = com(LINHAS.map((x) => x[0]), LINHAS.map((x) => x[1]));
  const r = EX.ler(L);
  check(r && r.formato === 'c6PJ' && r.banco === 'C6 Bank' && r.tipoConta === 'pj', 'reconhece o C6 PJ');
  check(r.chave === 'c6-1-123456789' && r.titular.nome === 'EMPRESA EXEMPLO LTDA' && r.titular.doc === '11.222.333/0001-81', 'conta, agência e titular lidos');
  check(r.lanc.length === 3 && r.lanc[0].data === '2026-12-03' && r.lanc[0].valor === 150000, 'entrada de R$ 1.500,00 em 03/12 (o ano vem do título do mês)');
  check(r.lanc[1].valor === -30050 && r.lanc[1].desc === 'Pix enviado' && /BELTRANO/.test(r.lanc[1].nome), 'saída com "R$ -" vira valor negativo; contraparte separada da descrição');
  check(r.lanc[2].valor === -5025 && r.lanc[2].data === '2026-12-06', 'saída com "- R$" e tipo "Saída" também fica negativa');
  check(r.de === '2026-12-01' && r.ate === '2026-12-10' && /^2026-12-10T09:15/.test(r.emitido), 'período e data de emissão');
  check(r.conf.conferidos === 1 && r.conf.divergencias.length === 0, 'totais "Entradas/Saídas" do mês conferem com a soma das linhas');
  check(r.lanc.every((l) => /^[0-9a-f]{8}/.test(l.h)), 'cada linha tem impressão digital (evita importar duas vezes)');
  const r2 = EX.ler(com(L.map((l) => l.replace('R$ 350,75', 'R$ 999,00')), L.x));
  check(r2.conf.divergencias.length === 1, 'total do mês diferente da soma vira divergência');
  const sem = EX.ler(com(L.map((l) => l.replace('Saída PIX', 'Débito').replace('R$ -300,50', 'R$ 300,50')), L.x));
  check(sem.lanc.length === 3, 'linha sem o tipo "Saída" ainda é lida (o sinal fica para a conferência dos totais)');
}

console.log('\n— Itaú: layout novo (extrato do site/app)');
{
  const L = com(['NOME EXEMPLO DA SILVA', 'CPF: 00001234567890 agência: 1234 conta: 0012345-6', 'Saldo em conta', 'R$ 100,00', 'Extrato conta corrente', 'Período de visualização: 01/12/2026 até 10/12/2026   Emitido em: 10/12/2026 10:00:00', 'Lançamentos', 'Data   Lançamentos   Descrição   Valor (R$)   Saldo (R$)',
    '09/12/2026   100,00', '09/12/2026   COMPRA DÉBITO   LOJA EXEMPLO   -20,00', '08/12/2026   120,00', '08/12/2026   PAGAMENTO DE PIX QR   EMPRESA EXEMPLO DE   -30,00', 'CODE   COMERCIO LTDA', '07/12/2026   150,00', '07/12/2026 PIX RECEBIDO   AMIGO DA SILVA   150,00', 'ANDRADE',
    'Consultas, informações e serviços, acesse itau.com.br'],
    [464, 323, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 100, 40, 40, 256, 40]);
  const r = EX.ler(L);
  check(r && r.formato === 'itauWeb' && r.banco === 'Itaú' && r.tipoConta === 'pf', 'reconhece o layout novo do Itaú (antes dava "Não reconheci o formato")');
  check(r.chave === 'itau-1234-012345-6', 'chave da conta no mesmo formato de antes (6 dígitos + dígito verificador)');
  check(r.titular.nome === 'NOME EXEMPLO DA SILVA' && r.titular.doc === '012.345.678-90', 'titular e CPF (que vem sem pontos) lidos');
  check(r.lanc.length === 3 && r.saldoAtual === 10000, '3 lançamentos e saldo atual');
  check(r.lanc[1].desc === 'PAGAMENTO DE PIX QR CODE' && r.lanc[1].nome === 'EMPRESA EXEMPLO DE COMERCIO LTDA', 'texto que quebra de linha: "CODE" volta para o tipo e o resto para a descrição');
  check(r.lanc[2].nome === 'AMIGO DA SILVA ANDRADE' && r.lanc[2].valor === 15000, 'nome que quebra na coluna da descrição junta ao lançamento de cima');
  check(r.conf.conferidos === 2 && r.conf.divergencias.length === 0, 'saldo de cada dia confere com os lançamentos');
}

console.log('\n— OFX do C6 e zip com senha');
{
  const OFX = 'OFXHEADER: 100\nDATA: OFXSGML\nVERSION: 102\nSECURITY: NONE\nENCODING: UTF - 8\nCHARSET: 1252\n\n<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>Banco C6 S.A.</ORG><FID>336</FID></FI></SONRS></SIGNONMSGSRSV1><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL</CURDEF>' +
    '<BANKACCTFROM><BANKID>336</BANKID><BRANCHID>1</BRANCHID><ACCTID>123456789</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM><BANKTRANLIST><DTSTART>20261201000000[-3:BRT]</DTSTART><DTEND>20261210000000[-3:BRT]</DTEND>' +
    '<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261203000000[-3:BRT]</DTPOSTED><TRNAMT>100.00</TRNAMT><FITID>A1</FITID><MEMO>Pix recebido</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261205000000[-3:BRT]</DTPOSTED><TRNAMT>-50.25</TRNAMT><FITID>A2</FITID><MEMO>Tarifa</MEMO></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>';
  const o = lib.ofxLer(OFX);
  check(o.banco === 'C6 Bank' && o.chave === 'c6-1-123456789' && o.lanc.length === 2 && o.lanc[1].valor === -5025 && o.lanc[0].data === '2026-12-03', 'OFX do C6: banco, conta (mesma chave do PDF PJ), datas com fuso e valores');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c6zip-')), ofx = path.join(dir, 'extrato.ofx'), zp = path.join(dir, 'e.zip');
  fs.writeFileSync(ofx, OFX); execSync('zip -q -P 123456 e.zip extrato.ofx', { cwd: dir });
  const b = fs.readFileSync(zp), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  check(lib.impEhZip(ab), 'reconhece o arquivo zip');
  estado.senha = '123456'; const it = await lib.impAbrirZip(ab);
  check(it.length === 1 && it[0].nome === 'extrato.ofx' && Buffer.from(it[0].buf).toString() === OFX, 'abre o zip com a senha certa e devolve o OFX idêntico');
  estado.senha = '000000'; let msg = ''; try { await lib.impAbrirZip(ab); } catch (e) { msg = e.message; }
  check(/senha/i.test(msg), 'senha errada não abre (na leitura automática pede para tocar em "Ler os recebidos")');
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('\n— OFX de outros bancos (tabela do Banco Central: Nubank e Caixa)');
{
  const ofx = (id, ag, cc) => 'OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>' + id + '<BRANCHID>' + ag + '<ACCTID>' + cc + '<ACCTTYPE>CHECKING</BANKACCTFROM><BANKTRANLIST><DTSTART>20261001<DTEND>20261031<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005<TRNAMT>-50.00<FITID>X1<MEMO>Compra</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>';
  const nu = lib.ofxLer(ofx('0260', '0001', '5992345-8')), cx = lib.ofxLer(ofx('104', '3596', '00018498-7')), zz = lib.ofxLer(ofx('999', '1', '2'));
  check(nu.banco === 'Nubank' && nu.chave === 'nubank-0001-5992345-8', 'OFX do Nubank (260): nome e a mesma chave de conta do PDF lido pelo leitor geral');
  check(cx.banco === 'Caixa' && cx.chave === 'caixa-3596-00018498-7', 'OFX da Caixa (104): nome e chave igual à do PDF');
  check(/Banco 999/.test(zz.banco) && zz.chave === 'b999-1-2', 'banco fora da tabela continua com o código (b999)');
}
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
