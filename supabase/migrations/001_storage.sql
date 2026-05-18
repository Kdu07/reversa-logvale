-- =====================================================================
-- STORAGE: buckets + policies
-- Execute no SQL Editor do Supabase Dashboard (ou via supabase db push)
-- =====================================================================

-- Criar buckets privados (sem conflito se já existirem)
insert into storage.buckets (id, name, public)
values
  ('box-photos',   'box-photos',   false),
  ('item-photos',  'item-photos',  false),
  ('invoice-xmls', 'invoice-xmls', false)
on conflict (id) do nothing;

-- =====================================================================
-- box-photos
-- =====================================================================
create policy "operators insert box-photos" on storage.objects
  for insert with check (
    bucket_id = 'box-photos'
    and (public.is_operator() or public.is_manager())
  );

create policy "authenticated read box-photos" on storage.objects
  for select using (
    bucket_id = 'box-photos'
    and auth.uid() is not null
  );

create policy "managers delete box-photos" on storage.objects
  for delete using (
    bucket_id = 'box-photos'
    and public.is_manager()
  );

-- =====================================================================
-- item-photos
-- =====================================================================
create policy "operators insert item-photos" on storage.objects
  for insert with check (
    bucket_id = 'item-photos'
    and (public.is_operator() or public.is_manager())
  );

create policy "authenticated read item-photos" on storage.objects
  for select using (
    bucket_id = 'item-photos'
    and auth.uid() is not null
  );

create policy "managers delete item-photos" on storage.objects
  for delete using (
    bucket_id = 'item-photos'
    and public.is_manager()
  );

-- =====================================================================
-- invoice-xmls
-- Operadores/managers gravam XMLs originais de NF
-- Clientes gravam XMLs de devolução
-- =====================================================================
create policy "operators insert invoice-xmls" on storage.objects
  for insert with check (
    bucket_id = 'invoice-xmls'
    and (public.is_operator() or public.is_manager())
  );

create policy "clients insert return invoice" on storage.objects
  for insert with check (
    bucket_id = 'invoice-xmls'
    and public.is_client()
  );

create policy "authenticated read invoice-xmls" on storage.objects
  for select using (
    bucket_id = 'invoice-xmls'
    and auth.uid() is not null
  );

create policy "managers delete invoice-xmls" on storage.objects
  for delete using (
    bucket_id = 'invoice-xmls'
    and public.is_manager()
  );
