import { Router } from "express";
import { getPromoToolsHealth, getPromoToolsMeta } from "../../services/promo-tools/db.js";
import { createProductsRouter } from "./products.routes.js";
import { createOrdersRouter } from "./orders.routes.js";

/**
 * Promotion Tools API routes (mounted at /api/promo-tools).
 * @param {{ publicHost: string }} options
 * @returns {import("express").Router}
 */
export function createPromoToolsRouter({ publicHost }) {
  const router = Router();

  router.get("/health", (_req, res) => {
    const health = getPromoToolsHealth();
    res.status(health.ok ? 200 : 503).json(health);
  });

  router.get("/meta", (_req, res) => {
    res.json(getPromoToolsMeta());
  });

  router.use("/products", createProductsRouter({ publicHost }));
  router.use("/orders", createOrdersRouter());

  return router;
}
