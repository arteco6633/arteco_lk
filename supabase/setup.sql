-- Однократная настройка в Supabase SQL Editor (Dashboard → SQL → New query)
-- После миграций Prisma: prisma migrate deploy

-- 1. Bucket для PDF и фото (приватный — доступ через API приложения)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Политики: service role обходит RLS; для anon/authenticated — запрет прямого доступа
-- Приложение читает файлы через /api/files с сессией и service role на сервере.

-- Представления создаются автоматически миграцией Prisma (vw_orders, vw_stage_*, vw_documents).
-- В Table Editor они появятся в разделе Views.
