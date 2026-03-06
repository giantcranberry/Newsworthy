import { Font } from "@react-pdf/renderer";

const NUNITO_BASE =
  "https://cdn.jsdelivr.net/fontsource/fonts/nunito-sans@latest/latin";
const LORA_BASE =
  "https://cdn.jsdelivr.net/fontsource/fonts/lora@latest/latin";

Font.register({
  family: "Nunito Sans",
  fonts: [
    { src: `${NUNITO_BASE}-300-normal.ttf`, fontWeight: 300, fontStyle: "normal" },
    { src: `${NUNITO_BASE}-300-italic.ttf`, fontWeight: 300, fontStyle: "italic" },
    { src: `${NUNITO_BASE}-400-normal.ttf`, fontWeight: 400, fontStyle: "normal" },
    { src: `${NUNITO_BASE}-400-italic.ttf`, fontWeight: 400, fontStyle: "italic" },
    { src: `${NUNITO_BASE}-600-normal.ttf`, fontWeight: 600, fontStyle: "normal" },
    { src: `${NUNITO_BASE}-600-italic.ttf`, fontWeight: 600, fontStyle: "italic" },
    { src: `${NUNITO_BASE}-700-normal.ttf`, fontWeight: 700, fontStyle: "normal" },
    { src: `${NUNITO_BASE}-700-italic.ttf`, fontWeight: 700, fontStyle: "italic" },
  ],
});

Font.register({
  family: "Lora",
  fonts: [
    { src: `${LORA_BASE}-400-normal.ttf`, fontWeight: 400, fontStyle: "normal" },
    { src: `${LORA_BASE}-400-italic.ttf`, fontWeight: 400, fontStyle: "italic" },
    { src: `${LORA_BASE}-500-normal.ttf`, fontWeight: 500, fontStyle: "normal" },
    { src: `${LORA_BASE}-500-italic.ttf`, fontWeight: 500, fontStyle: "italic" },
    { src: `${LORA_BASE}-700-normal.ttf`, fontWeight: 700, fontStyle: "normal" },
    { src: `${LORA_BASE}-700-italic.ttf`, fontWeight: 700, fontStyle: "italic" },
  ],
});
