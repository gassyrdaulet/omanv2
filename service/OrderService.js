import * as dotenv from "dotenv";
import config from "config";
dotenv.config();
const { PRODUCTION } = process.env;
const { dbConfig: dataBaseConfig, dbConfigProd: dataBaseConfigProduction } =
  config.get("dbConfig");
const production = PRODUCTION === "1";
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  service: "Mail.ru",
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const getNameByUID = async (uid) => {
  try {
    if (uid === null) {
      return "Нет";
    }
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const sql1 = `SELECT name FROM users WHERE uid = "${uid}"`;
    const { name } = (await conn.query(sql1))[0][0];
    await conn.end();
    return name;
  } catch (e) {
    return uid;
  }
};

export const sendNotificationEmail = async (title, desc, order, store) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const storeDataSql = `SELECT * FROM stores WHERE uid = '${store}'`;
    const storeData = (await conn.query(storeDataSql))[0][0];
    for (let item of storeData.users) {
      const sql1 = `SELECT email FROM users WHERE notifications = "true" and uid = "${item.uid}"`;
      const user = (await conn.query(sql1))[0][0];
      if (!user) {
        return;
      }
      transport.sendMail({
        from: process.env.EMAIL_SENDER,
        to: user.email,
        subject: "УВЕДОМЛЕНИЕ ОТ ORDERMANAGER",
        html: `<h1>${title}</h1>
          <p>Магазин "${storeData.store_name}"</p>
          <p>${desc}</p>
          <center><h1>${"UID: " + order.uid}<br/>${
          "Адрес: " + order.address
        }<br/>${"Товары: " + order.goods}</h1></center>
          </div>`,
      });
    }
  } catch (e) {
    console.log(e);
  }
};
