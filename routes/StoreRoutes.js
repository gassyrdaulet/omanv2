import { Router } from "express";
import { check } from "express-validator";
import {
  checkStore,
  createNewStore,
  getStoreInfo,
  editStore,
  getStoreUsers,
  addNewUser,
  editStoreUsers,
  deleteUserFromStore,
  quitTheStore,
  deleteStore,
  giveTheOwnership,
} from "../controllers/StoreController.js";
import { auth } from "../middleware/RouterSecurity.js";
import { roles } from "../middleware/RoleChecker.js";

const router = new Router();

router.post(
  "/createnewstore",
  [
    auth,
    check("store_name", "Название должно быть длиннее 1 и короче 20!").isLength(
      {
        min: 1,
        max: 20,
      }
    ),
    check("address", "Адрес должен быть длиннее 1 и короче 100!").isLength({
      min: 1,
      max: 100,
    }),
  ],
  createNewStore
);
router.get("/checkstore", auth, checkStore);
router.get("/getstoreinfo", auth, roles, getStoreInfo);
router.get("/getstoreusers", auth, roles, getStoreUsers);
router.post(
  "/addnewuser",
  [
    auth,
    roles,
    check("new_uid", "UID должен быть длиннее 1 и короче 12!").isLength({
      min: 1,
      max: 12,
    }),
    check("new_role", "'Админ' должен либо 'true' либо 'false'!").isBoolean(),
    check(
      "permission",
      "'Доступ' должен либо 'true' либо 'false'!"
    ).isBoolean(),
    check("deliver", "'Курьер' должен либо 'true' либо 'false'!").isBoolean(),
  ],
  addNewUser
);
router.patch(
  "/editstore",
  [
    auth,
    roles,
    check("store_name", "Название должно быть длиннее 1 и короче 20!").isLength(
      {
        min: 1,
        max: 20,
      }
    ),
    check("address", "Адрес должен быть длиннее 1 и короче 100!").isLength({
      min: 1,
      max: 100,
    }),
    check("kaspi", "'Kaspi.kz' должен либо 'true' либо 'false'!").isBoolean(),
    check(
      "activated",
      "'Активен' должен либо 'true' либо 'false'!"
    ).isBoolean(),
  ],
  editStore
);
router.patch(
  "/editusers",
  [
    auth,
    roles,
    check("editUid", "UID должно быть длиннее 1 и короче 10!").isLength({
      min: 1,
      max: 10,
    }),
  ],
  editStoreUsers
);
router.post(
  "/deleteuser",
  [
    auth,
    roles,
    check("deleteUid", "UID должно быть длиннее 1 и короче 10!").isLength({
      min: 1,
      max: 10,
    }),
  ],
  deleteUserFromStore
);
router.post(
  "/givetheownership",
  [
    auth,
    roles,
    check("newOwner", "UID должно быть длиннее 1 и короче 10!").isLength({
      min: 1,
      max: 10,
    }),
  ],
  giveTheOwnership
);
router.post("/quitthestore", [auth, roles], quitTheStore);
router.delete("/deletestore", [auth, roles], deleteStore);

export default router;
