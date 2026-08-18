// memo() returns an exotic object, not a function, so it would otherwise
// be read as this file's FileMeta and leave it silently empty.

import { memo } from 'react';

export default memo(() => null);
