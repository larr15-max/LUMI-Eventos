# LUMI Eventos 2.0 — gestão, caixa e ingressos em rede local

Continuação do **site LUMI original**, mantendo a identidade visual marrom/branco, o logotipo fornecido, as artes dos 6 eventos, a página inicial, cadastro, login, catálogo, compra, ingressos, administração e leitor de QR. Foram acrescentados **Caixa de Vendas, Estoque e Capacidade, Financeiro, Equipe e Caixas**, além de um servidor central com dados compartilhados.

**Projeto escolar demonstrativo, NÃO plataforma de cobrança real.** PIX e cartão não são cobrados; dinheiro serve apenas para registo e cálculo de troco. Não use CPF, telefone ou senhas reais. Não exponha esta instalação à internet pública.

## 1. Requisitos e instalação no VS Code

- **Node.js 22.13 ou superior** (a base usa `node:sqlite`, incluído no Node 22.13+; o aviso `ExperimentalWarning: SQLite` é esperado).
- **NPM**, incluído com Node.js.
- Visual Studio Code e um navegador atualizado.
- Internet para executar `npm install` uma vez (Express, Socket.IO, QR Code, leitor e PDF). As bibliotecas de QR e PDF passam a ser servidas pelo notebook; Google Fonts é opcional (há fontes alternativas locais).

1. Descompacte o ZIP. Abra a pasta **`lumi-site`** no VS Code (Arquivo → Abrir Pasta).
2. Abra Terminal → Novo Terminal na pasta `lumi-site`.
3. Execute:

   ```bash
   npm install
   npm start
   ```

4. No Windows, alternativamente, dê dois cliques em **`INICIAR-LUMI.bat`** para instalar dependências (se necessário) e iniciar o servidor. Abra **http://localhost:3000**. Para desenvolvimento com reinício automático, use `npm run dev`.
5. Na primeira inicialização são criados `data/lumi.sqlite`, seis eventos, produtos de demonstração, três caixas e um administrador.

> **IMPORTANTE:** Diferentemente da v1, **não utilize a extensão Live Server** para executar este sistema: ela só serve arquivos estáticos e não executa a API, o SQLite nem o Socket.IO. O próprio Express fornece os HTML, CSS e JavaScript em `localhost:3000`.

### Login inicial de demonstração

- Usuário administrador: **`admin@lumi.demo`**
- Senha inicial: **`LumiDemo2026!`**

Essas credenciais só existem para apresentações escolares. Para escolher outra senha **antes da primeira inicialização**, no PowerShell:

```powershell
$env:LUMI_ADMIN_PASSWORD="NovaSenhaForteSomenteParaTeste!"
npm start
```

A senha é guardada no SQLite com **scrypt e salt aleatório**, e sessões usam cookies HttpOnly. Se já inicializou a base, mudar a variável não altera a senha existente: altere-a em **Equipe e Caixas** como administrador. Não use este login padrão fora de uma rede de demonstração.

## 2. Acesso por vários dispositivos (rede Wi-Fi / LAN)

1. Ligue notebook servidor, caixas e celulares à **mesma rede local**, sem isolamento entre dispositivos.
2. No Windows do notebook servidor, abra o terminal e execute `ipconfig`; procure o **Endereço IPv4** (ex.: `192.168.1.35`).
3. Com o servidor ativo, acesse nos outros dispositivos **`http://192.168.1.35:3000`** (troque pelo seu IP). O terminal também lista os IPs detectados.
4. Autorize a porta **3000/TCP** no firewall **somente para a rede privada**. Evite Wi-Fi de convidados com isolamento de clientes.
5. Cada funcionário faz login em seu próprio dispositivo e seleciona um caixa. Todos usam o **mesmo `data/lumi.sqlite` do notebook servidor**.
6. Socket.IO envia avisos de atualização a todos. Há uma atualização adicional por consulta a cada ~20 s, caso a conexão WebSocket caia.

**Não copie o banco SQLite para cada máquina.** Execute o servidor em **um único notebook**; os clientes acessam esse servidor pelo navegador. Não abra `index.html` por `file://`.

### Câmera de QR no celular: HTTPS é essencial

**Em celulares remotos, `http://IP:3000` geralmente NÃO pode usar a câmera** porque o navegador exige *secure context*. A leitura **manual do código inteiro** e o envio de uma **imagem** continuam disponíveis.

Para câmera via LAN, configure um certificado **HTTPS confiável para o IP real do servidor**. O projeto aceita arquivos `certs/cert.pem` e `certs/key.pem`, e, se ambos existirem, abre também `https://IP:3443`.

Opção recomendada em laboratório com `mkcert`:

```bash
# Instale mkcert no computador servidor e configure confiança da CA local.
mkcert -install
mkdir certs
# Substitua 192.168.1.35 pelo endereço real do notebook
mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 192.168.1.35
npm start
```

Para que a câmera funcione nos celulares, a **CA do mkcert precisa ser instalada e confiável em cada dispositivo**, segundo as políticas do navegador/sistema. Só aceitar o aviso de certificado no navegador pode não ser suficiente. O comando `npm run cert` cria um certificado autoassinado de teste, mas **não o torna automaticamente confiável**. Caso não seja possível confiar na CA nos celulares da escola, faça a demonstração da câmera no `localhost` do notebook e use leitura por imagem/código nos outros dispositivos.

