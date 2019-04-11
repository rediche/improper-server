const mysql = require('mysql');

const connectionPool = mysql.createPool({
  connectionLimit: process.env.DB_POOL_LIMIT || 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

module.exports = connectionPool;