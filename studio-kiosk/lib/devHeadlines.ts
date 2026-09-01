export type DevHeadline = {
  filename: string;
  url: string;
};

/** Placeholder headlines for local dev when /api/headline is empty or unavailable. */
export const DEV_DUMMY_HEADLINES: DevHeadline[] = Array.from(
  { length: 12 },
  (_, index) => {
    const n = index + 1;
    return {
      filename: `dev-sample-${String(n).padStart(2, "0")}.jpg`,
      url: `https://picsum.photos/seed/sudutpandang-headline-${n}/800/1200`,
    };
  }
);

export const IS_DEV = process.env.NODE_ENV === "development";