## 3. Arquitetura

```text
lumi-site/
├── index.html                # Página inicial ORIGINAL preservada
├── cadastro.html             # Cadastro de clientes (API)
├── login.html                # Login de clientes e funcionários (API)
├── eventos.html              # Filtros, carrinho online demonstrativo
├── meus-ingressos.html       # QR exclusivo, impressão e PDF
├── admin.html                # Eventos, vendas, compradores e ingressos
├── validar.html              # Leitura e uso único de QR no servidor
├── caixa.html                # CAIXA RÁPIDO: ingressos + bebida + comida
├── estoque.html              # Produtos, movimentações e pulseiras
├── financeiro.html           # Receitas, despesas, PE, lucro e margens
├── equipe.html               # Funcionários, permissões e caixas
├── style.css                 # Estilos v1 preservados + módulos LUMI 2
├── script.js                 # Vanilla JS, interface e API fetch
├── server.js                 # Express, cookies de sessão e Socket.IO
├── service.js                # Regras e transações de negócio
├── database.js               # Schema SQLite, FK, índices e dados iniciais
├── package.json              # Dependências e comandos npm
├── scripts/make-cert.js      # Gerador opcional de HTTPS de laboratório
├── tests/lumi.test.js        # Testes e concorrência entre processos
├── assets/                   # Logotipo original + SVGs originais
├── certs/                    # Certificados locais (não incluídos no ZIP)
└── data/lumi.sqlite          # Criado na execução, não incluído no ZIP
```

O fluxo é **navegador (HTML/CSS/JS) → API Express → SQLite**. Socket.IO notifica os navegadores conectados quando dados mudam. A fonte da verdade é **sempre o SQLite**, não o `localStorage` de cada computador.

### Entidades do banco

`usuarios`, `funcionarios`, `caixas`, `eventos`, `produtos_evento`, `vendas`, `itens_venda`, `ingressos`, `despesas`, `movimentacoes_estoque`, `movimentacoes_financeiras`, `validacoes` e `sessoes`.

Todas possuem relacionamentos/chaves estrangeiras pertinentes; dados financeiros usam **centavos inteiros**, não `float`. O banco usa `WAL`, `busy_timeout` e transações `BEGIN IMMEDIATE` para que operações concorrentes não superlotem um evento ou consumam o mesmo código duas vezes.

## 4. Funções por perfil

| Perfil | Acesso |
|---|---|
| Cliente | Cadastro, login, eventos, compras demonstrativas, seus QR Codes, impressão e download PDF |
| Administrador (`ADMIN`) | Todos os módulos; criar/editar/arquivar eventos, estoque, caixa, equipe, despesas, vendas, cancelamentos e validador |
| Funcionário de caixa (`CAIXA`) | Caixa rápido e recibo com QR/PDF, sem acesso financeiro ou cadastro de funcionários |
| Validador (`VALIDADOR`) | Conferir e consumir ingressos por câmera, imagem ou código completo; sem acesso a vendas/finanças |

Um administrador cria os demais logins em **Equipe e Caixas**. Cada venda presencial registra `funcionario_id`, `caixa_id`, data/hora, itens, valor e método de pagamento. O caixa permite selecionar **Ingressos / Fichas de Bebida / Fichas de Comida**, adicionar/remover quantidades, acompanhar subtotais, cancelar o carrinho antes de confirmar e calcular troco em dinheiro.

## 5. Como testar cada função — roteiro sugerido

1. **Login admin:** acesse `/login.html` com as credenciais demo, e abra `/admin.html`. Verifique seis eventos, seus limites e as tabelas.
2. **Criar funcionário:** em `/equipe.html`, crie um operador `CAIXA` e outro `VALIDADOR` com senhas fictícias. Verifique que os perfis não conseguem entrar no Financeiro.
3. **Configurar eventos:** em `/admin.html`, edite preços, capacidade e custo variável unitário. A capacidade não pode ser menor que os ingressos emitidos. "Arquivar" retira o evento da venda mas conserva históricos.
4. **Caixa rápido:** em outro navegador/aba/dispositivo, entre como operador. Abra `/caixa.html`, escolha o evento e o caixa. Adicione 3 ingressos, 2 fichas de bebida e 1 ficha de comida. Confira subtotais e total. Selecione **Dinheiro**, informe o recebido e confira o troco; confirme.
5. **QR individuais:** confira o comprovante e os 3 códigos distintos. Use **Imprimir** ou **Baixar PDF** em cada ingresso. O QR contém apenas um token `LUMI2.` + bytes aleatórios seguros, sem CPF, nome ou e-mail.
6. **Cliente online:** em `/cadastro.html`, crie uma conta com dados **fictícios** e CPF de teste válido. Em `/eventos.html`, compre um ou mais ingressos demonstrativos. Em `/meus-ingressos.html`, veja os códigos exclusivos.
7. **Validação:** como `VALIDADOR`, abra `/validar.html`. Leia um QR com câmera (HTTPS) ou use a imagem ou o código completo. Confira status e clique em **Autorizar e marcar UTILIZADO**. Consulte novamente: a **segunda entrada é bloqueada**. Código adulterado ou inexistente também é recusado.
8. **Estoque:** no admin, em `/estoque.html`, confira diminuição automática de fichas e pulseiras, histórico e aviso de estoque mínimo. Experimente ajustar estoque com justificativa. Vincule outro produto MATERIAL ao evento, se quiser.
9. **Capacidade:** ajuste um evento para poucos lugares, faça a venda até lotar e tente emitir além do limite. O servidor deve rejeitar a venda **sem gravar nem cobrar nada**.
10. **Financeiro:** abra `/financeiro.html`, filtre evento, verifique receitas por método, despesas, resultado e margem. Registre uma despesa fixa e altere o custo variável unitário para verificar o ponto de equilíbrio. Cancelamentos retiram a venda da receita ativa.
11. **LAN:** abra o mesmo evento em dois dispositivos e realize uma compra em um deles. O outro deve atualizar a quantidade via Socket.IO. Faça o teste de duas compras perto da capacidade máxima.
12. **Auditoria:** em `/equipe.html`, confira o histórico de validações; em `/admin.html`, o funcionário e caixa de cada venda.

