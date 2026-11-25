/* LUMI 2 — Banco de dados central. Requer Node >=22.13 (node:sqlite).
   Valores financeiros são armazenados em CENTAVOS para não usar float em pagamentos.
   Cada operação de venda/validação executa dentro de transação SQLite. */
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'lumi.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL;');
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const hashPassword = password => {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
};
const verifyPassword = (password, stored) => {
  try { const [salt, digest] = stored.split(':'); const expected = Buffer.from(digest, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(salt, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
};
const EXAMPLES = [
  ['evt-aurora','Aurora Festival','Festival','2026-12-12','17:00','Parque das Artes','São Paulo, SP',18990,450,'assets/festival-aurora.svg','Música, luzes e encontros sob o céu. Uma celebração com diferentes ritmos e experiências.'],
  ['evt-atlas','Atlas Night','Festa','2026-12-19','22:00','Casa Áurea','Rio de Janeiro, RJ',8500,180,'assets/noite-atlas.svg','Uma noite imersiva com DJs convidados, pista iluminada e uma atmosfera inesquecível.'],
  ['evt-sunset','Sunset Garden','Experiência','2027-01-16','16:30','Jardim do Lago','Campinas, SP',6990,120,'assets/sunset-garden.svg','O encontro perfeito entre boa música, pôr do sol, gastronomia e natureza.'],
  ['evt-pulse','Pulse Electronic','Festival','2027-02-06','20:00','Arena 360','Belo Horizonte, MG',14900,300,'assets/pulse-electronic.svg','Batidas eletrônicas, artes visuais e uma noite para sentir a música por inteiro.'],
  ['evt-jazz','Lumi Jazz Club','Música','2027-03-13','20:30','Teatro Vereda','Curitiba, PR',7400,90,'assets/jazz-lumi.svg','Jazz contemporâneo em um ambiente acolhedor e intimista.'],
  ['evt-rooftop','Rooftop Sessions','Festa','2027-04-10','18:00','Terraço Horizonte','Florianópolis, SC',9900,160,'assets/rooftop-session.svg','Música ao vivo no alto da cidade e uma vista para guardar na memória.']
];
function initialize() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    cpf TEXT UNIQUE NOT NULL, telefone TEXT NOT NULL, senha_hash TEXT NOT NULL,
    tipo_usuario TEXT NOT NULL DEFAULT 'CLIENTE' CHECK(tipo_usuario='CLIENTE'), criado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS funcionarios (
    id TEXT PRIMARY KEY, nome TEXT NOT NULL, login TEXT NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash TEXT NOT NULL, permissao TEXT NOT NULL CHECK(permissao IN('ADMIN','CAIXA','VALIDADOR')),
    ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS caixas (
    id TEXT PRIMARY KEY, identificacao TEXT NOT NULL UNIQUE, funcionario_id TEXT REFERENCES funcionarios(id),
    status TEXT NOT NULL DEFAULT 'ABERTO' CHECK(status IN('ABERTO','FECHADO'))
  );
  CREATE TABLE IF NOT EXISTS eventos (
    id TEXT PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL, categoria TEXT NOT NULL,
    data TEXT NOT NULL, horario TEXT NOT NULL, local TEXT NOT NULL, cidade TEXT NOT NULL,
    imagem TEXT NOT NULL, capacidade_maxima INTEGER NOT NULL CHECK(capacidade_maxima>0),
    preco_centavos INTEGER NOT NULL CHECK(preco_centavos>=0),
    custo_variavel_unitario_centavos INTEGER NOT NULL DEFAULT 0 CHECK(custo_variavel_unitario_centavos>=0),
    pulseira_produto_id TEXT,
    status TEXT NOT NULL DEFAULT 'ATIVO' CHECK(status IN('ATIVO','ARQUIVADO')),
    criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS produtos_evento (
    id TEXT PRIMARY KEY, evento_id TEXT NOT NULL REFERENCES eventos(id), nome TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK(categoria IN('BEBIDA','COMIDA','MATERIAL')),
    preco_centavos INTEGER NOT NULL CHECK(preco_centavos>=0),
    quantidade_inicial INTEGER NOT NULL CHECK(quantidade_inicial>=0),
    quantidade_disponivel INTEGER NOT NULL CHECK(quantidade_disponivel>=0),
    quantidade_vendida INTEGER NOT NULL DEFAULT 0 CHECK(quantidade_vendida>=0),
    estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK(estoque_minimo>=0),
    ativo INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS vendas (
    id TEXT PRIMARY KEY, usuario_id TEXT REFERENCES usuarios(id), funcionario_id TEXT REFERENCES funcionarios(id),
    caixa_id TEXT REFERENCES caixas(id), evento_id TEXT NOT NULL REFERENCES eventos(id),
    comprador_nome TEXT NOT NULL, data_venda TEXT NOT NULL, valor_total_centavos INTEGER NOT NULL,
    forma_pagamento TEXT NOT NULL CHECK(forma_pagamento IN('DINHEIRO','PIX','CARTAO','DEMO')),
    status_pagamento TEXT NOT NULL CHECK(status_pagamento IN('CONFIRMADO_DEMO','CANCELADO','PENDENTE')),
    recebido_centavos INTEGER, troco_centavos INTEGER, origem TEXT NOT NULL CHECK(origem IN('ONLINE','CAIXA'))
  );
  CREATE TABLE IF NOT EXISTS itens_venda (
    id TEXT PRIMARY KEY, venda_id TEXT NOT NULL REFERENCES vendas(id), produto_id TEXT REFERENCES produtos_evento(id),
    tipo TEXT NOT NULL CHECK(tipo IN('INGRESSO','PRODUTO')),
    quantidade INTEGER NOT NULL CHECK(quantidade>0), preco_unitario_centavos INTEGER NOT NULL,
    subtotal_centavos INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ingressos (
    id TEXT PRIMARY KEY, venda_id TEXT NOT NULL REFERENCES vendas(id), evento_id TEXT NOT NULL REFERENCES eventos(id),
    codigo_unico TEXT NOT NULL UNIQUE, qr_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN('VALIDO','UTILIZADO','CANCELADO')),
    data_emissao TEXT NOT NULL, data_validacao TEXT, data_cancelamento TEXT
  );
  CREATE TABLE IF NOT EXISTS despesas (
    id TEXT PRIMARY KEY, evento_id TEXT NOT NULL REFERENCES eventos(id), descricao TEXT NOT NULL,
    categoria TEXT NOT NULL, valor_centavos INTEGER NOT NULL CHECK(valor_centavos>=0),
    data TEXT NOT NULL, observacao TEXT NOT NULL DEFAULT '', custo_fixo INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id TEXT PRIMARY KEY, produto_id TEXT NOT NULL REFERENCES produtos_evento(id),
    tipo_movimentacao TEXT NOT NULL, quantidade INTEGER NOT NULL,
    data TEXT NOT NULL, funcionario_id TEXT REFERENCES funcionarios(id), venda_id TEXT REFERENCES vendas(id),
    observacao TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS validacoes (
    id TEXT PRIMARY KEY, ingresso_id TEXT REFERENCES ingressos(id),
    funcionario_id TEXT REFERENCES funcionarios(id), data TEXT NOT NULL,
    resultado TEXT NOT NULL, codigo_consultado TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS movimentacoes_financeiras (
    id TEXT PRIMARY KEY, venda_id TEXT REFERENCES vendas(id), despesa_id TEXT REFERENCES despesas(id),
    evento_id TEXT NOT NULL REFERENCES eventos(id),
    tipo TEXT NOT NULL CHECK(tipo IN('VENDA','ESTORNO','DESPESA')),
    valor_centavos INTEGER NOT NULL, forma_pagamento TEXT, data TEXT NOT NULL,
    observacao TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS sessoes (
    token_hash TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK(tipo IN('CLIENTE','FUNCIONARIO')),
    ator_id TEXT NOT NULL, expira_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ingresso_evento ON ingressos(evento_id,status);
  CREATE INDEX IF NOT EXISTS idx_venda_evento ON vendas(evento_id,status_pagamento);
  CREATE INDEX IF NOT EXISTS idx_produto_evento ON produtos_evento(evento_id);
  CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_movimento_estoque ON movimentacoes_estoque(produto_id,data);
  CREATE INDEX IF NOT EXISTS idx_movimento_financeiro ON movimentacoes_financeiras(evento_id,data);
  `);
  if (!db.prepare('SELECT COUNT(*) AS n FROM eventos').get().n) {
    const insert = db.prepare(`INSERT INTO eventos (id,nome,categoria,data,horario,local,cidade,preco_centavos,capacidade_maxima,imagem,descricao,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const e of EXAMPLES) insert.run(...e,now(),now());
  }
  if (!db.prepare('SELECT COUNT(*) AS n FROM funcionarios').get().n) {
    const pass = process.env.LUMI_ADMIN_PASSWORD || 'LumiDemo2026!';
    db.prepare(`INSERT INTO funcionarios (id,nome,login,senha_hash,permissao,criado_em) VALUES (?,?,?,?,?,?)`)
      .run('staff-admin','Administrador LUMI', 'admin@lumi.demo',hashPassword(pass),'ADMIN',now());
  }
  if (!db.prepare('SELECT COUNT(*) AS n FROM caixas').get().n) {
    const stmt = db.prepare(`INSERT INTO caixas (id,identificacao,status) VALUES(?,?,'ABERTO')`);
    for (let i=1;i<=3;i++) stmt.run(`caixa-0${i}`,`Caixa 0${i}`);
  }
  if (!db.prepare('SELECT COUNT(*) AS n FROM produtos_evento').get().n) {
    const stmt = db.prepare(`INSERT INTO produtos_evento (id,evento_id,nome,categoria,preco_centavos,quantidade_inicial,quantidade_disponivel,estoque_minimo) VALUES(?,?,?,?,?,?,?,?)`);
    for (const ev of EXAMPLES) {
      for (const [suffix,name,cat,price,qty,min] of [
        ['drink','Ficha de bebida','BEBIDA',1600,280,25],
        ['food','Ficha de comida','COMIDA',2500,150,15],
        ['wrist','Pulseira do evento','MATERIAL',0,ev[8],30],
        ['printed','Fichas impressas (reserva)','MATERIAL',0,300,30]
      ]) stmt.run(`${ev[0]}-${suffix}`,ev[0],name,cat,price,qty,qty,min);
      db.prepare('UPDATE eventos SET pulseira_produto_id=? WHERE id=?').run(`${ev[0]}-wrist`,ev[0]);
    }
  }
}
function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result=work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
module.exports = { db, initialize, transaction, now, id, hashPassword, verifyPassword, EXAMPLES };
