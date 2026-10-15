// paginasLegais.ts - Páginas de Termos de Serviço e Política de Privacidade,
// servidas pela própria Edge Function (GET), pra atender à exigência do
// Discord Developer Portal (campos "URL dos termos de serviço" e
// "URL da política de privacidade" da aplicação).

function pagina(titulo: string, corpoHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} — Big Purple - Conteúdo</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #2b2d31; background: #f4f4f5; }
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.2rem; margin-top: 1.8rem; }
  code { background: #e3e5e8; padding: 2px 6px; border-radius: 4px; }
  a { color: #5865f2; }
</style>
</head>
<body>
${corpoHtml}
<hr>
<p><small>Última atualização: agosto de 2026.</small></p>
</body>
</html>`;
}

export const PAGINA_TERMOS = pagina(
  "Termos de Serviço",
  `
<h1>Termos de Serviço — Big Purple - Conteúdo</h1>
<p>Este bot é uma ferramenta de organização interna do clã, usada pra criar e gerenciar
painéis de inscrição em conteúdos (PTs) do jogo Albion Online dentro de servidores do Discord.</p>

<h2>O que o bot faz</h2>
<ul>
  <li>Cria, via comando <code>/conteudo</code>, um assistente guiado que gera um painel público de inscrição (atividade, ponto de encontro, zona, requisitos e vagas por função).</li>
  <li>Deixa qualquer membro do servidor se inscrever, desistir ou marcar bônus (Mana/Runa/Reset/Guardião) numa vaga através de botões e menus.</li>
  <li>Permite que o criador do painel remova jogadores da lista.</li>
</ul>

<h2>Uso aceitável</h2>
<p>O bot é fornecido "como está", de forma gratuita, pra uso dentro dos servidores em que for
adicionado. Não deve ser usado pra fins ilegais, abusivos ou que violem os
<a href="https://discord.com/terms" target="_blank" rel="noopener">Termos de Serviço do Discord</a>.</p>

<h2>Disponibilidade</h2>
<p>Por ser um projeto mantido por voluntários do clã, não há garantia de disponibilidade
contínua (uptime). O serviço pode ser alterado, pausado ou descontinuado a qualquer momento,
sem aviso prévio.</p>

<h2>Contato</h2>
<p>Dúvidas sobre estes termos podem ser enviadas diretamente à liderança do clã dentro do
servidor do Discord onde o bot está instalado.</p>
`,
);

export const PAGINA_PRIVACIDADE = pagina(
  "Política de Privacidade",
  `
<h1>Política de Privacidade — Big Purple - Conteúdo</h1>
<p>Esta página explica quais dados o bot acessa e como eles são usados.</p>

<h2>Dados que o bot acessa</h2>
<ul>
  <li><strong>ID do Discord</strong> de quem usa os comandos e interage com os painéis (necessário pra saber quem clicou em quê).</li>
  <li><strong>ID do servidor e do canal</strong> onde o painel é criado.</li>
  <li><strong>Apelido/nome de exibição</strong> no servidor, usado só pra montar a lista de participantes de forma legível.</li>
  <li><strong>Conteúdo digitado</strong> no formulário opcional de título da PT.</li>
</ul>
<p>O bot <strong>não lê</strong> o conteúdo de mensagens comuns do servidor — ele só recebe as
interações que você faz diretamente com ele (comandos, cliques em botão, seleções de menu).</p>

<h2>Onde os dados ficam</h2>
<p>Enquanto uma PT está sendo montada (Passo 1 a 3), o progresso fica guardado temporariamente
num banco de dados (Supabase), associado ao seu ID do Discord. Esse registro é apagado
automaticamente assim que o painel final é gerado. Depois disso, a única informação que
permanece visível é o próprio painel publicado no canal do Discord (a mensagem em si), que
segue as regras normais de retenção do Discord.</p>

<h2>Compartilhamento com terceiros</h2>
<p>Nenhum dado é vendido, alugado ou compartilhado com terceiros. Os dados descritos acima só
são usados pelo próprio bot, pra ele funcionar.</p>

<h2>Remoção de dados</h2>
<p>Pra pedir a remoção de algum dado associado ao seu ID do Discord, entre em contato com a
liderança do clã no servidor onde o bot está instalado.</p>
`,
);
