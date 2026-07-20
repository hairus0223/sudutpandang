import { Router } from "express";
import multer from "multer";
import {
  addProductImage,
  createProduct,
  deleteProduct,
  deleteProductImage,
  getProductById,
  listProducts,
  updateProduct,
} from "../../services/promo-tools/product.service.js";

const IMAGE_MAX_BYTES = Number(process.env.PROMO_TOOLS_IMAGE_MAX_BYTES) || 8 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("invalid_file_type"));
  },
});

/**
 * @param {{ publicHost: string }} options
 */
export function createProductsRouter({ publicHost }) {
  const router = Router();

  router.get("/", (req, res) => {
    try {
      const products = listProducts(publicHost, {
        category: typeof req.query.category === "string" ? req.query.category : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
      });
      res.json({ ok: true, products, count: products.length });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get("/:id", (req, res) => {
    try {
      const product = getProductById(publicHost, req.params.id);
      if (!product) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      res.json({ ok: true, product });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/", (req, res) => {
    try {
      const product = createProduct(publicHost, req.body ?? {});
      res.status(201).json({ ok: true, product });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.put("/:id", (req, res) => {
    try {
      const product = updateProduct(publicHost, req.params.id, req.body ?? {});
      if (!product) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      res.json({ ok: true, product });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete("/:id", (req, res) => {
    try {
      const deleted = deleteProduct(req.params.id);
      if (!deleted) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post("/:id/images", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ ok: false, error: "file_required" });
        return;
      }

      const image = await addProductImage(publicHost, req.params.id, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        isPrimary:
          req.body?.isPrimary === "1" ||
          req.body?.isPrimary === "true" ||
          req.body?.isPrimary === true,
      });

      if (!image) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }

      const product = getProductById(publicHost, req.params.id);
      res.status(201).json({ ok: true, image, product });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete("/:id/images/:imageId", (req, res) => {
    try {
      const deleted = deleteProductImage(
        publicHost,
        req.params.id,
        req.params.imageId
      );
      if (!deleted) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      const product = getProductById(publicHost, req.params.id);
      res.json({ ok: true, product });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

/**
 * @param {import("express").Response} res
 * @param {unknown} err
 */
function sendError(res, err) {
  const message = err instanceof Error ? err.message : String(err);

  if (message === "invalid_name") {
    res.status(400).json({ ok: false, error: "invalid_name", message: "Nama produk wajib diisi." });
    return;
  }
  if (message === "invalid_category") {
    res.status(400).json({ ok: false, error: "invalid_category" });
    return;
  }
  if (message === "duplicate_sku") {
    res.status(409).json({ ok: false, error: "duplicate_sku", message: "SKU sudah dipakai produk lain." });
    return;
  }
  if (message === "invalid_file_type") {
    res.status(400).json({ ok: false, error: "invalid_file_type" });
    return;
  }
  if (message === "promo_tools_db_unavailable") {
    res.status(503).json({ ok: false, error: "db_unavailable" });
    return;
  }

  console.error("[promo-tools/products]", err);
  res.status(500).json({ ok: false, error: "internal_error" });
}
