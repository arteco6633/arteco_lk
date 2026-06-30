# Mebel Flow

Система учёта производства мебели на заказ: от загрузки документов технолога до упаковки.

## Возможности

- Создание заказа с № заказа и изделиями (кухни, шкафы, тумбы)
- Загрузка PDF: сборочный чертёж, деталировка, бирка
- Импорт списка деталей и фурнитуры из Excel (отдельные шаблоны)
- Производственный поток:
  1. **Приёмка** у подрядчика
  2. **Сортировка** по изделиям в цеху
  3. **Присадка** с фото
  4. **ОКК** — контроль качества
  5. **Упаковка** — детали + фурнитура

## Запуск

База данных — **Supabase** (PostgreSQL). Настройте `.env` по образцу `.env.example`.

1. [Supabase Dashboard](https://supabase.com/dashboard) → ваш проект → **Settings → Database**
2. Скопируйте **Connection string** (пароль БД задаётся при создании проекта)
3. В `.env` укажите:
   - `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (уже в примере)
   - `DATABASE_URL` — **Transaction pooler**, порт **6543** (`?pgbouncer=true`)
   - `DIRECT_URL` — **Session / Direct**, порт **5432** (для миграций)

```bash
cd ~/Projects/mebel-flow
npm install
npm run db:setup
npm run dev
```

## Деплой на Vercel

В **Environment Variables** добавьте все переменные из `.env.example`:

| Переменная | Откуда |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API |
| `DATABASE_URL` | Database → Transaction pooler (:6543) |
| `DIRECT_URL` | Database → Session pooler (:5432) |
| `SESSION_SECRET` | Случайная строка 32+ символов |

После первого деплоя выполните seed (с тем же `DATABASE_URL` локально):

```bash
npm run db:seed
```

Демо-логин: `manager@mebel.local` / `123456`

## Демо-пользователи (пароль: `123456`)

| Email | Роль |
|-------|------|
| manager@mebel.local | Менеджер / технолог |
| contractor@mebel.local | Приёмка у подрядчика |
| sorter@mebel.local | Сортировка |
| driller@mebel.local | Присадка |
| qc@mebel.local | ОКК |
| packer@mebel.local | Упаковка |
| admin@mebel.local | Администратор (все разделы) |

## Excel-шаблоны

- **Детали:** `public/templates/parts-template.xlsx` — кнопка «Шаблон деталей» в заказе
- **Фурнитура:** `public/templates/hardware-template.xlsx` — кнопка «Шаблон фурнитуры» в заказе

### Детали

- **№ изделия** — номер изделия в заказе (1, 2, 3…)
- **Название детали**
- **Код детали** (необязательно)
- **Размер**
- **Количество**
- **Материал** (необязательно)

### Фурнитура

Колонки: **№ изделия**, **Название**, **Количество**, **Ед**

## Проверка импорта Excel

```bash
npm run test:excel
```

## Рабочий процесс

1. Менеджер создаёт заказ → добавляет изделия → загружает PDF → импортирует Excel с деталями
2. Приёмка отмечает принятые детали у подрядчика
3. Сортировщик выбирает изделие и отмечает отсортированные детали
4. Присадочник делает фото и отмечает выполненные детали
5. ОКК проверяет и ставит ОК / Не ОК
6. Упаковщик собирает комплект по изделию и отмечает фурнитуру

## Данные

- База SQLite: `prisma/dev.db`
- Загруженные файлы: папка `uploads/` (PDF, фото)
