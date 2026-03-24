export type FaceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export async function detectFaces(
  img: HTMLImageElement
): Promise<FaceBox[]> {
  if (!("FaceDetector" in window)) return [];

  // @ts-ignore
  const detector = new window.FaceDetector({
    fastMode: true,
    maxDetectedFaces: 3,
  });

  const faces = await detector.detect(img);

  return faces.map((f: any) => ({
    x: f.boundingBox.x,
    y: f.boundingBox.y,
    w: f.boundingBox.width,
    h: f.boundingBox.height,
  }));
}
