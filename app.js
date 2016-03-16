'use strict';
require("babel-register");
var logger = require('@hoist/logger');
var Server = require('./lib/server').default;
process.title = 'api.hoi.io';

var server = new Server();

process.on('message', function (msg) {
  if (msg === 'shutdown') {
    process.nextTick(function () {
      server.stop(function () {
        logger.info('server shutdown complete');
        process.exit(0);
      });
    });
    logger.info('server shutdown initiated');
  }
});


server.start();
logger.info('started');
