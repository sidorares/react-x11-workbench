// A module that fails at import time: discovery must diagnose it, not die.

throw new Error('boom at import time');

export const never = () => null;
