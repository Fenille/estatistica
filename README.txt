ANÁLISE CRIMINAL • 2ª CIA — V5 FIREBASE

Banco configurado:
https://criminal-76994-default-rtdb.firebaseio.com
Caminho utilizado: /criminal2cia/state

COMO FUNCIONA
- Ao abrir, o sistema busca os dados no Firebase Realtime Database.
- Se o caminho estiver vazio, a base inicial da planilha é enviada automaticamente.
- Cada inclusão, alteração ou exclusão é salva no navegador e sincronizada com o Firebase.
- Ao voltar para a guia, o sistema busca novamente a versão mais recente do Firebase.
- A cópia local funciona como contingência caso a internet ou as regras do Firebase bloqueiem o acesso.

IMPORTANTE SOBRE REGRAS
O sistema precisa de permissão de leitura e escrita no caminho /criminal2cia. Para teste, você pode usar as regras de firebase-rules-test.json. Elas são abertas e NÃO são recomendadas para produção.
Para a versão definitiva, o ideal é ativar autenticação (Google ou login próprio) e restringir as regras aos usuários autorizados.


CONTROLE DE EDIÇÃO (V7)
- Consulta dos dashboards permanece livre.
- Alterações exigem login de edição durante a sessão do navegador.
- Login configurado: 140965
- Senha configurada: 140965
- O botão no topo permite entrar/sair do modo edição.
- Importante: esta proteção é feita no front-end. Para segurança forte contra acesso direto ao Firebase, use Firebase Authentication e regras autenticadas.
