// Off-contract on purpose: a default export is either the file's FileMeta
// object or its component. A string is neither, and must be diagnosed
// rather than silently dropped. The named export beside it stays a story.

export default 'not a story';

export const ok = () => null;
