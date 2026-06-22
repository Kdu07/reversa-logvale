-- =====================================================================
-- pg_net: requisições HTTP a partir do banco (net.http_post)
-- Necessária para o pg_cron disparar as Edge Functions warning-email e
-- photo-cleanup (ver docs/JOBS.md). A 000_schema.sql já cria pg_cron e
-- uuid-ossp; esta adiciona pg_net, que faltava.
-- =====================================================================

create extension if not exists pg_net;
