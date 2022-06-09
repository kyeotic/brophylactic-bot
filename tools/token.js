"use strict";
exports.__esModule = true;
var di_ts_1 = require("../src/di.ts");
console.log(await (0, di_ts_1.initContext)().firebaseClient.getToken());
