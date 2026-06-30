# Supabase — структура базы Mebel Flow

## Принцип («по умному»)

Данные **не дублируются** по этапам. Одна нормализованная схема + **представления (views)** для удобного просмотра в Supabase Table Editor.

| Таблица | Назначение |
|---------|------------|
| `Order` | Заказы, статус (`NEW` → `PROCUREMENT` → `PRODUCTION` → `COMPLETED`) |
| `Product` | Изделия внутри заказа |
| `Part` | Детали, статус = этап производства |
| `HardwareItem` | Фурнитура, `purchased` = закупка |
| `Document` | PDF привязаны к **заказу** или **изделию** |
| `PartHistory` | Журнал смены статусов |
| `User` | Пользователи и роли |

## Представления по этапам (Views)

После `prisma migrate deploy` в Supabase появятся:

| View | Этап в приложении |
|------|-------------------|
| `vw_orders` | Сводка по заказам |
| `vw_documents` | Все документы |
| `vw_stage_procurement` | Закупка |
| `vw_stage_receipt` | Приёмка (`CREATED`) |
| `vw_stage_sort` | Сортировка (`RECEIVED`) |
| `vw_stage_drill` | Присадка (`SORTED`) |
| `vw_stage_qc` | ОКК (`DRILLED`) |
| `vw_stage_pack` | Упаковка (`QC_PASSED`) |

## Документы

- **Уровень заказа** — договор, счёт, общие файлы (`Document.orderId`)
- **Уровень изделия** — сборочный чертёж, деталировка, бирка (`Document.productId`)

## Файлы (Storage)

1. Выполните `supabase/setup.sql` в SQL Editor (создаёт bucket `documents`)
2. Добавьте в `.env` и Vercel: `SUPABASE_SERVICE_ROLE_KEY`
3. Без service role файлы сохраняются локально (`uploads/` или `/tmp` на Vercel — непостоянно)

## Миграции

```bash
npx prisma migrate deploy   # production / Supabase
npm run db:setup            # local dev + seed
```
