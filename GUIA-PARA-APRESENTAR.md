# LUMI Eventos — guião simples para apresentar à turma

## O que fizemos
Criámos um site para consultar eventos, comprar ingressos de demonstração e trabalhar com caixa, estoque e financeiro. Mantivemos o design LUMI (marrom, bege e branco).

## Como explicar os ficheiros
- **HTML** = páginas e formulários.
- **CSS** = aparência do site.
- **JavaScript** = interatividade e pedidos ao servidor.
- **Node.js/Express** = computador principal que atende os pedidos.
- **SQLite** = ficheiro onde ficam as informações de todos os dispositivos.
- **Socket.IO** = avisa os outros navegadores quando alguma coisa muda.

## História de uma compra
1. O funcionário seleciona um ingresso e pode adicionar fichas de bebida ou comida.
2. Escolhe pagamento demonstrativo (dinheiro, PIX ou cartão).
3. O servidor verifica se ainda há vagas ou produtos disponíveis.
4. A venda e os itens são gravados no banco SQLite.
5. Cada ingresso recebe um código exclusivo, convertido num QR Code.
6. Um funcionário lê o QR Code e o servidor altera o estado do ingresso para **UTILIZADO**.
7. O mesmo QR Code não permite entrar duas vezes.

## Por que precisamos de um servidor?
No projeto antigo, o navegador guardava os dados só naquele computador (`localStorage`). Agora, vários caixas partilham o mesmo banco de dados. Isso só funciona com o servidor ligado.

## Como iniciar na escola
Instalar Node.js uma vez → abrir a pasta `lumi-site` no VS Code → **Ctrl+F5** → navegador em `http://localhost:3000`. O VS Code prepara as bibliotecas automaticamente na primeira vez.

## O que é uma demonstração?
Não recebemos dinheiro real com PIX ou cartão. Os valores servem para treinar registos e relatórios. Não usamos dados pessoais reais.

## Dicas para a apresentação
Tenha uma conta de administrador e uma conta de caixa criadas com antecedência. Mostre um evento, a venda de dois ingressos, o estoque a diminuir, os dois QR Codes diferentes e uma leitura bem-sucedida seguida de uma rejeição ao repetir o código. Termine mostrando a receita e uma despesa no Financeiro.
