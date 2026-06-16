# Демо-дані

Файл [db/seeds.sql](C:/Users/PAPA/Downloads/diploma/db/seeds.sql) додає мінімальний набір даних для локальної демонстрації MVP:

- ролі `passenger`, `cashier`, `admin`;
- 3 тестові облікові записи;
- 5 станцій;
- 2 маршрути;
- 1 поїзд;
- кілька вагонів різних типів;
- набір місць;
- демонстраційні рейси на поточні та близькі дати.

## Тестові акаунти

Для всіх трьох облікових записів використовується один пароль: `Demo123!`

- `passenger_demo` / `passenger.demo@example.com`
- `cashier_demo` / `cashier.demo@example.com`
- `admin_demo` / `admin.demo@example.com`

Паролі в `db/seeds.sql` уже збережені у вигляді `bcrypt`-хешів, тому вони сумісні з поточною backend-логікою перевірки через `bcryptjs`.

## Порядок завантаження

1. Створити порожню MySQL-базу, наприклад `railway_ticket_system`.
2. Застосувати схему:

```powershell
mysql -u root -p railway_ticket_system < db/schema.sql
```

3. Завантажити демо-дані:

```powershell
mysql -u root -p railway_ticket_system < db/seeds.sql
```

Або використати вбудований скрипт:

```bash
npm run db:init
```

## Що можна показати на демо

- вхід під пасажиром, касиром і адміністратором;
- пошук рейсів між Києвом і Львовом;
- відображення вагонів і місць для обраного рейсу;
- різні типи місць і класів;
- пасажирський сценарій бронювання, оплати та повернення.

## Обмеження

- `bookings`, `tickets`, `payments`, `refunds` і `operation_logs` не наповнюються наперед: ці записи краще створювати через застосунок, щоб показати реальний життєвий цикл квитка;
- сиди розраховані на повторний запуск без дублювання ключових довідкових записів;
- якщо в БД вже є пошкоджені за кодировкою seed-рядки, для виправлення можна використати [scripts/repair-seed-encoding.mjs](C:/Users/PAPA/Downloads/diploma/scripts/repair-seed-encoding.mjs).
