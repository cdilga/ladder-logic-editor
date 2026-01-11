/// <reference types="vite/client" />

// Type declarations for raw file imports
declare module '*.st?raw' {
  const content: string;
  export default content;
}

declare module '*?raw' {
  const content: string;
  export default content;
}
