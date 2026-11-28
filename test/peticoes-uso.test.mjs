// Consumo do plano gratuito do R2: avisos em 80% e 95%, trava em 100%.  Use: node test/rodar.mjs peticoes-uso
import { calcularUso, MAX_ARQUIVO } from '../src/peticoes.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const GB = 1024 ** 3, lista = (gb) => [{ versoes: [{ tam: gb * GB }] }], zero = { mes: '2026-11', classeA: 0, classeB: 0 };
check(calcularUso(lista(1), zero).nivel === 'ok', '1 GB de 10: tudo certo');
check(calcularUso(lista(8), zero).nivel === 'atencao', '8 GB (80%): atenção');
check(calcularUso(lista(9.6), zero).nivel === 'critico', '9,6 GB (96%): crítico');
let u = calcularUso(lista(10), zero); check(u.nivel === 'bloqueado' && u.bloqueado, '10 GB (100%): trava novos envios');
u = calcularUso(lista(1), { ...zero, classeA: 1_000_000 }); check(u.bloqueado && u.qual === 'gravacoes', '1 milhão de gravações no mês: trava');
u = calcularUso(lista(1), { ...zero, classeB: 8_500_000 }); check(u.nivel === 'atencao' && u.qual === 'leituras', '85% das leituras: atenção');
check(MAX_ARQUIVO === 25 * 1024 * 1024, 'limite por arquivo: 25 MB');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
