const path = require("path");

const root = path.resolve(__dirname, "..", "..");

module.exports = {
  apps: [
    {
      name: "sudutpandang-api",
      cwd: path.join(root, "api"),
      script: "server.js",
      time: true,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "sudutpandang",
      cwd: path.join(root, "studio-kiosk"),
      script: path.join(
        root,
        "studio-kiosk",
        "node_modules",
        "next",
        "dist",
        "bin",
        "next"
      ),
      args: "start -p 5173 -H 0.0.0.0",
      time: true,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