Para executar testes automáticos de regras e concorrência:

```bash
npm test
```

O teste inclui **duas vendas em processos Node diferentes disputando as últimas vagas**: uma é aceita, a outra bloqueada, e a capacidade não é excedida.

## 6. Regras importantes de negócio

- **Ingressos**: cada unidade de uma venda recebe token aleatório de 256 bits exclusivo; o token completo deve existir na base. São mantidos status `VALIDO`, `UTILIZADO`, `CANCELADO`.
- **Validação**: o servidor confere o token completo e muda `VALIDO → UTILIZADO` dentro de uma transação atômica; validações repetidas são registradas no histórico.
- **Lotação**: conta ingressos não cancelados e, se o evento possuir material vinculado, o estoque restante de pulseiras. A emissão e descontos acontecem na mesma transação.
- **Estoque**: fichas e pulseiras são diminuídas pelo servidor; cancelamento integral de venda antes do uso dos ingressos devolve o estoque. Ingressos `UTILIZADO` não podem ser cancelados.
- **Cancelamento parcial**: o administrador pode cancelar ingresso ainda válido; o valor desse ingresso é estornado da receita demonstrativa da venda, a capacidade e a pulseira são devolvidas. A venda continua ativa se houver outros itens.
- **Financeiro**: a receita demonstrativa total agrega **vendas ativas** com status `CONFIRMADO_DEMO`. Vendas canceladas/pendentes não contam.
- **Custos totais**: despesas cadastradas + estimativa de custo variável unitário multiplicado pelos ingressos não cancelados. Não cadastre novamente nas despesas valores que já considerou no custo variável unitário para evitar dupla contagem.
- **Ponto de equilíbrio**: `teto(Custos fixos / (Preço unitário de ingresso − Custo variável unitário))`. Se o denominador for zero/negativo, o sistema indica inviável. Ignora vendas de fichas no cálculo unitário de ingressos.
- **Lucro/prejuízo**: receita − custos totais. **Margem**: `(Lucro / Receita) × 100` (indefinida com receita zero).

## 7. Limitações e segurança (obrigatório ler)

Este sistema **não é adequado para vender ingressos de verdade**, pois não possui provedor de pagamento, conciliação bancária, emissão fiscal, recuperação de senhas, antifraude industrial, políticas completas de privacidade/LGPD, auditoria imutável nem infraestrutura de produção.

As senhas são armazenadas como hashes scrypt no servidor e não em texto puro. Porém, o **HTTP na LAN não cifra senhas em trânsito**: use HTTPS confiável, dados fictícios, uma rede isolada e uma senha inicial personalizada. Sessões são cookies HttpOnly com expiração; acesso é verificado no servidor para todas as rotas privilegiadas.

As bibliotecas **QRCode.js**, **html5-qrcode** e **jsPDF** são instaladas via NPM e servidas localmente em `/vendor/`, portanto os dispositivos da LAN **não precisam de internet para QR/PDF após `npm install`**. As fontes Google são opcionais e usam CDNs; o CSS possui fontes alternativas. A câmera remota continua a exigir HTTPS confiável.

O banco da v1 em `localStorage` **não é migrado automaticamente**, pois as credenciais e relações eram exclusivas daquele navegador. O projeto v2 **não apaga** dados antigos do navegador, apenas passa a usar a base de dados central da nova versão. Cadastre novos usuários fictícios no v2.

Faça backup da **pasta `data`**, com o servidor parado, caso deseje preservar registros entre instalações. O ZIP de entrega não contém pessoas, compras nem senhas armazenadas na base. Para reiniciar a demonstração, pare o servidor e remova `data/lumi.sqlite` (o banco será criado novamente na próxima execução).

---

**LUMI Eventos — continuação do protótipo escolar.** Front-end Vanilla JS; servidor Express; SQLite compartilhado; Socket.IO para atualizações em rede local.
