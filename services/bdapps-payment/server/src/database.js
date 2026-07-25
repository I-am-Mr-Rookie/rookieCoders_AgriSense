export function createPoolConfig(connectionString, env = process.env) {
  const config = { connectionString };

  if (env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false") {
    const url = new URL(connectionString);
    for (const parameter of ["sslmode", "uselibpqcompat", "sslcert", "sslkey", "sslrootcert"]) {
      url.searchParams.delete(parameter);
    }
    config.connectionString = url.toString();
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}
