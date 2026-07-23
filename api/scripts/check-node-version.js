const major = Number(process.versions.node.split(".")[0]);

if (major < 22) {
  console.error(
    `\n❌ API membutuhkan Node.js 22+ (promo-tools memakai node:sqlite).\n` +
      `   Versi sekarang: ${process.version}\n\n` +
      `   Jalankan:\n` +
      `     source ~/.nvm/nvm.sh && nvm use 22\n` +
      `     npm start\n`
  );
  process.exit(1);
}
