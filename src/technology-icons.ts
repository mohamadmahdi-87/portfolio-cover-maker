import {
  siAlpinedotjs,
  siBootstrap,
  siCss as siCss3,
  siFigma,
  siHtml5,
  siJavascript,
  siLaravel,
  siNextdotjs,
  siPhp,
  siReact,
  siTailwindcss,
  siTypescript,
  siVuedotjs,
  siWoocommerce,
  siWordpress,
  type SimpleIcon,
} from "simple-icons";
import { TECHNOLOGIES } from "./defaults";

const catalog: Record<string, SimpleIcon> = {
  siWordpress,
  siWoocommerce,
  siLaravel,
  siPhp,
  siHtml5,
  siCss3,
  siJavascript,
  siTypescript,
  siReact,
  siNextdotjs,
  siTailwindcss,
  siBootstrap,
  siFigma,
  siVuedotjs,
  siAlpinedotjs,
};

export const technologyCatalog = TECHNOLOGIES.map((technology) => ({
  ...technology,
  iconData: catalog[technology.icon],
}));

export const iconForTechnology = (id: string) =>
  technologyCatalog.find((item) => item.id === id);
