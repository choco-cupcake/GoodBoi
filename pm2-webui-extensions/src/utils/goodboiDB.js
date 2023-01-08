const mysql = require('mysql2');
const bluebird = require('bluebird');
require("dotenv").config()

const dbConf = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.MYSQL_PASS,
    database: "goodboi",
    Promise: bluebird
};

class Database {

    static async getDBConnection() {
        try {
            if (!this.db) {
                // to test if credentials are correct
                await mysql.createConnection(dbConf);
                const pool = mysql.createPool(dbConf);
                // now get a Promise wrapped instance of that pool
                const promisePool = pool.promise();
                this.db = promisePool;
            }
            return this.db;
        } catch (err) {
            console.log('Error in database connection');
            console.log(err.message || err);
        }

    }
}

module.exports = Database;