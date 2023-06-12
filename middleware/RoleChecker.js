import * as dotenv from "dotenv";
import config from "config";
dotenv.config();
const { PRODUCTION } = process.env;
const { dbConfig: dataBaseConfig, dbConfigProd: dataBaseConfigProduction } =
  config.get("dbConfig");
const production = PRODUCTION === "1";
import mysql from "mysql2/promise";

export const roles = async (req, res, next) => {
  if (req.method === "OPTIONS") {
    next();
  }
  try {
    const { id } = req.user;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const userDataSql = `SELECT * FROM users WHERE id = '${id}'`;
    const user = (await conn.query(userDataSql))[0][0];
    const storeDataSql = `SELECT * FROM stores WHERE uid = '${user.store}'`;
    const store = (await conn.query(storeDataSql))[0][0];
    if (store?.id) {
      req.user.isStoreActive = store.activated;
      req.user.isStorePremium = store.premium;
      req.user.pickupAdress = store.address;
      req.user.store = user.store;
      if (store.owner === user.uid) {
        req.user.isOwner = true;
      } else {
        req.user.isOwner = false;
      }
      for (let item of store.users) {
        if (item.uid === user.uid) {
          req.user.permission = item.permission;
          req.user.role = item.role;
          break;
        }
      }
      await conn.end();
      next();
    } else {
      return res.status(400).json({
        message:
          "Вы не состоите в каком либо магазине. Пожалуйста перезайдите в приложение.",
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: e.name });
  }
};
