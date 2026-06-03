// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const assert = require('node:assert');

const binding = require('../common').binding;

assert.strictEqual(typeof binding, 'object');
assert.strictEqual(binding.test, true);
