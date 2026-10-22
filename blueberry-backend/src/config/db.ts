import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

pool.on('connect', () => {
    console.log('✅ Blueberry: Connected to PostgreSQL');
});

// Явно указываем тип Error для параметра err
pool.on('error', (err: Error) => {
    console.error('❌ Blueberry: Unexpected error on idle client', err);
    process.exit(-1);
});

export default pool;