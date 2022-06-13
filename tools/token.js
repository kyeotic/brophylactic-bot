"use strict";
exports.__esModule = true;
var di_js_1 = require("../src/di.js");
(0, di_js_1.initContext)()
    .firebaseClient.getToken()
    .then(function (t) { return console.log(t); });
