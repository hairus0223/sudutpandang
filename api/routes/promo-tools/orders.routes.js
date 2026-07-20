import { Router } from "express";
import {
  createOrder,
  deleteOrder,
  generateOrderNumber,
  getOrderById,
  listOrders,
  peekOrderNumber,
  replaceAllOrders,
  updateOrder,
  updateOrderStatus,
} from "../../services/promo-tools/order.service.js";

export function createOrdersRouter() {
  const router = Router();

  router.get("/", (req, res) => {
    try {
      const orders = listOrders({
        status: typeof req.query.status === "string" ? req.query.status : undefined,
      });
      res.json({ ok: true, orders, count: orders.length });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/next-number", (_req, res) => {
    try {
      res.json({ ok: true, orderNumber: peekOrderNumber() });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/next-number/reserve", (_req, res) => {
    try {
      res.json({ ok: true, orderNumber: generateOrderNumber() });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/replace-all", (req, res) => {
    try {
      const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];
      replaceAllOrders(orders);
      res.json({ ok: true, count: orders.length });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/:id", (req, res) => {
    try {
      const order = getOrderById(req.params.id);
      if (!order) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      res.json({ ok: true, order });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/", (req, res) => {
    try {
      const order = createOrder(req.body ?? {});
      res.status(201).json({ ok: true, order });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.put("/:id", (req, res) => {
    try {
      const order = updateOrder(req.params.id, req.body ?? {});
      if (!order) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      res.json({ ok: true, order });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch("/:id/status", (req, res) => {
    try {
      const status = req.body?.status;
      if (!status) {
        res.status(400).json({ ok: false, error: "status_required" });
        return;
      }
      const order = updateOrderStatus(req.params.id, status);
      if (!order) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      res.json({ ok: true, order });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete("/:id", (req, res) => {
    try {
      const deleted = deleteOrder(req.params.id);
      if (!deleted) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

function sendError(res, err) {
  const message = err instanceof Error ? err.message : String(err);

  if (message === "invalid_status") {
    res.status(400).json({ ok: false, error: "invalid_status" });
    return;
  }
  if (message === "promo_tools_db_unavailable") {
    res.status(503).json({ ok: false, error: "db_unavailable" });
    return;
  }

  console.error("[promo-tools/orders]", err);
  res.status(500).json({ ok: false, error: "internal_error" });
}
