import mysql from "mysql2/promise";

function getEnv(name, fallback) {
  return process.env[name] || fallback;
}

const seedData = {
  roles: [
    {
      code: "passenger",
      name: "Пасажир",
      description: "Користувач, який шукає рейси, бронює та оплачує квитки."
    },
    {
      code: "cashier",
      name: "Касир",
      description: "Співробітник, який може оформлювати продажі та повернення через службовий інтерфейс."
    },
    {
      code: "admin",
      name: "Адміністратор",
      description: "Користувач з доступом до керування довідниками та журналами операцій."
    }
  ],
  stations: [
    {
      code: "KYIV-PAS",
      name: "Київ-Пасажирський",
      city: "Київ",
      address: "Вокзальна площа, 1"
    },
    {
      code: "VINN-TSN",
      name: "Вінниця",
      city: "Вінниця",
      address: "площа Героїв Чорнобиля, 1"
    },
    {
      code: "KHM-TSN",
      name: "Хмельницький",
      city: "Хмельницький",
      address: "Проскурівська, 10"
    },
    {
      code: "TERN-TSN",
      name: "Тернопіль",
      city: "Тернопіль",
      address: "площа Перемоги, 1"
    },
    {
      code: "LVIV-PAS",
      name: "Львів",
      city: "Львів",
      address: "площа Двірцева, 1"
    }
  ],
  routes: [
    { code: "R-KYIV-LVIV", name: "Київ - Львів" },
    { code: "R-LVIV-KYIV", name: "Львів - Київ" }
  ],
  trains: [{ code: "IC-701", name: "Інтерсіті 701" }]
};

function utf8Hex(value) {
  return Buffer.from(value, "utf8").toString("hex").toUpperCase();
}

async function main() {
  const connection = await mysql.createConnection({
    host: getEnv("DB_HOST", "127.0.0.1"),
    port: Number(getEnv("DB_PORT", "3306")),
    user: getEnv("DB_USER", "root"),
    password: getEnv("DB_PASSWORD", ""),
    database: getEnv("DB_NAME", "railway_ticket_system"),
    charset: "utf8mb4"
  });

  try {
    await connection.query("SET NAMES utf8mb4");

    for (const role of seedData.roles) {
      await connection.query(
        `
          UPDATE roles
          SET
            name = CONVERT(0x${utf8Hex(role.name)} USING utf8mb4),
            description = CONVERT(0x${utf8Hex(role.description)} USING utf8mb4)
          WHERE code = ?
        `,
        [role.code]
      );
    }

    for (const station of seedData.stations) {
      await connection.query(
        `
          UPDATE stations
          SET
            name = CONVERT(0x${utf8Hex(station.name)} USING utf8mb4),
            city = CONVERT(0x${utf8Hex(station.city)} USING utf8mb4),
            address = CONVERT(0x${utf8Hex(station.address)} USING utf8mb4)
          WHERE code = ?
        `,
        [station.code]
      );
    }

    for (const route of seedData.routes) {
      await connection.query(
        `
          UPDATE routes
          SET name = CONVERT(0x${utf8Hex(route.name)} USING utf8mb4)
          WHERE code = ?
        `,
        [route.code]
      );
    }

    for (const train of seedData.trains) {
      await connection.query(
        `
          UPDATE trains
          SET name = CONVERT(0x${utf8Hex(train.name)} USING utf8mb4)
          WHERE code = ?
        `,
        [train.code]
      );
    }

    console.log("Seed encoding repaired");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
