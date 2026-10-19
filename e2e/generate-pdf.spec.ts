import { test } from "@playwright/test";
import path from "path";
import fs from "fs";

test("generate complete architecture PDF guide", async ({ page }) => {
  const htmlPath = path.resolve(__dirname, "../generate_pdf.html");
  const fileUrl = `file://${htmlPath.replace(/\\/g, "/")}`;

  await page.goto(fileUrl, { waitUntil: "networkidle" });

  const lab4PdfPath = path.resolve(__dirname, "../CPE334_Lab3_Lab4_Complete_Guide.pdf");
  const rootPdfPath = path.resolve(__dirname, "../../CPE334_Lab3_Lab4_Complete_Guide.pdf");

  await page.pdf({
    path: lab4PdfPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "15mm",
      bottom: "15mm",
      left: "12mm",
      right: "12mm",
    },
  });

  await page.pdf({
    path: rootPdfPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "15mm",
      bottom: "15mm",
      left: "12mm",
      right: "12mm",
    },
  });

  console.log("PDF created successfully at:", lab4PdfPath);
  console.log("PDF created successfully at:", rootPdfPath);
});
