import * as dotenv from "dotenv";
import config from "config";
dotenv.config();
const { PRODUCTION } = process.env;
const { dbConfig: dataBaseConfig, dbConfigProd: dataBaseConfigProduction } =
  config.get("dbConfig");
const production = PRODUCTION === "1";
import { validationResult } from "express-validator";
import mysql from "mysql2/promise";
import { customAlphabet } from "nanoid";
import { getNameByUID } from "../service/OrderService.js";

export const getStoreInfo = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const { store, user_uid } = req.user;
    const sql = `SELECT * FROM stores WHERE uid = '${store}'`;
    const result = (await conn.query(sql))[0][0];
    result.owner = (await getNameByUID(user_uid)) + ` (${user_uid})`;
    await conn.end();
    return res.send(result);
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const getStoreUsers = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const { store } = req.user;
    const sql = `SELECT users, owner FROM stores WHERE uid = '${store}'`;
    const result = (await conn.query(sql))[0][0];
    const resultWithNames = await Promise.all(
      result.users.map(async (item) => {
        item.name =
          (await getNameByUID(item.uid)) +
          ` (${
            item.uid === result.owner
              ? "Владелец"
              : item.role === "admin"
              ? "Админ"
              : "Обычный"
          })`;
        return item;
      })
    );
    await conn.end();
    return res.send(resultWithNames);
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const addNewUser = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const { store, role, isOwner } = req.user;
    const { new_uid, new_role, deliver, permission } = req.body;
    if (role !== "admin") {
      await conn.end();
      return res.status(403).json({ message: `Отказано в доступе!` });
    }
    if (new_role && !isOwner) {
      await conn.end();
      return res.status(403).json({
        message: `Только владелец магазина может создавать новых админов!`,
      });
    }
    const userDataSql = `SELECT * FROM users WHERE uid = '${new_uid}'`;
    const user = (await conn.query(userDataSql))[0][0];
    if (!user) {
      await conn.end();
      return res
        .status(400)
        .json({ message: `Пользователь с таким UID (${new_uid}) не найден.` });
    }
    const sql = `SELECT users FROM stores WHERE uid = '${user.store}'`;
    const storeDataNewUser = (await conn.query(sql))[0][0];
    if (storeDataNewUser?.id && store !== user.store) {
      await conn.end();
      return res.status(400).json({
        message: `Этот пользователь уже состоит в существующем магазине! Название: "${storeData.store_name}". UID:"${storeData.uid}"`,
      });
    }
    const storeDataSql = `SELECT users FROM stores WHERE uid = '${store}'`;
    const storeData = (await conn.query(storeDataSql))[0][0];
    const addStoreForUserSql = `UPDATE users SET store = "${store}" WHERE uid = "${new_uid}"`;
    await conn.query(addStoreForUserSql);
    const addUserForStoreSql = `UPDATE stores SET ? WHERE uid = "${store}"`;
    for (let item of storeData.users) {
      if (item.uid === new_uid) {
        await conn.end();
        return res.status(400).json({
          message: `Пользователь с таким UID (${new_uid}) уже добавлен в этот магазин!`,
        });
      }
    }
    storeData.users.push({
      uid: new_uid,
      role: new_role ? "admin" : "user",
      kaspi: false,
      deliver,
      permission,
    });
    await conn.query(addUserForStoreSql, {
      users: JSON.stringify(storeData.users),
    });
    return res.status(200).json({
      message: `Пользователь "${new_uid}" успешно добавлен в магазин!`,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const editStoreUsers = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const { store, role, isOwner, user_uid } = req.user;
    const { editUid, userSettings } = req.body;
    if (role !== "admin") {
      await conn.end();
      return res.status(403).json({ message: `Отказано в доступе!` });
    }
    if (role === "admin" && !userSettings.admin && editUid === user_uid) {
      await conn.end();
      return res.status(403).json({
        message: `Ошибка! Нельзя понизить свою же роль! `,
      });
    }
    const userDataSql = `SELECT * FROM users WHERE uid = '${editUid}'`;
    const user = (await conn.query(userDataSql))[0][0];
    if (!user) {
      await conn.end();
      return res.status(400).json({
        message: `Пользователя с таким UID (${editUid}) не существует. Вам следует удалить его из списка пользователей Вашего магазина.`,
      });
    }
    const storeDataSql = `SELECT owner,users FROM stores WHERE uid = '${store}'`;
    const storeData = (await conn.query(storeDataSql))[0][0];
    if (userSettings.admin) {
      let exInfo = {};
      for (let i = 0; i < storeData.users.length; i++) {
        if (storeData.users[i].uid === editUid) {
          exInfo = storeData.users[i];
          break;
        }
      }
      if (exInfo.role !== "admin") {
        if (!isOwner) {
          await conn.end();
          return res.status(403).json({
            message: `Отказано в доступе! Только владельцы могут назначать админов! `,
          });
        }
      }
    }
    if (
      storeData.owner === user_uid &&
      !userSettings.admin &&
      editUid === user_uid
    ) {
      await conn.end();
      return res.status(403).json({
        message: `Ошибка! Владелец не может понизить свою роль! `,
      });
    }
    const editStoreUsers = `UPDATE stores SET ? WHERE uid = "${store}"`;
    for (let i = 0; i < storeData.users.length; i++) {
      if (storeData.users[i].uid === editUid) {
        storeData.users[i] = {
          uid: editUid,
          role: userSettings.admin ? "admin" : "user",
          kaspi: userSettings.kaspi,
          deliver: userSettings.deliver,
          permission: userSettings.permission,
        };
        await conn.query(editStoreUsers, {
          users: JSON.stringify(storeData.users),
        });
        await conn.end();
        return res.status(200).json({
          message: `Пользователь "${editUid}" успешно отредактирован!`,
        });
      }
    }
    await conn.end();
    return res.status(400).json({
      message: `Пользователь с таким UID (${editUid}) не найден в списке пользовтелей магазина!`,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const checkStore = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const { id } = req.user;
    const userDataSql = `SELECT * FROM users WHERE id = '${id}'`;
    const user = (await conn.query(userDataSql))[0][0];
    const storeDataSql = `SELECT * FROM stores WHERE uid = '${user.store}'`;
    const store = (await conn.query(storeDataSql))[0][0];
    if (store?.id) {
      for (let item of store.users) {
        if (item.uid === user.uid) {
          user.role = item.role;
          break;
        }
      }
      await conn.end();
      return res.status(200).json({ isNoStore: false, role: user.role });
    } else {
      return res.status(400).json({ isNoStore: true });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка сервера: " + e, isNoStore: true });
  }
};

export const deleteUserFromStore = async (req, res) => {
  try {
    const { isOwner, user_uid, store } = req.user;
    const { deleteUid } = req.body;
    if (!isOwner) {
      return res.status(403).json({
        message: `Отказано в доступе! Только владельцы могут удалять пользователей! `,
      });
    }
    if (deleteUid === user_uid) {
      return res.status(403).json({
        message: `Ошибка! Владельцы не могут удалять самих себя! `,
      });
    }
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const storeDataSql = `SELECT * FROM stores WHERE uid = '${store}'`;
    const storeData = (await conn.query(storeDataSql))[0][0];
    const editStoreUsers = `UPDATE stores SET ? WHERE uid = "${store}"`;
    let deletedFound = false;
    const deletedUsers = storeData.users.filter((item) => {
      if (item.uid !== deleteUid) {
        return true;
      } else {
        deletedFound = true;
        return false;
      }
    });
    if (!deletedFound) {
      await conn.end();
      return res.status(400).json({
        message: `Пользователь с таким UID (${deleteUid}) не найден в списке пользовтелей магазина!`,
      });
    }
    const deleteStoreFromUserSql = `UPDATE users SET store = "0" WHERE uid = "${deleteUid}"`;
    await conn.query(deleteStoreFromUserSql);
    await conn.query(editStoreUsers, {
      users: JSON.stringify(deletedUsers),
    });
    await conn.end();
    return res.status(200).json({
      message: `Пользователь с UID (${deleteUid}) успешно удален из списка.`,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const quitTheStore = async (req, res) => {
  try {
    const { isOwner, user_uid, store } = req.user;
    if (isOwner) {
      return res.status(403).json({
        message: `Владелец не может покинуть свой же магазин! `,
      });
    }
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const storeDataSql = `SELECT * FROM stores WHERE uid = '${store}'`;
    const storeData = (await conn.query(storeDataSql))[0][0];
    let deletedFound = false;
    const deletedUsers = storeData.users.filter((item) => {
      if (item.uid !== user_uid) {
        return true;
      } else {
        deletedFound = true;
        return false;
      }
    });
    if (!deletedFound) {
      await conn.end();
      return res.status(400).json({
        message: `Пользователь с таким UID (${user_uid}) не найден в списке пользовтелей магазина!`,
      });
    }
    const deleteStoreFromUserSql = `UPDATE users SET store = "0" WHERE uid = "${user_uid}"`;
    await conn.query(deleteStoreFromUserSql);
    const editStoreUsersSql = `UPDATE stores SET ? WHERE uid = "${store}"`;
    await conn.query(editStoreUsersSql, {
      users: JSON.stringify(deletedUsers),
    });
    await conn.end();
    return res.status(200).json({
      message: `Вы успешно удалены из списка.`,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const createNewStore = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const errors = validationResult(req);
    const { store_name, address } = req.body;
    const { id } = req.user;
    const userDataSql = `SELECT * FROM users WHERE id = ${id}`;
    const user = (await conn.query(userDataSql))[0][0];
    const sql = `INSERT INTO stores SET ?`;
    const storeDataSql = `SELECT * FROM stores WHERE uid = '${user.store}'`;
    const store = (await conn.query(storeDataSql))[0][0];
    if (store?.id) {
      await conn.end();
      return res.status(400).json({
        message:
          "Ошибка! Вы уже состоите в существующем магазине! Обратитесь к администрации.",
      });
    }
    if (!errors.isEmpty()) {
      await conn.end();
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    const checkForUniqueStoreId = async () => {
      const nanoid = customAlphabet("1234567890", 8);
      const store_id = nanoid();
      const sql4 = `SELECT * FROM stores WHERE uid = '${store_id}'`;
      const store_candidate = (await conn.query(sql4))[0][0];
      if (store_candidate) {
        return await checkForUniqueStoreId();
      } else {
        return store_id;
      }
    };

    const uid = await checkForUniqueStoreId();

    await conn.query(sql, {
      uid,
      store_name,
      owner: user.uid,
      users: JSON.stringify([
        {
          uid: user.uid,
          role: "admin",
          deliver: true,
          permission: true,
          kaspi: false,
        },
      ]),
      address,
    });

    await conn.query(`UPDATE users SET store = '${uid}' WHERE id = ${id}`);
    await conn.query(`CREATE TABLE o_${uid} LIKE orders`);
    await conn.query(`CREATE TABLE f_${uid} LIKE finished_orders`);

    await conn.end();

    return res
      .json({
        message: "Магазин успешно зарегистрирован.",
      })
      .status(200);
  } catch (e) {
    console.log("ERROR in StoreController.createNewOrder(): " + e.message);
    res.status(500).json({ message: "Ошибка в сервере: " + e });
  }
};

export const deleteStore = async (req, res) => {
  try {
    const { store, isOwner } = req.user;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const getStoreDataSql = `SELECT * FROM stores where uid = ${store}`;
    const storeData = (await conn.query(getStoreDataSql))[0][0];
    if (isOwner && storeData.users.length <= 1) {
      const deleteStoreSql = `DELETE FROM stores WHERE uid = ${store}`;
      await conn.query(deleteStoreSql);
      const deleteTablesSql = `DROP TABLE o_${store}, f_${store}`;
      await conn.query(deleteTablesSql);
      res.status(200).json({ message: "Магазин успешно удален!" });
      conn.end();
    } else {
      res.status(400).json({
        message:
          "Не удалось удалить магазин. Для удаления магазина Вы должны быть его владельцем, а также в нем не должно быть других участников.",
      });
      conn.end();
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка! " + e });
  }
};

export const giveTheOwnership = async (req, res) => {
  try {
    const { store, isOwner } = req.user;
    const { newOwner } = req.body;
    if (!isOwner) {
      return res.status(400).json({
        message: "Вы не являетесь владельцом этого магазина.",
      });
    }
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const getStoreDataSql = `SELECT * FROM stores where uid = "${store}"`;
    const storeData = (await conn.query(getStoreDataSql))[0][0];
    for (let item of storeData.users) {
      if (item.uid === newOwner) {
        if (item.role !== "admin") {
          return res.status(400).json({
            message: `Сперва дайте этому пользователю роль админа!`,
          });
        }
        const newOwnerSql = `UPDATE stores SET ? WHERE uid = "${store}"`;
        await conn.query(newOwnerSql, { owner: newOwner });
        conn.end();
        return res
          .status(200)
          .json({ message: "Вы успешно передали владение!" });
      }
    }
    res.status(400).json({
      message: `Пользователя с UID: ${newOwner} нет в списке участников магазина!`,
    });
    conn.end();
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка! " + e });
  }
};

export const editStore = async (req, res) => {
  try {
    const { store: store_uid, isOwner } = req.user;
    const errors = validationResult(req);
    const { store_name, kaspi, activated, address } = req.body;
    const sql = `SELECT * FROM stores WHERE uid = "${store_uid}"`;
    if (!isOwner) {
      return res.status(400).json({
        message:
          "Ошибка! Отказано в доступе. Вы должны быть владельцом, если хотите редактировать магазин.",
      });
    }
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const store = (await conn.query(sql))[0][0];
    if (!store) {
      await conn.end();
      return res.status(400).json({
        message: `Ошибка! Магазина с UID = "${store_uid}" не существует.`,
      });
    }
    const editStoreSql = `UPDATE stores SET ? WHERE uid = ${store_uid}`;
    await conn.query(editStoreSql, {
      store_name,
      kaspi: kaspi ? "true" : "false",
      activated: activated ? "true" : "false",
      address,
    });
    res.status(200).json({ message: "Магазин успешно отредактирован!" });
    conn.end();
  } catch (e) {
    res.status(500).json({ message: "Ошибка! " + e });
  }
};
