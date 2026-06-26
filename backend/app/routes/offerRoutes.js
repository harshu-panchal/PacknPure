import express from "express";
import {
  getPublicOffers,
  getAdminOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  reorderOffers,
} from "../controller/offerController.js";

import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/offers", getPublicOffers);

router.get(
  "/admin-offers",
  verifyToken,
  allowRoles("admin"),
  getAdminOffers,
);

router.post(
  "/admin-offers",
  verifyToken,
  allowRoles("admin"),
  createOffer,
);

router.put(
  "/admin-offers/reorder",
  verifyToken,
  allowRoles("admin"),
  reorderOffers,
);

router.put(
  "/admin-offers/:id",
  verifyToken,
  allowRoles("admin"),
  updateOffer,
);

router.delete(
  "/admin-offers/:id",
  verifyToken,
  allowRoles("admin"),
  deleteOffer,
);



export default router;

