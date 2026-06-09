import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error("DATABASE_URL not set in .env");
    process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl });

console.log("Fetching tables in public schema...");
try {
    const res = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    `);
    console.log("Tables found:");
    console.log(res.rows.map(r => r.table_name));
} catch (e) {
    console.error("Database query failed:", e);
} finally {
    await pool.end();
}
