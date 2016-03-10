var myWorker = new Worker("app/app.browser.js"),
    ui = require('./ui')(myWorker);
