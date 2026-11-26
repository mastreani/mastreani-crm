# Mastreani Representações — CRM

CRM web para organizar pontos de contato, prospecção e recorrência. O quadro admite vários cartões para o mesmo cliente e não gerencia oportunidades ou valores.

## O que está incluído

- Clientes, perfis, contatos e empresas representadas.
- Kanban com colunas personalizáveis e reordenáveis; “Agendar” e “Concluído” permanecem fixas.
- Ao concluir um cartão, ele passa para o topo de “Concluído” e um novo cartão do cliente entra no fim de “Agendar”. É possível criar cartões adicionais para o mesmo cliente.
- Busca no Kanban por dados do cliente, anotações do histórico, datas em formatos usuais e etapa.
- Contato rápido no cartão com data, tipo e anotação; histórico editável.
- Backup e restauração em JSON.
- Sincronização do estado do CRM por conta Supabase e preparação da integração de login Google/Agenda Google.

## Estado da integração Google

O código e a função de servidor para Google Calendar estão incluídos, mas a integração **não está ativa até configurar seu projeto Supabase e as credenciais OAuth do Google**. Não coloque segredos em `config.js` nem os envie pelo chat. Sem esse setup, o CRM continua no armazenamento local do navegador; os eventos de Agenda não são criados.

Quando ativa, cada contato registrado cria um evento na Agenda principal do Google, terminando no horário de conclusão e com início 30 minutos antes. O evento contém o cliente, tipo e anotação; não exibe a hora no cartão CRM. Editar o contato ou os dados do cliente atualiza o evento vinculado, e apagar o cliente tenta remover seus eventos. Cartões adicionais e alterações de coluna não criam eventos na Agenda.

## Configuração necessária para hospedagem própria

### 1. Banco Supabase

1. Crie/abra seu projeto Supabase e rode no SQL Editor, em ordem:
   - `supabase/migrations/202611260001_mastreani_crm_state.sql`
   - `supabase/migrations/202611260002_google_calendar.sql`
2. Em Authentication → URL Configuration, configure a URL HTTPS do seu CRM como Site URL e adicione-a às Redirect URLs.
3. Em Project Settings → API, copie a Project URL e a chave publicável (`sb_publishable_...`) ou `anon` legada. Coloque apenas esses valores públicos em `config.js`; nunca use a chave service role no navegador.

### 2. Login Google e Calendar API

1. No Google Cloud Console, selecione/crie um projeto e habilite **Google Calendar API**.
2. Configure a tela de consentimento OAuth para sua conta/uso pretendido. Crie um cliente OAuth do tipo **Web application**.
3. Na lista de URIs de redirecionamento autorizados do cliente Google, adicione o callback OAuth do seu projeto Supabase: `https://<PROJECT-REF>.supabase.co/auth/v1/callback`.
4. No Supabase, abra Authentication → Providers → Google e habilite o provedor com o Client ID e Client Secret do Google. Configure o consentimento para permitir o escopo `https://www.googleapis.com/auth/calendar.events`.
5. Guarde o Client ID e Client Secret diretamente como secrets do projeto Supabase, com os nomes exatos `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. **Não os escreva no site nem os envie pelo chat.**

### 3. Publicar a Edge Function

Com a Supabase CLI autenticada e vinculada ao projeto, a partir desta pasta:

```sh
supabase functions deploy mastreani-google-calendar --no-verify-jwt
```

A função valida o usuário chamando `auth.getUser()` e mantém o refresh token Google no servidor, em tabela com RLS e acesso exclusivo ao service role. Não retire essas proteções. O arquivo `supabase/config.toml` registra `verify_jwt = false` porque a função faz a validação do JWT no próprio código.

### 4. Configuração final e teste

1. Preencha `config.js` com Project URL e chave publicável do seu projeto.
2. Hospede a pasta inteira via HTTPS, sem remover `vendor/`, `fonts/` nem `supabase/`.
3. Abra **Sincronização e acesso**, entre com Google e aceite a permissão da Agenda. Use a mesma conta em todos os dispositivos.
4. Teste com um contato fictício. Confirme o evento na Agenda Google, edite a observação/data e confirme que o evento correspondente foi atualizado.
5. Guarde backups JSON regularmente, principalmente antes de importar dados ou mexer em aparelhos diferentes ao mesmo tempo.

## Importação de registros locais já existentes

Os dados do navegador não são enviados automaticamente para uma nova conta se ela já tiver registros diferentes. Faça backup JSON antes de autenticar/configurar e confira qual cópia será mantida. O armazenamento local funciona por navegador/dispositivo; após login configurado, o banco Supabase passa a ser a fonte sincronizada.

## Privacidade

A página pública contém apenas código e credenciais públicas do Supabase. Os registros do CRM são privados por RLS por conta; refresh tokens Google ficam exclusivamente no servidor. Evite anotações com dados pessoais sensíveis que não sejam necessários ao relacionamento comercial.
