import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Or use user, host, database, password, port
  // user: "youruser",
  // host: "localhost",
  // database: "yourdb",
  // password: "yourpassword",
  // port: 5432,
});

export default pool;