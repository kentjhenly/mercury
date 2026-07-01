// pdf-parse ships no types. We only use the default export: a function that
// takes a Buffer and resolves with at least { text }.
declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: unknown): Promise<PdfParseResult>;
  export default pdfParse;
}
