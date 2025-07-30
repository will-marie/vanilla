/// <reference types="jest" />
import { exportCalendarToPDF, PDFExportOptions } from "@utils/pdfExport";
import { PDFDocument, PageSizes } from "pdf-lib";

// Helper function to get form field names from PDF bytes
async function getPdfFieldNames(pdfBytes: Uint8Array): Promise<string[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  return form.getFields().map((field) => field.getName());
}

// Create a minimal valid PNG buffer (1x1 pixel, black)
const mockPngBuffer = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe5, 0x27,
  0xde, 0x48, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60,
  0x82,
]);

describe("PDF Export Utils", () => {
  const mockOptions: PDFExportOptions = {
    year: 2025,
    selectedMonths: ["January", "February"],
    events: [
      { date: "2025-01-01", title: "New Year" },
      { date: "2025-02-14", title: "Valentine's Day" },
    ],
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a PDF document with correct size and structure", async () => {
    const result = await exportCalendarToPDF(mockOptions);
    const pdfDoc = await PDFDocument.load(result);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    const [expectedWidth, expectedHeight] = PageSizes.A3;
    expect(Math.abs(width - expectedWidth)).toBeLessThan(0.5);
    expect(Math.abs(height - expectedHeight)).toBeLessThan(0.5);
    expect(pdfDoc.getPages()).toHaveLength(1);

    const pdfBytes = await pdfDoc.save();
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });

  it("should handle background image loading by calling fetch", async () => {
    const options = {
      ...mockOptions,
      backgroundUrl: "data:image/png;base64,fake",
    };

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      Promise.resolve({
        arrayBuffer: () => Promise.resolve(mockPngBuffer.buffer),
      }) as unknown as Response
    );

    await exportCalendarToPDF(options);
    expect(fetchSpy).toHaveBeenCalledWith(options.backgroundUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("should generate PDF with all required content", async () => {
    // 1. Generate the PDF bytes
    const result = await exportCalendarToPDF(mockOptions);

    // 2. Parse the PDF and get field names
    const fieldNames = await getPdfFieldNames(result);

    // 3. Assert that the expected field names exist
    expect(fieldNames).toContain("2025");
    mockOptions.selectedMonths.forEach((month: string) => {
      expect(fieldNames).toContain(month);
    });
    mockOptions.events.forEach((event: { date: string; title: string }) => {
      expect(fieldNames).toContain(event.title);
    });
  });

  it("should handle different month and event selections", async () => {
    const options = {
      ...mockOptions,
      selectedMonths: ["March"],
      events: [{ date: "2025-03-15", title: "Special Test Event" }],
    };

    const result = await exportCalendarToPDF(options);

    // 2. Parse and get field names
    const fieldNames = await getPdfFieldNames(result);

    // 3. Assert on the contents
    expect(fieldNames).toContain("March");
    expect(fieldNames).toContain("Special Test Event");
    expect(fieldNames).not.toContain("January");
    expect(fieldNames).not.toContain("Valentine's Day");
  });
});
