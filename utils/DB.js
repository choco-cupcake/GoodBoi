const mysql = require('mysql2');
const bluebird = require('bluebird');
require("dotenv").config()

const dbConf = {
    host: "localhost",
    user: "root",
    password: process.env.MYSQL_PASS,
    database: "bugjunkie",
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
            console.log(err.errro || err);
        }

    }
}

module.exports = Database;