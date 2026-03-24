export type PrintTemplate = {
  id: "2R" | "4R" | "4R_FULL" | "STRIP";
  label: string;
  width: number;
  height: number;
  dpi: number;
  fullBleed?: boolean;
};

export const PRINT_TEMPLATES: PrintTemplate[] = [
  {
    id: "4R",
    label: "4R (10 x 15 cm) – Standard",
    width: 1772,
    height: 1181,
    dpi: 300,
    fullBleed: false,
  },
  {
    id: "4R_FULL",
    label: "4R Full Photo (No Frame)",
    width: 1181,
    height: 1772,
    dpi: 300,
    fullBleed: true,
  },
  //   {
  //     id: "STRIP",
  //     label: "Photo Strip",
  //     width: 1240,
  //     height: 3600,
  //     dpi: 300,
  //   },
];

