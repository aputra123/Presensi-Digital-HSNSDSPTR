declare module 'mammoth' {
  const mammoth: {
    convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: any[] }>;
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: any[] }>;
    [key: string]: any;
  };
  export default mammoth;
}

declare module 'pdfjs-dist/build/pdf.mjs' {
  export const getDocument: any;
  export const GlobalWorkerOptions: any;
  export const version: string;
}
