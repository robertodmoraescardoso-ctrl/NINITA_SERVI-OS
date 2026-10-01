-- ============================================================
-- MIGRAÇÃO 002 — LOCALIZAÇÕES (frente > pavimento > ambiente)
-- Villa Ninita · Acompanhamento de Serviços · Fase 2
--
-- O QUE FAZ
--   Cria duas tabelas NOVAS. Não altera nem apaga nada do que
--   já existe (servicos, config, fotos continuam intactos).
--
--   localizacoes            árvore de 3 níveis:
--                             1 = frente (Torre A, Torre BC...)
--                             2 = pavimento (Térreo, 1º pavimento...)
--                             3 = ambiente / unidade (101, 102...)
--   servico_localizacoes    liga cada serviço a uma ou mais
--                           localizações (ex.: alvenaria do 1º ao
--                           4º pavimento = 4 ligações)
--
-- COMO RODAR
--   1. Supabase > SQL Editor > New query
--   2. Cole este arquivo inteiro e clique em Run
--   3. Deve aparecer "Success. No rows returned"
--   Pode rodar de novo sem problema: nada é duplicado.
--
-- ENQUANTO NÃO RODAR
--   O site continua funcionando normalmente; só a parte de
--   localização fica desligada, com um aviso no painel.
-- ============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ------------------------------------------------------------
-- 1. Árvore de localizações
-- ------------------------------------------------------------
create table if not exists public.localizacoes (
  id           uuid primary key default gen_random_uuid(),
  pai_id       uuid references public.localizacoes(id),
  nivel        smallint not null check (nivel between 1 and 3),
  nome         text not null check (length(trim(nome)) > 0),
  ordem        integer not null default 0,
  criado_em    timestamptz not null default now(),
  excluido_em  timestamptz,            -- exclusão lógica: nunca DELETE
  -- frente não tem pai; pavimento e ambiente sempre têm
  constraint localizacoes_pai_coerente check (
    (nivel = 1 and pai_id is null) or (nivel > 1 and pai_id is not null)
  )
);

-- nome não se repete dentro do mesmo pai (entre os ativos)
create unique index if not exists localizacoes_nome_unico
  on public.localizacoes (coalesce(pai_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(nome)))
  where excluido_em is null;

create index if not exists localizacoes_pai_idx   on public.localizacoes (pai_id);
create index if not exists localizacoes_nivel_idx on public.localizacoes (nivel, ordem);

-- ------------------------------------------------------------
-- 2. Ligação serviço x localização
-- ------------------------------------------------------------
create table if not exists public.servico_localizacoes (
  servico_id      text not null references public.servicos(id) on delete cascade,
  localizacao_id  uuid not null references public.localizacoes(id),
  criado_em       timestamptz not null default now(),
  excluido_em     timestamptz,          -- ligação desfeita (exclusão lógica)
  primary key (servico_id, localizacao_id)
);

create index if not exists servico_localizacoes_loc_idx
  on public.servico_localizacoes (localizacao_id) where excluido_em is null;

-- ------------------------------------------------------------
-- 3. Acesso: só usuários logados (mesma regra das tabelas atuais)
-- ------------------------------------------------------------
alter table public.localizacoes         enable row level security;
alter table public.servico_localizacoes enable row level security;

drop policy if exists "logados leem localizacoes"     on public.localizacoes;
drop policy if exists "logados gravam localizacoes"   on public.localizacoes;
drop policy if exists "logados alteram localizacoes"  on public.localizacoes;
create policy "logados leem localizacoes"    on public.localizacoes for select to authenticated using (true);
create policy "logados gravam localizacoes"  on public.localizacoes for insert to authenticated with check (true);
create policy "logados alteram localizacoes" on public.localizacoes for update to authenticated using (true) with check (true);

drop policy if exists "logados leem ligacoes"    on public.servico_localizacoes;
drop policy if exists "logados gravam ligacoes"  on public.servico_localizacoes;
drop policy if exists "logados alteram ligacoes" on public.servico_localizacoes;
create policy "logados leem ligacoes"    on public.servico_localizacoes for select to authenticated using (true);
create policy "logados gravam ligacoes"  on public.servico_localizacoes for insert to authenticated with check (true);
create policy "logados alteram ligacoes" on public.servico_localizacoes for update to authenticated using (true) with check (true);
-- sem política de DELETE de propósito: exclusão é sempre lógica (excluido_em)

-- ------------------------------------------------------------
-- 4. As seis frentes da obra (só cria se ainda não existirem)
--    Pavimentos e unidades são cadastrados pela tela "Locais".
-- ------------------------------------------------------------
insert into public.localizacoes (nivel, nome, ordem)
select 1, f.nome, f.ordem
from (values ('Torre A', 1), ('Torre BC', 2), ('Periferia', 3),
             ('Anexos', 4), ('IEP', 5), ('Guarita', 6)) as f(nome, ordem)
where not exists (
  select 1 from public.localizacoes l
  where l.nivel = 1 and l.excluido_em is null and lower(l.nome) = lower(f.nome)
);
