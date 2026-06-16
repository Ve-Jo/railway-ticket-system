# Автоматизація процесів бронювання, продажу та повернення квитків залізничного вокзалу

Вебзастосунок для дипломного проєкту з автоматизації пошуку рейсів, бронювання місць, оплати, повернення квитків і базового адміністрування довідників та розкладу.

https://diploma-production-bd0d.up.railway.app/

<img width="799" height="591" alt="{4EAE64DC-A84D-4C32-A7C4-39CB30C4961F}" src="https://github.com/user-attachments/assets/054d57af-5ac2-4e4f-ae97-9a02d1564a7b" />
<img width="780" height="581" alt="{635E04EE-9A8B-480B-ACD9-8FF8EFBB4F63}" src="https://github.com/user-attachments/assets/b017144d-97fc-4386-8909-30daf1a1085f" />
<img width="798" height="563" alt="{BC3330AB-13D8-4D80-83BF-B3C5D82E5990}" src="https://github.com/user-attachments/assets/7099c861-cd74-4273-b7e6-a9d842de288f" />

## Тема роботи

Інформаційна система автоматизації процесів бронювання, продажу та повернення залізничних квитків.

## Коротко про проєкт

Система покриває три основні ролі:

- `passenger` - пошук рейсів, вибір місця, бронювання, оплата, повернення;
- `cashier` - оформлення продажів і повернень у службовому інтерфейсі;
- `admin` - керування станціями, маршрутами, поїздами, вагонами та рейсами.

## Технології

- React + Vite
- Node.js + Express
- MySQL
- `mysql2`
- server-side sessions + cookie
- CSS Modules
- GitHub + Railway

## Архітектурна схема

```mermaid
flowchart LR
    U[Користувачі]

    subgraph FE[Клієнтський рівень]
        P[Пасажирський інтерфейс]
        O[Службовий інтерфейс]
    end

    subgraph BE[Серверний рівень]
        API[Express API]
        AUTH[Сесії та авторизація]
        BOOK[Пошук рейсів, бронювання, оплата, повернення]
        ADMIN[Адміністрування довідників і рейсів]
    end

    subgraph DATA[Рівень даних]
        DB[(MySQL)]
        REF[Станції, маршрути, поїзди, рейси]
        LIFE[Бронювання, квитки, оплати, повернення]
        LOGS[Журнал операцій]
    end

    U --> P
    U --> O
    P --> API
    O --> API
    API --> AUTH
    API --> BOOK
    API --> ADMIN
    API --> DB
    DB --> REF
    DB --> LIFE
    DB --> LOGS
```

## Важливі файли проєкту

### База даних

- схема БД: [db/schema.sql](./db/schema.sql)
- тестові дані: [db/seeds.sql](./db/seeds.sql)
- SQL-перевірки сценаріїв: [db/smoke-checks.sql](./db/smoke-checks.sql)

### Документація

- архітектура: [docs/architecture.md](./docs/architecture.md)
- контракти API: [docs/api-contracts.md](./docs/api-contracts.md)
- проєктування БД: [docs/database-design.md](./docs/database-design.md)

## Локальний запуск

```bash
npm install
npm run db:up
npm run db:init
npm run dev
```

Перед запуском потрібно заповнити `.env` за зразком `.env.example`.
