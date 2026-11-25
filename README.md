# LUMI Eventos — edição simplificada para a escola

**Esta é uma continuação do projeto LUMI 2.0, não um site novo.** Conserva o visual marrom/bege e as funcionalidades de vendas, QR Code, estoque, financeiro, funcionários e rede local. O que mudou foi a **forma de iniciar e explicar o projeto**: é possível executar pelo botão **Iniciar sem Depuração** do Visual Studio Code, sem decorar comandos.

## 1. Como abrir (sem escrever comandos)

**Na primeira vez:**
1. Instale o **Node.js LTS** em https://nodejs.org (só uma vez). A LUMI requer a versão **22.13 ou superior**. O npm vem incluído; não o instale em separado.
2. Extraia o ZIP. No VS Code, escolha **Ficheiro / Arquivo → Abrir Pasta** e selecione a pasta **`lumi-site`** (a pasta que contém `index.html` e `server.js`). **Não abra apenas um ficheiro isolado.**
3. No VS Code, abra **Executar → Iniciar sem Depuração**, ou pressione **Ctrl+F5**. Se aparecer uma escolha, selecione **LUMI — Iniciar sem depuração**.
4. Na primeira execução, o VS Code descarrega as bibliotecas automaticamente, pela internet. Depois, o navegador deve abrir em **http://localhost:3000**.
5. Deixe o VS Code com o servidor em execução enquanto utiliza a LUMI. Para parar, use o botão **Parar** do VS Code.

> Não é preciso escrever `npm install` nem `npm start`: o VS Code executa esses passos automaticamente por meio dos ficheiros `.vscode/launch.json`, `.vscode/tasks.json` e `scripts/preparar.js`.

**Se o navegador não abrir sozinho:** digite **http://localhost:3000** no navegador. **Se o VS Code disser que não encontra `node`:** instale Node.js, feche completamente o VS Code e abra-o novamente. **Se a porta 3000 já estiver ocupada:** feche o servidor LUMI anterior antes de iniciar outro.

**Outra opção (Windows):** dê dois cliques no ficheiro **`INICIAR-LUMI.bat`** e abra **http://localhost:3000**. O ficheiro também instala as dependências automaticamente na primeira utilização.

**Não utilize o Live Server** para esta versão: ele abre HTML, mas não executa a base de dados nem o servidor da rede local.

## 2. Entrar no sistema

- Site dos clientes: **http://localhost:3000**
- Administrador: **admin@lumi.demo**
- Senha inicial para demonstração: **LumiDemo2026!**
- Páginas principais: `eventos.html`, `meus-ingressos.html`, `admin.html`, `caixa.html`, `validar.html`, `estoque.html`, `financeiro.html`, `equipe.html`.

Use apenas dados fictícios, inclusive CPF, nome e telefone. Esta instalação é para apresentação escolar.

## 3. O que cada ficheiro faz (explicação simples)

| Ficheiro | Explicação |
|---|---|
| `index.html` e restantes `.html` | São as páginas que aparecem no navegador. |
| `style.css` | Define as cores, letras, botões e adapta o site ao telemóvel. |
| `script.js` | Faz os botões, formulários e pedidos ao servidor funcionarem. |
| `server.js` | Recebe os pedidos dos navegadores e chama as regras do sistema. |
| `service.js` | Guarda as regras de negócio: comprar, validar, cancelar e gerir estoque. |
| `database.js` | Cria e consulta a base de dados SQLite. |
| `data/lumi.sqlite` | Base de dados criada automaticamente na primeira execução (não vai no ZIP). |
| `.vscode/` | Diz ao VS Code como iniciar a LUMI sem digitar comandos. |
| `scripts/preparar.js` | Instala automaticamente o que faltar na primeira execução. |

**Exemplo para explicar à professora:** o cliente clica em **Comprar** → `script.js` envia o pedido ao `server.js` → `service.js` verifica as vagas → `database.js` grava a compra no SQLite → o navegador recebe a confirmação e mostra um QR Code para cada ingresso.

## 4. Como apresentar as funcionalidades

1. **Eventos:** abra o catálogo e experimente a pesquisa e os filtros.
2. **Cadastro e login:** crie um cliente com dados fictícios e entre na conta.
3. **Compra:** compre 3 ingressos de demonstração e confirme que aparecem 3 QR Codes diferentes.
4. **Caixa:** entre com uma conta de caixa criada pelo administrador. Adicione ingressos e fichas de bebida/comida; teste **Dinheiro** e o cálculo de troco; PIX e cartão são **simulações**.
5. **Estoque:** observe os ingressos disponíveis e a quantidade de produtos diminuírem após a venda.
6. **Validação:** entre como validador e leia um QR pela câmara, por imagem ou pelo código completo. Após usar o ingresso, o mesmo código deve ser recusado.
7. **Financeiro:** registe uma despesa e veja receitas, custos, lucro, margem e ponto de equilíbrio.
8. **Equipe:** crie funcionários com os perfis de administrador, caixa e validador e verifique as permissões.
9. **Rede local:** no notebook do servidor, execute `ipconfig` (ou consulte as informações de rede do Windows) para descobrir o IP local. Nos outros dispositivos ligados ao mesmo Wi-Fi, abra `http://IP-DO-NOTEBOOK:3000`. Não instale o projeto nos outros aparelhos.
10. **Atualização entre caixas:** abra dois navegadores em dispositivos diferentes, faça uma venda num deles e veja o estoque atualizado no outro.

**Nota importante para a câmara:** em outros telemóveis ligados por `http://IP:3000`, os navegadores normalmente exigem **HTTPS confiável** para autorizar a câmara. A validação por imagem ou digitação do código continua disponível. Em `localhost` a câmara é normalmente permitida. Leia as instruções HTTPS na documentação técnica se precisar de câmara via Wi-Fi.

## 5. O que o enunciado realmente exige

O enunciado inicial pedia apenas **HTML + CSS + JavaScript**, com `localStorage`. Nessa versão era possível abrir o site de forma mais simples, mas **os dados de um navegador não eram partilhados pelos outros**.

O enunciado **atualizado** passou a exigir **Node.js + Express + SQLite + Socket.IO** e acesso por vários dispositivos na rede. Isso requer executar um servidor, embora o aluno **não precise de aprender comandos npm para o iniciar**. A solução mantém os requisitos e automatiza a configuração.

## 6. Limitações e segurança

- Todas as vendas, PIX e cartões são **demonstrações**: não há cobranças reais.
- O SQLite guarda dados **no notebook que executa o servidor**. Os outros aparelhos só consultam esse servidor pela rede.
- Senhas de utilizadores criados são protegidas por hash; mesmo assim, o projeto não deve ser publicado na internet nem utilizado com dados reais.
- Para câmera via Wi-Fi em celulares, configure HTTPS confiável. Consulte `DOCUMENTACAO-TECNICA.md`.
- Não partilhe os ficheiros internos da base de dados nem as senhas de demonstração fora da escola.

## 7. Documentação para quem quiser aprofundar

- `DOCUMENTACAO-TECNICA.md`: arquitetura, testes, LAN, certificados HTTPS, regras de negócio e utilização avançada.
- `GUIA-PARA-APRESENTAR.md`: guião curto com o que dizer na apresentação.
- `tests/lumi.test.js`: testes automáticos das regras de compra e validação.

> **Resumo:** para utilizar a LUMI nesta versão, basta instalar Node.js **uma vez**, abrir a pasta no VS Code e clicar **Iniciar sem Depuração**. É o caminho mais simples possível sem retirar as funcionalidades obrigatórias de servidor e rede.
