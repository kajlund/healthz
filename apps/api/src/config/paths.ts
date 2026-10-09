import { fileURLToPath } from "node:url";

export const projectDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
export const webDirectory = fileURLToPath(new URL("../../../web/dist/", import.meta.url));
