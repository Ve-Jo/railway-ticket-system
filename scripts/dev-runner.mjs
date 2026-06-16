import { spawn } from "node:child_process";
import { access, copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, ".env.example");

async function ensureEnvFile() {
  try {
    await access(envPath);
  } catch {
    await copyFile(envExamplePath, envPath);
    console.log("Created .env from .env.example");
  }
}

function loadEnvFile(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: true,
      ...options
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });

    child.on("error", reject);
  });
}

async function waitForMysqlHealthy() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const status = await new Promise((resolve) => {
      const child = spawn(
        "docker",
        ["inspect", "-f", "{{.State.Health.Status}}", "diploma-mysql"],
        {
          cwd: rootDir,
          stdio: ["ignore", "pipe", "pipe"],
          shell: true
        }
      );

      let stdout = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.on("exit", () => {
        resolve(stdout.trim());
      });

      child.on("error", () => {
        resolve("");
      });
    });

    if (status === "healthy") {
      console.log("MySQL container is healthy");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Timed out waiting for MySQL healthcheck");
}

async function bootstrap() {
  await ensureEnvFile();

  const envFile = await readFile(envPath, "utf8");
  const env = loadEnvFile(envFile);

  process.env = {
    ...process.env,
    ...env
  };

  await run("docker", ["compose", "up", "-d", "mysql"]);
  await waitForMysqlHealthy();
  await run("node", ["./scripts/init-db.mjs"]);
  await run("npm", ["run", "dev:app"]);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
