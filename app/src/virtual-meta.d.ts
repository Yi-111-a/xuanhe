declare module 'virtual:tianbao-meta' {
  const meta: {
    names: Record<string, string>;
    kinds: Record<string, string>;
    events: Record<string, { title: string; kind: string; choices: boolean; bookkeeping: boolean; internal: boolean; illustration?: string }>;
    endings: Record<string, string>;
  };
  export default meta;
}
